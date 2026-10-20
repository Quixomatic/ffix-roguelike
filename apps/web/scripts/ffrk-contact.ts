/**
 * Contact sheets of FFRK's enemy sheets, for picking stand-ins (`enemy-sprite-map.ts`): each sheet's normal pose in a
 * numbered cell, labelled with its sheet id (and its name, in the index, when `ffrk:names` matched one).
 *
 * Run: bun scripts/ffrk-contact.ts [--bosses] [--unnamed | --named | --match <text> | id…] [--out <dir>] [--per <n>]
 *   --bosses    boss rigs instead of enemy sheets, each drawn in its idle pose
 *   --unnamed   only the sheets `ffrk:names` couldn't name (the ones a name search can't find)
 *   --named     only the named ones
 *   --match     named sheets whose name or series contains the text ("bird", "FFV")
 *   id…         just these sheets
 * Writes `<out>/contact-<n>.png` pages (default `.docs/assets/FFRK-data/_contact`, git-ignored with the rest of .docs)
 * and `index.txt` (page, cell → id, name). Read-only on the FFRK data.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { poseAt, visibilityAt, type Rig } from "../src/features/sprites/ffrk-anim";
import { renderPose, type Atlas, type SheetLookup } from "./lib/render-rig";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data");
/** `--bosses`: boss rigs instead of enemy sheets, each drawn in its idle pose. */
const BOSSES = process.argv.includes("--bosses");
const SHEETS = join(ROOT, "_raw", BOSSES ? "bosses" : "enemies");
const names = JSON.parse(readFileSync(join(ROOT, "enemy-names.json"), "utf8")) as Record<string, { name: string; series: string }>;

const args = process.argv.slice(2);
const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const out = opt("--out") ?? join(ROOT, "_contact");
const per = Number(opt("--per") ?? 48);
const match = opt("--match")?.toLowerCase();
const ids = args.filter((a, i) => /^\d+$/.test(a) && !["--out", "--per", "--match"].includes(args[i - 1] ?? ""));

const all = readdirSync(SHEETS)
  .filter((f) => /^\d+\.png$/.test(f))
  .map((f) => f.slice(0, -4))
  .sort();
const pick = ids.length
  ? ids
  : all.filter((id) => {
      const n = names[id];
      if (args.includes("--unnamed")) return !n;
      if (args.includes("--named")) return !!n;
      if (match) return !!n && `${n.name} ${n.series}`.toLowerCase().includes(match);
      return true;
    });

// A 3×5 pixel font for the id labels.
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
const CELL = 112;
const COLS = 8;
const LABEL = 14;

function drawText(img: PNG, text: string, x0: number, y0: number, scale = 2) {
  for (const [i, ch] of [...text].entries()) {
    const bits = DIGITS[Number(ch)];
    if (!bits) continue;
    for (let b = 0; b < 15; b++) {
      if (bits[b] !== "1") continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const x = x0 + i * 4 * scale + (b % 3) * scale + dx;
          const y = y0 + Math.floor(b / 3) * scale + dy;
          const o = (y * img.width + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
          img.data[o + 3] = 255;
        }
    }
  }
}

/** A boss rig's idle pose, drawn the way the sprite build draws it (its first idle frame, with its visibility switches). */
function bossIdle(id: string): PNG | null {
  const base = join(SHEETS, id);
  if (!existsSync(`${base}.anim.json`)) return null;
  const rig = JSON.parse(readFileSync(`${base}.anim.json`, "utf8")) as Rig;
  const main = { sheet: PNG.sync.read(readFileSync(`${base}.png`)), atlas: JSON.parse(readFileSync(`${base}.json`, "utf8")) as Atlas };
  const sheetOf: SheetLookup = (p) => {
    const file = p.url?.split("/").pop();
    if (!file || file === `img_${id}.png`) return main;
    if (!new RegExp(`^img_${id}_\\d+\\.png$`).test(file)) return undefined;
    const extra = join(SHEETS, `${id}~${file}`);
    return existsSync(extra) ? { sheet: PNG.sync.read(readFileSync(extra)), atlas: JSON.parse(readFileSync(extra.replace(/\.png$/, ".json"), "utf8")) as Atlas } : main;
  };
  const tagName = ["idle", ...Object.keys(rig.tag)].find((t) => rig.tag[t]);
  if (!tagName) return null;
  const f = rig.tag[tagName]![0];
  return renderPose(poseAt(rig, f, visibilityAt(rig, tagName, f)), sheetOf).png;
}

