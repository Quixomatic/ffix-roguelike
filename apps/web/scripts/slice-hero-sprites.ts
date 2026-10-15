/// <reference types="node" />
/**
 * Slices the FFRK battle sprite sheets (git-ignored, under .docs/assets/FFRK) into Phaser/CSS-friendly
 * horizontal strips: one 32×32 cell per pose, feet on the bottom row, every pose aligned to the standing pose
 * so animations don't jitter. Writes:
 *   public/sprites/heroes/<key>.png             — the strip (nearest-neighbour, untouched pixels)
 *   src/features/sprites/hero-sheets.gen.ts     — frame counts + animations (frame indices into the strip)
 *
 * The FFRK sheets are TexturePacker atlases without frame data, packed differently per character, so each
 * character lists where its poses sit (top-left corner of the pose's opaque bounding box in the sheet). The
 * script finds the connected sprite there; `extra` pulls in detached parts. Animations are built from pose
 * names by one shared template, falling back along FALLBACK when a sheet lacks a pose.
 *
 *   bun scripts/slice-hero-sprites.ts                 (from apps/web)
 *   bun scripts/slice-hero-sprites.ts --preview <dir> (also writes an enlarged sheet of every animation)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(WEB, "../../.docs/assets/FFRK/Playable Characters (Full)/FF9");
const OUT = path.join(WEB, "public/sprites/heroes");
const GEN = path.join(WEB, "src/features/sprites/hero-sheets.gen.ts");

const CELL = 32;

type PoseName =
  | "stand"
  | "blink"
  | "ready"
  | "walk"
  | "windup"
  | "swing"
  | "strike"
  | "chant"
  | "cast"
  | "item"
  | "hurt"
  | "dying"
  | "dyingAlt"
  | "ko"
  | "win"
  | "winAlt"
  | "evade";

/** "x,y" of the pose's top-left, or with a manual nudge / detached parts. */
type PoseSpec = string | { at: string; dx?: number; dy?: number; extra?: string[] };

interface HeroSheet {
  file: string;
  poses: Partial<Record<PoseName, PoseSpec>>;
}

/** Where a missing pose borrows from. */
const FALLBACK: Record<PoseName, PoseName | null> = {
  stand: null,
  blink: "stand",
  ready: "stand",
  walk: "stand",
  windup: "ready",
  swing: "strike",
  strike: "ready",
  chant: "ready",
  cast: "chant",
  item: "cast",
  hurt: "stand",
  dying: "hurt",
  dyingAlt: "dying",
  ko: "dying",
  win: "cast",
  winAlt: "win",
  evade: "hurt",
};

interface AnimTemplate {
  poses: PoseName[];
  frameRate: number;
  /** -1 loops; 0 plays once and holds the last frame. */
  repeat: number;
}

/** The animation set every hero gets (same names everywhere). */
const ANIMS: Record<string, AnimTemplate> = {
  idle: { poses: ["stand"], frameRate: 1, repeat: -1 },
  ready: { poses: ["ready"], frameRate: 1, repeat: -1 },
  walk: { poses: ["stand", "walk"], frameRate: 6, repeat: -1 },
  attack: { poses: ["windup", "swing", "strike", "strike"], frameRate: 9, repeat: 0 },
  chant: { poses: ["chant"], frameRate: 1, repeat: -1 },
  cast: { poses: ["chant", "cast", "cast", "cast"], frameRate: 6, repeat: 0 },
  item: { poses: ["item"], frameRate: 1, repeat: 0 },
  defend: { poses: ["ready"], frameRate: 1, repeat: -1 },
  hurt: { poses: ["hurt"], frameRate: 1, repeat: 0 },
  dying: { poses: ["dying", "dying", "dying", "dyingAlt"], frameRate: 3, repeat: -1 },
  ko: { poses: ["ko"], frameRate: 1, repeat: 0 },
  victory: { poses: ["win", "winAlt"], frameRate: 3, repeat: -1 },
  evade: { poses: ["evade"], frameRate: 1, repeat: 0 },
};

/**
 * Pose positions per sheet. Every FFRK sheet carries the same pose set: an idle drawn three times plus a blink,
 * a chant pose drawn twice (+ blinks), a four-frame breathing/step loop, a kneel (×3), a KO, an evade with
 * ghost after-images, and pairs (open eyes / blink) for ready, cast (arm raised) and three action poses.
 */
