/**
 * Permanent progression between runs: unlocked characters, their builds (level/EXP/AP/equipment), the gear
 * stash, banked gil and lifetime stats. The server persists this in Postgres; these are the pure rules.
 */
import { getItem, MAIN_CAST, type EquipSlot, type SynthesisRecipe } from "@ffix-roguelike/game-data";

import { WORLDS } from "../content/worlds";
import { recipesUpTo } from "../run/loot";

import type { RunOutcome } from "../run/run";
import { activeSupports, canEquip, emptyRecord, getStarterWeapon, loadoutSlots, loadoutUsed, newBuild, nextLoadoutUnlock, type CharacterBuild } from "../stats";

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

export const STARTING_CAST = ["zidane"];
export const MAX_TIER = 5;

export interface UnlockRule {
  key: string;
  hint: string;
  check(p: Profile): boolean;
}

/** In unlock order: the roster grows one companion at a time. */
export const UNLOCKS: UnlockRule[] = [
  { key: "vivi", hint: "Win 3 battles", check: (p) => p.stats.battles >= 3 },
  { key: "steiner", hint: "Finish your first run", check: (p) => p.stats.runs >= 1 },
  { key: "garnet", hint: "Defeat Garland", check: (p) => (p.stats.bossKills.garland ?? 0) > 0 },
  { key: "freya", hint: "Win 40 battles", check: (p) => p.stats.battles >= 40 },
  { key: "quina", hint: "Finish 6 runs", check: (p) => p.stats.runs >= 6 },
  { key: "amarant", hint: "Steal 15 items", check: (p) => p.stats.steals >= 15 },
  { key: "eiko", hint: "Defeat Golbez", check: (p) => (p.stats.bossKills.golbez ?? 0) > 0 },
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
  for (const b of outcome.builds) {
    const record = { ...(b.record ?? emptyRecord()) };
    record.runs++;
    if (outcome.won) record.wins++;
    record.bossKills += outcome.stats.bossKills.length;
    p.builds[b.key] = { ...b, record };
  }
  // The stash stayed at camp; add whatever the run brought home.
  for (const [id, n] of Object.entries(outcome.stash)) p.stash[Number(id)] = (p.stash[Number(id)] ?? 0) + n;
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


export class ProfileError extends Error {}

/** Between runs: equip an item from the stash (or unequip with null). The removed piece returns to the stash. */
export function equipFromStash(profile: Profile, key: string, slot: EquipSlot, itemId: number | null): Profile {
  const p = structuredClone(profile);
  const build = p.builds[key];
  if (!build || !p.unlocked.includes(key)) throw new ProfileError("Character not available");
  if (itemId == null && slot === "weapon" && build.equipment.weapon === getStarterWeapon(key)) throw new ProfileError("A weapon is required");
  if (itemId != null) {
    if ((p.stash[itemId] ?? 0) <= 0) throw new ProfileError("You don't have that");
    if (!canEquip(key, getItem(itemId), slot)) throw new ProfileError("Can't equip that there");
    p.stash[itemId]!--;
    if (p.stash[itemId] === 0) delete p.stash[itemId];
  }
  const old = build.equipment[slot];
  const starter = getStarterWeapon(key);
  // Is this a new loadout piece (filling a slot that was empty / held the free starting weapon)?
  const addsPiece = itemId != null && (old == null || (slot === "weapon" && old === starter)) && !(slot === "weapon" && itemId === starter);
  if (addsPiece && loadoutUsed(build).length >= loadoutSlots(build)) {
    const next = nextLoadoutUnlock(build);
    throw new ProfileError(
      loadoutSlots(build) === 0
        ? `No loadout slots yet${next ? ` — unlocks after ${next.hint} with this character` : ""}`
        : `Loadout full (${loadoutSlots(build)})${next ? ` — next slot after ${next.hint}` : ""}`,
    );
  }
  if (old != null && !(slot === "weapon" && old === starter)) p.stash[old] = (p.stash[old] ?? 0) + 1;
  build.equipment[slot] = itemId ?? (slot === "weapon" ? starter : null);
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

/** Synthesis tier available at camp: the furthest world reached, and Hades Workshop (39) after a win. */
export function campSynthTier(profile: Profile): number {
  if (profile.stats.wins > 0) return 39;
  return WORLDS[Math.min(WORLDS.length - 1, profile.stats.bestWorld)]!.synthTier;
}

/** Recipes the camp workshop can make: unlocked tier, and gear-only ingredients (the stash holds gear). */
export function campRecipes(profile: Profile): SynthesisRecipe[] {
  return recipesUpTo(campSynthTier(profile)).filter((r) => r.ingredients.every((id) => getItem(id).kind !== "item"));
}

/** Synthesize at camp from stash gear and banked gil; the result goes to the stash. */
export function synthesizeAtCamp(profile: Profile, recipeId: number): Profile {
  const recipe = campRecipes(profile).find((r) => r.id === recipeId);
  if (!recipe) throw new ProfileError("That recipe isn't available yet");
  if (profile.gil < recipe.price) throw new ProfileError("Not enough gil");
  const p = structuredClone(profile);
  for (const id of recipe.ingredients) {
    if ((p.stash[id] ?? 0) <= 0) throw new ProfileError(`Missing ${getItem(id).name} in your stash`);
    p.stash[id]!--;
    if (p.stash[id] === 0) delete p.stash[id];
  }
  p.gil -= recipe.price;
  p.stash[recipe.result] = (p.stash[recipe.result] ?? 0) + 1;
  return p;
}
