#!/usr/bin/env bun
/// <reference types="node" />
/**
 * fetch-ffrk-effects — download FFRK's ability effects (spells, skills, enemy attacks, soul breaks, summons) from the
 * game's static server into `.docs/assets/FFRK-data/_raw/effects/` (git-ignored), mirroring the server layout.
 *
 * Effects are AnimationBuilder rigs in `lang/ab/ability/<folder>/<file>.json` (see `.docs/ffrk-assets.md`). File names
 * vary — `<n>_hit.json`, `hit.json`, `hit_1.json`, `launch.json`, `shot.json`, `back.json`… — so:
 *   1. every exact path in `effects/catalog.json` (`ffrk:effect-names`, from captured game data) is fetched;
 *   2. every folder id in [FROM, TO) is probed for `<n>_hit.json`, `hit.json` and `<n>_shot.json`; a folder with any
 *      of them is checked for the other known names;
 *   3. each rig is crawled: every `/Content/lang/ab/...` (or `./lang/ab/...`) path it mentions — particle files,
 *      `.sajson` frame animations, images and their atlas `.json`, `ability/common/*` — is fetched and crawled in turn;
 *      every `action_sound` id is fetched from `lang/se/se_ogg/<id>.ogg`.
 * Already-downloaded files are skipped (re-runnable; 404s are remembered in `.missing` so re-runs skip them too).
 * Writes `effects/index.json`: folder → { files, images, sounds } (merged across runs, saved as it goes).
 *
 *   bun scripts/fetch-ffrk-effects.ts [from] [to]     (default 10000 100000)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC = "https://dff.sp.mbga.jp/dff/static/lang";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw", "effects");
const CONCURRENCY = 24;
const PROBE = (n: number) => [`${n}_hit.json`, "hit.json", `${n}_shot.json`];
const MORE = (n: number) => [`${n}_launch.json`, `${n}_shot.json`, `${n}_hit.json`, `${n}_hit_1.json`, "hit.json", "hit_1.json", "hit_2.json", "hit_3.json", "launch.json", "shot.json", "back.json", "land.json", "hit_miss.json", "magicite.json", "magicite_hit.json", "magicite_hit_1.json"];

const [FROM = 10000, TO = 100000] = process.argv.slice(2).map(Number);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Known misses, so re-runs don't probe them again.
const MISSING = join(OUT, ".missing");
mkdirSync(OUT, { recursive: true });
const missing = new Set(existsSync(MISSING) ? readFileSync(MISSING, "utf8").split("\n").filter(Boolean) : []);

async function get(url: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      await sleep(800 * (attempt + 1));
    }
  }
  return null;
}

const local = (path: string) => join(OUT, ...path.split("/"));

/** Fetch `lang/<path>` once (cached on disk); null if the server doesn't have it. */
async function fetchPath(path: string): Promise<Uint8Array | null> {
  const file = local(path);
  if (existsSync(file)) return new Uint8Array(readFileSync(file));
  if (missing.has(path)) return null;
  const data = await get(`${STATIC}/${path}`);
  if (data) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
  } else {
    missing.add(path);
    appendFileSync(MISSING, `${path}\n`);
  }
  return data;
}

async function pool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

interface Folder {
  files: Set<string>;
  images: Set<string>;
  sounds: Set<string>;
}
const folders = new Map<string, Folder>();
const folderOf = (rigPath: string) => /ab\/ability\/([^/]+)\//.exec(rigPath)?.[1] ?? "?";
const addRig = (rigPath: string) => {
  const f = folderOf(rigPath);
  let e = folders.get(f);
  if (!e) folders.set(f, (e = { files: new Set(), images: new Set(), sounds: new Set() }));
  e.files.add(rigPath.split("/").pop()!);
};