const HEROES: Record<string, HeroSheet> = {
  zidane: {
    file: "Zidane",
    poses: {
      stand: "69,14", blink: "1,151", ready: "86,14", walk: "18,39",
      windup: "118,26", swing: "237,25", strike: "69,14",
      chant: "186,1", cast: "135,26", hurt: "237,1",
      dying: "35,63", dyingAlt: "86,60", ko: "68,1",
      win: "135,26", winAlt: "86,14", evade: "135,1",
    },
  },
  vivi: {
    file: "Vivi",
    poses: {
      stand: "69,18", blink: "110,1", ready: "18,18", walk: "161,1",
      windup: "229,1", swing: "212,1", strike: "212,1",
      chant: "144,1", cast: "127,1", hurt: "178,1",
      dying: "212,49", ko: "64,1",
      // Vivi turns to face you for his victory hop.
      win: "101,50", winAlt: "34,65", evade: "161,25",
    },
  },
  garnet: {
    file: "Garnet",
    poses: {
      stand: "18,17", blink: "1,76", ready: "118,41", walk: "152,1",
      windup: "186,1", swing: "169,1", strike: "169,1",
      chant: "118,1", cast: "134,41", hurt: "135,1",
      dying: "237,22", dyingAlt: "203,22", ko: "68,1",
      win: "134,41", winAlt: "118,41", evade: "35,17",
    },
  },
  steiner: {
    file: "Steiner",
    poses: {
      stand: "35,16", blink: "1,151", ready: "136,1", walk: "187,1",
      windup: "204,1", swing: "153,1", strike: "153,1",
      chant: "18,16", cast: "52,16", hurt: "170,1",
      dying: "221,25", dyingAlt: "238,25", ko: "43,1",
      win: "52,16", winAlt: "136,1", evade: "118,1",
    },
  },
  freya: {
    file: "Freya",
    poses: {
      stand: "220,1", blink: "169,1", ready: "1,26", walk: "152,1",
      windup: "203,1", swing: "186,1", strike: "186,1",
      chant: "18,16", cast: "85,48", hurt: "135,1",
      dying: "118,26", dyingAlt: "52,40", ko: "68,1",
      win: "85,48", winAlt: "1,26", evade: "1,76",
    },
  },
  quina: {
    // No eyes, so no blink frames; poses picked by silhouette.
    file: "Quina",
    poses: {
      stand: "35,123", ready: "1,1", walk: "36,25",
      windup: "36,1", swing: "18,151", strike: "53,24",
      chant: "35,51", cast: "1,176", item: "18,176", hurt: "35,147",
      dying: "52,72", dyingAlt: "69,218", ko: "100,1",
      win: "51,171", winAlt: "36,1", evade: "19,26",
    },
  },
  eiko: {
    file: "Eiko",
    poses: {
      stand: "199,1", blink: "148,1", ready: "1,16", walk: "113,31",
      windup: "182,1", swing: "165,1", strike: "165,1",
      chant: "147,40", cast: "18,16", hurt: "114,1",
      dying: "1,84", dyingAlt: "65,80", ko: "49,1",
      win: "18,16", winAlt: "1,16", evade: "195,34",
    },
  },
  amarant: {
    file: "Amarant",
    poses: {
      stand: "202,1", blink: "33,17", ready: "1,26", walk: "85,17",
      windup: "168,1", swing: "151,1", strike: "151,1",
      chant: "217,41", cast: "183,48", hurt: "133,1",
      dying: "236,21", dyingAlt: "132,25", ko: "83,1",
      win: "1,51", winAlt: "183,48", evade: "1,76",
    },
  },
  beatrix: {
    file: "Beatrix",
    poses: {
      stand: "52,17", blink: "169,1", ready: "1,26", walk: "152,1",
      windup: "203,1", swing: "186,1", strike: "186,1",
      chant: "18,17", cast: "85,49", hurt: "135,1",
      dying: "18,42", dyingAlt: "118,26", ko: "68,1",
      win: "85,49", winAlt: "1,26", evade: "1,76",
    },
  },
  marcus: {
    file: "Marcus",
    poses: {
      stand: "1,1", blink: "1,51", ready: "151,1", walk: "215,1",
      windup: "231,1", swing: "68,56", strike: "68,56",
      chant: "183,1", cast: "103,16", hurt: "35,16",
      dying: "86,36", dyingAlt: "35,40", ko: "68,1",
      win: "103,16", winAlt: "151,1", evade: "1,76",
    },
  },
};

// ---------------------------------------------------------------------------------------------------------

interface Img {
  w: number;
  h: number;
  data: Uint8Array;
}

interface Part {
  x: number;
  y: number;
  w: number;
  h: number;
  pixels: number[];
}

function readPng(file: string): Img {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { w: png.width, h: png.height, data: png.data };
}

