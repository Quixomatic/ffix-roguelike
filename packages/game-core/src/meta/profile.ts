/**
 * Permanent progression between runs: unlocked characters, their builds (level/EXP/AP/equipment), the gear
 * stash, banked gil and lifetime stats. The server persists this in Postgres; these are the pure rules.
 */
import { getItem, MAIN_CAST, type EquipSlot } from "@ffix-roguelike/game-data";

import type { RunOutcome } from "../run/run";
import { activeSupports, canEquip, newBuild, type CharacterBuild } from "../stats";

export interface ProfileStats {
  runs: number;
  wins: number;
  battles: number;
  bossKills: Record<string, number>;
  eaten: number;
  steals: number;
  bestWorld: number;
  highestTierWon: number;
}

export interface Profile {
  gil: number;
  unlocked: string[];
  builds: Record<string, CharacterBuild>;
  stash: Record<number, number>;
  stats: ProfileStats;
  /** Highest difficulty tier the player may start (wins unlock the next). */
  maxTier: number;
}

export const STARTING_CAST = ["zidane", "vivi", "steiner"];
export const MAX_TIER = 5;

export interface UnlockRule {
  key: string;
  hint: string;
  check(p: Profile): boolean;
}

export const UNLOCKS: UnlockRule[] = [
  { key: "garnet", hint: "Defeat Garland", check: (p) => (p.stats.bossKills.garland ?? 0) > 0 },
  { key: "freya", hint: "Win 15 battles", check: (p) => p.stats.battles >= 15 },
  { key: "quina", hint: "Finish 3 runs", check: (p) => p.stats.runs >= 3 },
  { key: "eiko", hint: "Defeat Golbez", check: (p) => (p.stats.bossKills.golbez ?? 0) > 0 },
  { key: "amarant", hint: "Steal 20 items", check: (p) => p.stats.steals >= 20 },
  { key: "beatrix", hint: "Defeat Kefka", check: (p) => (p.stats.bossKills.kefka ?? 0) > 0 },
  { key: "blank", hint: "Win a run on Tier 1 or higher", check: (p) => p.stats.highestTierWon >= 1 },
];

export function newProfile(): Profile {
  const builds: Record<string, CharacterBuild> = {};
  for (const key of [...MAIN_CAST, "beatrix", "blank"]) builds[key] = newBuild(key, 1);
  return {
    gil: 0,
    unlocked: [...STARTING_CAST],
    builds,
    stash: {},
    stats: { runs: 0, wins: 0, battles: 0, bossKills: {}, eaten: 0, steals: 0, bestWorld: 0, highestTierWon: -1 },
    maxTier: 0,
  };
}

export interface RunReport {
  profile: Profile;
  newlyUnlocked: string[];
  tierUnlocked: number | null;
}

/** Fold a finished run into the profile. */
export function applyRunOutcome(profile: Profile, outcome: RunOutcome, tier: number): RunReport {
  const p = structuredClone(profile);
  for (const b of outcome.builds) p.builds[b.key] = b;
  // The stash brought into the run is fully represented in the outcome (equipped + unequipped).
  p.stash = { ...outcome.stash };
  p.gil += outcome.gilEarned;
  p.stats.runs++;
  p.stats.battles += outcome.stats.battles;
  p.stats.eaten += outcome.stats.eaten;
  p.stats.steals += outcome.stats.steals;
  p.stats.bestWorld = Math.max(p.stats.bestWorld, outcome.worldReached);
  for (const id of outcome.stats.bossKills) p.stats.bossKills[id] = (p.stats.bossKills[id] ?? 0) + 1;
  let tierUnlocked: number | null = null;
  if (outcome.won) {
    p.stats.wins++;
    p.stats.highestTierWon = Math.max(p.stats.highestTierWon, tier);
    if (tier === p.maxTier && p.maxTier < MAX_TIER) {
      p.maxTier++;
      tierUnlocked = p.maxTier;
    }
  }
  const newlyUnlocked = UNLOCKS.filter((u) => !p.unlocked.includes(u.key) && u.check(p)).map((u) => u.key);
  p.unlocked.push(...newlyUnlocked);
  return { profile: p, newlyUnlocked, tierUnlocked };
}

/**
 * Stash items not currently equipped by party members who'll be brought into a run. Characters left at home
 * keep their gear on.
 */
export function runStash(profile: Profile): Record<number, number> {
  return { ...profile.stash };
}

export class ProfileError extends Error {}

/** Between runs: equip an item from the stash (or unequip with null). The removed piece returns to the stash. */
export function equipFromStash(profile: Profile, key: string, slot: EquipSlot, itemId: number | null): Profile {
  const p = structuredClone(profile);
  const build = p.builds[key];
  if (!build || !p.unlocked.includes(key)) throw new ProfileError("Character not available");
  if (itemId == null && slot === "weapon") throw new ProfileError("A weapon is required");
  if (itemId != null) {
    if ((p.stash[itemId] ?? 0) <= 0) throw new ProfileError("You don't have that");
    if (!canEquip(key, getItem(itemId), slot)) throw new ProfileError("Can't equip that there");
    p.stash[itemId]!--;
    if (p.stash[itemId] === 0) delete p.stash[itemId];
  }
  const old = build.equipment[slot];
  if (old != null) p.stash[old] = (p.stash[old] ?? 0) + 1;
  build.equipment[slot] = itemId;
  build.supports = build.supports.filter((id) => activeSupports(build).has(id));
  return p;
}

export function setProfileSupports(profile: Profile, key: string, supports: number[]): Profile {
  const p = structuredClone(profile);
  const build = p.builds[key];
  if (!build || !p.unlocked.includes(key)) throw new ProfileError("Character not available");
  const candidate = { ...build, supports: [...new Set(supports)] };
  if (activeSupports(candidate).size !== candidate.supports.length) throw new ProfileError("Not enough magic stones, or ability not available");
  build.supports = candidate.supports;
  return p;
}