/** The sheet's normal pose (`<id>_base.png` in its atlas; a boss rig's idle pose), or the whole sheet. */
function basePose(id: string): PNG {
  if (BOSSES) {
    const idle = bossIdle(id);
    if (idle) return idle;
  }
  const bytes = readFileSync(join(SHEETS, `${id}.png`));
  const sheet = PNG.sync.read(bytes.subarray(0, bytes.lastIndexOf("IEND") + 8));
  const atlasFile = join(SHEETS, `${id}.json`);
  const f = existsSync(atlasFile) ? (JSON.parse(readFileSync(atlasFile, "utf8")).frames?.[`${id}_base.png`]?.frame as { x: number; y: number; w: number; h: number } | undefined) : undefined;
  if (!f) return sheet;
  const pose = new PNG({ width: f.w, height: f.h });
  PNG.bitblt(sheet, pose, f.x, f.y, f.w, f.h, 0, 0);
  return pose;
}

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
const index: string[] = [];
for (let page = 0; page * per < pick.length; page++) {
  const ids = pick.slice(page * per, (page + 1) * per);
  const rows = Math.ceil(ids.length / COLS);
  const img = new PNG({ width: COLS * CELL, height: rows * CELL });
  // A mid-grey checker so dark and light sprites both show.
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      const v = ((Math.floor(x / CELL) + Math.floor(y / CELL)) % 2 ? 0x50 : 0x5c) as number;
      img.data[o] = img.data[o + 1] = v;
      img.data[o + 2] = v + 8;
      img.data[o + 3] = 255;
    }
  for (const [i, id] of ids.entries()) {
    const cx = (i % COLS) * CELL;
    const cy = Math.floor(i / COLS) * CELL;
    const pose = basePose(id);
    // Nearest-neighbour scale to fit above the label: whole numbers up to 3× for small sheets, shrunk for big ones (boss
    // atlases).
    const fit = Math.min((CELL - 4) / pose.width, (CELL - LABEL - 4) / pose.height);
    const s = fit >= 1 ? Math.min(3, Math.floor(fit)) : fit;
    const w = Math.min(Math.floor(pose.width * s), CELL - 2);
    const h = Math.min(Math.floor(pose.height * s), CELL - LABEL - 2);
    const ox = cx + Math.floor((CELL - w) / 2);
    const oy = cy + Math.floor((CELL - LABEL - h) / 2);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const si = (Math.floor(y / s) * pose.width + Math.floor(x / s)) * 4;
        if (pose.data[si + 3]! < 128) continue;
        const di = ((oy + y) * img.width + ox + x) * 4;
        img.data[di] = pose.data[si]!;
        img.data[di + 1] = pose.data[si + 1]!;
        img.data[di + 2] = pose.data[si + 2]!;
        img.data[di + 3] = 255;
      }
    drawText(img, id, cx + 4, cy + CELL - LABEL + 2);
    index.push(`${page + 1}\t${i + 1}\t${id}\t${names[id] ? `${names[id]!.name} (${names[id]!.series})` : "?"}`);
  }
  writeFileSync(join(out, `contact-${page + 1}.png`), PNG.sync.write(img));
}
writeFileSync(join(out, "index.txt"), `page\tcell\tid\tname\n${index.join("\n")}\n`);
console.log(`${pick.length} sheets → ${Math.ceil(pick.length / per)} page(s) in ${out}`);
