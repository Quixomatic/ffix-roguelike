#!/usr/bin/env bun
/// <reference types="node" />
/**
 * fetch-ffrk-effects — download FFRK's ability effects (spells, skills, enemy attacks, soul breaks) from the game's
 * static server into `.docs/assets/FFRK-data/_raw/effects/` (git-ignored), mirroring the server layout.
 *
 * Effects live at `lang/ab/ability/<n>/<n>_{hit,launch,shot}.json` (AnimationBuilder rigs, see
 * `.docs/ffrk-assets.md`), n = the ability's `ability_animation_id` (its own 5-digit namespace, not the ability id).
 * Every id in [FROM, TO) is probed for `_hit`; ids that have one are checked for `_launch`/`_shot` too. Each rig is
 * then crawled: every `/Content/lang/ab/...` path it mentions (particle files `pb_*.json`, its own PNGs, shared
 * `effect_image/*` atlases and their `.json` frame lists, `ability/common/*`, `.sajson` frame animations) is fetched
 * and crawled in turn, and every `action_sound` id is
 * fetched from `lang/se/se_ogg/<id>.ogg`. Already-downloaded files are skipped (re-runnable).
 * Writes `effects/index.json`: id → { phases, images, sounds }.
 *
 *   bun scripts/fetch-ffrk-effects.ts [from] [to]     (default 10000 100000; index.json merges across runs)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STATIC = "https://dff.sp.mbga.jp/dff/static/lang";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw", "effects");
const CONCURRENCY = 16;
const PHASES = ["hit", "launch", "shot"] as const;

const [FROM = 10000, TO = 100000] = process.argv.slice(2).map(Number);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a server file; null when it doesn't exist. */
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

/** Local path for a server path under `lang/` (e.g. "ab/ability/30002/30002_hit.json"). */
const local = (path: string) => join(OUT, ...path.split("/"));

/** Fetch `lang/<path>` once (cached on disk); returns the bytes or null. */
async function fetchPath(path: string): Promise<Uint8Array | null> {
  const file = local(path);
  if (existsSync(file)) return new Uint8Array(readFileSync(file));
  const data = await get(`${STATIC}/${path}`);
  if (data) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
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

// 1. Which ids have effects.
const found = new Map<number, { phases: string[]; images: Set<string>; sounds: Set<string> }>();

/** Write `index.json`, merged with earlier runs over other id ranges. Called as the run goes, so the effects gallery
 * can browse what's downloaded so far. */
function writeIndex() {
  const file = join(OUT, "index.json");
  const previous = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  const merged = { ...previous, ...Object.fromEntries([...found.entries()].map(([id, f]) => [id, { phases: f.phases, images: [...f.images].sort(), sounds: [...f.sounds].sort() }])) };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(merged).sort((a, b) => Number(a[0]) - Number(b[0]))), null, 1)}\n`);
}
const ids = Array.from({ length: TO - FROM }, (_, k) => FROM + k);
let probed = 0;
await pool(ids, async (id) => {
  if (await fetchPath(`ab/ability/${id}/${id}_hit.json`)) found.set(id, { phases: ["hit"], images: new Set(), sounds: new Set() });
  if (++probed % 5000 === 0) {
    console.log(`probed ${probed}/${ids.length}, ${found.size} effects`);
    writeIndex();
  }
});
await pool([...found.keys()], async (id) => {
  for (const ph of PHASES.slice(1)) if (await fetchPath(`ab/ability/${id}/${id}_${ph}.json`)) found.get(id)!.phases.push(ph);
});
console.log(`${found.size} effects in ${FROM}–${TO - 1}`);

// 2. Crawl dependencies: every /Content/lang/... path, every sound id.
const seen = new Set<string>();
// "/Content/lang/ab/..." in rigs and particle files; "./lang/ab/..." in SpriteAnimationBuilder (.sajson) files.
const CONTENT = /(?:\/Content\/|\.\/)lang\/([A-Za-z0-9_./-]+\.(?:json|png|sajson))/g;
const SOUND = /"action_sound"[^}]*?"id"\s*:\s*"([A-Za-z0-9_]+)"|"id"\s*:\s*"(se_[A-Za-z0-9_]+)"/g;

async function crawl(path: string, owner: { images: Set<string>; sounds: Set<string> }) {
  const data = await fetchPath(path);
  if (!data || !/\.(json|sajson)$/.test(path)) return;
  const text = new TextDecoder().decode(data);
  const deps: string[] = [];
  for (const m of text.matchAll(CONTENT)) {
    const p = m[1]!.replace(/\/\/+/g, "/");
    if (p.includes("/effect_image/")) owner.images.add(p.split("/").pop()!.replace(/\.(json|png)$/, ""));
    deps.push(p);
    // An image's atlas (frame names used by particles and .sajson frames) sits next to it.
    if (p.endsWith(".png")) deps.push(p.replace(/\.png$/, ".json"));
  }
  for (const m of text.matchAll(SOUND)) owner.sounds.add((m[1] ?? m[2])!);
  for (const p of deps) {
    // Shared files are fetched once but still credited to every effect that uses them.
    const key = `${p}`;
    if (seen.has(key)) {
      if (/\.(json|sajson)$/.test(p)) await creditShared(p, owner);
      continue;
    }
    seen.add(key);
    await crawl(p, owner);
  }
}

/** A shared rig's images/sounds, for effects that reach it after the first crawl. */
const sharedCache = new Map<string, { images: Set<string>; sounds: Set<string> }>();
async function creditShared(path: string, owner: { images: Set<string>; sounds: Set<string> }) {
  let c = sharedCache.get(path);
  if (!c) {
    c = { images: new Set(), sounds: new Set() };
    sharedCache.set(path, c);
    const text = existsSync(local(path)) ? readFileSync(local(path), "utf8") : "";
    for (const m of text.matchAll(CONTENT)) if (m[1]!.includes("/effect_image/")) c.images.add(m[1]!.split("/").pop()!.replace(/\.(json|png)$/, ""));
    for (const m of text.matchAll(SOUND)) c.sounds.add((m[1] ?? m[2])!);
  }
  for (const i of c.images) owner.images.add(i);
  for (const s of c.sounds) owner.sounds.add(s);
}

let crawled = 0;
await pool([...found.entries()], async ([id, info]) => {
  for (const ph of info.phases) await crawl(`ab/ability/${id}/${id}_${ph}.json`, info);
  if (++crawled % 200 === 0) console.log(`crawled ${crawled}/${found.size}`);
});

// 3. Sounds.
const sounds = new Set([...found.values()].flatMap((f) => [...f.sounds]));
let gotSounds = 0;
await pool([...sounds], async (s) => {
  if (await fetchPath(`se/se_ogg/${s}.ogg`)) gotSounds++;
});

writeIndex();
console.log(`✓ ${found.size} effects, ${seen.size} dependency files, ${gotSounds}/${sounds.size} sounds → ${OUT}`);
