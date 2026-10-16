#!/usr/bin/env bun
/// <reference types="node" />
/**
 * assets:upload — upload the packs from `assets:pack` (`apps/web/.assets/`) to the R2 bucket under `assets/`:
 * every pack the bucket doesn't have yet (names are content-hashed, so an existing name is the same bytes), then
 * `assets/manifest.json` last, so players never get a manifest naming a pack that isn't there.
 *
 * R2 credentials are the server's (`apps/server/.env`): the package script runs this through varlock from
 * apps/server. The game reads from `VITE_ASSET_BASE_URL` = `<CLOUDFLARE_R2_PUBLIC_URL>/assets`.
 *
 *   pnpm -F web assets:upload            upload new packs + the manifest
 *   pnpm -F web assets:upload --prune    also delete packs in the bucket the manifest no longer names
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { KEYS, storageFromEnv } from "@ffix-roguelike/storage";

import type { AssetManifest } from "../src/lib/asset-pack";
import { Progress } from "./lib/fetcher";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", ".assets");
const MANIFEST = join(OUT, "manifest.json");
const PRUNE = process.argv.includes("--prune");

const storage = storageFromEnv();
if (!storage) throw new Error("R2 isn't configured — set the CLOUDFLARE_R2_* variables in apps/server/.env");
if (!existsSync(MANIFEST)) throw new Error("No packs yet — run `pnpm -F web assets:pack` first");

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as AssetManifest;
const packs = Object.values(manifest.packs);
const present = new Set(await storage.list(KEYS.asset("packs/")));
const missing = packs.filter((p) => !present.has(KEYS.asset(`packs/${p.file}`)));
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

console.log(`${packs.length} packs in the manifest; ${packs.length - missing.length} already in the bucket, ${missing.length} to upload (${mb(missing.reduce((n, p) => n + p.bytes, 0))})`);
if (missing.length) {
  const bar = new Progress("upload", missing.length);
  // A few at a time: packs are large, and R2 is fine with modest concurrency.
  const queue = [...missing];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        await storage.put(KEYS.asset(`packs/${p.file}`), readFileSync(join(OUT, "packs", p.file)), { contentType: "application/octet-stream" });
        bar.tick();
      }
    }),
  );
  bar.done();
}

await storage.put(KEYS.asset("manifest.json"), readFileSync(MANIFEST), { contentType: "application/json" });
console.log(`manifest → ${storage.publicUrl(KEYS.asset("manifest.json"))}`);

if (PRUNE) {
  const keep = new Set(packs.map((p) => KEYS.asset(`packs/${p.file}`)));
  const stale = [...present].filter((k) => !keep.has(k));
  for (const k of stale) await storage.delete(k);
  console.log(`pruned ${stale.length} old pack(s)`);
}
console.log(`\nVITE_ASSET_BASE_URL=${storage.publicUrl("assets")}`);
