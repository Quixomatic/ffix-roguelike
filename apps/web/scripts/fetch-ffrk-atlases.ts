#!/usr/bin/env bun
/// <reference types="node" />
/**
 * fetch-ffrk-atlases — download FFRK's own sprite data (sheet + TexturePacker atlas with named frames, and the
 * boss animation file) from the game's static server into `.docs/assets/FFRK-data/_raw/` (git-ignored), so
 * slicing can use real frame names ("base_chant_1", "base_fatal", "glass_idle" = Blind…) instead of guesses.
 *
 *   bun scripts/fetch-ffrk-atlases.ts [characters|bosses|enemies]…   (default: all three)
 *
 * IDs are <group digit><2-digit series><3-digit number> (e.g. 109001 = an FF9 party sheet, 209001 = an FF9 boss).
 * Each 1000-block is probed from 001; a block with nothing in its first PROBE ids is skipped, and a block ends
 * after MISS_STREAK misses in a row. Already-downloaded ids are skipped, so the script can be re-run.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "https://dff.sp.mbga.jp/dff/static/lang/ab/character";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw");
const SERIES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "27", "50", "51", "60", "70", "90"];
const PROBE = 25;
const MISS_STREAK = 60;
const MAX_IN_BLOCK = 999;
const CONCURRENCY = 6;

type Kind = "characters" | "bosses" | "enemies";
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
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/") && !type.includes("json")) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

/** Download one id; true if it exists. */
async function fetchId(kind: Kind, id: number): Promise<boolean> {
  const dir = join(OUT, kind);
  const parts = files[kind](id);
  if (existsSync(join(dir, parts[0]!.name))) return true;
  const sheet = await get(parts[0]!.url);
  if (!sheet) return false;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, parts[0]!.name), sheet);
  for (const p of parts.slice(1)) {
    const data = await get(p.url);
    if (data) writeFileSync(join(dir, p.name), data);
  }
  return true;
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

const kinds = (process.argv.slice(2).filter((a) => a in files) as Kind[]).length ? (process.argv.slice(2) as Kind[]) : (Object.keys(files) as Kind[]);
for (const kind of kinds) {
  let total = 0;
  for (let group = 1; group <= 9; group++)
    for (const s of SERIES) {
      const base = group * 100000 + Number(s) * 1000;
      const n = await crawlBlock(kind, base);
      if (n) console.log(`${kind} ${base}: ${n}`);
      total += n;
    }
  console.log(`✓ ${kind}: ${total} sheets → ${join(OUT, kind)}`);
}
