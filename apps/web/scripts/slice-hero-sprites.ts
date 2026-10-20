/// <reference types="node" />
/**
 * Slices FFRK's party battle sheets into Phaser/CSS-friendly horizontal strips, using FFRK's own atlas data:
 * every sheet comes with a TexturePacker JSON naming each frame ("base_idle", "base_chant_1", "base_fatal",
 * "glass_idle" = Blind…) and placing it in a 32×32 source cell, so poses line up exactly as in FFRK.
 *
 * Weapons: FFRK draws the weapon as its own sprite between the body and a separate arm piece (`left_arm_3` = the
 * raised arm of `left_arm_1`, `left_arm_4` = the extended arm of `left_arm_2`), so the hand closes over the grip.
 * The strip carries those arm pieces; for each attack frame the slicer records the arm piece, the hand point (the
 * raised arm's top / the extended arm's front tip) and the weapon's angle. Weapon sprites (all drawn tip up-left)
 * are copied as 32×32 cells with their grip point.
 *
 * Input: `.docs/assets/FFRK-data/_raw/{characters,weapons}/<id>.{png,json}` (git-ignored;
 * `pnpm -F web ffrk:fetch` downloads them). Writes:
 *   public/sprites/heroes/<key>.png             — the strip (32×32 cells, untouched pixels)
 *   public/sprites/weapons/<id>.png             — weapon cells
 *   src/features/sprites/hero-sheets.gen.ts     — frames, animations, the attack rig, weapon grips
 *
 *   bun scripts/slice-hero-sprites.ts                 (from apps/web; `pnpm -F web sprites:heroes`)
 *   bun scripts/slice-hero-sprites.ts --preview <dir> (also writes an enlarged row per animation, weapon drawn)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.resolve(WEB, "../../.docs/assets/FFRK-data/_raw");
const OUT = path.join(WEB, "public/sprites/heroes");
const WEAPON_OUT = path.join(WEB, "public/sprites/weapons");
const GEN = path.join(WEB, "src/features/sprites/hero-sheets.gen.ts");

const CELL = 32;

/** Our hero key → FFRK character sheet id (FF9 = 109xxx) and a stand-in weapon sprite (FFRK equip/weapon id). */
const HEROES: Record<string, { sheet: number; weapon: number }> = {
  zidane: { sheet: 109001, weapon: 100001 }, // dagger
  garnet: { sheet: 109002, weapon: 100012 }, // rod
  vivi: { sheet: 109003, weapon: 100009 }, // staff
  steiner: { sheet: 109004, weapon: 100002 }, // sword
  freya: { sheet: 109005, weapon: 100066 }, // spear
  quina: { sheet: 109006, weapon: 100066 }, // (fork) spear
  eiko: { sheet: 109007, weapon: 100012 }, // (flute) rod
  amarant: { sheet: 109008, weapon: 100008 }, // claws
  beatrix: { sheet: 109009, weapon: 100003 }, // long sword
  marcus: { sheet: 109015, weapon: 100002 },
  blank: { sheet: 109066, weapon: 100002 },
  kuja: { sheet: 109010, weapon: 100009 }, // (staff: he wears Vivi's mage gear)
};

/**
 * Animations as FFRK frame names (without "base_"). FFRK's poses: idle; ready (crouched, before acting); walk
 * (stepping forward); left_arm_1 (weapon raised) → left_arm_2 (swing); chant_1/2 (casting loop) → hands_up
 * (release; also items and the victory cheer); damage; fatal (Low HP kneel); dead.
 */
