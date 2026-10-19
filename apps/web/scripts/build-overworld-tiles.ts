#!/usr/bin/env bun
/// <reference types="node" />
/**
 * tiles:overworld — the overworld tilesets from Super Retro World — Overworld (`.docs/assets/super-retro-world-overworld`,
 * git-ignored; credit Gif, Noiracide, Romi — see its LICENCE.txt) → `public/sprites/overworld/` (git-ignored, shipped in
 * the `overworld` asset pack):
 *
 *   terrain.png  each autotile in map/tileset-catalog.ts `AUTOTILES` baked into a row of its 47 shapes (map/autotile.ts),
 *                then a row of 16 narrow road tiles composed from the object sheet's path pieces (`ROAD_PIECES`)
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
import { AUTOTILES, OBJECT_COLUMNS, OVERWORLD_TILE as T, ROAD_PIECES, TILESET_MARGIN, TILESET_SPACING } from "../src/features/run/map/tileset-catalog";

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

// ── Roads: 16 connection tiles from the object sheet's path pieces (tileset-catalog `ROAD_PIECES`) ──
/** The pieces' grass (their most common colour), which becomes see-through: the road then sits on any ground. */
const grassKey = (() => {
  const counts = new Map<string, number>();
  const p = ROAD_PIECES.ns;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const k = pixel(objects, p.col * T + x, p.row * T + y).join(",");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
})();
type RoadPixel = { rgba: number[]; dirt: boolean } | null;
/** One piece's pixels: null for its grass, the rest split into dirt (the light path) and edging (everything else). */
function piece(key: keyof typeof ROAD_PIECES, flipY = false): RoadPixel[][] {
  const p = ROAD_PIECES[key];
  return Array.from({ length: T }, (_, y) =>
    Array.from({ length: T }, (_, x) => {
      const rgba = pixel(objects, p.col * T + x, p.row * T + (flipY ? T - 1 - y : y));
      if (rgba.join(",") === grassKey) return null;
      return { rgba, dirt: rgba[0]! > 180 };
    }),
  );
}
/** The road tile for a set of connected sides (ROAD_N | ROAD_E | ROAD_S | ROAD_W): see-through outside the path. */
function roadTile(mask: number): RoadPixel[][] {
  const sides = (["n", "e", "s", "w"] as const).filter((_, i) => mask & (1 << i));
  const parts: RoadPixel[][][] = [];
  if (sides.length === 1) parts.push(sides[0] === "s" ? piece("n", true) : piece(sides[0]!));
  for (let i = 0; i < sides.length; i++)
    for (let j = i + 1; j < sides.length; j++) {
      const pair = `${sides[i]}${sides[j]}`;
      parts.push(piece(({ ne: "ne", ns: "ns", nw: "nw", es: "es", ew: "ew", sw: "sw" } as const)[pair as "ne"]));
    }
  // Union: every part's edging, then every part's dirt over it (so the joins have no edging across the path).
  const out: RoadPixel[][] = Array.from({ length: T }, () => Array<RoadPixel>(T).fill(null));
  for (const pass of [false, true]) for (const part of parts) for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (part[y]![x] && part[y]![x]!.dirt === pass) out[y]![x] = part[y]![x];
  return out;
}

// Terrain: one row per autotile, one column per shape; each tile is four quarters from the autotile's 2×3 block. After
// them, one row of road tiles (the first 16 columns: every connection).
const terrain = extrudedSheet(AUTOTILE_SHAPES.length, AUTOTILES.length + 1, (col, row, put) => {
  if (row === AUTOTILES.length) {
    if (col >= 16) return;
    const tile = roadTile(col);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (tile[y]![x]) put(x, y, tile[y]![x]!.rgba);
    return;
  }
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
