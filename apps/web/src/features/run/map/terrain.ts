/**
 * The overworld's scenery, procedurally from the map layout (pure TS: no Phaser): the area theme's ground everywhere,
 * then seeded patches of water and of forests / plants (autotiles from map/tileset-catalog.ts) that keep clear of every
 * stage and road (and a tile around them), so the roads and stages always read. The same map always gets the same
 * scenery (seeded by its stages).
 */
import type { MapTheme } from "@ffix-roguelike/game-core";

import { autotileShape, FULL_SHAPE, neighboursOf } from "./autotile";
import type { MapLayout } from "./layout";
import { autotileBase, type AutotileName } from "./tileset-catalog";

/**
 * What an area theme is made of: its ground; its water and how much of the free land it covers (0–1); its scenery
 * (autotiles, mixed into regions by weight) and how much of the rest of the free land that covers.
 */
interface ThemeTerrain {
  ground: AutotileName;
  water: { tile: AutotileName; cover: number };
  scenery: { cover: number; tiles: { tile: AutotileName; weight: number }[] };
}

/** Per area theme (content/worlds.ts `theme`; every one of `MAP_THEMES` has a row). */
export const THEME_TERRAIN: Record<string, ThemeTerrain> = {
  grassland: { ground: "grass", water: { tile: "waterGrass", cover: 0.07 }, scenery: { cover: 0.3, tiles: [{ tile: "forestGreen", weight: 3 }, { tile: "forestDense", weight: 1 }] } },
  forest: { ground: "grassDark", water: { tile: "waterGrass", cover: 0.04 }, scenery: { cover: 0.6, tiles: [{ tile: "forestDense", weight: 3 }, { tile: "pines", weight: 1 }] } },
  castle: { ground: "grass", water: { tile: "waterGrass", cover: 0.05 }, scenery: { cover: 0.25, tiles: [{ tile: "forestGreen", weight: 2 }, { tile: "forestAutumn", weight: 1 }] } },
  ice: { ground: "snow", water: { tile: "ice", cover: 0.08 }, scenery: { cover: 0.35, tiles: [{ tile: "pinesFrozen", weight: 2 }, { tile: "forestFrozen", weight: 1 }] } },
  cave: { ground: "stone", water: { tile: "lavaPool", cover: 0.05 }, scenery: { cover: 0.3, tiles: [{ tile: "pinesDark", weight: 2 }, { tile: "pinesDead", weight: 1 }] } },
  marsh: { ground: "grassDarker", water: { tile: "waterGrass", cover: 0.2 }, scenery: { cover: 0.3, tiles: [{ tile: "forestDense", weight: 2 }, { tile: "pinesDead", weight: 1 }] } },
  ruin: { ground: "rockySand", water: { tile: "waterSand", cover: 0.04 }, scenery: { cover: 0.22, tiles: [{ tile: "pinesDead", weight: 2 }, { tile: "cactus", weight: 1 }] } },
  // Plain sand with cactus stands, palm oases by a little water, and rock fields (rocky sand's edges are sand too).
  desert: { ground: "dirt", water: { tile: "waterSand", cover: 0.03 }, scenery: { cover: 0.25, tiles: [{ tile: "cactus", weight: 3 }, { tile: "rockySand", weight: 2 }, { tile: "palms", weight: 1 }] } },
  // Grey rock, lava pools, and the burning pines.
  volcano: { ground: "stone", water: { tile: "lavaPool", cover: 0.12 }, scenery: { cover: 0.35, tiles: [{ tile: "pinesVolcanic", weight: 3 }, { tile: "pinesDark", weight: 1 }] } },
  // Sea with sandy beaches over light grass, and palms.
  coast: { ground: "grassLight", water: { tile: "waterSand", cover: 0.35 }, scenery: { cover: 0.2, tiles: [{ tile: "palms", weight: 2 }, { tile: "forestGreen", weight: 1 }] } },
  // Tended land: light grass, ponds, orchards and autumn trees, thinly.
  town: { ground: "grassLight", water: { tile: "waterGrass", cover: 0.05 }, scenery: { cover: 0.18, tiles: [{ tile: "forestGreen", weight: 2 }, { tile: "forestAutumn", weight: 1 }, { tile: "forestPink", weight: 1 }] } },
  // Stone under ice-crystal spires (the frozen pines), blue and purple growth (no crystal tiles in the set: a stand-in).
  crystal: { ground: "stone", water: { tile: "ice", cover: 0.08 }, scenery: { cover: 0.4, tiles: [{ tile: "pinesFrozen", weight: 2 }, { tile: "forestBlue", weight: 1 }, { tile: "pinesPurple", weight: 1 }] } },
} satisfies Record<MapTheme, ThemeTerrain>;

/**
 * Smooth seeded value noise (0–1): random values on a lattice every `scale` tiles, blended smoothly between, plus a
 * finer octave for ragged edges.
 */
function valueNoise(random: () => number, w: number, h: number, scale: number): (x: number, y: number) => number {
  const octave = (s: number) => {
    const gw = Math.ceil(w / s) + 2;
    const gh = Math.ceil(h / s) + 2;
    const grid = Array.from({ length: gh }, () => Array.from({ length: gw }, random));
    const smooth = (t: number) => t * t * (3 - 2 * t);
    return (x: number, y: number) => {
      const gx = x / s;
      const gy = y / s;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = smooth(gx - x0);
      const ty = smooth(gy - y0);
      const v = (i: number, j: number) => grid[y0 + j]![x0 + i]!;
      return (v(0, 0) * (1 - tx) + v(1, 0) * tx) * (1 - ty) + (v(0, 1) * (1 - tx) + v(1, 1) * tx) * ty;
    };
  };
  const coarse = octave(scale);
  const fine = octave(Math.max(1.5, scale / 3));
  return (x, y) => coarse(x, y) * 0.75 + fine(x, y) * 0.25;
}