const ANIMS: Record<string, { frames: string[]; frameRate: number; repeat: number }> = {
  idle: { frames: ["idle"], frameRate: 1, repeat: -1 },
  ready: { frames: ["ready"], frameRate: 1, repeat: -1 },
  walk: { frames: ["walk", "idle"], frameRate: 6, repeat: -1 },
  attack: { frames: ["walk", "left_arm_1", "left_arm_1", "left_arm_2", "left_arm_2", "left_arm_2", "ready"], frameRate: 10, repeat: 0 },
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

/**
 * The weapon during the attack, per attack frame: which arm piece goes over it and the weapon's angle (degrees,
 * clockwise; weapons are drawn tip up-left, so +90 points it up-and-back, 0 up-and-forward, -90 down-and-forward).
 * Multiples of 90° keep the pixels crisp.
 */
const ATTACK_RIG: ({ arm: "left_arm_3" | "left_arm_4"; angle: number } | null)[] = [
  null,
  { arm: "left_arm_3", angle: 90 },
  { arm: "left_arm_3", angle: 90 },
  { arm: "left_arm_4", angle: 0 },
  { arm: "left_arm_4", angle: -90 },
  { arm: "left_arm_4", angle: -90 },
  null,
];
const ARMS = ["left_arm_3", "left_arm_4"] as const;

/**
 * Status looks. FFRK draws Blind as a full "glass_*" pose set (shades on), Mini as a small "mini_*" set, and single
 * "sleep" / "stone" poses. Each variant maps the base animation frames to its own frames (falling back to base).
 */
const MINI_FOR: Record<string, string> = {
  idle: "mini_idle",
  ready: "mini_ready",
  walk: "mini_walk",
  left_arm_1: "mini_attack",
  left_arm_2: "mini_attack",
  right_arm_1: "mini_attack",
  right_arm_2: "mini_attack",
  chant_1: "mini_ready",
  chant_2: "mini_ready",
  hands_up: "mini_ready",
  damage: "mini_damage",
  fatal: "mini_fatal",
  dead: "mini_dead",
};
const VARIANTS: Record<string, (base: string, has: (name: string) => boolean) => string> = {
  blind: (n, has) => (has(`glass_${n}`) ? `glass_${n}` : `base_${n}`),
  mini: (n, has) => {
    const m = MINI_FOR[n] ?? "mini_idle";
    return has(m) ? m : `base_${n}`;
  },
};

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

interface RigFrame {
  arm: number;
  hand: [number, number];
  angle: number;
}

interface Built {
  strip: PNG;
  frames: number;
  anims: Record<string, { frames: number[]; frameRate: number; repeat: number }>;
  /** Status variants: per animation, the strip frames to show instead (same timing as `anims`). */
  variants: Record<string, Record<string, number[]>>;
  /** Single-frame status poses (strip frame), if the sheet has them. */
  poses: { sleep?: number; stone?: number };
  rig: (RigFrame | null)[];
  weapon: number;
}

const readAtlas = (file: string) => JSON.parse(fs.readFileSync(file, "utf8")) as { frames: Record<string, AtlasFrame> };

/** Blit an atlas frame into a 32×32 cell of `dst` at cell column `cell`, where it sits in its source cell. */
function blitCell(dst: PNG, src: PNG, f: AtlasFrame, cell: number) {
  if (f.rotated) throw new Error("rotated atlas frames aren't supported");
  const ox = cell * CELL + f.spriteSourceSize.x + Math.floor((CELL - f.sourceSize.w) / 2);
  const oy = f.spriteSourceSize.y + (CELL - f.sourceSize.h);
  for (let y = 0; y < f.frame.h; y++)
    for (let x = 0; x < f.frame.w; x++) {
      const si = ((f.frame.y + y) * src.width + f.frame.x + x) * 4;
      const di = ((oy + y) * dst.width + ox + x) * 4;
      for (let c = 0; c < 4; c++) dst.data[di + c] = src.data[si + c]!;
    }
}

/** Opaque pixels of cell `cell` in a strip, in cell coordinates. */
function opaque(img: PNG, cell: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (img.data[(y * img.width + cell * CELL + x) * 4 + 3]! > 10) pts.push([x, y]);
  return pts;
}
const mean = (p: [number, number][]): [number, number] => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

/** The hand: top two rows of a raised arm, front (left) two columns of an extended one. */
function handOf(strip: PNG, cell: number, raised: boolean): [number, number] {
  const pts = opaque(strip, cell);
  if (raised) {
    const top = Math.min(...pts.map((p) => p[1]));
    return mean(pts.filter((p) => p[1] <= top + 1));
  }
  const left = Math.min(...pts.map((p) => p[0]));
  return mean(pts.filter((p) => p[0] <= left + 1));
}

/** Grip of a weapon cell (tip up-left): a fifth of the way from the bottom-right end toward the tip. */
function gripOf(cell: PNG): [number, number] {
  const pts = opaque(cell, 0);
  const end = pts.reduce((a, b) => (b[0] + b[1] > a[0] + a[1] ? b : a));
  const tip = pts.reduce((a, b) => (b[0] + b[1] < a[0] + a[1] ? b : a));
  return [end[0] + (tip[0] - end[0]) * 0.2, end[1] + (tip[1] - end[1]) * 0.2];
}

function buildWeapon(id: number): { cell: PNG; grip: [number, number] } {
  const src = PNG.sync.read(fs.readFileSync(path.join(RAW, "weapons", `${id}.png`)));
  const f = Object.values(readAtlas(path.join(RAW, "weapons", `${id}.json`)).frames)[0]!;
  const cell = new PNG({ width: CELL, height: CELL });
  blitCell(cell, src, f, 0);
  return { cell, grip: gripOf(cell) };
}

function build(key: string, hero: (typeof HEROES)[string]): Built {
  const sheet = PNG.sync.read(fs.readFileSync(path.join(RAW, "characters", `${hero.sheet}.png`)));
  const atlas = readAtlas(path.join(RAW, "characters", `${hero.sheet}.json`));
  const has = (name: string) => !!atlas.frames[`${name}.png`];
  // Every atlas frame the strip needs, by its full FFRK name: base poses and arm pieces, then the status sets.
  const baseNames = [...new Set([...Object.values(ANIMS).flatMap((a) => a.frames), ...ARMS])];
  for (const n of baseNames) if (!has(`base_${n}`)) throw new Error(`${key} (${hero.sheet}): no base_${n} frame`);
  const cells: string[] = baseNames.map((n) => `base_${n}`);
  const cellOf = (name: string) => {
    let i = cells.indexOf(name);
    if (i < 0) i = cells.push(name) - 1;
    return i;
  };
  const anims = Object.fromEntries(Object.entries(ANIMS).map(([a, def]) => [a, { ...def, frames: def.frames.map((n) => cellOf(`base_${n}`)) }]));
  const variants = Object.fromEntries(
    Object.entries(VARIANTS).map(([v, pick]) => [v, Object.fromEntries(Object.entries(ANIMS).map(([a, def]) => [a, def.frames.map((n) => cellOf(pick(n, has)))]))]),
  );
  const poses = { sleep: has("sleep") ? cellOf("sleep") : undefined, stone: has("stone") ? cellOf("stone") : undefined };
  const strip = new PNG({ width: cells.length * CELL, height: CELL });
  cells.forEach((n, cell) => blitCell(strip, sheet, atlas.frames[`${n}.png`]!, cell));
  const rig = ATTACK_RIG.map((r) => {
    if (!r) return null;
    const arm = cellOf(`base_${r.arm}`);
    const [x, y] = handOf(strip, arm, r.arm === "left_arm_3");
    return { arm, hand: [Math.round(x * 2) / 2, Math.round(y * 2) / 2] as [number, number], angle: r.angle };
  });
  return { strip, frames: cells.length, anims, variants, poses, rig, weapon: hero.weapon };
}

/** Preview: each animation as a row, the attack with the weapon and arm piece layered in. */
function preview(key: string, b: Built, weapon: { cell: PNG; grip: [number, number] }, dir: string) {
  const scale = 4;
  const rows = Object.entries(b.anims);
  const cols = Math.max(...rows.map(([, r]) => r.frames.length));
  const out = new PNG({ width: cols * 40 * scale, height: rows.length * 40 * scale });
  out.data.fill(235);
  const put = (x: number, y: number, src: PNG, si: number) => {
    for (let dy = 0; dy < scale; dy++)
      for (let dx = 0; dx < scale; dx++) {
        const px = Math.round(x * scale) + dx, py = Math.round(y * scale) + dy;
        if (px >= 0 && py >= 0 && px < out.width && py < out.height) for (let c = 0; c < 4; c++) out.data[(py * out.width + px) * 4 + c] = src.data[si + c]!;
      }
  };
  const drawCell = (ox: number, oy: number, cell: number) => {
    for (const [x, y] of opaque(b.strip, cell)) put(ox + x, oy + y, b.strip, (y * b.strip.width + cell * CELL + x) * 4);
  };
  rows.forEach(([name, r], row) =>
    r.frames.forEach((cell, col) => {
      const ox = col * 40 + 4, oy = row * 40 + 4;
      drawCell(ox, oy, cell);
      const rig = name === "attack" ? b.rig[col] : null;
      if (!rig) return;
      const a = (rig.angle * Math.PI) / 180;
      for (const [x, y] of opaque(weapon.cell, 0)) {
        const dx = x - weapon.grip[0], dy = y - weapon.grip[1];
        put(ox + rig.hand[0] + dx * Math.cos(a) - dy * Math.sin(a), oy + rig.hand[1] + dx * Math.sin(a) + dy * Math.cos(a), weapon.cell, (y * CELL + x) * 4);
      }
      drawCell(ox, oy, rig.arm);
    }),
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}-preview.png`), PNG.sync.write(out));
}

function main() {
  const pi = process.argv.indexOf("--preview");
  const previewDir = pi > 0 ? process.argv[pi + 1] : undefined;
  if (!fs.existsSync(RAW)) throw new Error(`FFRK atlases not found at ${RAW} — run scripts/fetch-ffrk-atlases.ts first`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(WEAPON_OUT, { recursive: true });

  const weapons = new Map<number, { cell: PNG; grip: [number, number] }>();
  for (const h of Object.values(HEROES)) if (!weapons.has(h.weapon)) weapons.set(h.weapon, buildWeapon(h.weapon));
  for (const [id, w] of weapons) fs.writeFileSync(path.join(WEAPON_OUT, `${id}.png`), PNG.sync.write(w.cell));

  const gen: Record<string, Omit<Built, "strip">> = {};
  for (const [key, hero] of Object.entries(HEROES)) {
    const b = build(key, hero);
    fs.writeFileSync(path.join(OUT, `${key}.png`), PNG.sync.write(b.strip));
    gen[key] = { frames: b.frames, anims: b.anims, variants: b.variants, poses: b.poses, rig: b.rig, weapon: b.weapon };
    if (previewDir) preview(key, b, weapons.get(hero.weapon)!, previewDir);
  }

  const body = Object.entries(gen)
    .map(([key, g]) => {
      const anims = Object.entries(g.anims)
        .map(([n, a]) => `      ${n}: { frames: [${a.frames.join(", ")}], frameRate: ${a.frameRate}, repeat: ${a.repeat} },`)
        .join("\n");
      const rig = g.rig.map((r) => (r ? `{ arm: ${r.arm}, hand: [${r.hand.join(", ")}], angle: ${r.angle} }` : "null")).join(", ");
      const variants = Object.entries(g.variants)
        .map(([v, byAnim]) => `      ${v}: { ${Object.entries(byAnim).map(([a, fr]) => `${a}: [${fr.join(", ")}]`).join(", ")} },`)
        .join("\n");
      const poses = Object.entries(g.poses)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return `  ${key}: {\n    frames: ${g.frames},\n    anims: {\n${anims}\n    },\n    variants: {\n${variants}\n    },\n    poses: { ${poses} },\n    rig: [${rig}],\n    weapon: ${g.weapon},\n  },`;
    })
    .join("\n");
  const grips = [...weapons].map(([id, w]) => `  ${id}: [${w.grip.map((v) => Math.round(v * 2) / 2).join(", ")}],`).join("\n");
  fs.writeFileSync(
    GEN,
    `// Generated by scripts/slice-hero-sprites.ts — do not edit by hand.\n\n` +
      `/** Each hero strip is a row of CELL×CELL frames at /sprites/heroes/<key>.png, feet on the bottom row. */\n` +
      `export const HERO_CELL = ${CELL};\n\n` +
      `export type HeroAnim = ${Object.keys(ANIMS).map((n) => `"${n}"`).join(" | ")};\n\n` +
      `export type HeroVariant = ${Object.keys(VARIANTS).map((n) => `"${n}"`).join(" | ")};\n\n` +
      `/** The weapon during one attack frame: the arm piece drawn over it (strip frame), the hand (cell px) and angle. */\n` +
      `export interface HeroRigFrame {\n  arm: number;\n  hand: [number, number];\n  angle: number;\n}\n\n` +
      `export interface HeroSheetInfo {\n  frames: number;\n  anims: Record<HeroAnim, { frames: number[]; frameRate: number; repeat: number }>;\n` +
      `  /** Status looks: Blind (FFRK's glasses set) and Mini — per animation, the frames to show instead. */\n  variants: Record<HeroVariant, Record<HeroAnim, number[]>>;\n` +
      `  /** Single-frame status poses. */\n  poses: { sleep?: number; stone?: number };\n` +
      `  /** Per attack-animation frame. */\n  rig: (HeroRigFrame | null)[];\n  /** Stand-in weapon sprite (/sprites/weapons/<id>.png). */\n  weapon: number;\n}\n\n` +
      `export const HERO_SHEETS: Record<string, HeroSheetInfo> = {\n${body}\n};\n\n` +
      `/** Weapon sprite id → grip point in its 32×32 cell (sprites are drawn tip up-left). */\n` +
      `export const WEAPON_GRIPS: Record<number, [number, number]> = {\n${grips}\n};\n`,
  );
  console.log(`wrote ${Object.keys(gen).length} strips, ${weapons.size} weapons and ${path.relative(WEB, GEN)}`);
}

main();
