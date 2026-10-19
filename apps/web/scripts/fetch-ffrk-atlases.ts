#!/usr/bin/env bun
/// <reference types="node" />
/**
 * fetch-ffrk-atlases — download FFRK's own sprite data (sheet + TexturePacker atlas with named frames, and the
 * boss animation file) from the game's static server into `.docs/assets/FFRK-data/_raw/` (git-ignored), so
 * slicing can use real frame names ("base_chant_1", "base_fatal", "glass_idle" = Blind…) instead of guesses.
 *
 *   bun scripts/fetch-ffrk-atlases.ts [characters|bosses|enemies|weapons|icons]…   (default: all)
 *   bun scripts/fetch-ffrk-atlases.ts icons --all-realms                          (icons for every realm, not just IX)
 *
 * weapons: the battle sprites characters swing (`equip/weapon/<n>`, numbered from 100001, unnamed).
 * icons:   every relic's menu art (48/112/256 px) for the relics in the community "Enlir" database export
 *          (`.refs/enlir/relics.csv`), FF9's by default; writes `icons/relics.json` (id → name/type/slot/realm).
 *
 * IDs are <group digit><2-digit series><3-digit number> (e.g. 109001 = an FF9 party sheet, 209001 = an FF9 boss).
 * Each 1000-block is probed from 001; a block with nothing in its first PROBE ids is skipped, and a block ends
 * after MISS_STREAK misses in a row. Built on lib/fetcher.ts: already-downloaded files and known misses are skipped (re-runs
 * are fast), requests time out and retry, and each kind shows a progress bar.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Fetcher, Progress } from "./lib/fetcher";

const HOST = "https://dff.sp.mbga.jp/dff/static/lang/ab/character";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw");
const SERIES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "27", "50", "51", "60", "70", "90"];
const PROBE = 25;
const MISS_STREAK = 60;
const MAX_IN_BLOCK = 999;
const CONCURRENCY = 6;

type Kind = "characters" | "bosses" | "enemies" | "weapons";
const files: Record<Kind, (id: number) => { name: string; url: string; required: boolean }[]> = {
  characters: (id) => [
    { name: `${id}.png`, url: `${HOST}/player/sab/${id}/img_chara.png`, required: true },
    { name: `${id}.json`, url: `${HOST}/player/sab/${id}/img_chara.json`, required: false },
  ],
  bosses: (id) => [
    { name: `${id}.png`, url: `${HOST}/boss/${id}/img_${id}.png`, required: true },
    { name: `${id}.json`, url: `${HOST}/boss/${id}/img_${id}.json`, required: false },
    { name: `${id}.anim.json`, url: `${HOST}/boss/${id}/${id}_1.json`, required: false },
  ],
  enemies: (id) => [
    { name: `${id}.png`, url: `${HOST}/enemy/img_${id}.png`, required: true },
    { name: `${id}.json`, url: `${HOST}/enemy/img_${id}.json`, required: false },
  ],
  weapons: (id) => [
    { name: `${id}.png`, url: `${EQUIP}/weapon/${id}/img_${id}.png`, required: true },
    { name: `${id}.json`, url: `${EQUIP}/weapon/${id}/img_${id}.json`, required: false },
  ],
};
const EQUIP = "https://dff.sp.mbga.jp/dff/static/lang/ab/equip";
const IMAGE = "https://dff.sp.mbga.jp/dff/static/lang/image";
const ENLIR_RELICS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".refs", "enlir", "relics.csv");

/** One fetcher per asset kind (disk cache, remembered misses, timeouts/retries — see lib/fetcher.ts). */
const nets: Partial<Record<Kind | "icons" | "effects", Fetcher>> = {};
const netFor = (kind: Kind | "icons") =>
  (nets[kind] ??= new Fetcher({ root: join(OUT, kind), baseUrl: "", concurrency: CONCURRENCY, localPath: (name) => join(OUT, kind, name) }));

/** Download one id (its files, saved as `<kind>/<name>`); true if it exists. */
async function fetchId(kind: Kind, id: number): Promise<boolean> {
  const net = netFor(kind);
  const parts = files[kind](id);
  if (!(await net.get(parts[0]!.name, parts[0]!.url))) return false;
  for (const p of parts.slice(1)) await net.get(p.name, p.url);
  if (kind === "bosses") await fetchRigSheets(id);
  return true;
}

/** The local name of a boss rig's extra sheet: `<id>~img_<id>_1.png` (and `.json`). */
export const rigSheetName = (id: number | string, file: string) => `${id}~${file}`;

