/**
 * Presentation-only tile layout for the overworld: places the run's map nodes on a coarse tile grid and routes
 * every edge as an orthogonal (SMW-style) road with L-turns. Pure TS — no Phaser — so it can be rendered and
 * checked outside the browser. Nothing here feeds back into game-core: the map data stays exactly as generated.
 *
 * Lattice maps (every map generated since the fixed symmetrical shape — `WorldMap.lattice`) are laid out exactly:
 * each column's stages sit on their lanes around the middle line, and every link is a road that runs right, turns up
 * or down one lane at the middle of the gap, and runs right again (`buildLatticeLayout`). Stages that link to the same
 * column share that middle road, so routes branch and merge symmetrically, Pokelike-style, with SMW-style turns.
 *
 * Older saved maps (free rows and links) are routed one column gap at a time: each edge gets a few candidate shapes (a
 * Z through one of the lanes in the gap, or an L that leaves/arrives vertically) and the best combination is searched
 * exhaustively:
 *  - other stages (and a one-tile halo around them) are avoided, so roads never run through a stage;
 *  - edges that share a source or a target are encouraged to share road (branch/merge junctions);
 *  - unrelated roads may only cross at right angles, never run along each other or turn on each other.
 */
import type { MapNode, WorldMap } from "@ffix-roguelike/game-core";

/** World pixels per tile. */
export const TILE = 16;
/** Tiles between neighbouring columns. */
export const COL_STEP = 8;
/** Tiles between rows 0/1/2. */
export const ROW_STEP = 5;
/** Tiles left of the start / right of the castle. */
const MARGIN_X = 5;
/** Tile row of row 0. */
const TOP = 6;

export interface TilePoint {
  x: number;
  y: number;
}

export interface EdgeRoute {
  from: string;
  to: string;
  /** Every tile from the source stage to the target stage, inclusive, 4-connected. */
  tiles: TilePoint[];
  /** Just the endpoints and the turns: the straight runs to walk/draw, segment by segment. */
  corners: TilePoint[];
}

export interface MapLayout {
  /** Size in tiles. */
  cols: number;
  rows: number;
  nodes: Map<string, TilePoint>;
  routes: EdgeRoute[];
  route(from: string, to: string): EdgeRoute | undefined;
  /** The roads out of a stage as a branching tree (shared stretches merged; forks where they split). */
  branchesFrom(stage: string): Branch[];
}

export type Dir = "up" | "down" | "left" | "right";

/**
 * One stretch of road between decision points: from a stage or a fork to the next fork or a stage. Routes out of
 * the same stage that share tiles from the start are merged; where they split is a fork.
 */
export interface Branch {
  /** Tiles from the decision point it leaves (inclusive) to the fork/stage it ends at (inclusive). */
  tiles: TilePoint[];
  /** Direction of its first step out of the decision point. */
  dir: Dir;
  /** Every destination stage reachable along it. */
  stages: string[];
  /** The stage it ends at (leaf), if any. */
  to?: string;
  /** Branches out of the fork it ends at (empty for a leaf). */
  children: Branch[];
}

export function stepDir(a: TilePoint, b: TilePoint): Dir {
  return b.x > a.x ? "right" : b.x < a.x ? "left" : b.y > a.y ? "down" : "up";
}

export const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

