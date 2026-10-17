/**
 * Overworld map generation — a Super Mario World–style path of stages from the start to the boss castle.
 *
 * Every map has the same shape, like Pokelike's: columns run left→right with a fixed number of stages each
 * (`MAP_SHAPE`: start → 2 → 3 → 4 → 3 → 4 → 3 → 2 → boss), centred on the map's middle line so the whole map is
 * symmetrical. Each stage links to the stages one step up and one step down in the next column (its "lanes" are one
 * apart), which makes a diamond lattice: every route branches and merges the same way, and the player picks a path
 * through it. Only what the stages *are* is random. Early stages are plain battles; elites, shops and events appear
 * deeper in; the column before the castle is always Moogles (rest + mail gear home).
 */
import { WORLDS } from "../content/worlds";
import type { Rng } from "../rng";

export type NodeKind = "start" | "battle" | "elite" | "semiboss" | "treasure" | "shop" | "synth" | "stiltzkin" | "chocobo" | "moogle" | "event" | "boss";

export interface MapNode {
  id: string;
  col: number;
  /**
   * Position in the column. Lattice maps (`WorldMap.lattice`): the lane, centred on 0 and two apart within a column
   * (a column of 4 has lanes −3, −1, 1, 3; of 3: −2, 0, 2), so linked stages are always one lane apart. Older maps:
   * row 0–2.
   */
  row: number;
  /** Layout position in map units (0–100 × 0–100). */
  x: number;
  y: number;
  kind: NodeKind;
  next: string[];
  /** 0 at the start, 1 at the boss — drives encounter difficulty. */
  depth: number;
}

export interface WorldMap {
  world: number;
  nodes: MapNode[];
  startId: string;
  bossId: string;
  /** Generated with the fixed symmetrical shape (`MAP_SHAPE`); saved maps from before it don't have this. */
  lattice?: boolean;
}

/** Stages per column, start to boss. Any column can be any size (1 included); the first and last must be 1. */
export const MAP_SHAPE = [1, 2, 3, 4, 3, 4, 3, 2, 1];
export const MAP_COLUMNS = MAP_SHAPE.length;
/** The column that becomes a single semi-boss fortress (every path crosses it) when the area has a semi-boss. */
export const SEMIBOSS_COLUMN = 4;

function pickKind(rng: Rng, col: number): NodeKind {
  if (col <= 2) return rng.weighted([
    { weight: 8, value: "battle" as NodeKind },
    { weight: col === 2 ? 2 : 0, value: "treasure" as NodeKind },
    { weight: col === 2 ? 1 : 0, value: "event" as NodeKind },
  ]);
  return rng.weighted([
    { weight: 6, value: "battle" as NodeKind },
    { weight: col >= 3 ? 2 : 0, value: "elite" as NodeKind },
    { weight: 1.5, value: "treasure" as NodeKind },
    { weight: 1.2, value: "shop" as NodeKind },
    { weight: 1, value: "synth" as NodeKind },
    { weight: col >= 3 ? 0.45 : 0, value: "stiltzkin" as NodeKind },
    { weight: 0.8, value: "chocobo" as NodeKind },
    { weight: 1.5, value: "event" as NodeKind },
    { weight: col === 4 ? 1.5 : 0.3, value: "moogle" as NodeKind },
  ]);
}

export function generateWorldMap(rng: Rng, world: number, shape: readonly number[] = MAP_SHAPE): WorldMap {
  const last = shape.length - 1;
  const maxLane = Math.max(...shape) - 1;
  const columns: MapNode[][] = [];
  for (let col = 0; col <= last; col++) {
    // The semi-boss column is a single fortress (every path passes it) when the area has one.
    const fortress = col === SEMIBOSS_COLUMN && !!WORLDS[world]?.semiBoss;
    const count = col === 0 || col === last || fortress ? 1 : Math.max(1, shape[col]!);
    const nodes = Array.from({ length: count }, (_, i): MapNode => {
      const kind: NodeKind = col === 0 ? "start" : col === last ? "boss" : fortress ? "semiboss" : col === last - 1 ? "moogle" : pickKind(rng, col);
      const lane = 2 * i - (count - 1);
      return {
        id: `w${world}c${col}r${i}`,
        col,
        row: lane,
        x: 6 + (col / last) * 88,
        y: 50 + (maxLane ? (lane / maxLane) * 35 : 0),
        kind,
        next: [],
        depth: col / last,
      };
    });
    columns.push(nodes);
  }

  // The lattice: each stage links to the stages one lane up and down in the next column (the same lane when the
  // columns are the same size). Columns whose sizes differ by more than one (a fortress) are joined by nearest lane,
  // so every stage still has a way in and a way out.
  for (let col = 0; col < last; col++) {
    const here = columns[col]!;
    const there = columns[col + 1]!;
    for (const a of here) for (const b of there) if (Math.abs(a.row - b.row) <= 1) a.next.push(b.id);
    const nearest = (list: MapNode[], lane: number) => [...list].sort((p, q) => Math.abs(p.row - lane) - Math.abs(q.row - lane))[0]!;
    for (const a of here) if (!a.next.length) a.next.push(nearest(there, a.row).id);
    for (const b of there) {
      if (here.some((a) => a.next.includes(b.id))) continue;
      nearest(here, b.row).next.push(b.id);
    }
    // Keep each stage's exits top to bottom.
    for (const a of here) a.next.sort((p, q) => there.find((n) => n.id === p)!.row - there.find((n) => n.id === q)!.row);
  }

  // No two elites back to back on the same path, and no shop right after a shop.
  const byId = new Map(columns.flat().map((n) => [n.id, n]));
  for (const n of columns.flat()) {
    for (const id of n.next) {
      const m = byId.get(id)!;
      if (["elite", "shop", "synth", "stiltzkin", "chocobo"].includes(n.kind) && m.kind === n.kind) m.kind = "battle";
    }
  }

  const nodes = columns.flat();
  return { world, nodes, startId: columns[0]![0]!.id, bossId: columns[last]![0]!.id, lattice: true };
}

export function getNode(map: WorldMap, id: string): MapNode {
  const n = map.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`No map node ${id}`);
  return n;
}
