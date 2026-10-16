import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { varlockVitePlugin } from "@varlock/vite-integration";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * Dev only: serve the downloaded FFRK effect library (`.docs/assets/FFRK-data/_raw/effects`, git-ignored) at
 * `/ffrk-raw/…` so the effects gallery can play any effect. Builds use the packed `public/effects/` set.
 * `PUT /ffrk-raw/__map` saves the gallery's ability → effect assignments to `src/features/effects/ability-effects.json`.
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
            JSON.parse(body);
            writeFileSync(join(__dirname, "src", "features", "effects", "ability-effects.json"), body);
            res.statusCode = 204;
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