/** The value that `cover` (0–1) of `values` are above: so a theme's coverage is exact whatever the noise. */
function threshold(values: number[], cover: number) {
  if (!values.length || cover <= 0) return Infinity;
  const sorted = [...values].sort((a, b) => b - a);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * cover))]!;
}

export interface TerrainLayers {
  /** Tile indices into terrain.png, row-major `rows × cols`; -1 = empty. The theme's ground, everywhere. */
  ground: number[][];
  water: number[][];
  scenery: number[][];
}

/** A small seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string's hash (FNV-1a), for the seed. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Every tile's distance (4-way steps) from the nearest road or stage tile. */
function roadDistance(layout: MapLayout, w: number, h: number): number[][] {
  const dist = Array.from({ length: h }, () => Array<number>(w).fill(Infinity));
  const queue: [number, number][] = [];
  const seed = (x: number, y: number) => {
    if (dist[y]![x] === 0) return;
    dist[y]![x] = 0;
    queue.push([x, y]);
  };
  for (const r of layout.routes) for (const t of r.tiles) seed(t.x, t.y);
  for (const p of layout.nodes.values()) seed(p.x, p.y);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[ny]![nx]! <= dist[y]![x]! + 1) continue;
      dist[ny]![nx] = dist[y]![x]! + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** Build the terrain layers for a layout and area theme; `seed` keeps it the same each time (e.g. the map's stage ids). */
export function buildTerrain(layout: MapLayout, theme: string, seed: string): TerrainLayers {
  const cfg = THEME_TERRAIN[theme] ?? THEME_TERRAIN.grassland!;
  const { cols: w, rows: h } = layout;
  const random = rng(hash(`${theme}|${seed}`));

  // Keep clear: every stage (two tiles around it: room for its marker and label) and road (one tile around).
  const blocked: boolean[][] = Array.from({ length: h }, () => Array<boolean>(w).fill(false));
  const block = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (y + dy >= 0 && y + dy < h && x + dx >= 0 && x + dx < w) blocked[y + dy]![x + dx] = true;
  };
  for (const p of layout.nodes.values()) block(p.x, p.y, 2);
  for (const r of layout.routes) for (const t of r.tiles) block(t.x, t.y, 1);

  // Natural patches from smooth noise over the free land: water first (larger, rarer pools), then scenery over the rest,
  // its kinds mixed into regions by a slower noise. Coverage is a share of the free tiles (exact per theme).
  const taken: (AutotileName | null)[][] = Array.from({ length: h }, () => Array<AutotileName | null>(w).fill(null));
  const free: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!blocked[y]![x]) free.push([x, y]);
  // Away from the middle: each tile's distance (in tiles) from the nearest road, and a weight that keeps the route's
  // surroundings open — nothing within OPEN tiles, fading in over the next RAMP — so scenery gathers toward the edges.
  const dist = roadDistance(layout, w, h);
  const OPEN = 2;
  const RAMP = 6;
  const away = (x: number, y: number) => Math.min(1, Math.max(0, (dist[y]![x]! - OPEN) / RAMP));
  const waterNoise = valueNoise(random, w, h, 7);
  const wetness = (x: number, y: number) => waterNoise(x, y) * away(x, y);
  const wCut = threshold(free.map(([x, y]) => wetness(x, y)), cfg.water.cover);
  for (const [x, y] of free) if (wetness(x, y) >= wCut && wetness(x, y) > 0) taken[y]![x] = cfg.water.tile;
  const land = free.filter(([x, y]) => !taken[y]![x]);
  const treeNoise = valueNoise(random, w, h, 5);
  const kindNoise = valueNoise(random, w, h, 10);
  const growth = (x: number, y: number) => treeNoise(x, y) * away(x, y);
  const sCut = threshold(land.map(([x, y]) => growth(x, y)), cfg.scenery.cover);
  const total = cfg.scenery.tiles.reduce((n, t) => n + t.weight, 0);
  for (const [x, y] of land) {
    if (growth(x, y) < sCut || growth(x, y) <= 0) continue;
    let pick = kindNoise(x, y) * total;
    taken[y]![x] = (cfg.scenery.tiles.find((t) => (pick -= t.weight) < 0) ?? cfg.scenery.tiles[0]!).tile;
  }

  const empty = () => Array.from({ length: h }, () => Array<number>(w).fill(-1));
  const ground = Array.from({ length: h }, () => Array<number>(w).fill(autotileBase(cfg.ground) + FULL_SHAPE));
  const water = empty();
  const scenery = empty();
  const isWater = new Set([cfg.water.tile]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = taken[y]![x];
      if (!t) continue;
      // Each autotile's edges follow its own patch (off the map counts as more of it: no edge at the border).
      const shape = autotileShape(neighboursOf((nx, ny) => taken[ny]![nx] === t, x, y, w, h));
      (isWater.has(t) ? water : scenery)[y]![x] = autotileBase(t) + shape;
    }
  return { ground, water, scenery };
}
