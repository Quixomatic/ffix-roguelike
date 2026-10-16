import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Dev only: serve the downloaded FFRK effect library (`.docs/assets/FFRK-data/_raw/effects`, git-ignored) at
 * `/ffrk-raw/…` so the effects gallery can play any effect. Builds use the packed `public/effects/` set.
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
      server.middlewares.use("/ffrk-raw", (req, res, next) => {
        const file = normalize(join(root, decodeURIComponent((req.url ?? "/").split("?")[0]!)));
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
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
  ],
});
