#!/usr/bin/env bun
/// <reference types="node" />
/**
 * seed-ability-effects — first pass of FF9 move → FFRK effect assignments (`src/features/effects/ability-effects.json`).
 *
 * Every FF9 move (party abilities "a:<id>", monster attacks "e:<index>") whose name is also an FFRK ability name in
 * `effects/catalog.json` gets that ability's recipe: the exact launch/shot/hit files FFRK played (captured game data),
 * or — for named effects without captured files — the hit file in the effect's own folder. Existing assignments
 * (made or corrected in the /effects gallery) are never overwritten. Run after `ffrk:effect-names` / `ffrk:effects`.
 *
 *   bun scripts/seed-ability-effects.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FX = join(ROOT, ".docs", "assets", "FFRK-data", "_raw", "effects");
const MAP_FILE = join(ROOT, "apps", "web", "src", "features", "effects", "ability-effects.json");
const SEED = join(ROOT, "packages", "db", "seed", "ff9");

type Catalog = Record<string, { names: string[]; phases: Record<string, string> }>;
type Index = Record<string, { files: string[] }>;
type EffectMap = { abilities: Record<string, { phases: Record<string, string>; from?: string }> };

const catalog = JSON.parse(readFileSync(join(FX, "catalog.json"), "utf8")) as Catalog;
const index = existsSync(join(FX, "index.json")) ? (JSON.parse(readFileSync(join(FX, "index.json"), "utf8")) as Index) : {};
const map = JSON.parse(readFileSync(MAP_FILE, "utf8")) as EffectMap;

/** FFRK name (lower case) → [id, recipe]; prefer entries with captured files, then the lowest id. */
const byName = new Map<string, { id: string; phases: Record<string, string>; exact: boolean }>();
for (const [id, e] of Object.entries(catalog).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const exact = Object.keys(e.phases).length > 0;
  const phases = exact ? e.phases : Object.fromEntries((index[id]?.files ?? []).filter((f) => /(^|_)hit\.json$/.test(f)).slice(0, 1).map((f) => ["hit", `ab/ability/${id}/${f}`]));
  if (!Object.keys(phases).length) continue;
  for (const n of e.names) {
    const k = n.trim().toLowerCase();
    const cur = byName.get(k);
    if (!cur || (exact && !cur.exact)) byName.set(k, { id, phases, exact });
  }
}

const actions = JSON.parse(readFileSync(join(SEED, "actions.json"), "utf8")) as { id: number; name: string }[];
const bestiary = JSON.parse(readFileSync(join(SEED, "bestiary.json"), "utf8")) as { actions: { uid: number; name: string }[] };
const moves = [...actions.map((a) => ({ key: `a:${a.id}`, name: a.name })), ...bestiary.actions.map((a) => ({ key: `e:${a.uid}`, name: a.name }))];

/** Names too generic to match by: plain attacks get their weapon's hit effect instead. */
const SKIP = new Set(["attack"]);

let added = 0;
for (const m of moves) {
  if (map.abilities[m.key] || !m.name || SKIP.has(m.name.trim().toLowerCase())) continue;
  const hit = byName.get(m.name.trim().toLowerCase());
  if (!hit) continue;
  map.abilities[m.key] = { phases: hit.phases, from: `${catalog[hit.id]!.names.join(" / ")} (FFRK ${hit.id}${hit.exact ? "" : ", hit only"})` };
  added++;
}
map.abilities = Object.fromEntries(Object.entries(map.abilities).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
writeFileSync(MAP_FILE, `${JSON.stringify(map, null, 2)}\n`);
console.log(`✓ ${added} moves assigned by FFRK name (${Object.keys(map.abilities).length} in all) → ${MAP_FILE}`);
