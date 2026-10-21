/**
 * Node-only: load FF9 battle data from the seed files (packages/db/seed/ff9, written by
 * scripts/import-ff9-battles.ts). Used by tests and the simulator so they run without a database; the server
 * loads the same data from Postgres. Not exported from the package root (the web bundle never needs fs).
 *
 *   import { loadFf9Cache, loadBattleScriptCache } from "@ffix-roguelike/game-data/cache";
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { registerBestiary, registerGameData, registerRewardTables, type GameData, type RewardTables } from "./index";
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

/** Read the cached FF9 game tables (characters, abilities, items…) and register them. */
export function loadGameDataCache(): GameData {
  const data: GameData = {
    actions: read("actions.json"),
    characters: read("characters.json"),
    items: read("items.json"),
    leveling: read("leveling.json"),
    statuses: read("statuses.json"),
    supportAbilities: read("support-abilities.json"),
    synthesis: read("synthesis.json"),
    shops: read("shops.json"),
  };
  registerGameData(data);
  return data;
}

/** The committed reward / gear-availability seed data (packages/db/seed/rewards) — what the server seeds into Postgres. */
export const REWARD_CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "seed", "rewards");
export const REWARD_SEED_FILES = {
  rarities: "rarities.json",
  roles: "roles.json",
  sources: "sources.json",
  boons: "boons.json",
  gear: "gear-availability.json",
  starter: "starter-upgrades.json",
  achievements: "achievements.json",
  relics: "relics.json",
  synergies: "synergies.json",
  characterTags: "character-tags.json",
  journeyGroups: "journey-groups.json",
  areas: "areas.json",
  journeys: "journeys.json",
  challengeCategories: "challenge-categories.json",
  challenges: "challenges.json",
} as const;

export const hasRewardCache = () => Object.values(REWARD_SEED_FILES).every((f) => existsSync(join(REWARD_CACHE_DIR, f)));

/** Read the reward tables from their seed files and register them. */
export function loadRewardCache(): RewardTables {
  const read = <T>(f: string) => JSON.parse(readFileSync(join(REWARD_CACHE_DIR, f), "utf8")) as T;
  const tables: RewardTables = {
    rarities: read(REWARD_SEED_FILES.rarities),
    roles: read(REWARD_SEED_FILES.roles),
    sources: read(REWARD_SEED_FILES.sources),
    boons: read(REWARD_SEED_FILES.boons),
    gear: read(REWARD_SEED_FILES.gear),
    starter: read(REWARD_SEED_FILES.starter),
    achievements: read(REWARD_SEED_FILES.achievements),
    relics: read(REWARD_SEED_FILES.relics),
    synergies: read(REWARD_SEED_FILES.synergies),
    characterTags: read(REWARD_SEED_FILES.characterTags),
    journeyGroups: read(REWARD_SEED_FILES.journeyGroups),
    areas: read(REWARD_SEED_FILES.areas),
    journeys: read(REWARD_SEED_FILES.journeys),
    challengeCategories: read(REWARD_SEED_FILES.challengeCategories),
    challenges: read(REWARD_SEED_FILES.challenges),
  };
  registerRewardTables(tables);
  return tables;
}

/** Everything a game-rules process needs except battle scripts: game tables + bestiary (+ reward tables, once seeded). */
export function loadFf9Cache(): void {
  loadGameDataCache();
  loadBestiaryCache();
  if (hasRewardCache()) loadRewardCache();
}
