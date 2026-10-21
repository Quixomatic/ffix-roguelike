/**
 * Overworld map generation — a Super Mario World–style path of stages from the start to the boss castle.
 *
 * Every map has the same shape, like Pokelike's: columns run left→right with a fixed number of stages each
 * (setting `map.defaultShape`: start → 2 → 3 → 4 → 3 → 4 → 3 → 2 → boss), centred on the map's middle line so the whole map is
 * symmetrical. Each stage links to the stages one step up and one step down in the next column (its "lanes" are one
 * apart), which makes a diamond lattice: every route branches and merges the same way, and the player picks a path
 * through it. Only what the stages *are* is random. Early stages are plain battles; elites, shops and events appear
 * deeper in; the column before the castle has one Moogle (rest + mail gear home) and the rest are other stages.
 */
import { setting, SETTINGS } from "@ffix-roguelike/game-data";

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
  /** Generated with a symmetrical lattice shape (`mapShapeOf`); saved maps from before it don't have this. */
  lattice?: boolean;
}

/**
 * Stages per round (column), start to boss — the default for every area (an area can set its own, `mapShape`). Any
 * round can have any number of stages, 1 included, as long as the shape is valid (`checkMapShape`).
 */
export const defaultMapShape = (): readonly number[] => {
  const shape = setting("map.defaultShape");
  // A shape that breaks the rules (`checkMapShape`) would fail every map: fall back to the built-in one.
  return checkMapShape(shape) ? SETTINGS["map.defaultShape"].default : shape;
};

/**
 * Why a map shape can't be used, or null when it's fine: the start and the boss are one stage each, every round has
 * at least one, and neighbouring rounds differ by at most one stage — so every stage links to the stages one lane up
 * and down (or straight across) and the lattice stays symmetrical. (A 4 only ever sits between 3s, 4s or 5s.)
 */
export function checkMapShape(shape: readonly number[]): string | null {
  if (shape.length < 2) return "a map needs at least a start and a boss";
  if (shape[0] !== 1 || shape[shape.length - 1] !== 1) return "the start and the boss are one stage each";
  for (let i = 0; i < shape.length; i++) {
    if (!Number.isInteger(shape[i]) || shape[i]! < 1) return `round ${i} needs a whole number of stages, at least 1`;
    if (i > 0 && Math.abs(shape[i]! - shape[i - 1]!) > 1) return `rounds ${i - 1} and ${i} differ by more than one stage (${shape[i - 1]} → ${shape[i]})`;
  }
  return null;
}

/** The shape an area's maps use. */
export const mapShapeOf = (world: number): readonly number[] => WORLDS[world]?.mapShape ?? defaultMapShape();

/**
 * What a stage is, by how far along the map it is (`last` = the boss's column). The first quarter is plain fights, with
 * treasure and events only at its end (setting `map.earlyWeights`); after that, the setting `map.weights`, with the
 * Moogle likelier in the middle round (`map.middleMoogleWeight`).
 */
function pickKind(rng: Rng, col: number, last: number, { noMoogle = false } = {}): NodeKind {
  const early = Math.round(last / 4);
  const middle = Math.floor(last / 2);
  const pick = (weights: Record<string, number>, weightOf: (kind: string, w: number) => number): NodeKind => {
    const options = Object.entries(weights).map(([kind, w]) => ({ weight: Math.max(0, weightOf(kind, w)), value: kind as NodeKind }));
    // Every weight zero (a setting turned everything off): a plain fight.
    return options.some((o) => o.weight > 0) ? rng.weighted(options) : "battle";
  };
  if (col <= early) return pick(setting("map.earlyWeights"), (kind, w) => (kind === "battle" || col === early ? w : 0));
  return pick(setting("map.weights"), (kind, w) => (kind !== "moogle" ? w : noMoogle ? 0 : col === middle ? setting("map.middleMoogleWeight") : w));
}

export function generateWorldMap(rng: Rng, world: number, shape: readonly number[] = mapShapeOf(world)): WorldMap {
  const problem = checkMapShape(shape);
  if (problem) throw new Error(`Map shape [${shape.join(", ")}]: ${problem}`);
  const last = shape.length - 1;
  const maxLane = Math.max(...shape) - 1;
  const columns: MapNode[][] = [];
  for (let col = 0; col <= last; col++) {
    // The middle column is a single fortress (every path passes it) when the area has a semi-boss; the rounds either
    // side join it by nearest lane.
    const fortress = col === Math.floor(last / 2) && last >= 4 && !!WORLDS[world]?.semiBoss;
    const count = col === 0 || col === last || fortress ? 1 : Math.max(1, shape[col]!);
    // The round before the castle: one Moogle (a rest before the boss), and its other stages something else, so going
    // in unrested for one more fight, shop or event is a choice.
    const moogleAt = col === last - 1 ? rng.int(0, count - 1) : -1;
    const nodes = Array.from({ length: count }, (_, i): MapNode => {
      const kind: NodeKind =
        col === 0 ? "start"
        : col === last ? "boss"
        : fortress ? "semiboss"
        : i === moogleAt ? "moogle"
        : col === last - 1 ? pickKind(rng, col, last, { noMoogle: true })
        : pickKind(rng, col, last);
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
