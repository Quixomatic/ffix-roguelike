/// <reference types="node" />
/**
 * Slices FFRK's party battle sheets into Phaser/CSS-friendly horizontal strips, using FFRK's own atlas data:
 * every sheet comes with a TexturePacker JSON naming each frame ("base_idle", "base_chant_1", "base_fatal",
 * "glass_idle" = Blind…) and placing it in a 32×32 source cell, so poses line up exactly as in FFRK.
 *
 * Input: `.docs/assets/FFRK-data/_raw/characters/<id>.{png,json}` (git-ignored; `bun scripts/fetch-ffrk-atlases.ts`
 * downloads them). Writes:
 *   public/sprites/heroes/<key>.png             — the strip (32×32 cells, untouched pixels)
 *   src/features/sprites/hero-sheets.gen.ts     — frame counts + animations (frame indices into the strip)
 *
 *   bun scripts/slice-hero-sprites.ts                 (from apps/web; `pnpm -F web sprites:heroes`)
 *   bun scripts/slice-hero-sprites.ts --preview <dir> (also writes an enlarged row per animation)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(WEB, "../../.docs/assets/FFRK-data/_raw/characters");
const OUT = path.join(WEB, "public/sprites/heroes");
const GEN = path.join(WEB, "src/features/sprites/hero-sheets.gen.ts");

const CELL = 32;

/** Our hero key → FFRK character sheet id (FF9 = 109xxx). */
const HEROES: Record<string, number> = {
  zidane: 109001,
  garnet: 109002,
  vivi: 109003,
  steiner: 109004,
  freya: 109005,
  quina: 109006,
  eiko: 109007,
  amarant: 109008,
  beatrix: 109009,
  marcus: 109015,
  blank: 109066,
};

/**
 * Animations as FFRK frame names (without "base_"). FFRK's poses: idle; ready (crouched, before acting); walk
 * (stepping forward); left_arm_1 (weapon raised) → right_arm_1/2 (swing); chant_1/2 (casting loop) → hands_up
 * (release; also items and the victory cheer); damage; fatal (Low HP kneel); dead.
 */
const ANIMS: Record<string, { frames: string[]; frameRate: number; repeat: number }> = {
  idle: { frames: ["idle"], frameRate: 1, repeat: -1 },
  ready: { frames: ["ready"], frameRate: 1, repeat: -1 },
  walk: { frames: ["walk", "idle"], frameRate: 6, repeat: -1 },
  attack: { frames: ["walk", "left_arm_1", "right_arm_1", "right_arm_2", "right_arm_2", "ready"], frameRate: 10, repeat: 0 },
  chant: { frames: ["chant_1", "chant_2"], frameRate: 4, repeat: -1 },
  cast: { frames: ["chant_1", "chant_2", "chant_1", "chant_2", "hands_up", "hands_up", "hands_up"], frameRate: 8, repeat: 0 },
  item: { frames: ["ready", "hands_up", "hands_up", "hands_up"], frameRate: 6, repeat: 0 },
  defend: { frames: ["ready"], frameRate: 1, repeat: -1 },
  hurt: { frames: ["damage", "damage", "damage"], frameRate: 6, repeat: 0 },
  dying: { frames: ["fatal"], frameRate: 1, repeat: -1 },
  ko: { frames: ["dead"], frameRate: 1, repeat: 0 },
  victory: { frames: ["hands_up", "idle"], frameRate: 2, repeat: -1 },
  evade: { frames: ["walk", "walk", "idle"], frameRate: 8, repeat: 0 },
};

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

interface Built {
  strip: PNG;
  frames: number;
  anims: Record<string, { frames: number[]; frameRate: number; repeat: number }>;
}

function build(key: string, id: number): Built {
  const sheet = PNG.sync.read(fs.readFileSync(path.join(SRC, `${id}.png`)));
  const atlas = JSON.parse(fs.readFileSync(path.join(SRC, `${id}.json`), "utf8")) as { frames: Record<string, AtlasFrame> };
  const names = [...new Set(Object.values(ANIMS).flatMap((a) => a.frames))];
  for (const n of names) if (!atlas.frames[`base_${n}.png`]) throw new Error(`${key} (${id}): no base_${n} frame`);
  const strip = new PNG({ width: names.length * CELL, height: CELL });
  names.forEach((n, cell) => {
    const f = atlas.frames[`base_${n}.png`]!;
    if (f.rotated) throw new Error(`${key}: rotated frame ${n} not supported`);
    // Place the trimmed frame where it sits in its 32×32 source cell, so every pose shares FFRK's baseline.
    const ox = cell * CELL + f.spriteSourceSize.x + Math.floor((CELL - f.sourceSize.w) / 2);
    const oy = f.spriteSourceSize.y + (CELL - f.sourceSize.h);
    for (let y = 0; y < f.frame.h; y++)
      for (let x = 0; x < f.frame.w; x++) {
        const si = ((f.frame.y + y) * sheet.width + f.frame.x + x) * 4;
        const di = ((oy + y) * strip.width + ox + x) * 4;
        for (let c = 0; c < 4; c++) strip.data[di + c] = sheet.data[si + c]!;
      }
  });
  const anims = Object.fromEntries(Object.entries(ANIMS).map(([a, def]) => [a, { ...def, frames: def.frames.map((n) => names.indexOf(n)) }]));
  return { strip, frames: names.length, anims };
}

function preview(key: string, b: Built, dir: string) {
  const scale = 4;
  const rows = Object.values(b.anims);
  const cols = Math.max(...rows.map((r) => r.frames.length));
  const out = new PNG({ width: cols * CELL * scale, height: rows.length * CELL * scale });
  out.data.fill(235);
  rows.forEach((r, row) =>
    r.frames.forEach((cell, col) => {
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const si = (y * b.strip.width + cell * CELL + x) * 4;
          if (b.strip.data[si + 3]! < 10) continue;
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++) {
              const di = (((row * CELL + y) * scale + dy) * out.width + (col * CELL + x) * scale + dx) * 4;
              for (let c = 0; c < 4; c++) out.data[di + c] = b.strip.data[si + c]!;
            }
        }
    }),
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}-preview.png`), PNG.sync.write(out));
  console.log(`${key}: ${Object.keys(b.anims).join(", ")} (rows)`);
}

function main() {
  const pi = process.argv.indexOf("--preview");
  const previewDir = pi > 0 ? process.argv[pi + 1] : undefined;
  if (!fs.existsSync(SRC)) throw new Error(`FFRK atlases not found at ${SRC} — run scripts/fetch-ffrk-atlases.ts first`);
  fs.mkdirSync(OUT, { recursive: true });

  const gen: Record<string, Omit<Built, "strip">> = {};
  for (const [key, id] of Object.entries(HEROES)) {
    const b = build(key, id);
    fs.writeFileSync(path.join(OUT, `${key}.png`), PNG.sync.write(b.strip));
    gen[key] = { frames: b.frames, anims: b.anims };
    if (previewDir) preview(key, b, previewDir);
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
