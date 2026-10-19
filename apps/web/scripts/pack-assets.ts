#!/usr/bin/env bun
/// <reference types="node" />
/**
 * assets:pack — pack the game's shipped assets, one pack per asset class, from the local build outputs:
 *
 *   heroes   public/sprites/heroes/        (sprites:heroes)
 *   weapons  public/sprites/weapons/       (sprites:heroes)
 *   items    public/sprites/items.png      (sprites:items)
 *   ui       public/sprites/ui/            (sprites:ui)
 *   badges   public/sprites/badges/        (sprites:badges: achievement badge atlas + catalog)
 *   overworld public/sprites/overworld/    (tiles:overworld: the overworld map's terrain + object tilesets)
 *   sfx      public/sfx/                   (FF9's menu sounds: python scripts/extract-ff9-sfx.py)
 *   enemies  public/sprites/enemies/       (sprites:enemies)
 *   effects  the FFRK effect files the game can play — `usedEffectPaths()` and everything they reference
 *            (particles, frame animations, images + atlases, sounds), from .docs/assets/FFRK-data/_raw/effects
 *   music    public/music/                 (audio:music) — one pack per track ("music/music006"), so a track
 *            downloads when it's first played, not with the whole soundtrack
 *
 * Writes `apps/web/.assets/packs/<name>.<hash>.pack.gz` (gzipped) and `apps/web/.assets/manifest.json` (git-ignored). Names
 * carry a hash of the pack's contents: re-running after local files change rewrites only the packs whose
 * contents changed (the rest print "unchanged"), and old versions of a pack are removed. Format:
 * `src/lib/asset-pack.ts`.
 *
 *   bun scripts/pack-assets.ts                  every class
 *   bun scripts/pack-assets.ts effects music    only these classes (the manifest keeps the others)
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { usedEffectPaths } from "../src/features/effects/effect-recipes";
import { PACK_MAGIC, PACK_VERSION, type AssetManifest, type PackEntry, type PackHeader } from "../src/lib/asset-pack";
import { ENEMY_SPRITE_MAP } from "./enemy-sprite-map";
import { Progress } from "./lib/fetcher";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");
const EFFECTS = join(HERE, "..", "..", "..", ".docs", "assets", "FFRK-data", "_raw", "effects");
const OUT = join(HERE, "..", ".assets");
const PACKS = join(OUT, "packs");
const MANIFEST = join(OUT, "manifest.json");

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".json": "application/json",
  ".sajson": "application/json",
  ".ogg": "audio/ogg",
};

/** A file to pack: where it is on disk and its path under the asset base. */
interface Source {
  disk: string;
  path: string;
}

/** Every file under a directory, as sources under `prefix`. */
function dir(root: string, prefix: string): Source[] {
  if (!existsSync(root)) return [];
  const out: Source[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push({ disk: p, path: `${prefix}/${relative(root, p).replaceAll("\\", "/")}` });
    }
  };
  walk(root);
  return out;
}

const file = (disk: string, path: string): Source[] => (existsSync(disk) ? [{ disk, path }] : []);

// ---------- effects: the used rigs and everything they reference (same rules as ffrk:effects' crawl) ----------

const CONTENT = /(?:\/Content\/|\.\/)lang\/([A-Za-z0-9_./-]+\.(?:json|png|sajson))/g;
const SOUND = /"id"\s*:\s*"(se_[A-Za-z0-9_]+)"/g;

