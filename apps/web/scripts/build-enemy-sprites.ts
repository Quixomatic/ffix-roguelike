#!/usr/bin/env bun
/// <reference types="node" />
/**
 * build-enemy-sprites — monster sprites for battle from FFRK's own sheets (see `enemy-sprite-map.ts`).
 *
 * - FFRK enemy sheets → a 3-cell strip: base, white (hit flash), thunder (lightning palette).
 * - FFRK boss rigs (AnimationBuilder `.anim.json`) → rendered here, with the same evaluator the game uses
 *   (`src/features/sprites/ffrk-anim.ts`), into a frame grid: idle (loop), attack, damage, dead. The battle scene
 *   plays them as ordinary sprite animations.
 * - FFRK party sheets (story characters fought as enemies) → idle, white, damage cells, flipped to face right.
 *
 * Writes `public/sprites/enemies/<file>.png` and `src/features/sprites/enemy-sprites.gen.ts`.
 *
 *   bun scripts/build-enemy-sprites.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { poseAt, poseBounds, type DrawPart, type Rig } from "../src/features/sprites/ffrk-anim";
import { ENEMY_SPRITE_MAP } from "./enemy-sprite-map";
import { renderPose, type Atlas, type SheetLookup } from "./lib/render-rig";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = join(HERE, "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw");
const OUT_DIR = join(HERE, "..", "public", "sprites", "enemies");
const GEN = join(HERE, "..", "src", "features", "sprites", "enemy-sprites.gen.ts");

/** Boss animations rendered (rig tag → our name), every STEP-th rig frame (rigs run at 60 fps). */
const BOSS_ANIMS: { name: string; tags: string[]; repeat: boolean }[] = [
  { name: "idle", tags: ["idle"], repeat: true },
  { name: "attack", tags: ["attack"], repeat: false },
  { name: "damage", tags: ["damage"], repeat: false },
  { name: "dead", tags: ["dead"], repeat: false },
];
const STEP = 3;
const MAX_SHEET_W = 4096;