function writeIndex() {
  const file = join(OUT, "index.json");
  const previous = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, { files?: string[] }>) : {};
  const merged: Record<string, unknown> = {};
  // Old-format entries (by effect id with "phases") are dropped; folders merge their file lists.
  for (const [k, v] of Object.entries(previous)) if (v.files) merged[k] = v;
  for (const [k, f] of folders) {
    const prev = (merged[k] as { files?: string[] } | undefined)?.files ?? [];
    merged[k] = { files: [...new Set([...prev, ...f.files])].sort(), images: [...f.images].sort(), sounds: [...f.sounds].sort() };
  }
  writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(merged).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))), null, 1)}\n`);
}

// 1. Exact paths from captured game data.
const catalogFile = join(OUT, "catalog.json");
const catalog = existsSync(catalogFile) ? (JSON.parse(readFileSync(catalogFile, "utf8")) as Record<string, { phases: Record<string, string> }>) : {};
const catalogPaths = [...new Set(Object.values(catalog).flatMap((e) => Object.values(e.phases)))];
await pool(catalogPaths, async (p) => {
  if (await fetchPath(p)) addRig(p);
});
console.log(`catalog: ${catalogPaths.length} paths, ${folders.size} folders`);

// 2. Probe folder ids.
const ids = Array.from({ length: TO - FROM }, (_, k) => FROM + k);
let probed = 0;
const hits: number[] = [];
await pool(ids, async (n) => {
  for (const f of PROBE(n))
    if (await fetchPath(`ab/ability/${n}/${f}`)) {
      hits.push(n);
      break;
    }
  if (++probed % 5000 === 0) {
    console.log(`probed ${probed}/${ids.length}, ${hits.length} folders`);
    writeIndex();
  }
});
await pool(hits, async (n) => {
  for (const f of MORE(n)) if (await fetchPath(`ab/ability/${n}/${f}`)) addRig(`ab/ability/${n}/${f}`);
});
console.log(`${hits.length} folders in ${FROM}–${TO - 1}`);

// 3. Crawl dependencies.
const seen = new Set<string>();
// "/Content/lang/ab/..." in rigs and particle files; "./lang/ab/..." in SpriteAnimationBuilder (.sajson) files.
const CONTENT = /(?:\/Content\/|\.\/)lang\/([A-Za-z0-9_./-]+\.(?:json|png|sajson))/g;
const SOUND = /"id"\s*:\s*"(se_[A-Za-z0-9_]+)"/g;

/** Files a rig/particle/sajson file references (images also bring their atlas). */
const depsOf = (text: string) =>
  [...text.matchAll(CONTENT)].flatMap((m) => {
    const p = m[1]!.replace(/^ww\/compile\/[a-z]+\//, "").replace(/\/\/+/g, "/");
    return p.endsWith(".png") ? [p, p.replace(/\.png$/, ".json")] : [p];
  });

/** Everything reachable from a file: images (effect_image names) and sounds, crawling as needed. */
const reach = new Map<string, Promise<{ images: Set<string>; sounds: Set<string> }>>();
function crawl(path: string): Promise<{ images: Set<string>; sounds: Set<string> }> {
  if (!reach.has(path))
    reach.set(
      path,
      (async () => {
        const out = { images: new Set<string>(), sounds: new Set<string>() };
        seen.add(path);
        const data = await fetchPath(path);
        if (!data || !/\.(json|sajson)$/.test(path)) return out;
        const text = new TextDecoder().decode(data);
        for (const m of text.matchAll(SOUND)) out.sounds.add(m[1]!);
        for (const p of depsOf(text)) {
          if (p.includes("/effect_image/") && p.endsWith(".png")) out.images.add(p.split("/").pop()!.replace(/\.png$/, ""));
          const sub = await crawl(p);
          sub.images.forEach((i) => out.images.add(i));
          sub.sounds.forEach((s) => out.sounds.add(s));
        }
        return out;
      })(),
    );
  return reach.get(path)!;
}

let crawled = 0;
await pool([...folders.entries()], async ([folder, f]) => {
  for (const file of f.files) {
    const r = await crawl(`ab/ability/${folder}/${file}`);
    r.images.forEach((i) => f.images.add(i));
    r.sounds.forEach((s) => f.sounds.add(s));
  }
  if (++crawled % 200 === 0) console.log(`crawled ${crawled}/${folders.size}`);
});

// 4. Sounds.
const sounds = new Set([...folders.values()].flatMap((f) => [...f.sounds]));
let gotSounds = 0;
await pool([...sounds], async (s) => {
  if (await fetchPath(`se/se_ogg/${s}.ogg`)) gotSounds++;
});

writeIndex();
console.log(`✓ ${folders.size} effect folders, ${seen.size} files crawled, ${gotSounds}/${sounds.size} sounds → ${OUT}`);
