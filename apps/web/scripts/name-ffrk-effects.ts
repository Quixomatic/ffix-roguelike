#!/usr/bin/env bun
/// <reference types="node" />
/**
 * name-ffrk-effects — FFRK's own names for its ability effects, and the exact files each one plays.
 *
 * FFRK links an ability to its effect only in live battle data: each ability carries `options.ability_animation_id`,
 * and the payload's `assets` map lists the files per phase (`"ability-61762_hit": "/Content/lang/ab/ability/33077/hit.json"`).
 * File names vary (`<id>_hit.json`, `hit.json`, `hit_1.json`, `launch.json`, `shot.json`, `common/launch_black.json`…)
 * and the folder isn't always the effect id (magicite effects live in 33xxx folders). No public table exists; the only
 * captured payloads we know of are RK² (rk-squared) test data, markcerqueira/ff-record-keeper (2015 dumps) and
 * ffrk-proxy samples, cloned into `.refs/`. This collects every name and every phase path from all of their JSON and
 * writes `effects/catalog.json`: id → { names, phases: { "hit": "ab/ability/…json", "launch": …, "hit_2": …, "miss_hit": … } }.
 *
 *   bun scripts/name-ffrk-effects.ts
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SOURCES = ["rk-squared", "markcerqueira-ffrk", "ffrk-proxy"].map((d) => join(ROOT, ".refs", d));
const OUT = join(ROOT, ".docs", "assets", "FFRK-data", "_raw", "effects", "catalog.json");

export interface CatalogEntry {
  names: string[];
  /** Phase key ("launch", "shot", "hit", "hit_2", "miss_hit"…) → server path under `lang/` ("ab/ability/…json"). */
  phases: Record<string, string>;
}

const walkFiles = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).flatMap((f) => (f === ".git" || f === "node_modules" ? [] : statSync(join(d, f)).isDirectory() ? walkFiles(join(d, f)) : f.endsWith(".json") ? [join(d, f)] : [])) : [];

/** "/Content/lang/ww/compile/en/ab/ability/1/x.json" → "ab/ability/1/x.json" (the JP server has no ww/compile/en). */
const normal = (p: string) => p.replace(/^.*?\/lang\//, "").replace(/^ww\/compile\/[a-z]+\//, "");

const catalog = new Map<string, { names: Set<string>; phases: Map<string, string> }>();
const entry = (id: string) => {
  let e = catalog.get(id);
  if (!e) catalog.set(id, (e = { names: new Set(), phases: new Map() }));
  return e;
};

function visit(o: unknown) {
  if (Array.isArray(o)) return o.forEach(visit);
  if (!o || typeof o !== "object") return;
  const rec = o as Record<string, unknown>;
  const opts = rec.options as Record<string, unknown> | undefined;
  const id = opts && typeof opts === "object" && "ability_animation_id" in opts ? opts.ability_animation_id : "ability_animation_id" in rec ? rec.ability_animation_id : undefined;
  const name = opts?.name || opts?.alias_name || rec.name;
  if (id != null && String(id) !== "0" && typeof name === "string" && name.trim() && name !== "?") entry(String(id)).names.add(name.trim());
  for (const [k, v] of Object.entries(rec)) {
    const m = /^ability-(\d+)_(.+)$/.exec(k);
    const path = typeof v === "string" ? v : v && typeof v === "object" ? (v as { assetPath?: string }).assetPath : undefined;
    if (m && path && /\.json$/.test(path)) entry(m[1]!).phases.set(m[2]!, normal(path));
  }
  Object.values(rec).forEach(visit);
}

let files = 0;
for (const src of SOURCES)
  for (const f of walkFiles(src)) {
    try {
      const text = readFileSync(f, "utf8");
      if (!text.includes("ability_animation_id") && !text.includes('"ability-')) continue;
      visit(JSON.parse(text));
      files++;
    } catch {
      /* not JSON we can read */
    }
  }

const out: Record<string, CatalogEntry> = Object.fromEntries(
  [...catalog.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([id, e]) => [id, { names: [...e.names].sort(), phases: Object.fromEntries([...e.phases.entries()].sort()) }]),
);
writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
const named = Object.values(out).filter((e) => e.names.length).length;
const withFiles = Object.values(out).filter((e) => Object.keys(e.phases).length).length;
console.log(`✓ ${Object.keys(out).length} effects (${named} named, ${withFiles} with file paths) from ${files} captured payloads → ${OUT}`);