interface FrameRect {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

const readPng = (file: string) => PNG.sync.read(readFileSync(file));
const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

/** Copy an atlas frame into `out` at (dx, dy) in its untrimmed cell, optionally mirrored. */
function blitFrame(sheet: PNG, f: FrameRect, out: PNG, dx: number, dy: number, flip = false) {
  const cw = f.sourceSize.w;
  for (let y = 0; y < f.frame.h; y++)
    for (let x = 0; x < f.frame.w; x++) {
      const s = ((f.frame.y + y) * sheet.width + f.frame.x + x) * 4;
      if (!sheet.data[s + 3]) continue;
      const cx = f.spriteSourceSize.x + x;
      const ox = dx + (flip ? cw - 1 - cx : cx);
      const oy = dy + f.spriteSourceSize.y + y;
      const o = (oy * out.width + ox) * 4;
      sheet.data.copy(out.data, o, s, s + 4);
    }
}

/** A strip of named frames from one atlas, each in a cell the size of the largest untrimmed frame. */
function strip(sheet: PNG, atlas: Record<string, FrameRect>, names: string[], flip: boolean) {
  const frames = names.map((n) => atlas[n]).filter((f): f is FrameRect => !!f);
  const w = Math.max(...frames.map((f) => f.sourceSize.w));
  const h = Math.max(...frames.map((f) => f.sourceSize.h));
  const out = new PNG({ width: w * frames.length, height: h });
  frames.forEach((f, i) => blitFrame(sheet, f, out, i * w + Math.floor((w - f.sourceSize.w) / 2), h - f.sourceSize.h, flip));
  return { png: out, w, h, count: frames.length };
}

export interface GenInfo {
  url: string;
  /** Cell size. */
  w: number;
  h: number;
  /** Where the monster's feet/origin are within a cell (px). */
  originX: number;
  originY: number;
  anims: Record<string, { frames: number[]; fps: number; repeat: boolean }>;
  /** Single-frame looks: hit flash and lightning palette (enemy sheets). */
  white?: number;
  thunder?: number;
}

mkdirSync(OUT_DIR, { recursive: true });
const built = new Map<string, GenInfo>();
const out: Record<string, GenInfo & { src: string }> = {};

for (const [name, source] of Object.entries(ENEMY_SPRITE_MAP)) {
  const kind = "enemy" in source ? "enemy" : "boss" in source ? "boss" : "player";
  const id = "enemy" in source ? source.enemy : "boss" in source ? source.boss : source.player;
  const file = `${kind}-${id}`;
  let info = built.get(file);
  if (!info) {
    if (kind === "enemy") {
      const base = join(RAW, "enemies", String(id));
      if (!existsSync(`${base}.json`)) {
        console.warn(`skip ${name}: no enemy sheet ${id}`);
        continue;
      }
      const atlas = readJson<{ frames: Record<string, FrameRect> }>(`${base}.json`).frames;
      const s = strip(readPng(`${base}.png`), atlas, [`${id}_base.png`, `${id}_white.png`, `${id}_thunder.png`], false);
      writeFileSync(join(OUT_DIR, `${file}.png`), PNG.sync.write(s.png));
      info = { url: `/sprites/enemies/${file}.png`, w: s.w, h: s.h, originX: s.w / 2, originY: s.h, anims: { idle: { frames: [0], fps: 1, repeat: true } }, white: 1, thunder: s.count > 2 ? 2 : undefined };
    } else if (kind === "player") {
      const base = join(RAW, "characters", String(id));
      const atlas = readJson<{ frames: Record<string, FrameRect> }>(`${base}.json`).frames;
      const s = strip(readPng(`${base}.png`), atlas, ["base_idle.png", "base_idle_white.png", "base_damage.png", "base_left_arm_2.png", "base_dead.png"], true);
      writeFileSync(join(OUT_DIR, `${file}.png`), PNG.sync.write(s.png));
      info = {
        url: `/sprites/enemies/${file}.png`,
        w: s.w,
        h: s.h,
        originX: s.w / 2,
        originY: s.h,
        anims: { idle: { frames: [0], fps: 1, repeat: true }, damage: { frames: [2], fps: 1, repeat: false }, attack: { frames: [3], fps: 1, repeat: false }, dead: { frames: [4], fps: 1, repeat: false } },
        white: 1,
      };
    } else {
      const base = join(RAW, "bosses", String(id));
      if (!existsSync(`${base}.anim.json`)) {
        console.warn(`skip ${name}: no boss rig ${id}`);
        continue;
      }
      const rig = readJson<Rig>(`${base}.anim.json`);
      const main = { sheet: readPng(`${base}.png`), atlas: readJson<Atlas>(`${base}.json`) };
      // Each image node names its sheet; extra ones are fetched as `<id>~img_<id>_1.png` (fetch-ffrk-atlases).
      const sheets = new Map<string, { sheet: PNG; atlas: Atlas } | undefined>();
      const sheetOf: SheetLookup = (p) => {
        const file = p.url?.split("/").pop();
        if (!file || file === `img_${id}.png`) return main;
        // Only further body sheets (img_<id>_N.png); masks and overlays (img_mask_…) need FFRK's special blending.
        if (!new RegExp(`^img_${id}_\\d+\\.png$`).test(file)) return undefined;
        if (!sheets.has(file)) {
          const extra = join(RAW, "bosses", `${id}~${file}`);
          sheets.set(file, existsSync(extra) && existsSync(extra.replace(/\.png$/, ".json")) ? { sheet: readPng(extra), atlas: readJson<Atlas>(extra.replace(/\.png$/, ".json")) } : undefined);
        }
        return sheets.get(file) ?? main;
      };
      // Every pose first, so all cells share one box (and one origin).
      const poses: { anim: string; parts: DrawPart[] }[] = [];
      for (const a of BOSS_ANIMS) {
        const tag = a.tags.map((t) => rig.tag[t]).find(Boolean);
        if (!tag) continue;
        for (let f = tag[0]; f <= tag[1]; f += STEP) poses.push({ anim: a.name, parts: poseAt(rig, f) });
      }
      const boxes = poses.map((p) => poseBounds(p.parts)).filter((b) => Number.isFinite(b.minX));
      const minX = Math.floor(Math.min(...boxes.map((b) => b.minX))) - 1;
      const minY = Math.floor(Math.min(...boxes.map((b) => b.minY))) - 1;
      const w = Math.ceil(Math.max(...boxes.map((b) => b.maxX))) + 1 - minX;
      const h = Math.ceil(Math.max(...boxes.map((b) => b.maxY))) + 1 - minY;
      const cols = Math.max(1, Math.min(poses.length, Math.floor(MAX_SHEET_W / w)));
      const grid = new PNG({ width: cols * w, height: Math.ceil(poses.length / cols) * h });
      const anims: GenInfo["anims"] = {};
      poses.forEach((p, i) => {
        // Render with a fixed frame of reference: pad each pose out to the shared box.
        const shifted = p.parts.map((q) => ({ ...q, m: [q.m[0], q.m[1], q.m[2], q.m[3], q.m[4] - minX, q.m[5] - minY] as DrawPart["m"] }));
        const anchor: DrawPart = { node: "", packerid: "", w: 1, h: 1, m: [1, 0, 0, 1, 0, 0], alpha: 0, tint: [1, 1, 1], blend: "alpha" };
        const corner: DrawPart = { ...anchor, m: [1, 0, 0, 1, w - 1, h - 1] };
        const { png } = renderPose([anchor, corner, ...shifted], sheetOf, undefined, 0);
        PNG.bitblt(png, grid, 0, 0, Math.min(w, png.width), Math.min(h, png.height), (i % cols) * w, Math.floor(i / cols) * h);
        const a = BOSS_ANIMS.find((x) => x.name === p.anim)!;
        (anims[p.anim] ??= { frames: [], fps: (rig.fps || 60) / STEP, repeat: a.repeat }).frames.push(i);
      });
      writeFileSync(join(OUT_DIR, `${file}.png`), PNG.sync.write(grid));
      info = { url: `/sprites/enemies/${file}.png`, w, h, originX: -minX, originY: -minY, anims };
    }
    built.set(file, info);
  }
  out[name] = { ...info, src: source.src };
}

writeFileSync(
  GEN,
  `// Generated by scripts/build-enemy-sprites.ts — do not edit.
import type { EnemySpriteInfo } from "./enemy-sprites";

export const ENEMY_SPRITES: Record<string, EnemySpriteInfo> = ${JSON.stringify(out, null, 1)};
`,
);
console.log(`✓ ${Object.keys(out).length} monsters → ${built.size} sheets in ${OUT_DIR}`);