/** Connected opaque regions (8-neighbour), keyed by the top-left of their bounding box. */
function findParts(img: Img): Map<string, Part> {
  const seen = new Uint8Array(img.w * img.h);
  const parts = new Map<string, Part>();
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const start = y * img.w + x;
      if (seen[start] || img.data[start * 4 + 3] === 0) continue;
      const pixels: number[] = [];
      const stack = [start];
      seen[start] = 1;
      let x0 = x, x1 = x, y0 = y, y1 = y;
      while (stack.length) {
        const i = stack.pop()!;
        pixels.push(i);
        const cx = i % img.w, cy = (i - cx) / img.w;
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
            const n = ny * img.w + nx;
            if (!seen[n] && img.data[n * 4 + 3] !== 0) {
              seen[n] = 1;
              stack.push(n);
            }
          }
      }
      parts.set(`${x0},${y0}`, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pixels });
    }
  return parts;
}

/** A pose cut out of the sheet: trimmed RGBA, bounding box only. */
class Sprite {
  constructor(
    readonly w: number,
    readonly h: number,
    readonly rgba: Uint8Array,
  ) {}

  static cut(img: Img, parts: Part[]): Sprite {
    const x0 = Math.min(...parts.map((p) => p.x));
    const y0 = Math.min(...parts.map((p) => p.y));
    const w = Math.max(...parts.map((p) => p.x + p.w)) - x0;
    const h = Math.max(...parts.map((p) => p.y + p.h)) - y0;
    const rgba = new Uint8Array(w * h * 4);
    for (const p of parts)
      for (const i of p.pixels) {
        const sx = i % img.w, sy = (i - sx) / img.w;
        rgba.set(img.data.subarray(i * 4, i * 4 + 4), ((sy - y0) * w + (sx - x0)) * 4);
      }
    return new Sprite(w, h, rgba);
  }

  /** Packed RGB, or -1 when transparent / out of bounds. */
  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const o = (y * this.w + x) * 4;
    return this.rgba[o + 3] ? (this.rgba[o]! << 16) | (this.rgba[o + 1]! << 8) | this.rgba[o + 2]! : -1;
  }
}

/** Horizontal shift of `s` (feet on the same row as `ref`) that best overlays it on `ref`. */
function bestShift(ref: Sprite, refX: number, s: Sprite): number {
  let best = -Infinity;
  let bestX = Math.round(refX + (ref.w - s.w) / 2);
  for (let x = refX - 10; x <= refX + ref.w + 10 - s.w; x++) {
    let score = 0;
    for (let y = 0; y < s.h; y++)
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.at(sx, y);
        if (c < 0) continue;
        const r = ref.at(x + sx - refX, ref.h - s.h + y);
        if (r === c) score += 2;
        else if (r >= 0) score += 0.25;
      }
    // Ties go to the shift closest to centred.
    score -= Math.abs(x + s.w / 2 - (refX + ref.w / 2)) * 0.01;
    if (score > best) {
      best = score;
      bestX = x;
    }
  }
  return bestX;
}

function blit(dst: PNG, s: Sprite, ox: number, oy: number, cellX: number) {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const dx = ox + x, dy = oy + y;
      const si = (y * s.w + x) * 4;
      if (!s.rgba[si + 3]) continue;
      if (dx < 0 || dy < 0 || dx >= CELL || dy >= CELL) throw new Error(`pose overflows its ${CELL}px cell`);
      dst.data.set(s.rgba.subarray(si, si + 4), (dy * dst.width + cellX + dx) * 4);
    }
}

interface Built {
  frames: number;
  anims: Record<string, { frames: number[]; frameRate: number; repeat: number }>;
  strip: PNG;
}

function build(key: string, sheet: HeroSheet): Built {
  const img = readPng(path.join(SRC, `Mobile - Final Fantasy Record Keeper - ${sheet.file}.png`));
  const parts = findParts(img);
  const take = (at: string) => {
    const p = parts.get(at.replace(/\s/g, ""));
    if (!p) throw new Error(`${key}: no sprite at ${at}`);
    return p;
  };

  const resolve = (pose: PoseName): PoseName => {
    let p: PoseName | null = pose;
    while (p && !sheet.poses[p]) p = FALLBACK[p];
    if (!p) throw new Error(`${key}: no pose for ${pose}`);
    return p;
  };

  const standSpec = sheet.poses.stand!;
  const standAt = typeof standSpec === "string" ? standSpec : standSpec.at;
  const stand = Sprite.cut(img, [take(standAt)]);
  const standX = Math.floor((CELL - stand.w) / 2);

  // One cell per distinct source sprite, in first-use order.
  const cellOf = new Map<string, number>();
  const placed: { s: Sprite; x: number; y: number }[] = [];
  const cellFor = (pose: PoseName): number => {
    const spec = sheet.poses[resolve(pose)]!;
    const o = typeof spec === "string" ? { at: spec } : spec;
    const id = JSON.stringify(o);
    const known = cellOf.get(id);
    if (known !== undefined) return known;
    const s = Sprite.cut(img, [take(o.at), ...(o.extra ?? []).map(take)]);
    // Lying-down poses are much wider than tall: centre them; everything else aligns to the standing pose.
    const x = (s.w > s.h ? Math.floor((CELL - s.w) / 2) : bestShift(stand, standX, s)) + (o.dx ?? 0);
    const y = CELL - s.h + (o.dy ?? 0);
    placed.push({ s, x, y });
    cellOf.set(id, placed.length - 1);
    return placed.length - 1;
  };

  const anims: Built["anims"] = {};
  for (const [name, t] of Object.entries(ANIMS))
    anims[name] = { frames: t.poses.map(cellFor), frameRate: t.frameRate, repeat: t.repeat };

  const strip = new PNG({ width: CELL * placed.length, height: CELL });
  strip.data.fill(0);
  placed.forEach((p, i) => blit(strip, p.s, p.x, p.y, i * CELL));
  return { frames: placed.length, anims, strip };
}

