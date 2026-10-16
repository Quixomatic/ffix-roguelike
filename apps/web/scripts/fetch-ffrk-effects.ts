#!/usr/bin/env bun
/// <reference types="node" />
/**
 * fetch-ffrk-effects — download FFRK's ability effects (spells, skills, enemy attacks, soul breaks, summons) from the
 * game's static server into `.docs/assets/FFRK-data/_raw/effects/` (git-ignored), mirroring the server layout.
 *
 * Effects are AnimationBuilder rigs in `lang/ab/ability/<folder>/<file>.json` (see `.docs/ffrk-assets.md`). File
 * names vary (`<n>_hit.json`, `hit.json`, `hit_1.json`, `launch.json`, `shot.json`, `back.json`…), so the stages are:
 *   1. catalog  — every exact path in `effects/catalog.json` (`ffrk:effect-names`, from captured game data)
 *   2. probe    — every folder id in [from, to) for `<n>_hit.json`, `hit.json`, `<n>_shot.json`
 *   3. variants — each folder found, for the other known file names
 *   4. crawl    — every file a rig uses (particles `pb_*.json`, `.sajson` frame animations, images + their atlas
 *                 `.json`, `ability/common/*`), recording each folder's effect art and sounds
 *   5. index    — `effects/index.json`: folder → { files, images, sounds }
 *   6. sounds   — `lang/se/se_ogg/<id>.ogg`: by default only for effects the game plays (assignments, weapon
 *                 attacks, monster defaults — `src/features/effects/effect-recipes.ts`)
 * Built on `lib/fetcher.ts`: parallel, timeouts + retries, disk cache and a remembered-missing list (re-runs are
 * fast), progress bars.
 *
 *   bun scripts/fetch-ffrk-effects.ts [from] [to] [--skip-probe] [--sounds used|all|none]
 *     defaults: 10000 100000, --sounds used. --skip-probe reuses the folders already in index.json.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { usedEffectPaths } from "../src/features/effects/effect-recipes";
import { Fetcher } from "./lib/fetcher";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw", "effects");
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? "") : undefined;
};
const [FROM = 10000, TO = 100000] = args.filter((a) => /^\d+$/.test(a)).map(Number);
const SKIP_PROBE = args.includes("--skip-probe");
const SOUNDS = (flag("--sounds") ?? "used") as "used" | "all" | "none";

const net = new Fetcher({ root: OUT, baseUrl: "https://dff.sp.mbga.jp/dff/static/lang/", concurrency: 24 });
const indexFile = join(OUT, "index.json");
type Entry = { files: string[]; images: string[]; sounds: string[] };
const previous: Record<string, Entry> = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : {};

/** Rig files found per folder. */
const folders = new Map<string, Set<string>>();
const addRig = (path: string) => {
  const m = /^ab\/ability\/([^/]+)\/([^/]+\.json)$/.exec(path);
  if (!m) return;
  const set = folders.get(m[1]!) ?? new Set();
  set.add(m[2]!);
  folders.set(m[1]!, set);
};
for (const [folder, e] of Object.entries(previous)) for (const f of e.files) addRig(`ab/ability/${folder}/${f}`);

// 1. catalog
const catalogFile = join(OUT, "catalog.json");
const catalog = existsSync(catalogFile) ? (JSON.parse(readFileSync(catalogFile, "utf8")) as Record<string, { phases: Record<string, string> }>) : {};
const catalogPaths = [...new Set(Object.values(catalog).flatMap((e) => Object.values(e.phases)))];
await net.run("catalog", catalogPaths, async (p) => {
  if (await net.get(p)) addRig(p);
});

// 2–3. probe and variants
if (!SKIP_PROBE) {
  const ids = Array.from({ length: TO - FROM }, (_, k) => FROM + k);
  const hits: number[] = [];
  await net.run("probe", ids, async (n) => {
    for (const f of [`${n}_hit.json`, "hit.json", `${n}_shot.json`])
      if (await net.get(`ab/ability/${n}/${f}`)) {
        hits.push(n);
        return;
      }
  });
  const variants = (n: number) => [`${n}_launch.json`, `${n}_shot.json`, `${n}_hit.json`, `${n}_hit_1.json`, "hit.json", "hit_1.json", "hit_2.json", "hit_3.json", "launch.json", "shot.json", "back.json", "land.json", "hit_miss.json", "magicite.json", "magicite_hit.json", "magicite_hit_1.json"];
  await net.run("variants", hits, async (n) => {
    for (const f of variants(n)) if (await net.get(`ab/ability/${n}/${f}`)) addRig(`ab/ability/${n}/${f}`);
  });
}

// 4. crawl. Each file's *own* references are cached (small); a folder's art/sounds are gathered by walking them.
const CONTENT = /(?:\/Content\/|\.\/)lang\/([A-Za-z0-9_./-]+\.(?:json|png|sajson))/g;
const SOUND = /"id"\s*:\s*"(se_[A-Za-z0-9_]+)"/g;
interface Refs {
  deps: string[];
  images: string[];
  sounds: string[];
}
const refs = new Map<string, Refs>();
async function refsOf(path: string): Promise<Refs> {
  const cached = refs.get(path);
  if (cached) return cached;
  const out: Refs = { deps: [], images: [], sounds: [] };
  refs.set(path, out);
  const data = await net.get(path);
  if (data && /\.(json|sajson)$/.test(path)) {
    const text = new TextDecoder().decode(data);
    for (const m of text.matchAll(CONTENT)) {
      const p = m[1]!.replace(/^ww\/compile\/[a-z]+\//, "").replace(/\/\/+/g, "/");
      out.deps.push(p);
      if (p.endsWith(".png")) {
        out.deps.push(p.replace(/\.png$/, ".json")); // its atlas (frame names), when it has one
        if (p.includes("/effect_image/")) out.images.push(p.split("/").pop()!.replace(/\.png$/, ""));
      }
    }
    for (const m of text.matchAll(SOUND)) out.sounds.push(m[1]!);
  }
  return out;
}
/** Everything reachable from some files: the art and sounds they use (fetching what's missing). */
async function reach(start: string[]) {
  const images = new Set<string>();
  const sounds = new Set<string>();
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length) {
    const p = queue.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    const r = await refsOf(p);
    r.images.forEach((i) => images.add(i));
    r.sounds.forEach((s) => sounds.add(s));
    queue.push(...r.deps);
  }
  return { images, sounds };
}
const index: Record<string, Entry> = {};
await net.run("crawl", [...folders.keys()], async (folder) => {
  const files = [...folders.get(folder)!].sort();
  const { images, sounds } = await reach(files.map((f) => `ab/ability/${folder}/${f}`));
  index[folder] = { files, images: [...images].sort(), sounds: [...sounds].sort() };
});

// 5. index
const byFolder = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
writeFileSync(indexFile, `${JSON.stringify(Object.fromEntries(Object.entries({ ...previous, ...index }).sort(([a], [b]) => byFolder(a, b))), null, 1)}\n`);

// 6. sounds
const wanted =
  SOUNDS === "none" ? new Set<string>() : SOUNDS === "all" ? new Set(Object.values(index).flatMap((e) => e.sounds)) : (await reach(usedEffectPaths())).sounds;
await net.run(`sounds (${SOUNDS})`, [...wanted], async (id) => {
  await net.get(`se/se_ogg/${id}.ogg`);
});

console.log(`✓ ${Object.keys(index).length} effect folders indexed, ${wanted.size} sounds; ${net.downloaded} files downloaded (${net.requests} requests) → ${OUT}`);
