#!/usr/bin/env bun
/// <reference types="node" />
/**
 * name-ffrk-effects — put names on FFRK's numbered ability effects (`FFRK-data/_raw/effects/ab/ability/<id>`).
 *
 * FFRK links an ability to its effect only in live battle data: each ability's `options.ability_animation_id`.
 * No public table of these exists; the only captured payloads we know of are in RK² (rk-squared) test data
 * (party lists — every owned ability and soul break — gacha results, battles), markcerqueira/ff-record-keeper
 * (2015 battle dumps) and ffrk-proxy samples, cloned into `.refs/`. This collects every (name → animation id)
 * pair from all of their JSON and writes `effects/names.json`: id → names (several abilities can share one effect).
 *
 *   bun scripts/name-ffrk-effects.ts
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SOURCES = ["rk-squared", "markcerqueira-ffrk", "ffrk-proxy"].map((d) => join(ROOT, ".refs", d));
const OUT = join(ROOT, ".docs", "assets", "FFRK-data", "_raw", "effects", "names.json");

const walkFiles = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).flatMap((f) => (f === ".git" || f === "node_modules" ? [] : statSync(join(d, f)).isDirectory() ? walkFiles(join(d, f)) : f.endsWith(".json") ? [join(d, f)] : [])) : [];

const names = new Map<string, Set<string>>();
const add = (id: unknown, name: unknown) => {
  const n = typeof name === "string" ? name.trim() : "";
  if (id == null || !n || n === "?") return;
  const set = names.get(String(id)) ?? new Set<string>();
  set.add(n);
  names.set(String(id), set);
};

function visit(o: unknown) {
  if (Array.isArray(o)) return o.forEach(visit);
  if (!o || typeof o !== "object") return;
  const rec = o as Record<string, unknown>;
  const opts = rec.options as Record<string, unknown> | undefined;
  if (opts && typeof opts === "object" && "ability_animation_id" in opts) add(opts.ability_animation_id, opts.name || opts.alias_name || rec.name);
  else if ("ability_animation_id" in rec) add(rec.ability_animation_id, rec.name);
  Object.values(rec).forEach(visit);
}

let files = 0;
for (const src of SOURCES)
  for (const f of walkFiles(src)) {
    try {
      const text = readFileSync(f, "utf8");
      if (!text.includes("ability_animation_id")) continue;
      visit(JSON.parse(text));
      files++;
    } catch {
      /* not JSON we can read */
    }
  }
names.delete("0"); // "0" = the weapon's own attack effect, not a folder
const out = Object.fromEntries([...names.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([id, s]) => [id, [...s].sort()]));
writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(`✓ ${Object.keys(out).length} named effects from ${files} captured payloads → ${OUT}`);