/** Every animation as a row, 4× with a feet line, for eyeballing alignment. */
function preview(key: string, b: Built, dir: string) {
  const S = 4;
  const rows = Object.entries(b.anims).map(([n, a]) => [n, { frames: a.frames.filter((f, i) => f !== a.frames[i - 1]) }] as const);
  const cols = Math.max(...rows.map(([, a]) => a.frames.length));
  const out = new PNG({ width: cols * CELL * S, height: rows.length * CELL * S });
  rows.forEach(([, a], r) =>
    a.frames.forEach((f, c) => {
      for (let y = 0; y < CELL * S; y++)
        for (let x = 0; x < CELL * S; x++) {
          const o = ((r * CELL * S + y) * out.width + c * CELL * S + x) * 4;
          const si = ((Math.floor(y / S)) * b.strip.width + f * CELL + Math.floor(x / S)) * 4;
          const edge = x === 0 || y === 0;
          const mid = Math.floor(x / S) === CELL / 2 && x % S === 0;
          if (b.strip.data[si + 3]) out.data.set(b.strip.data.subarray(si, si + 4), o);
          else out.data.set(edge ? [150, 150, 150, 255] : mid ? [205, 215, 235, 255] : (r + c) % 2 ? [232, 232, 232, 255] : [244, 244, 244, 255], o);
        }
    }),
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}-preview.png`), PNG.sync.write(out));
  console.log(`${key}: ${rows.map(([n]) => n).join(", ")} (rows)`);
}

function main() {
  const pi = process.argv.indexOf("--preview");
  const previewDir = pi > 0 ? process.argv[pi + 1] : undefined;
  if (!fs.existsSync(SRC)) throw new Error(`FFRK sheets not found at ${SRC}`);
  fs.mkdirSync(OUT, { recursive: true });

  const gen: Record<string, Omit<Built, "strip">> = {};
  for (const [key, sheet] of Object.entries(HEROES)) {
    const b = build(key, sheet);
    fs.writeFileSync(path.join(OUT, `${key}.png`), PNG.sync.write(b.strip));
    gen[key] = { frames: b.frames, anims: b.anims };
    if (previewDir) preview(key, b, previewDir);
    console.log(`${key}: ${b.frames} cells`);
  }

  const body = Object.entries(gen)
    .map(([key, g]) => {
      const anims = Object.entries(g.anims)
        .map(([n, a]) => `      ${n}: { frames: [${a.frames.join(", ")}], frameRate: ${a.frameRate}, repeat: ${a.repeat} },`)
        .join("\n");
      return `  ${key}: {\n    frames: ${g.frames},\n    anims: {\n${anims}\n    },\n  },`;
    })
    .join("\n");
  fs.writeFileSync(
    GEN,
    `// Generated by scripts/slice-hero-sprites.ts — do not edit by hand.\n\n` +
      `/** Each hero strip is a row of CELL×CELL frames at /sprites/heroes/<key>.png, feet on the bottom row. */\n` +
      `export const HERO_CELL = ${CELL};\n\n` +
      `export type HeroAnim = ${Object.keys(ANIMS).map((n) => `"${n}"`).join(" | ")};\n\n` +
      `export interface HeroSheetInfo {\n  frames: number;\n  anims: Record<HeroAnim, { frames: number[]; frameRate: number; repeat: number }>;\n}\n\n` +
      `export const HERO_SHEETS: Record<string, HeroSheetInfo> = {\n${body}\n};\n`,
  );
  console.log(`wrote ${Object.keys(gen).length} strips to ${path.relative(WEB, OUT)} and ${path.relative(WEB, GEN)}`);
}

main();
