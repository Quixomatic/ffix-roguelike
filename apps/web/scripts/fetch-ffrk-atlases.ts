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
 * after MISS_STREAK misses in a row. Already-downloaded ids are skipped, so the script can be re-run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  let n = 0;
  for (let i = 0; i < relics.length; i += CONCURRENCY)
    await Promise.all(
      relics.slice(i, i + CONCURRENCY).map(async (r) => {
        const rr = String(r.rarity).padStart(2, "0");
        for (const size of [48, 112, 256]) {
          const file = join(dir, `${r.id}_${size}.png`);
          if (existsSync(file)) continue;
          const data = await get(`${IMAGE}/equipment/${r.id}/${r.id}_${rr}_${size}.png`);
          if (data) writeFileSync(file, data), n++;
        }
      }),
    );
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
  for (let group = 1; group <= 9; group++)
    for (const s of SERIES) {
      const base = group * 100000 + Number(s) * 1000;
      const n = await crawlBlock(kind, base);
      if (n) console.log(`${kind} ${base}: ${n}`);
      total += n;
    }
  console.log(`✓ ${kind}: ${total} sheets → ${join(OUT, kind)}`);
}
