/**
 * FFRK "AnimationBuilder" rigs (cocos2d-x): boss animations (`character/boss/<id>/<id>_1.json`) and ability effects
 * share this format. A rig is a node tree; image nodes draw a frame of the sheet's atlas; keyframe curves animate
 * position, rotation, scale, alpha and colour on one shared timeline, and `tag` names frame ranges ("idle",
 * "attack", "damage", "dead_boss"…). See `.docs/ffrk-assets.md` §4.3.
 *
 * `poseAt(rig, frame)` evaluates the whole tree at a frame and returns what to draw, back to front, with each
 * image's corners in rig space (x right, y down, origin at the rig's root). Pure — no Phaser — so build scripts can
 * render stills with it and the battle scene can play it.
 */

export type Channel = "posX" | "posY" | "rotZ" | "scaleX" | "scaleY" | "alpha" | "red" | "green" | "blue";

interface Segment {
  type: "liner" | "spline";
  /** liner: [f0, v0, f1, v1]; spline: cubic Bézier [f0, v0, c1f, c1v, c2f, c2v, f1, v1]. */
  point: number[];
}

export interface RigNode {
  name: string;
  type: string | null;
  attrs?: {
    frame?: [number, number, number, number];
    anchor?: [number, number];
    rotation?: [number, number, number];
    scale?: [number, number];
    alpha?: number;
    color?: [number, number, number];
    visible?: boolean;
    blend?: "alpha" | "add";
    image?: { packerid?: string; url?: string; uvs?: [number, number, number, number] };
    anime?: Partial<Record<Channel, Segment[]>>;
  };
  children?: RigNode[];
}

export interface Rig {
  fps: number;
  tag: Record<string, [number, number, number]>;
  tree: RigNode[];
}

/** One image to draw: its atlas frame and where its corners land. */
export interface DrawPart {
  node: string;
  packerid: string;
  /** Local image size (pixels). */
  w: number;
  h: number;
  /** Affine transform from image pixels (0..w, 0..h, y down) to rig space: x' = a·x + c·y + tx, y' = b·x + d·y + ty. */
  m: [a: number, b: number, c: number, d: number, tx: number, ty: number];
  alpha: number;
  tint: [number, number, number];
  blend: "alpha" | "add";
}

/** Nodes never drawn as part of the character (anchors, effect slots, UI). */
const SKIP = /^(eff_nul|sight_nul|info_nul|gauge_nul|combo_count_nul|character_visible_touch)$/;

function bezierAt(p: number[], f: number): number {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p as [number, number, number, number, number, number, number, number];
  if (f <= x0) return y0;
  if (f >= x3) return y3;
  // x(t) is monotonic for keyframe curves: bisect for t.
  let lo = 0;
  let hi = 1;
  let t = 0.5;
  for (let i = 0; i < 30; i++) {
    t = (lo + hi) / 2;
    const u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    if (x < f) lo = t;
    else hi = t;
  }
  const u = 1 - t;
  return u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
}

/** A channel's value at `frame`: the covering segment, else the end of the last segment before it, else `base`. */
export function curveAt(segs: Segment[] | undefined, frame: number, base: number): number {
  if (!segs?.length) return base;
  let before: Segment | null = null;
  for (const s of segs) {
    const p = s.point;
    const f0 = p[0]!;
    const f1 = p[p.length - 2]!;
    if (frame >= f0 && frame <= f1) {
      if (s.type === "spline" && p.length >= 8) return bezierAt(p, frame);
      const v0 = p[1]!;
      const v1 = p[p.length - 1]!;
      return f1 === f0 ? v1 : v0 + ((v1 - v0) * (frame - f0)) / (f1 - f0);
    }
    if (f1 < frame && (!before || f1 >= before.point[before.point.length - 2]!)) before = s;
  }
  return before ? before.point[before.point.length - 1]! : base;
}

type M = [number, number, number, number, number, number];
const mul = (p: M, q: M): M => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];

/**
 * Evaluate the rig at `frame`. Coordinates are y-down; rotation is degrees counter-clockwise on screen; a node's
 * image is drawn with its anchor (a fraction of its size) at the node's position, and its children are placed
 * relative to that position. The root node (FFRK's stage placement: position (120, 210), scale 1.5) is left out,
 * so the origin is the character's own and the art is at its native pixel size. Verified against FFRK's own
 * composited boss stills (Plant Brain, Gizamaluke, Hades).
 */
export function poseAt(rig: Rig, frame: number): DrawPart[] {
  const out: DrawPart[] = [];
  const walk = (n: RigNode, parent: M, alpha: number, tint: [number, number, number], root: boolean) => {
    if (SKIP.test(n.name) || n.type === "collision" || n.type === "attractor" || n.type === "particle") return;
    const a = n.attrs ?? {};
    const an = a.anime ?? {};
    if (root) {
      // Starts hidden (the battle engine shows it); its transform is the stage placement.
      for (const ch of n.children ?? []) walk(ch, parent, alpha, tint, false);
      return;
    }
    // "*visible*" group nodes start hidden and are switched on by the battle engine; everything else obeys.
    if (a.visible === false && !/visible/.test(n.name)) return;
    const [fx, fy, w, h] = a.frame ?? [0, 0, 0, 0];
    const x = curveAt(an.posX, frame, fx);
    const y = curveAt(an.posY, frame, fy);
    const rot = (-curveAt(an.rotZ, frame, a.rotation?.[2] ?? 0) * Math.PI) / 180;
    const sx = curveAt(an.scaleX, frame, a.scale?.[0] ?? 1);
    const sy = curveAt(an.scaleY, frame, a.scale?.[1] ?? 1);
    const al = alpha * curveAt(an.alpha, frame, a.alpha ?? 1);
    const c = a.color ?? [1, 1, 1];
    const tn: [number, number, number] = [tint[0] * curveAt(an.red, frame, c[0]), tint[1] * curveAt(an.green, frame, c[1]), tint[2] * curveAt(an.blue, frame, c[2])];
    if (al <= 0.001) return;
    const [ax, ay] = a.anchor ?? [0, 0];
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const node = mul(parent, [cos * sx, sin * sx, -sin * sy, cos * sy, x, y]);
    const img = a.image;
    if (n.type === "image" && img?.packerid && w > 0 && h > 0)
      out.push({ node: n.name, packerid: img.packerid, w, h, m: mul(node, [1, 0, 0, 1, -ax * w, -ay * h]), alpha: al, tint: tn, blend: a.blend ?? "alpha" });
    for (const ch of n.children ?? []) walk(ch, node, al, tn, false);
  };
  for (const n of rig.tree) walk(n, [1, 0, 0, 1, 0, 0], 1, [1, 1, 1], true);
  return out;
}

/** Bounding box of a pose in rig space. */
export function poseBounds(parts: DrawPart[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of parts)
    for (const [u, v] of [
      [0, 0],
      [p.w, 0],
      [0, p.h],
      [p.w, p.h],
    ] as const) {
      const X = p.m[0] * u + p.m[2] * v + p.m[4];
      const Y = p.m[1] * u + p.m[3] * v + p.m[5];
      minX = Math.min(minX, X);
      maxX = Math.max(maxX, X);
      minY = Math.min(minY, Y);
      maxY = Math.max(maxY, Y);
    }
  return { minX, minY, maxX, maxY };
}
