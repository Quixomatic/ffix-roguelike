#!/usr/bin/env bun
/// <reference types="node" />
/**
 * name-ffrk-enemies — put names on FFRK's numbered enemy sheets (`FFRK-data/_raw/enemies/<id>`).
 *
 * The Final Fantasy Wiki hosts ~22k `FFRK_<Name>_<Series>.png` files, most of them FFRK's own sprites at native
 * size. This lists them through the wiki's MediaWiki API, downloads the small ones to `FFRK-data/_wiki/images`
 * (skipping files already there), and matches each against every enemy sheet's `<id>_base` frame pixel for pixel
 * (alpha-trimmed, ±2 px alignment). A match is a share of opaque pixels with the same colour ≥ 0.98.
 * Writes `FFRK-data/enemy-names.json`: id → { name, series, file, score, alts }.
 *
 *   bun scripts/name-ffrk-enemies.ts [--relist]     (--relist: list the wiki again instead of _wiki/files.json)
 *
 * The wiki's CDN answers with WebP unless the URL asks for `format=original`; files that came down as WebP are
 * fetched again.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".docs", "assets", "FFRK-data");
const ENEMIES = join(DATA, "_raw", "enemies");
const WIKI = join(DATA, "_wiki");
const IMAGES = join(WIKI, "images");
const API = "https://finalfantasy.fandom.com/api.php";
const MAX_SIDE = 400;
const MIN_SCORE = 0.98;
const CONCURRENCY = 12;

interface WikiFile {
  name: string;
  url: string;
  width: number;
  height: number;
}

async function listWikiFiles(): Promise<WikiFile[]> {
  const out: WikiFile[] = [];
  let cont: Record<string, string> = {};
  for (;;) {
    const q = new URLSearchParams({ action: "query", list: "allimages", aiprefix: "FFRK", ailimit: "500", aiprop: "url|size", format: "json", ...cont });
    const res = await fetch(`${API}?${q}`, { headers: { "User-Agent": "ffix-roguelike asset research" } });
    const d = (await res.json()) as { query: { allimages: WikiFile[] }; continue?: Record<string, string> };
    out.push(...d.query.allimages);
    if (!d.continue) return out;
    cont = d.continue;
  }
}

async function download(files: WikiFile[]) {
  mkdirSync(IMAGES, { recursive: true });
  const isPng = (file: string) => existsSync(file) && readFileSync(file).subarray(0, 4).toString("hex") === "89504e47";
  const todo = files.filter((f) => !isPng(join(IMAGES, f.name)));
  for (let i = 0; i < todo.length; i += CONCURRENCY)
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (f) => {
        try {
          const res = await fetch(`${f.url}&format=original`, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (res.ok) writeFileSync(join(IMAGES, f.name), new Uint8Array(await res.arrayBuffer()));
        } catch {
          /* skipped; a re-run retries */
        }
      }),
    );
  console.log(`downloaded ${todo.length} new wiki images`);
}

/** An RGBA image cropped to its opaque pixels. */
interface Img {
  w: number;
  h: number;
  px: Uint8Array;
}

function trim(src: PNG, x0 = 0, y0 = 0, w0 = src.width, h0 = src.height): Img | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -1,
    maxY = -1;
  for (let y = y0; y < y0 + h0; y++)
    for (let x = x0; x < x0 + w0; x++)
      if (src.data[(y * src.width + x) * 4 + 3]! > 128) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  if (maxX < 0) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) px.set(src.data.subarray(((minY + y) * src.width + minX) * 4, ((minY + y) * src.width + minX + w) * 4), y * w * 4);
  return { w, h, px };
}

const read = (file: string): PNG | null => {
  try {
    return PNG.sync.read(readFileSync(file));
  } catch {
    return null;
  }
};

