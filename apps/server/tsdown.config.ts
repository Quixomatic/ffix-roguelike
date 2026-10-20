import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "tsdown";

/** The FF9 and reward seed files the server loads into Postgres on boot (packages/db/seed). */
const SEED_SRC = join(import.meta.dirname, "..", "..", "packages", "db", "seed");
/**
 * Where the bundled seeders look for them: they resolve `../seed/<table>` from their own file, which is
 * dist/index.mjs once bundled, so apps/server/seed (git-ignored, rebuilt by every build).
 */
const SEED_OUT = join(import.meta.dirname, "seed");

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  deps: {
    alwaysBundle: [/@ffix-roguelike\/.*/],
  },
  onSuccess: () => {
    rmSync(SEED_OUT, { recursive: true, force: true });
    cpSync(SEED_SRC, SEED_OUT, { recursive: true });
  },
});
