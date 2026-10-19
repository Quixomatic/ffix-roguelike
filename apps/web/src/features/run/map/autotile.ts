/**
 * RPG Maker A1/A2-style autotiles (MV/MZ "floor" autotiles), pure TS so the tile builder (scripts/build-overworld-tiles.ts)
 * and the map scene share one definition.
 *
 * An autotile is a 2×3-tile source block, drawn per tile from four quarter-tiles (half a tile each way). Each quarter
 * is chosen from the block by the cell's neighbours on that corner: the two orthogonal ones and the diagonal between.
 * In quarter units (x 0–3, y 0–5) the block holds:
 *
 *   rows 0–1, x 0–1  a preview tile          rows 0–1, x 2–3  the four inner corners
 *   rows 2–5         a 2×2-tile framed patch: outer corners, edges and the plain middle
 *
 * The builder bakes every shape that can occur (47) into a strip per autotile, in `AUTOTILE_SHAPES` order; the scene
 * picks a cell's strip index with `autotileShape`.
 */

/** A quarter's look: an outer corner, a top/bottom edge, a left/right edge, an inner corner, or the plain middle. */
type QuarterKind = "outer" | "hEdge" | "vEdge" | "inner" | "full";
type Corner = "tl" | "tr" | "bl" | "br";

/** Where each quarter's pieces sit in the 2×3 block, in quarter units [x, y] (the MV/MZ floor autotile layout). */
export const QUARTER_SOURCE: Record<Corner, Record<QuarterKind, [number, number]>> = {
  tl: { outer: [0, 2], hEdge: [2, 2], vEdge: [0, 4], inner: [2, 0], full: [2, 4] },
  tr: { outer: [3, 2], hEdge: [1, 2], vEdge: [3, 4], inner: [3, 0], full: [1, 4] },
  bl: { outer: [0, 5], hEdge: [2, 5], vEdge: [0, 3], inner: [2, 1], full: [2, 3] },
  br: { outer: [3, 5], hEdge: [1, 5], vEdge: [3, 3], inner: [3, 1], full: [1, 3] },
};

/** Which neighbours share the terrain (true = same). */
export interface Neighbours {
  n: boolean;
  s: boolean;
  e: boolean;
  w: boolean;
  ne: boolean;
  nw: boolean;
  se: boolean;
  sw: boolean;
}

function kind(vertical: boolean, horizontal: boolean, diagonal: boolean): QuarterKind {
  if (!vertical && !horizontal) return "outer";
  if (!vertical) return "hEdge";
  if (!horizontal) return "vEdge";
  return diagonal ? "full" : "inner";
}

/** The four quarters' looks for a cell, as a key ("full,full,inner,full" — tl, tr, bl, br). */
export function quarterKinds(nb: Neighbours): [QuarterKind, QuarterKind, QuarterKind, QuarterKind] {
  return [kind(nb.n, nb.w, nb.nw), kind(nb.n, nb.e, nb.ne), kind(nb.s, nb.w, nb.sw), kind(nb.s, nb.e, nb.se)];
}

const keyOf = (k: QuarterKind[]) => k.join(",");

/** Every shape that can occur (47), in a fixed order: the strip order the builder bakes. */
export const AUTOTILE_SHAPES: QuarterKind[][] = (() => {
  const seen = new Map<string, QuarterKind[]>();
  for (let m = 0; m < 256; m++) {
    const b = (i: number) => (m & (1 << i)) !== 0;
    const k = quarterKinds({ n: b(0), s: b(1), e: b(2), w: b(3), ne: b(4), nw: b(5), se: b(6), sw: b(7) });
    seen.set(keyOf(k), k);
  }
  return [...seen.keys()].sort().map((k) => seen.get(k)!);
})();

const SHAPE_INDEX = new Map(AUTOTILE_SHAPES.map((k, i) => [keyOf(k), i]));

/** The strip index of a cell's shape. */
export const autotileShape = (nb: Neighbours): number => SHAPE_INDEX.get(keyOf(quarterKinds(nb)))!;

/** The plain-middle shape (a cell surrounded by its own terrain): what a filled area mostly is. */
export const FULL_SHAPE = autotileShape({ n: true, s: true, e: true, w: true, ne: true, nw: true, se: true, sw: true });

/** Neighbours of (x, y) in a grid by a predicate; off the grid counts as the same terrain (no edge at the map border). */
export function neighboursOf(same: (x: number, y: number) => boolean, x: number, y: number, w: number, h: number): Neighbours {
  const at = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx < 0 || ny < 0 || nx >= w || ny >= h ? true : same(nx, ny);
  };
  return { n: at(0, -1), s: at(0, 1), e: at(1, 0), w: at(-1, 0), ne: at(1, -1), nw: at(-1, -1), se: at(1, 1), sw: at(-1, 1) };
}
