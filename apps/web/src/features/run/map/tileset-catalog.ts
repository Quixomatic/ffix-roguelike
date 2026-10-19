/**
 * The overworld tileset: Super Retro World — Overworld (`.docs/assets/super-retro-world-overworld`, 16×16 tiles; credit
 * Gif @gif_not_jif, Noiracide @Noiracide, Romi @DessRomaric). Built by `pnpm -F web tiles:overworld`
 * (scripts/build-overworld-tiles.ts) from the pack's RPG Maker MZ sheets, which are exact 3× upscales of the 16px art:
 *
 *   sprites/overworld/terrain.png  every autotile below baked into a strip of its 47 shapes (map/autotile.ts), one
 *                                  strip per row in AUTOTILES order — tile index = row × AUTOTILE_SHAPE_COUNT + shape
 *   sprites/overworld/objects.png  the object sheet (MZ "B", tileset_0): buildings, castles, mountains — 16×16 tiles
 *
 * Both are extruded (every tile's edge pixels repeated 1px outward; margin 1, spacing 2) so tiles never bleed into
 * their neighbours when the camera scrolls or zooms.
 */

/** Tile size (px), and the extrusion the built sheets carry (Phaser `addTilesetImage` margin / spacing). */
export const OVERWORLD_TILE = 16;
export const TILESET_MARGIN = 1;
export const TILESET_SPACING = 2;
/** Shapes per autotile strip (map/autotile.ts `AUTOTILE_SHAPES`). */
export const AUTOTILE_SHAPE_COUNT = 47;
/** Tiles across the object sheet (MZ "B": 16×16). */
export const OBJECT_COLUMNS = 16;

/**
 * Autotiles: name, the MZ sheet it's from, and its 2×3 block's top-left tile there (native 16px tiles). A1 (water,
 * animated in RPG Maker: we use the first frame) and A2 (ground; its right half is forests and plants drawn over ground,
 * with see-through edges).
 */
export const AUTOTILES = [
  // A2, left half: ground
  { name: "grass", sheet: "A2", tx: 0, ty: 0 },
  { name: "grassLight", sheet: "A2", tx: 2, ty: 0 },
  { name: "grassDark", sheet: "A2", tx: 4, ty: 0 },
  { name: "grassDarker", sheet: "A2", tx: 6, ty: 0 },
  { name: "rockySand", sheet: "A2", tx: 0, ty: 3 },
  { name: "rocksOnGrass", sheet: "A2", tx: 4, ty: 3 },
  { name: "snow", sheet: "A2", tx: 0, ty: 6 },
  { name: "ice", sheet: "A2", tx: 2, ty: 6 },
  { name: "stone", sheet: "A2", tx: 4, ty: 6 },
  { name: "lava", sheet: "A2", tx: 6, ty: 6 },
  // A2, right half: forests and plants over ground
  { name: "forestDense", sheet: "A2", tx: 8, ty: 0 },
  { name: "forestGreen", sheet: "A2", tx: 10, ty: 0 },
  { name: "palms", sheet: "A2", tx: 12, ty: 0 },
  { name: "cactus", sheet: "A2", tx: 14, ty: 0 },
  { name: "forestAutumn", sheet: "A2", tx: 8, ty: 3 },
  { name: "forestRed", sheet: "A2", tx: 10, ty: 3 },
  { name: "pines", sheet: "A2", tx: 12, ty: 3 },
  { name: "pinesDead", sheet: "A2", tx: 14, ty: 3 },
  { name: "forestPurple", sheet: "A2", tx: 8, ty: 6 },
  { name: "forestPink", sheet: "A2", tx: 10, ty: 6 },
  { name: "pinesVolcanic", sheet: "A2", tx: 12, ty: 6 },
  { name: "pinesPurple", sheet: "A2", tx: 14, ty: 6 },
  { name: "forestBlue", sheet: "A2", tx: 8, ty: 9 },
  { name: "forestFrozen", sheet: "A2", tx: 10, ty: 9 },
  { name: "pinesFrozen", sheet: "A2", tx: 12, ty: 9 },
  { name: "pinesDark", sheet: "A2", tx: 14, ty: 9 },
  // A1: water (first animation frame)
  { name: "waterSand", sheet: "A1", tx: 0, ty: 0 },
  { name: "waterGrass", sheet: "A1", tx: 8, ty: 9 },
  { name: "poison", sheet: "A1", tx: 8, ty: 3 },
  { name: "lavaPool", sheet: "A1", tx: 8, ty: 6 },
  // Flat fill in the colour at A2 tile (tx, ty)'s first pixel: dirt, the sand the ground autotiles' edges sit on. Under the
  // whole map; the ground autotile leaves the roads out, so they show as dirt paths with natural edges.
  { name: "dirt", sheet: "flat", tx: 0, ty: 1 },
] as const;

export type AutotileName = (typeof AUTOTILES)[number]["name"];

/** An autotile's first tile index in terrain.png (add the shape, 0–46). */
export const autotileBase = (name: AutotileName): number => AUTOTILES.findIndex((a) => a.name === name) * AUTOTILE_SHAPE_COUNT;

/** A picture on the object sheet: its top-left tile (column, row) and size in tiles. */
export interface ObjectSprite {
  col: number;
  row: number;
  w: number;
  h: number;
}

/**
 * What stands just above each kind of stage on the overworld (the stage itself is a circle marker on the road), from
 * the object sheet. Kinds without one show just the marker.
 */
export const STAGE_SPRITES: Partial<Record<string, ObjectSprite>> = {
  start: { col: 3, row: 6, w: 1, h: 1 }, // signpost
  battle: { col: 8, row: 13, w: 1, h: 1 }, // red tent: a monster camp
  elite: { col: 10, row: 12, w: 1, h: 2 }, // tall stone tower
  shop: { col: 8, row: 1, w: 1, h: 1 }, // orange shop with a sign
  synth: { col: 8, row: 3, w: 1, h: 1 }, // blue shop with a sign
  stiltzkin: { col: 10, row: 5, w: 1, h: 1 }, // market stall
  chocobo: { col: 8, row: 12, w: 1, h: 1 }, // blue tent
  moogle: { col: 9, row: 2, w: 1, h: 1 }, // red-roofed house
  event: { col: 8, row: 14, w: 1, h: 1 }, // banner flag
  semiboss: { col: 8, row: 6, w: 2, h: 2 }, // grey fort
  boss: { col: 10, row: 8, w: 2, h: 2 }, // red castle
};
