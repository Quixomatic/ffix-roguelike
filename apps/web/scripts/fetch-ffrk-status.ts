#!/usr/bin/env bun
/// <reference types="node" />
/**
 * fetch-ffrk-status — download FFRK's status looks from the game's static server into
 * `.docs/assets/FFRK-data/_raw/effects/` (git-ignored, the same mirror as the ability effects):
 *
 *   - **auras** — `ab/character/common/status_eff.json`: one AnimationBuilder rig whose tags are the looping status
 *     auras FFRK's client plays on a unit (`eff_light_haste`, `eff_light_slow`, `eff_light_protect`, `eff_light_shell`,
 *     `eff_light_reflect`, `eff_light_regene`, `eff_light_reraise`, `eff_violent` (rage)…; scenes/battle/view/
 *     StatusAilmentsView AURA_TAG), plus every particle file, frame animation and image it uses;
 *   - **special looks** — `special/status_eff_frozen.json` (Freeze), `status_eff_trance.json`, `status_eff_noroi.json`
 *     (curse), `status_eff_bg.json`;
 *   - **balloon icons** — `ab/battle/status_icon/<n>.png`, the bubble shown over a unit's head; n = FFRK status id − 199
 *     (200 Poison → 1, 201 Silence → 2, 202 Paralysis → 3, 203 Confuse → 4, 206 Stop → 7, 210 Blind → 11, 211 Sleep →
 *     12, 215 Berserk → 16…). Probed 1–80; missing ones are remembered.
 *   - their sounds (`se/se_ogg/<id>.ogg`).
 *
 *   bun scripts/fetch-ffrk-status.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Fetcher } from "./lib/fetcher";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw", "effects");
const net = new Fetcher({ root: OUT, baseUrl: "https://dff.sp.mbga.jp/dff/static/lang/", concurrency: 16 });

/** The status rigs the battle plays (see the header). */
export const STATUS_RIGS = [
  "ab/character/common/status_eff.json",
  "ab/character/common/status_eff_bg.json",
  "ab/character/common/special/status_eff_frozen.json",
  "ab/character/common/special/status_eff_trance.json",
  "ab/character/common/special/status_eff_noroi.json",
];

const CONTENT = /(?:\/Content\/|\.\/)lang\/([A-Za-z0-9_./-]+\.(?:json|png|sajson))/g;
const SOUND = /"id"\s*:\s*"(se_[A-Za-z0-9_]+)"/g;

// Everything reachable from the rigs: particles, frame animations, images and their atlases, sounds.
const seen = new Set<string>();
const sounds = new Set<string>();
let queue = [...STATUS_RIGS];
while (queue.length) {
  const batch = queue.filter((p) => !seen.has(p));
  batch.forEach((p) => seen.add(p));
  const next: string[] = [];
  await net.run(`crawl (${seen.size})`, batch, async (p) => {
    const data = await net.get(p);
    if (!data || !/\.(json|sajson)$/.test(p)) return;
    const text = new TextDecoder().decode(data);
    for (const m of text.matchAll(CONTENT)) {
      const dep = m[1]!.replace(/^ww\/compile\/[a-z]+\//, "").replace(/\/\/+/g, "/");
      next.push(dep);
      if (dep.endsWith(".png")) next.push(dep.replace(/\.png$/, ".json"));
    }
    for (const m of text.matchAll(SOUND)) sounds.add(m[1]!);
  });
  queue = next;
}

// Balloon icons.
const icons = Array.from({ length: 80 }, (_, i) => `ab/battle/status_icon/${i + 1}.png`);
let found = 0;
await net.run("balloon icons", icons, async (p) => {
  if (await net.get(p)) found++;
});

await net.run("sounds", [...sounds], async (id) => {
  await net.get(`se/se_ogg/${id}.ogg`);
});

console.log(`✓ ${seen.size} status files, ${found} balloon icons, ${sounds.size} sounds; ${net.downloaded} downloaded (${net.requests} requests) → ${OUT}`);
