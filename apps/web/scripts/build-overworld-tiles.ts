#!/usr/bin/env bun
/// <reference types="node" />
/**
 * tiles:overworld — the overworld tilesets from Super Retro World — Overworld (`.docs/assets/super-retro-world-overworld`,
 * git-ignored; credit Gif, Noiracide, Romi — see its LICENCE.txt) → `public/sprites/overworld/` (git-ignored, shipped in
 * the `overworld` asset pack):
 *
 *   terrain.png  each autotile in map/tileset-catalog.ts `AUTOTILES` baked into a row of its 47 shapes (map/autotile.ts)
 *   objects.png  the object sheet (MZ "B", tileset_0), as 16×16 tiles
 *
 * The pack's MZ sheets are exact 3× upscales of its 16px art, so they're scaled back down by taking one pixel per 3×3
 * block. Every tile is extruded (its edge pixels repeated 1px outward: margin 1, spacing 2), so tiles don't bleed.
 *
 *   bun scripts/build-overworld-tiles.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { AUTOTILE_SHAPES, QUARTER_SOURCE } from "../src/features/run/map/autotile";
import { AUTOTILES, OBJECT_COLUMNS, OVERWORLD_TILE as T, TILESET_MARGIN, TILESET_SPACING } from "../src/features/run/map/tileset-catalog";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", ".docs", "assets", "super-retro-world-overworld", "rpgmaker", "MZ", "tilesets");
const OUT = join(HERE, "..", "public", "sprites", "overworld");
const Q = T / 2;
const CORNERS = ["tl", "tr", "bl", "br"] as const;

/** A 3× sheet back at native size (one pixel per 3×3 block). */
function native(file: string): PNG {
  const big = PNG.sync.read(readFileSync(join(SRC, file)));
  const out = new PNG({ width: big.width / 3, height: big.height / 3 });
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const s = (y * 3 * big.width + x * 3) * 4;
      const d = (y * out.width + x) * 4;
      for (let k = 0; k < 4; k++) out.data[d + k] = big.data[s + k]!;
    }
  return out;
}

/** A sheet of `cols`×`rows` extruded tiles; `draw(col, row, put)` paints one 16×16 tile through `put(x, y, rgba)`. */
function extrudedSheet(cols: number, rows: number, draw: (col: number, row: number, put: (x: number, y: number, rgba: number[]) => void) => void): PNG {
  const step = T + TILESET_SPACING;
  const png = new PNG({ width: TILESET_MARGIN * 2 + cols * step - TILESET_SPACING, height: TILESET_MARGIN * 2 + rows * step - TILESET_SPACING });
  png.data.fill(0);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const ox = TILESET_MARGIN + c * step;
      const oy = TILESET_MARGIN + r * step;
      const put = (x: number, y: number, rgba: number[]) => {
        // The pixel, and its copies 1px outward where it's on the tile's edge (corners too).
        for (const dy of y === 0 ? [-1, 0] : y === T - 1 ? [0, 1] : [0])
          for (const dx of x === 0 ? [-1, 0] : x === T - 1 ? [0, 1] : [0]) {
            const i = ((oy + y + dy) * png.width + ox + x + dx) * 4;
            for (let k = 0; k < 4; k++) png.data[i + k] = rgba[k]!;
          }
      };
      draw(c, r, put);
    }
  return png;
}

const pixel = (png: PNG, x: number, y: number) => {
  const i = (y * png.width + x) * 4;
  return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!, png.data[i + 3]!];
};

const sheets = { A1: native("_srw_overworld_A1.png"), A2: native("_srw_overworld_A2.png") };
const objects = native("_srw_tileset_0.png");

// Terrain: one row per autotile, one column per shape; each tile is four quarters from the autotile's 2×3 block.
const terrain = extrudedSheet(AUTOTILE_SHAPES.length, AUTOTILES.length, (col, row, put) => {
  const a = AUTOTILES[row]!;
  if (a.sheet === "flat") {
    // A plain fill (dirt): every shape the same colour, from the A2 sheet.
    const rgba = pixel(sheets.A2, a.tx * T, a.ty * T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, rgba);
    return;
  }
  const src = sheets[a.sheet];
  const kinds = AUTOTILE_SHAPES[col]!;
  CORNERS.forEach((corner, i) => {
    const [qx, qy] = QUARTER_SOURCE[corner][kinds[i]!];
    const sx = a.tx * T + qx * Q;
    const sy = a.ty * T + qy * Q;
    const dx = (i % 2) * Q;
    const dy = Math.floor(i / 2) * Q;
    for (let y = 0; y < Q; y++) for (let x = 0; x < Q; x++) put(dx + x, dy + y, pixel(src, sx + x, sy + y));
  });
});

// Objects: the B sheet's 16×16 tiles, as they are.
const objectRows = objects.height / T;
const objectSheet = extrudedSheet(OBJECT_COLUMNS, objectRows, (col, row, put) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) put(x, y, pixel(objects, col * T + x, row * T + y));
});

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "terrain.png"), PNG.sync.write(terrain));
writeFileSync(join(OUT, "objects.png"), PNG.sync.write(objectSheet));
console.log(`✓ terrain.png: ${AUTOTILES.length} autotiles × ${AUTOTILE_SHAPES.length} shapes; objects.png: ${OBJECT_COLUMNS}×${objectRows} tiles → ${OUT}`);