function effectFiles(): { sources: Source[]; missing: string[] } {
  const seen = new Set<string>();
  const sounds = new Set<string>();
  const missing: string[] = [];
  /** Atlases guessed from a png's name — most images have none, so these aren't "missing". */
  const optional = new Set<string>();
  const queue = usedEffectPaths();
  while (queue.length) {
    const p = queue.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    const disk = join(EFFECTS, p);
    if (!existsSync(disk)) {
      if (!optional.has(p)) missing.push(p);
      continue;
    }
    if (!/\.(json|sajson)$/.test(p)) continue;
    const text = readFileSync(disk, "utf8");
    for (const m of text.matchAll(CONTENT)) {
      const dep = m[1]!.replace(/^ww\/compile\/[a-z]+\//, "").replace(/\/\/+/g, "/");
      queue.push(dep);
      if (dep.endsWith(".png")) {
        const atlas = dep.replace(/\.png$/, ".json");
        optional.add(atlas);
        queue.push(atlas);
      }
    }
    for (const m of text.matchAll(SOUND)) sounds.add(m[1]!);
  }
  for (const id of sounds) {
    const p = `se/se_ogg/${id}.ogg`;
    if (existsSync(join(EFFECTS, p))) seen.add(p);
    else missing.push(p);
  }
  const sources = [...seen].filter((p) => existsSync(join(EFFECTS, p))).map((p) => ({ disk: join(EFFECTS, p), path: `effects/${p}` }));
  return { sources, missing };
}

// ---------- classes ----------

/** Each asset class → its packs (name → files). */
const CLASSES: Record<string, () => Record<string, Source[]>> = {
  heroes: () => ({ heroes: dir(join(PUBLIC, "sprites", "heroes"), "sprites/heroes") }),
  weapons: () => ({ weapons: dir(join(PUBLIC, "sprites", "weapons"), "sprites/weapons") }),
  items: () => ({ items: file(join(PUBLIC, "sprites", "items.png"), "sprites/items.png") }),
  ui: () => ({ ui: dir(join(PUBLIC, "sprites", "ui"), "sprites/ui") }),
  badges: () => ({ badges: dir(join(PUBLIC, "sprites", "badges"), "sprites/badges") }),
  overworld: () => ({ overworld: dir(join(PUBLIC, "sprites", "overworld"), "sprites/overworld") }),
  sfx: () => ({ sfx: dir(join(PUBLIC, "sfx"), "sfx") }),
  enemies: () => ({ enemies: dir(join(PUBLIC, "sprites", "enemies"), "sprites/enemies") }),
  effects: () => {
    const { sources, missing } = effectFiles();
    if (missing.length) console.warn(`effects: ${missing.length} referenced files aren't downloaded (run ffrk:effects): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);
    return { effects: sources };
  },
  // The in-game bosses' FFRK rigs and sheets, for drawing them live (Settings → Live boss animation), at the FFRK
  // server paths the effect player loads: <id>_1.json (rig), img_<id>.png/json, further body sheets img_<id>_N.
  // Masks and overlays (img_mask_…) stay out, as in the baked sprites. Also the rigs' particle and frame-animation
  // files (pb_*.json, .sajson: death puffs, smoke, water…) and the effect images they use that the effects pack lacks.
  bosses: () => {
    const raw = join(EFFECTS, "..", "bosses");
    const ids = [...new Set(Object.values(ENEMY_SPRITE_MAP).flatMap((s) => ("boss" in s ? [s.boss] : [])))];
    const sources: Source[] = [];
    const images = new Set<string>();
    for (const id of ids) {
      const at = (local: string, name: string) => existsSync(join(raw, local)) && sources.push({ disk: join(raw, local), path: `effects/ab/character/boss/${id}/${name}` });
      if (!existsSync(join(raw, `${id}.anim.json`))) continue;
      at(`${id}.anim.json`, `${id}_1.json`);
      at(`${id}.png`, `img_${id}.png`);
      at(`${id}.json`, `img_${id}.json`);
      for (const f of readdirSync(raw).filter((x) => x.startsWith(`${id}~img_${id}_`))) at(f, f.slice(`${id}~`.length));
      for (const f of readdirSync(raw).filter((x) => x.startsWith(`${id}~pb_`) || (x.startsWith(`${id}~`) && x.endsWith(".sajson")))) {
        at(f, f.slice(`${id}~`.length));
        for (const m of readFileSync(join(raw, f), "utf8").matchAll(/(?:\/Content\/|\.\/)lang\/(ab\/effect_image\/[^"]+\.(?:png|json))/g)) images.add(m[1]!);
      }
    }
    const shipped = new Set(effectFiles().sources.map((s) => s.path));
    for (const p of images) if (!shipped.has(`effects/${p}`)) sources.push(...file(join(EFFECTS, p), `effects/${p}`));
    return { bosses: sources };
  },
  music: () =>
    Object.fromEntries(
      dir(join(PUBLIC, "music"), "music")
        .filter((s) => s.path.endsWith(".ogg"))
        .map((s) => [`music/${s.path.split("/").pop()!.replace(/\.ogg$/, "")}`, [s]]),
    ),
};

// ---------- pack ----------

/** Build a pack's bytes; the hash covers paths, types and contents (not the header layout). */
function build(name: string, sources: Source[]) {
  const sorted = [...sources].sort((a, b) => a.path.localeCompare(b.path));
  const hash = createHash("sha256");
  const files: PackEntry[] = [];
  const blobs: Buffer[] = [];
  let offset = 0;
  for (const s of sorted) {
    const data = readFileSync(s.disk);
    const type = TYPES[extname(s.path).toLowerCase()] ?? "application/octet-stream";
    hash.update(`${s.path}\0${type}\0${data.length}\0`).update(data);
    files.push({ path: s.path, type, offset, size: data.length });
    blobs.push(data);
    offset += data.length;
  }
  const header = Buffer.from(JSON.stringify({ name, files } satisfies PackHeader), "utf8");
  const prefix = Buffer.alloc(12);
  prefix.write(PACK_MAGIC, 0, "ascii");
  prefix.writeUInt32LE(PACK_VERSION, 4);
  prefix.writeUInt32LE(header.length, 8);
  return { hash: hash.digest("hex").slice(0, 12), bytes: Buffer.concat([prefix, header, ...blobs]), files: files.length };
}

const fileName = (name: string, hash: string) => `${name.replaceAll("/", "-")}.${hash}.pack.gz`;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

const wanted = process.argv.slice(2);
for (const w of wanted) if (!CLASSES[w]) throw new Error(`Unknown asset class "${w}" (have: ${Object.keys(CLASSES).join(", ")})`);
const classes = wanted.length ? wanted : Object.keys(CLASSES);

mkdirSync(PACKS, { recursive: true });
const previous: AssetManifest | null = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null;
const manifest: AssetManifest = { version: PACK_VERSION, generated: new Date().toISOString(), packs: {} };
// Classes not being packed this time keep their manifest entries.
const classOf = (name: string) => name.split("/")[0]!;
for (const [name, pack] of Object.entries(previous?.packs ?? {})) if (!classes.includes(classOf(name))) manifest.packs[name] = pack;

let written = 0;
let unchanged = 0;
for (const cls of classes) {
  const packs = Object.entries(CLASSES[cls]!()).filter(([, sources]) => sources.length);
  if (!packs.length) {
    console.warn(`${cls}: no files (build them first)`);
    continue;
  }
  const bar = packs.length > 1 ? new Progress(cls, packs.length) : null;
  const lines: string[] = [];
  for (const [name, sources] of packs) {
    const { hash, bytes, files } = build(name, sources);
    const out = fileName(name, hash);
    const path = join(PACKS, out);
    const fresh = !existsSync(path);
    if (fresh) writeFileSync(path, gzipSync(bytes, { level: 9 }));
    fresh ? written++ : unchanged++;
    const gz = statSync(path).size;
    manifest.packs[name] = { file: out, hash, bytes: gz, size: bytes.length, encoding: "gzip", files };
    lines.push(`${name.padEnd(18)} ${String(files).padStart(5)} files  ${mb(bytes.length).padStart(8)} → ${mb(gz).padStart(8)} gz  ${out}${fresh ? "" : "  (unchanged)"}`);
    bar?.tick();
  }
  bar?.done();
  if (packs.length > 1) {
    const total = packs.reduce((n, [name]) => n + manifest.packs[name]!.bytes, 0);
    const changed = lines.filter((l) => !l.endsWith("(unchanged)"));
    console.log(`${cls.padEnd(18)} ${packs.length} packs  ${mb(total)}${changed.length ? `, ${changed.length} rewritten` : ", unchanged"}`);
  } else console.log(lines[0]);
}

// Drop pack files the manifest no longer names (older versions, removed groups).
const keep = new Set(Object.values(manifest.packs).map((p) => p.file));
let removed = 0;
for (const f of readdirSync(PACKS))
  if (!keep.has(f)) {
    rmSync(join(PACKS, f));
    removed++;
  }

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
const total = Object.values(manifest.packs).reduce((n, p) => n + p.bytes, 0);
console.log(`\n${Object.keys(manifest.packs).length} packs, ${mb(total)} — ${written} written, ${unchanged} unchanged, ${removed} old removed → ${relative(process.cwd(), OUT) || "."}`);