const remoteOf = (url: string) => url.replace(/^(?:\/Content\/|\.\/)lang\//, "https://dff.sp.mbga.jp/dff/static/lang/");
/** The effect library (`_raw/effects`, FFRK server paths), for the shared effect images boss particles use. */
const effectNet = () => (nets.effects ??= new Fetcher({ root: join(OUT, "effects"), baseUrl: "", concurrency: CONCURRENCY, localPath: (name) => join(OUT, "effects", name) }));

/**
 * A boss rig can draw from more than its main sheet: each image node names its own (`image.url`, e.g.
 * `img_209002_1.png` — Black Waltz 1's body, wings and arms). Fetch every extra sheet and its atlas the rig uses,
 * and its particle (`pb_*.json`) and frame-animation (`.sajson`) files — a death puff, smoke, water — saved the same
 * way (`<id>~<file>`), with the effect images those use (`ab/effect_image/…`, into the effect library).
 */
async function fetchRigSheets(id: number) {
  const rigPath = join(OUT, "bosses", `${id}.anim.json`);
  if (!existsSync(rigPath)) return;
  const urls = new Set<string>();
  const text = readFileSync(rigPath, "utf8");
  for (const m of text.matchAll(/"url"\s*:\s*"([^"]+\.png)"/g)) urls.add(m[1]!);
  const net = netFor("bosses");
  for (const url of urls) {
    const file = url.split("/").pop()!;
    if (file === `img_${id}.png` || !url.includes(`/boss/${id}/`)) continue;
    const remote = remoteOf(url);
    await net.get(rigSheetName(id, file), remote);
    await net.get(rigSheetName(id, file.replace(/\.png$/, ".json")), remote.replace(/\.png$/, ".json"));
  }
  const fx = new Set<string>();
  for (const m of text.matchAll(/"file"\s*:\s*"([^"]+\/boss\/\d+\/((?:pb_[^"/]+\.json)|(?:[^"/]+\.sajson)))"/g)) fx.add(m[1]!);
  for (const url of fx) {
    const name = rigSheetName(id, url.split("/").pop()!);
    if (!(await net.get(name, remoteOf(url)))) continue;
    const local = join(OUT, "bosses", name);
    if (!existsSync(local)) continue;
    for (const m of readFileSync(local, "utf8").matchAll(/(?:\/Content\/|\.\/)lang\/(ab\/effect_image\/[^"]+\.(?:png|json))/g)) await effectNet().get(m[1]!, remoteOf(`/Content/lang/${m[1]}`));
  }
}

async function crawlBlock(kind: Kind, base: number): Promise<number> {
  let found = 0;
  let misses = 0;
  // Probe the start of the block in parallel; an empty start means an unused block.
  const probe = await Promise.all(Array.from({ length: PROBE }, (_, i) => fetchId(kind, base + 1 + i)));
  found += probe.filter(Boolean).length;
  if (!found) return 0;
  const lastHit = probe.lastIndexOf(true);
  misses = PROBE - 1 - lastHit;
  for (let n = PROBE + 1; n <= MAX_IN_BLOCK && misses < MISS_STREAK; n += CONCURRENCY) {
    const ids = Array.from({ length: Math.min(CONCURRENCY, MAX_IN_BLOCK - n + 1) }, (_, i) => base + n + i);
    const hits = await Promise.all(ids.map((id) => fetchId(kind, id)));
    for (const h of hits) {
      if (h) {
        found++;
        misses = 0;
      } else misses++;
    }
  }
  return found;
}

/** Minimal CSV (quoted fields) → rows. */
function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n") row.push(cell), rows.push(row), (row = []), (cell = "");
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

async function fetchIcons(allRealms: boolean) {
  if (!existsSync(ENLIR_RELICS)) throw new Error(`no Enlir relics export at ${ENLIR_RELICS}`);
  const [head, ...rows] = csv(readFileSync(ENLIR_RELICS, "utf8"));
  const col = (n: string) => head!.indexOf(n);
  const relics = rows
    .map((r) => ({ id: r[col("ID")]!, slot: r[col("Slot")]!, type: r[col("Type")]!, name: r[col("Name")]!, realm: r[col("Synergy")]!, rarity: Number(r[col("Rarity")]) }))
    .filter((r) => /^\d+$/.test(r.id) && (allRealms || r.realm === "IX"));
  const dir = join(OUT, "icons");
  mkdirSync(dir, { recursive: true });
  const net = netFor("icons");
  await net.run("relic icons", relics, async (r) => {
    const rr = String(r.rarity).padStart(2, "0");
    for (const size of [48, 112, 256]) await net.get(`${r.id}_${size}.png`, `${IMAGE}/equipment/${r.id}/${r.id}_${rr}_${size}.png`);
  });
  const n = net.downloaded;
  writeFileSync(join(dir, "relics.json"), `${JSON.stringify(Object.fromEntries(relics.map(({ id, ...r }) => [id, r])), null, 1)}
`);
  console.log(`✓ icons: ${relics.length} relics, ${n} new images → ${dir}`);
}

const args = process.argv.slice(2);
const wanted = args.filter((a) => a in files || a === "icons");
const kinds = (wanted.length ? wanted : [...Object.keys(files), "icons"]) as (Kind | "icons")[];
for (const kind of kinds) {
  if (kind === "icons") {
    await fetchIcons(args.includes("--all-realms"));
    continue;
  }
  let total = 0;
  if (kind === "weapons") {
    // One sequential range from 100001, in 1000-blocks until a block is empty.
    for (let base = 100000; ; base += 1000) {
      const n = await crawlBlock(kind, base);
      if (!n) break;
      console.log(`${kind} ${base}: ${n}`);
      total += n;
    }
    console.log(`✓ ${kind}: ${total} sprites → ${join(OUT, kind)}`);
    continue;
  }
  const blocks = Array.from({ length: 9 }, (_, g) => SERIES.map((s) => (g + 1) * 100000 + Number(s) * 1000)).flat();
  const bar = new Progress(`${kind} blocks`, blocks.length);
  for (const base of blocks) {
    total += await crawlBlock(kind, base);
    bar.tick();
  }
  bar.done();
  console.log(`✓ ${kind}: ${total} sheets → ${join(OUT, kind)}`);
}
