/**
 * Node-only: load FF9 battle data from the seed files (packages/db/seed/ff9, written by
 * scripts/import-ff9-battles.ts). Used by tests and the simulator so they run without a database; the server
 * loads the same data from Postgres. Not exported from the package root (the web bundle never needs fs).
 *
 *   import { loadBestiaryCache, loadBattleScriptCache } from "@ffix-roguelike/game-data/cache";
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { registerBestiary } from "./index";
import type { FF9Bestiary } from "./types";

/** The committed FF9 seed data (packages/db/seed/ff9) — what the server loads into Postgres. */
export const FF9_CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "seed", "ff9");

function read<T>(file: string): T {
  const path = join(FF9_CACHE_DIR, file);
  if (!existsSync(path)) {
    throw new Error(
      `FF9 battle data cache missing (${path}). Run: pnpm -F @ffix-roguelike/game-data import:battles <BattleMap export dir>`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export const hasBestiaryCache = () => existsSync(join(FF9_CACHE_DIR, "bestiary.json"));

/** Read the cached bestiary and register it. */
export function loadBestiaryCache(): FF9Bestiary {
  const data = read<FF9Bestiary>("bestiary.json");
  registerBestiary(data);
  return data;
}

/** Cached battle AI scripts: scene id → base64 of the .eb bytes. */
export function loadBattleScriptCache(): Record<string, string> {
  return read<Record<string, string>>("battle-scripts.json");
}
