#!/usr/bin/env bun
/// <reference types="node" />
/**
 * build-badges — the achievement badge set (`.docs/assets/achievement-badges/Achivement Badge (n).png`, n = 1…1015,
 * git-ignored like the other bought packs) → one atlas for the game:
 *
 *   public/sprites/badges/badges.png   every badge centred in a CELL×CELL cell, COLS per row, in number order
 *   public/sprites/badges/badges.json  { cell, cols, count, badges: [{ id, w, h, name, tags, frame }] } — the names
 *                                      and search tags come from scripts/badge-catalog.json (the admin picker searches them)
 *
 * Badge n sits at cell n − 1, so drawing one needs only its number (web `features/hub/badge.tsx`).
 *
 *   bun scripts/build-badges.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BADGE_COUNT } from "@ffix-roguelike/game-data";
import { PNG } from "pngjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", ".docs", "assets", "achievement-badges");
const CATALOG = join(HERE, "badge-catalog.json");
const OUT = join(HERE, "..", "public", "sprites", "badges");
/** Cell size (the widest badges are 48 px) and cells per row. */
const CELL = 48;
const COLS = 32;

interface CatalogEntry {
  id: number;
  name: string;
  tags: string[];
  frame: "round" | "square" | "plain" | "pair";
}

const catalog = new Map<number, CatalogEntry>(existsSync(CATALOG) ? (JSON.parse(readFileSync(CATALOG, "utf8")) as CatalogEntry[]).map((e) => [e.id, e]) : []);
const rows = Math.ceil(BADGE_COUNT / COLS);
const atlas = new PNG({ width: COLS * CELL, height: rows * CELL });
const badges: (Partial<CatalogEntry> & { id: number; w: number; h: number })[] = [];
for (let id = 1; id <= BADGE_COUNT; id++) {
  const png = PNG.sync.read(readFileSync(join(SRC, `Achivement Badge (${id}).png`)));
  const w = Math.min(png.width, CELL);
  const h = Math.min(png.height, CELL);
  const i = id - 1;
  PNG.bitblt(png, atlas, 0, 0, w, h, (i % COLS) * CELL + Math.floor((CELL - w) / 2), Math.floor(i / COLS) * CELL + Math.floor((CELL - h) / 2));
  const c = catalog.get(id);
  badges.push({ id, w, h, ...(c ? { name: c.name, tags: c.tags, frame: c.frame } : {}) });
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "badges.png"), PNG.sync.write(atlas));
writeFileSync(join(OUT, "badges.json"), `${JSON.stringify({ cell: CELL, cols: COLS, count: BADGE_COUNT, badges })}\n`);
console.log(`✓ ${BADGE_COUNT} badges (${catalog.size} catalogued) → ${OUT}`);
