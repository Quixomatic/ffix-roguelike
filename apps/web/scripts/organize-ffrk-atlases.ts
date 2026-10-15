#!/usr/bin/env bun
/// <reference types="node" />
/**
 * organize-ffrk-atlases — lay the sheets downloaded by fetch-ffrk-atlases out like `.docs/assets/FFRK`.
 *
 * Every raw sheet (`FFRK-data/_raw/<kind>/<id>.png` + atlas `.json` [+ boss `.anim.json`]) is matched to the
 * Spriters Resource rip with the same pixels in the matching FFRK folder and copied to
 * `FFRK-data/<same folders>/<same name>.{png,json,anim.json}`, plus `<name>.id` with the FFRK id. Sheets with no
 * local twin go to `<Category>/<series>/_unmatched/<id>.*` (enemies: Spriters only has one combined sheet per game,
 * so they're all filed by series). Writes `FFRK-data/index.json` (id → path).
 *
 *   bun scripts/organize-ffrk-atlases.ts
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets");
const LOCAL = join(ASSETS, "FFRK");
const DATA = join(ASSETS, "FFRK-data");
const RAW = join(DATA, "_raw");

const CATEGORY = { characters: "Playable Characters (Full)", bosses: "Bosses", enemies: "Enemies" } as const;
type Kind = keyof typeof CATEGORY;

/** FFRK series code (id digits 2–3) → the rip's folder name. */
const SERIES: Record<string, string> = {
  ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(i + 1).padStart(2, "0"), `FF${i + 1}`])),
  "50": "FFT",
  "60": "FFT0",
  "90": "Core",
};
const seriesOf = (id: string) => SERIES[id.slice(1, 3)] ?? `series-${id.slice(1, 3)}`;

const walk = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.toLowerCase().endsWith(".png") ? [join(d, f)] : [])) : [];

const decode = (file: string): PNG | null => {
  try {
    return PNG.sync.read(readFileSync(file));
  } catch {
    return null;
  }
};

/** Fraction of the raw sheet's opaque pixels that the local image has at the same place with the same colour. */
function overlap(raw: PNG, local: PNG, sample?: number[]): number {
  if (local.width < raw.width || local.height < raw.height) return 0;
  const idx = sample ?? opaque(raw);
  let same = 0;
  for (const i of idx) {
    const x = i % raw.width;
    const y = Math.floor(i / raw.width);
    const r = i * 4;
    const l = (y * local.width + x) * 4;
    if (local.data[l + 3]! > 0 && Math.abs(local.data[l]! - raw.data[r]!) + Math.abs(local.data[l + 1]! - raw.data[r + 1]!) + Math.abs(local.data[l + 2]! - raw.data[r + 2]!) < 12) same++;
  }
  return idx.length ? same / idx.length : 0;
}
function opaque(p: PNG, limit = Infinity): number[] {
  const out: number[] = [];
  for (let i = 0; i < p.width * p.height && out.length < limit; i++) if (p.data[i * 4 + 3]! > 200) out.push(i);
  return out;
}

const index: Record<string, string> = {};
for (const kind of Object.keys(CATEGORY) as Kind[]) {
  const rawDir = join(RAW, kind);
  if (!existsSync(rawDir)) continue;
  const ids = readdirSync(rawDir).filter((f) => /^\d+\.png$/.test(f)).map((f) => f.slice(0, -4));
  const locals = kind === "enemies" ? [] : walk(join(LOCAL, CATEGORY[kind])).map((file) => ({ file, png: decode(file) })).filter((x) => x.png);
  const taken = new Set<string>();
  let matched = 0;
  for (const id of ids) {
    const raw = decode(join(rawDir, `${id}.png`));
    if (!raw) continue;
    const pts = opaque(raw);
    const sample = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 300)) === 0);
    // Same series folder first, then everything in the category.
    const series = seriesOf(id);
    const ordered = [...locals.filter((l) => basename(dirname(l.file)) === series), ...locals.filter((l) => basename(dirname(l.file)) !== series)];
    let best: { file: string; score: number } | null = null;
    for (const l of ordered) {
      if (taken.has(l.file)) continue;
      if (overlap(raw, l.png!, sample) < 0.9) continue;
      const score = overlap(raw, l.png!, pts);
      if (score >= 0.95 && (!best || score > best.score)) best = { file: l.file, score };
      if (best && best.score > 0.999) break;
    }
    let dest: string;
    if (best) {
      taken.add(best.file);
      matched++;
      dest = join(DATA, relative(LOCAL, best.file)).replace(/\.png$/i, "");
    } else dest = join(DATA, CATEGORY[kind], series, kind === "enemies" ? "" : "_unmatched", id);
    mkdirSync(dirname(dest), { recursive: true });
    for (const ext of [".png", ".json", ".anim.json"]) {
      const src = join(rawDir, id + ext);
      if (existsSync(src)) copyFileSync(src, dest + ext);
    }
    if (best) writeFileSync(`${dest}.id`, `${id}\n`);
    index[id] = relative(DATA, dest).replaceAll("\\", "/");
  }
  console.log(`${kind}: ${ids.length} sheets, ${matched} matched to the rips${kind === "enemies" ? " (enemies are filed by series)" : ""}`);
}
writeFileSync(join(DATA, "index.json"), `${JSON.stringify(index, null, 1)}\n`);
console.log(`✓ ${Object.keys(index).length} sheets laid out in ${DATA}`);