/** Share of pixels opaque in either image that are opaque and the same colour in both, best over ±2 px. */
function score(a: Img, b: Img): number {
  if (Math.abs(a.w - b.w) > 3 || Math.abs(a.h - b.h) > 3) return 0;
  let best = 0;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      let union = 0;
      let same = 0;
      const ax0 = Math.max(0, dx);
      const ay0 = Math.max(0, dy);
      const bx0 = Math.max(0, -dx);
      const by0 = Math.max(0, -dy);
      const w = Math.min(a.w - ax0, b.w - bx0);
      const h = Math.min(a.h - ay0, b.h - by0);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = ((ay0 + y) * a.w + ax0 + x) * 4;
          const j = ((by0 + y) * b.w + bx0 + x) * 4;
          const oa = a.px[i + 3]! > 128;
          const ob = b.px[j + 3]! > 128;
          if (!oa && !ob) continue;
          union++;
          if (oa && ob && Math.abs(a.px[i]! - b.px[j]!) + Math.abs(a.px[i + 1]! - b.px[j + 1]!) + Math.abs(a.px[i + 2]! - b.px[j + 2]!) < 24) same++;
        }
      if (union) best = Math.max(best, same / union);
    }
  return best;
}

/** "FFRK_Black_Waltz_No._1_FFIX.png" → { name: "Black Waltz No. 1", series: "FFIX" }. */
function parseName(file: string): { name: string; series: string } {
  const words = file.replace(/^FFRK_/, "").replace(/\.png$/i, "").split("_");
  const last = words.at(-1) ?? "";
  const series = /^(FF[A-Z0-9-]*|X-2|IX|Core|KH|Type-0|T|FFT|FFBE|FFLII|FFRK)$/i.test(last) && words.length > 1 ? words.pop()! : "";
  return { name: words.join(" "), series };
}

let files: WikiFile[];
if (!process.argv.includes("--relist") && existsSync(join(WIKI, "files.json"))) files = JSON.parse(readFileSync(join(WIKI, "files.json"), "utf8"));
else {
  files = await listWikiFiles();
  mkdirSync(WIKI, { recursive: true });
  writeFileSync(join(WIKI, "files.json"), JSON.stringify(files));
}
const small = files.filter((f) => f.width <= MAX_SIDE && f.height <= MAX_SIDE && /\.png$/i.test(f.name));
console.log(`${files.length} FFRK files on the wiki, ${small.length} sprite-sized`);
await download(small);

// Enemy base frames, bucketed by size for the pre-filter.
const enemies: { id: string; img: Img }[] = [];
for (const f of readdirSync(ENEMIES).filter((f) => /^\d+\.json$/.test(f))) {
  const id = f.slice(0, -5);
  const atlas = JSON.parse(readFileSync(join(ENEMIES, f), "utf8")) as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
  const key = Object.keys(atlas.frames).find((k) => k.endsWith("_base.png"));
  const sheet = key && read(join(ENEMIES, `${id}.png`));
  if (!key || !sheet) continue;
  const fr = atlas.frames[key]!.frame;
  const img = trim(sheet, fr.x, fr.y, fr.w, fr.h);
  if (img) enemies.push({ id, img });
}

const found = new Map<string, { score: number; file: string }[]>();
for (const name of readdirSync(IMAGES)) {
  const png = read(join(IMAGES, name));
  const img = png && trim(png);
  if (!img) continue;
  for (const e of enemies) {
    const s = score(img, e.img);
    if (s >= MIN_SCORE) found.set(e.id, [...(found.get(e.id) ?? []), { score: Math.round(s * 1000) / 1000, file: name }]);
  }
}

const out: Record<string, { name: string; series: string; file: string; score: number; alts: string[] }> = {};
for (const { id } of enemies.sort((a, b) => a.id.localeCompare(b.id))) {
  const hits = found.get(id)?.sort((a, b) => b.score - a.score);
  if (!hits) continue;
  const best = hits[0]!;
  out[id] = { ...parseName(best.file), file: best.file, score: best.score, alts: hits.slice(1).map((h) => parseName(h.file).name) };
}
writeFileSync(join(DATA, "enemy-names.json"), `${JSON.stringify(out, null, 1)}\n`);
console.log(`✓ named ${Object.keys(out).length} of ${enemies.length} enemy sheets → ${join(DATA, "enemy-names.json")}`);
