import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Dev only: serve the downloaded FFRK effect library (`.docs/assets/FFRK-data/_raw/effects`, git-ignored) at
 * `/ffrk-raw/…` so the effects gallery can play any effect. The game itself loads effects from the R2 effects pack.
 * `PUT /ffrk-raw/__map` merges the gallery's changed assignments (`{ set, remove }`) into
 * `src/features/effects/ability-effects.json` and returns the whole map.
 */
function ffrkRawEffects(): Plugin {
  const root = join(__dirname, "..", "..", ".docs", "assets", "FFRK-data", "_raw", "effects");
  const types: Record<string, string> = { ".json": "application/json", ".sajson": "application/json", ".png": "image/png", ".ogg": "audio/ogg" };
  return {
    name: "ffrk-raw-effects",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/ffrk-raw/__map", (req, res, next) => {
        if (req.method !== "PUT") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            // A patch, merged into the file on disk — a stale gallery tab can't overwrite newer assignments.
            const patch = JSON.parse(body) as { set?: Record<string, unknown>; remove?: string[] };
            const file = join(__dirname, "src", "features", "effects", "ability-effects.json");
            const map = JSON.parse(readFileSync(file, "utf8")) as { abilities: Record<string, unknown> };
            Object.assign(map.abilities, patch.set ?? {});
            for (const key of patch.remove ?? []) delete map.abilities[key];
            const out = `${JSON.stringify(map, null, 2)}\n`;
            writeFileSync(file, out);
            res.setHeader("Content-Type", "application/json");
            res.end(out);
            return;
          } catch {
            res.statusCode = 400;
          }
          res.end();
        });
      });
      // Boss rigs by their FFRK server paths (ab/character/boss/<id>/…), from the boss downloads (`ffrk:fetch bosses`):
      // `<id>_1.json` is the rig, `img_<id>.png/json` the main sheet, other sheets `<id>~<file>`. For Practice's live
      // boss animation (admin, dev only).
      const bosses = join(root, "..", "bosses");
      server.middlewares.use("/ffrk-raw/ab/character/boss", (req, res, next) => {
        const m = /^\/(\d+)\/([^/?]+)/.exec(decodeURIComponent(req.url ?? ""));
        if (!m) return next();
        const [, id, name] = m;
        const local = name === `${id}_1.json` ? `${id}.anim.json` : name === `img_${id}.png` ? `${id}.png` : name === `img_${id}.json` ? `${id}.json` : `${id}~${name}`;
        const file = normalize(join(bosses, local));
        if (!file.startsWith(bosses) || !existsSync(file)) return next();
        res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
      server.middlewares.use("/ffrk-raw", (req, res, next) => {
        const file = normalize(join(root, decodeURIComponent((req.url ?? "/").split("?")[0]!)));
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * Build only: when the game loads its assets from R2 (`VITE_ASSET_BASE_URL`), don't ship the copies in `public/`
 * (sprites, music, menu sounds — ~64 MB) in the build output; they're only the dev fallback.
 */
function dropPackedAssets(): Plugin {
  let outDir = "";
  let remote = false;
  return {
    name: "drop-packed-assets",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
      remote = !!(config.env.VITE_ASSET_BASE_URL ?? process.env.VITE_ASSET_BASE_URL);
    },
    closeBundle() {
      if (!remote) return;
      for (const dir of ["sprites", "music", "sfx"]) rmSync(join(outDir, dir), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    varlockVitePlugin({ ssrInjectMode: "auto-load" }),
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    ffrkRawEffects(),
    dropPackedAssets(),
  ],
});
