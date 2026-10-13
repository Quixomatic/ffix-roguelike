/**
 * Overworld map generation — a Super Mario World–style path of stages from the start to the boss castle.
 * Columns run left→right; each column has 1–3 stages and paths branch/merge between neighbouring rows, so
 * the player picks a route. Early stages are plain battles; elites, shops and events appear deeper in; the
 * column before the castle is always a Moogle (rest + mail gear home).
 */
import type { Rng } from "../rng";

export type NodeKind = "start" | "battle" | "elite" | "treasure" | "shop" | "synth" | "stiltzkin" | "chocobo" | "moogle" | "event" | "boss";

export interface MapNode {
  id: string;
  col: number;
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
}

export const MAP_COLUMNS = 9;

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

export function generateWorldMap(rng: Rng, world: number): WorldMap {
  const last = MAP_COLUMNS - 1;
  const columns: MapNode[][] = [];
  for (let col = 0; col <= last; col++) {
    const count = col === 0 || col === last ? 1 : col === last - 1 ? rng.int(1, 2) : rng.int(2, 3);
    const rows = rng.shuffle([0, 1, 2]).slice(0, count).sort();
    const nodes = rows.map((row): MapNode => {
      const kind: NodeKind = col === 0 ? "start" : col === last ? "boss" : col === last - 1 ? "moogle" : pickKind(rng, col);
      const centred = count === 1 ? 1 : row;
      return {
        id: `w${world}c${col}r${row}`,
        col,
        row: centred,
        x: 6 + (col / last) * 88,
        y: 20 + centred * 30 + (col === 0 || col === last ? 0 : rng.int(-6, 6)),
        kind,
        next: [],
        depth: col / last,
      };
    });
    columns.push(nodes);
  }

  // Connect each column to the next: every node gets ≥1 exit, every next node gets ≥1 entrance,
  // and links only go to the nearest rows so paths don't cross wildly.
  for (let col = 0; col < last; col++) {
    const here = columns[col]!;
    const there = columns[col + 1]!;
    for (const a of here) {
      const sorted = [...there].sort((p, q) => Math.abs(p.row - a.row) - Math.abs(q.row - a.row));
      a.next.push(sorted[0]!.id);
      if (sorted[1] && Math.abs(sorted[1].row - a.row) <= 1 && rng.chance(45)) a.next.push(sorted[1].id);
    }
    for (const b of there) {
      if (here.some((a) => a.next.includes(b.id))) continue;
      const nearest = [...here].sort((p, q) => Math.abs(p.row - b.row) - Math.abs(q.row - b.row))[0]!;
      nearest.next.push(b.id);
    }
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
  return { world, nodes, startId: columns[0]![0]!.id, bossId: columns[last]![0]!.id };
}

export function getNode(map: WorldMap, id: string): MapNode {
  const n = map.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`No map node ${id}`);
  return n;
}