/** Merge routes that leave the same stage into a branch tree (prefix-sharing tiles become one road). */
export function buildBranches(routes: EdgeRoute[], start = 0): Branch[] {
  const groups = new Map<string, EdgeRoute[]>();
  for (const r of routes) {
    const t = r.tiles[start + 1];
    if (!t) continue;
    const k = `${t.x},${t.y}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()].map((group) => {
    let end = start + 1;
    for (;;) {
      const nxt = group[0]!.tiles[end + 1];
      if (!nxt || !group.every((r) => r.tiles[end + 1]?.x === nxt.x && r.tiles[end + 1]?.y === nxt.y)) break;
      end++;
    }
    const first = group[0]!;
    const tiles = first.tiles.slice(start, end + 1);
    const leaf = group.find((r) => r.tiles.length === end + 1);
    return {
      tiles,
      dir: stepDir(tiles[0]!, tiles[1]!),
      stages: group.map((r) => r.to),
      to: leaf?.to,
      children: leaf ? [] : buildBranches(group, end),
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Hashing (deterministic per-node nudges)

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}


// ---------------------------------------------------------------------------------------------------------------
// Node placement

function placeNode(n: MapNode, last: number): TilePoint {
  const ends = n.col === 0 || n.col === last;
  // game-core lays rows out at y = 20 + row·30 ± 6; keep that wobble as ±1 tile so roads get some jogs.
  const wobble = ends ? 0 : Math.max(-1, Math.min(1, Math.round((n.y - (20 + n.row * 30)) / 4)));
  const nudge = ends ? 0 : (hashString(n.id) % 3) - 1;
  return { x: MARGIN_X + n.col * COL_STEP + nudge, y: TOP + n.row * ROW_STEP + wobble };
}

// ---------------------------------------------------------------------------------------------------------------
// Routing

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** One candidate road: its tiles (stages excluded) with the axes each carries and whether it turns there. */
interface Raster {
  tiles: TilePoint[];
  /** key → bit 1 horizontal, bit 2 vertical, bit 4 turn. */
  cells: Map<number, number>;
  turns: number;
  shape: number;
}

interface Edge {
  from: string;
  to: string;
}

/** Tiles between neighbouring lanes on lattice maps (stages in one column are two lanes apart). */
const LANE_STEP = 3;

/** Tiles of a path through the given corner points (each step 4-connected). */
function tilesThrough(pts: TilePoint[]): TilePoint[] {
  const tiles: TilePoint[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = tiles[tiles.length - 1]!;
    const b = pts[i]!;
    const sx = Math.sign(b.x - a.x);
    const sy = Math.sign(b.y - a.y);
    for (let x = a.x + sx, y = a.y + sy; x !== b.x || y !== b.y; x += sx, y += sy) tiles.push({ x, y });
    if (a.x !== b.x || a.y !== b.y) tiles.push({ x: b.x, y: b.y });
  }
  return tiles;
}

/** The roads and their branch trees, from placed stages and routed edges. */
function finishLayout(cols: number, rows: number, nodes: Map<string, TilePoint>, routes: EdgeRoute[]): MapLayout {
  const routeIndex = new Map(routes.map((r) => [`${r.from}>${r.to}`, r]));
  const trees = new Map<string, Branch[]>();
  const branchesFrom = (stage: string) => {
    let t = trees.get(stage);
    if (!t) {
      t = buildBranches(routes.filter((r) => r.from === stage));
      trees.set(stage, t);
    }
    return t;
  };
  return { cols, rows, nodes, routes, route: (from, to) => routeIndex.get(`${from}>${to}`), branchesFrom };
}

/**
 * The fixed symmetrical layout: stages on their lanes (centred on the middle row), every link right → up/down at the
 * middle of the gap → right. Links into or out of the same lanes share the middle road, so each stage's two exits
 * fork at the middle of the gap and two entrances merge there.
 */
function buildLatticeLayout(map: WorldMap): MapLayout {
  const last = Math.max(...map.nodes.map((n) => n.col));
  const maxLane = Math.max(1, ...map.nodes.map((n) => Math.abs(n.row)));
  const middle = TOP + maxLane * LANE_STEP;
  const cols = MARGIN_X * 2 + last * COL_STEP + 1;
  const rows = middle * 2 + 1;
  const nodes = new Map<string, TilePoint>();
  for (const n of map.nodes) nodes.set(n.id, { x: MARGIN_X + n.col * COL_STEP, y: middle + n.row * LANE_STEP });
  const routes: EdgeRoute[] = [];
  for (const n of map.nodes) {
    const s = nodes.get(n.id)!;
    for (const to of n.next) {
      const t = nodes.get(to)!;
      const turn = s.x + Math.floor((t.x - s.x) / 2);
      const tiles = tilesThrough(s.y === t.y ? [s, t] : [s, { x: turn, y: s.y }, { x: turn, y: t.y }, t]);
      routes.push({ from: n.id, to, tiles, corners: routeCorners(tiles) });
    }
  }
  return finishLayout(cols, rows, nodes, routes);
}

export function buildMapLayout(map: WorldMap): MapLayout {
  if (map.lattice) return buildLatticeLayout(map);
  const last = Math.max(...map.nodes.map((n) => n.col));
  const cols = MARGIN_X * 2 + last * COL_STEP + 1;
  const rows = TOP * 2 + ROW_STEP * 2 + 1;
  const idx = (x: number, y: number) => y * cols + x;

  const nodes = new Map<string, TilePoint>();
  for (const n of map.nodes) nodes.set(n.id, placeNode(n, last));
  const nodeAt = new Map<number, string>();
  for (const [id, p] of nodes) nodeAt.set(idx(p.x, p.y), id);

  // Halo: tiles round a stage (and its label underneath) that other stages' roads should keep clear of.
  const halo = new Map<number, string[]>();
  for (const [id, p] of nodes) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const k = idx(p.x + dx, p.y + dy);
        halo.set(k, [...(halo.get(k) ?? []), id]);
      }
    }
  }

  const gaps: Edge[][] = Array.from({ length: last }, () => []);
  for (const n of map.nodes) for (const t of n.next) gaps[n.col]!.push({ from: n.id, to: t });

  const rasterize = (pts: TilePoint[], shape: number): Raster => {
    const tiles: TilePoint[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const a = tiles[tiles.length - 1]!;
      const b = pts[i]!;
      const sx = Math.sign(b.x - a.x);
      const sy = Math.sign(b.y - a.y);
      for (let x = a.x + sx, y = a.y + sy; ; x += sx, y += sy) {
        tiles.push({ x, y });
        if (x === b.x && y === b.y) break;
      }
    }
    const cells = new Map<number, number>();
    let turns = 0;
    for (let i = 1; i < tiles.length - 1; i++) {
      const a = tiles[i - 1]!;
      const p = tiles[i]!;
      const b = tiles[i + 1]!;
      const inAxis = a.y === p.y ? 1 : 2;
      const outAxis = b.y === p.y ? 1 : 2;
      const turn = inAxis !== outAxis;
      if (turn) turns++;
      cells.set(idx(p.x, p.y), inAxis | outAxis | (turn ? 4 : 0));
    }
    return { tiles, cells, turns, shape };
  };

  const isRelated = (e: Edge, f: Edge) => e.from === f.from || e.to === f.to;

  /** Cost of two roads sharing the map. */
  const pairCost = (p: Raster, e: Edge, q: Raster, f: Edge): number => {
    const related = isRelated(e, f);
    let cost = 0;
    for (const [k, a] of p.cells) {
      const b = q.cells.get(k);
      if (b === undefined) {
        if (!related) {
          // Parallel neighbours read as one fat road.
          const x = k % cols;
          const y = (k - x) / cols;
          for (let d = 0; d < 4; d++) if (q.cells.has(idx(x + DX[d]!, y + DY[d]!))) cost += 1;
        }
        continue;
      }
      if (related) cost += (a & b & 3) ? -0.5 : 4;
      else if ((a & b & 3) || ((a | b) & 4)) cost += 1000;
      else cost += 30;
    }
    return cost;
  };

  const unaryCost = (r: Raster, e: Edge): number => {
    let cost = r.turns * 2 + r.shape;
    for (const [k] of r.cells) {
      const other = nodeAt.get(k);
      if (other) return Infinity;
      for (const id of halo.get(k) ?? []) if (id !== e.from && id !== e.to) cost += 15;
      // Running over a stage's label (the tile below it).
      const above = nodeAt.get(k - cols);
      if (above) cost += above === e.from || above === e.to ? 3 : 15;
    }
    return cost;
  };

  const chosen: { edge: Edge; raster: Raster }[] = [];
  for (const gap of gaps) {
    // Straightest first: it only matters for the greedy fallback.
    gap.sort((a, b) => Math.abs(nodes.get(a.from)!.y - nodes.get(a.to)!.y) - Math.abs(nodes.get(b.from)!.y - nodes.get(b.to)!.y));
    const options = gap.map((e) => {
      const s = nodes.get(e.from)!;
      const t = nodes.get(e.to)!;
      const list: Raster[] = [];
      if (s.y === t.y) list.push(rasterize([s, t], 0));
      else {
        const mid = (s.x + t.x) / 2;
        // Z: across, up/down at a lane in the gap, across.
        for (let lane = s.x + 2; lane <= t.x - 2; lane++) {
          list.push(rasterize([s, { x: lane, y: s.y }, { x: lane, y: t.y }, t], Math.abs(lane - mid) * 0.4));
        }
        // L: leave the stage vertically, or arrive vertically.
        list.push(rasterize([s, { x: s.x, y: t.y }, t], 3));
        list.push(rasterize([s, { x: t.x, y: s.y }, t], 3));
        // Staircase through the middle row: lets two roads that swap rows (an X) cross exactly once.
        if (Math.abs(s.y - t.y) >= 3) {
          const ym = Math.round((s.y + t.y) / 2);
          for (let l1 = s.x + 2; l1 <= t.x - 4; l1++) {
            for (let l2 = l1 + 2; l2 <= t.x - 2; l2++) {
              list.push(rasterize([s, { x: l1, y: s.y }, { x: l1, y: ym }, { x: l2, y: ym }, { x: l2, y: t.y }, t], 2));
            }
          }
        }
      }
      const scored = list
        .map((r) => {
          let c = unaryCost(r, e);
          for (const prev of chosen) c += pairCost(r, e, prev.raster, prev.edge);
          return { r, c };
        })
        .filter((o) => Number.isFinite(o.c))
        .sort((a, b) => a.c - b.c)
        .slice(0, 10); // = OPT below
      // Something always has to exist; fall back to the plain Z through the middle.
      if (!scored.length) scored.push({ r: list[0]!, c: 0 });
      return scored;
    });

    // Exhaustive search over this gap's combinations (a handful of edges × ≤10 options).
    const pick = new Array<number>(gap.length).fill(0);
    let best = Infinity;
    let bestPick = pick.slice();
    // Every pair of options precomputed into a flat table: [i][a][j][b] → cost (OPT = max options per edge).
    const OPT = 10;
    const E = gap.length;
    const table = new Float64Array(E * OPT * E * OPT);
    for (let i = 0; i < E; i++)
      for (let a = 0; a < options[i]!.length; a++)
        for (let j = 0; j < i; j++)
          for (let b = 0; b < options[j]!.length; b++)
            table[((i * OPT + a) * E + j) * OPT + b] = pairCost(options[i]![a]!.r, gap[i]!, options[j]![b]!.r, gap[j]!);
    const pc = (i: number, a: number, j: number, b: number) => table[((i * OPT + a) * E + j) * OPT + b]!;
    // Lower bound for branch-and-bound: the cheapest option of every edge still to place (shared road can only
    // knock a little off, so this is near-admissible and keeps the search fast).
    const restMin = options.map((_, i) => options.slice(i).reduce((sum, o) => sum + Math.min(...o.map((x) => x.c)), 0) - 3 * (gap.length - i));
    restMin.push(0);
    const search = (i: number, acc: number) => {
      if (acc + restMin[i]! >= best) return;
      if (i === gap.length) {
        best = acc;
        bestPick = pick.slice();
        return;
      }
      for (let a = 0; a < options[i]!.length; a++) {
        let c = acc + options[i]![a]!.c;
        for (let j = 0; j < i; j++) c += pc(i, a, j, pick[j]!);
        pick[i] = a;
        search(i + 1, c);
      }
    };
    search(0, 0);
    gap.forEach((edge, i) => chosen.push({ edge, raster: options[i]![bestPick[i]!]!.r }));
  }

  const routes: EdgeRoute[] = chosen.map(({ edge, raster }) => ({ from: edge.from, to: edge.to, tiles: raster.tiles, corners: routeCorners(raster.tiles) }));
  return finishLayout(cols, rows, nodes, routes);
}

/** Corner points of a route (tile coordinates), for walking segment by segment. */
export function routeCorners(tiles: TilePoint[]): TilePoint[] {
  if (tiles.length <= 2) return tiles;
  const out: TilePoint[] = [tiles[0]!];
  for (let i = 1; i < tiles.length - 1; i++) {
    const a = tiles[i - 1]!;
    const b = tiles[i]!;
    const c = tiles[i + 1]!;
    if (b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y) out.push(b);
  }
  out.push(tiles[tiles.length - 1]!);
  return out;
}
