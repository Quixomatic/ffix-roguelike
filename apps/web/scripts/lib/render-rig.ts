/// <reference types="node" />
/**
 * Software renderer for FFRK AnimationBuilder poses (`poseAt` in `src/features/sprites/ffrk-anim.ts`): draws a pose
 * from its sheet + atlas into a PNG with nearest-neighbour sampling. Used by build scripts for stills/previews.
 */
import { PNG } from "pngjs";

import { poseBounds, type DrawPart } from "../../src/features/sprites/ffrk-anim";

export interface Atlas {
  frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
}

/** Render `parts` (sheet `sheet`, atlas `atlas`) into a tightly cropped PNG; returns it and the rig-space origin within it. */
export function renderPose(parts: DrawPart[], sheet: PNG, atlas: Atlas, pad = 2): { png: PNG; originX: number; originY: number } {
  const b = poseBounds(parts);
  const ox = Math.floor(b.minX) - pad;
  const oy = Math.floor(b.minY) - pad;
  const W = Math.max(1, Math.ceil(b.maxX) + pad - ox);
  const H = Math.max(1, Math.ceil(b.maxY) + pad - oy);
  const out = new PNG({ width: W, height: H });
  for (const p of parts) {
    const fr = atlas.frames[p.packerid]?.frame;
    if (!fr) continue;
    const [a, bb, c, d, tx, ty] = p.m;
    const det = a * d - bb * c;
    if (Math.abs(det) < 1e-9) continue;
    // Inverse affine: rig space → image pixels.
    const ia = d / det;
    const ib = -bb / det;
    const ic = -c / det;
    const id = a / det;
    const corners = [
      [0, 0],
      [p.w, 0],
      [0, p.h],
      [p.w, p.h],
    ].map(([u, v]) => [a * u! + c * v! + tx, bb * u! + d * v! + ty]);
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((q) => q[0]!)) - ox));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(...corners.map((q) => q[0]!)) - ox));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((q) => q[1]!)) - oy));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...corners.map((q) => q[1]!)) - oy));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const X = x + ox + 0.5 - tx;
        const Y = y + oy + 0.5 - ty;
        const u = ia * X + ic * Y;
        const v = ib * X + id * Y;
        if (u < 0 || v < 0 || u >= p.w || v >= p.h) continue;
        // The atlas frame may be smaller/larger than the node's size: scale into it.
        const sx = fr.x + Math.min(fr.w - 1, Math.floor((u * fr.w) / p.w));
        const sy = fr.y + Math.min(fr.h - 1, Math.floor((v * fr.h) / p.h));
        const s = (sy * sheet.width + sx) * 4;
        const sa = (sheet.data[s + 3]! / 255) * p.alpha;
        if (sa <= 0) continue;
        const o = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) {
          const src = sheet.data[s + k]! * p.tint[k]!;
          out.data[o + k] = p.blend === "add" ? Math.min(255, out.data[o + k]! + src * sa) : Math.round(src * sa + out.data[o + k]! * (1 - sa));
        }
        out.data[o + 3] = p.blend === "add" ? out.data[o + 3]! : Math.round(255 * (sa + (out.data[o + 3]! / 255) * (1 - sa)));
      }
  }
  return { png: out, originX: -ox, originY: -oy };
}
