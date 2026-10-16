/**
 * Asset cache: game files (music, sound effects, FFRK effect files) kept in the browser's Cache Storage, so they're
 * downloaded once and then read from disk — even across hard reloads, which bypass the normal HTTP cache. Bump
 * `CACHE` when shipped asset files change in place (new files with new names don't need it).
 */
const CACHE = "ffix-assets-v1";

let opened: Promise<Cache | null> | null = null;
const open = () => (opened ??= typeof caches === "undefined" ? Promise.resolve(null) : caches.open(CACHE).catch(() => null));

// Old cache versions are dropped once, in the background.
if (typeof caches !== "undefined")
  void caches
    .keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ffix-assets-") && k !== CACHE).map((k) => caches.delete(k))))
    .catch(() => undefined);

/** `fetch`, answered from the asset cache when possible (only successful responses are stored). */
export async function cachedFetch(url: string): Promise<Response> {
  const cache = await open();
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) return hit;
  const res = await fetch(url);
  if (res.ok && cache) await cache.put(url, res.clone()).catch(() => undefined);
  return res;
}

/** Download these files into the cache in the background (when the browser is idle), a few at a time. */
export function warmCache(urls: string[]) {
  const run = async () => {
    const cache = await open();
    if (!cache) return;
    for (const url of urls) {
      if (await cache.match(url).catch(() => undefined)) continue;
      await cachedFetch(url).catch(() => undefined);
    }
  };
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(() => void run());
  else setTimeout(() => void run(), 2000);
}
