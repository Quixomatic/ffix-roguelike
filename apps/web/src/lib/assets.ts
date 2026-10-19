/**
 * Game assets (sprites, effects, music) by path — "sprites/heroes/zidane.png", "effects/ab/…", "music/music006.ogg".
 *
 * With `VITE_ASSET_BASE_URL` set (the R2 bucket's `/assets`), files come from **asset packs**
 * (`pnpm -F web assets:pack` → `assets:upload`): `loadPacks` downloads a pack once (with progress), keeps the
 * whole pack in Cache Storage (pack names are content-hashed, so a changed pack is a new name), and serves its
 * files from memory — `assetUrl` gives a blob URL (Phaser, <img>, CSS), `assetFetch` a Response.
 * Unset — **dev only** — files come from the local build outputs in `public/` (git-ignored) and the dev server's
 * `/ffrk-raw` effect library. Production always uses R2: builds ship no local copies.
 */
import { ENV } from "@/env";
import { cachedFetch } from "@/lib/asset-cache";

import { readPack, type AssetManifest } from "./asset-pack";

const BASE = (ENV.VITE_ASSET_BASE_URL ?? "").replace(/\/+$/, "");
/** Assets come from R2 packs. */
export const REMOTE = BASE !== "";
// The local fallback is the dev server's alone: a production build without R2 has no assets to fall back to.
if (!REMOTE && !import.meta.env.DEV) console.error("VITE_ASSET_BASE_URL is not set: the game's assets load from R2 in production.");

const PACK_CACHE = "ffix-packs-v1";

const files = new Map<string, { url: string; blob: Blob }>();
const loaded = new Map<string, Promise<void>>();
let manifest: Promise<AssetManifest> | null = null;

const clean = (path: string) => path.replace(/^\/+/, "");

/** Where a file lives when it isn't in a loaded pack: the app's public files (effects: the dev library). */
function localUrl(path: string): string {
  if (path.startsWith("effects/")) return `${import.meta.env.DEV ? "/ffrk-raw" : "/effects"}/${path.slice(8)}`;
  return `/${path}`;
}

/** A URL for an asset (a leading "/" is fine — the generated sprite maps use "/sprites/…"). */
export function assetUrl(path: string): string {
  const p = clean(path);
  return files.get(p)?.url ?? localUrl(p);
}

/** `fetch` for an asset: from a loaded pack when it's in one, otherwise the local file (asset-cached). */
export async function assetFetch(path: string): Promise<Response> {
  const p = clean(path);
  const f = files.get(p);
  if (f) return new Response(f.blob, { headers: { "Content-Type": f.blob.type } });
  return cachedFetch(localUrl(p));
}

export function assetManifest(): Promise<AssetManifest> {
  manifest ??= fetch(`${BASE}/manifest.json`, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`Asset manifest: HTTP ${r.status}`);
    return r.json() as Promise<AssetManifest>;
  });
  manifest.catch(() => (manifest = null));
  return manifest;
}

const openCache = () => (typeof caches === "undefined" ? Promise.resolve(null) : caches.open(PACK_CACHE).catch(() => null));

/** Download a pack (or read it from Cache Storage, where it's kept unzipped), reporting bytes as they arrive. */
async function packBytes(url: string, gzip: boolean, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const cache = await openCache();
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Asset pack ${url}: HTTP ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    onBytes(value.byteLength);
  }
  const blob = new Blob(chunks);
  // The browser's own gzip decoder (no library).
  const buf = gzip ? await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer() : await blob.arrayBuffer();
  await cache?.put(url, new Response(buf)).catch(() => undefined);
  return buf;
}

export interface PackProgress {
  done: number;
  total: number;
}

/**
 * Make these packs' files available ("heroes", "effects", "music/music006"…). Packs already loaded are skipped;
 * `onProgress` gets bytes over all of them (cached packs count as done at once). No-op without R2.
 */
export async function loadPacks(names: string[], onProgress?: (p: PackProgress) => void): Promise<void> {
  if (!REMOTE) return;
  const m = await assetManifest();
  const wanted = names.filter((n) => m.packs[n]);
  const total = wanted.reduce((n, name) => n + m.packs[name]!.bytes, 0);
  let done = 0;
  const report = () => onProgress?.({ done: Math.min(done, total), total });
  report();
  await Promise.all(
    wanted.map((name) => {
      const pack = m.packs[name]!;
      let mine = 0;
      const run =
        loaded.get(name) ??
        packBytes(`${BASE}/packs/${pack.file}`, pack.encoding === "gzip", (n) => {
          mine += n;
          done += n;
          report();
        }).then((buf) => {
          const { header, file } = readPack(buf);
          for (const e of header.files) {
            const blob = new Blob([file(e)], { type: e.type });
            files.set(e.path, { url: URL.createObjectURL(blob), blob });
          }
        });
      loaded.set(name, run);
      run.catch(() => loaded.delete(name));
      return run.then(() => {
        done += pack.bytes - mine;
        report();
      });
    }),
  );
}

/** Drop cached packs the manifest no longer lists (older versions). */
export async function prunePackCache(): Promise<void> {
  if (!REMOTE) return;
  const [m, cache] = await Promise.all([assetManifest(), openCache()]);
  if (!cache) return;
  const keep = new Set(Object.values(m.packs).map((p) => `${BASE}/packs/${p.file}`));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

/** The packs every session needs before the game renders. */
export const BOOT_PACKS = ["heroes", "weapons", "items", "ui", "badges", "overworld", "sfx", "enemies", "effects", "bosses"];
