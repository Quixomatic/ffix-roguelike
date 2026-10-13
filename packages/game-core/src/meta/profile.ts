/**
 * Permanent progression between runs: unlocked characters, their builds (start level, Completion Points, gear
 * slots, AP, FF9 growth pool, loadout), the gear stash, banked gil and lifetime stats. The server persists this
 * in Postgres; these are the pure rules.
 *
 * Inside a run, characters level with FF9's normal EXP system from their start level. When the run ends, levels
 * reset and each party member earns Completion Points (CP), spent before the next run on a higher start level or
 * a loadout gear slot. Gear found in a run is only kept if the run is won.
 */
import { getItem, MAIN_CAST, shops, type EquipSlot, type SynthesisRecipe } from "@ffix-roguelike/game-data";

import { WORLDS } from "../content/worlds";
import { recipesUpTo } from "../run/loot";
import type { RunOutcome } from "../run/run";
import {
  activeSupports,
  canEquip,
  emptyRecord,
  expForLevel,
  getStarterWeapon,
  loadoutSlots,
  loadoutUsed,
  newBuild,
  nextSlotCost,
  type CharacterBuild,
} from "../stats";

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
  /** Banked gil — the out-of-run currency (camp shop, workshop). */
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

export class ProfileError extends Error {}

// ── end of run ───────────────────────────────────────────────────────────────
export interface RunReport {
  profile: Profile;
  newlyUnlocked: string[];
  tierUnlocked: number | null;
  /** Completion Points earned per character this run. */
  points: Record<string, number>;
}

/** Completion Points for one character at the end of a run. */
export function completionPoints(levelsGained: number, bossesDefeated: number, won: boolean): number {
  return levelsGained + bossesDefeated * 3 + (won ? 10 : 0);
}

/** Fold a finished run into the profile. */
export function applyRunOutcome(profile: Profile, outcome: RunOutcome, tier: number): RunReport {
  const p = structuredClone(profile);
  const points: Record<string, number> = {};
  for (const b of outcome.builds) {
    const before = profile.builds[b.key];
    const record = { ...(b.record ?? emptyRecord()) };
    record.runs++;
    if (outcome.won) record.wins++;
    record.bossKills += outcome.stats.bossKills.length;
    // Levels reset to the start level and become CP. AP (mastered abilities) and the FF9 growth pool are permanent.
    const startLevel = before?.level ?? 1;
    const earned = completionPoints(Math.max(0, b.level - startLevel), outcome.stats.bossKills.length, outcome.won);
    points[b.key] = earned;
    p.builds[b.key] = {
      ...b,
      record,
      level: startLevel,
      exp: expForLevel(startLevel),
      points: (before?.points ?? 0) + earned,
      slots: before?.slots ?? 0,
    };
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
  return { profile: p, newlyUnlocked, tierUnlocked, points };
}

// ── spending Completion Points ───────────────────────────────────────────────
/** CP needed to raise a start level from `level` to `level + 1`. */
export const startLevelCost = (level: number) => level;

function editable(profile: Profile, key: string) {
  const p = structuredClone(profile);
  const b = p.builds[key];
  if (!b || !p.unlocked.includes(key)) throw new ProfileError("Character not available");
  return { p, b };
}

/** Spend CP to raise a character's start level by one. */
export function raiseStartLevel(profile: Profile, key: string): Profile {
  const { p, b } = editable(profile, key);
  if (b.level >= 99) throw new ProfileError("Already at the maximum level");
  const cost = startLevelCost(b.level);
  if ((b.points ?? 0) < cost) throw new ProfileError(`Need ${cost} CP`);
  b.points = (b.points ?? 0) - cost;
  b.level++;
  b.exp = expForLevel(b.level);
  return p;
}

/** Spend CP on the next loadout gear slot. */
export function buyLoadoutSlot(profile: Profile, key: string): Profile {
  const { p, b } = editable(profile, key);
  const cost = nextSlotCost(b);
  if (cost == null) throw new ProfileError("All gear slots unlocked");
  if ((b.points ?? 0) < cost) throw new ProfileError(`Need ${cost} CP`);
  b.points = (b.points ?? 0) - cost;
  b.slots = loadoutSlots(b) + 1;
  return p;
}

// ── loadout & abilities before a run ─────────────────────────────────────────
/** Equip an item from the stash into a bought gear slot (or unequip with null). The removed piece returns to the stash. */
export function equipFromStash(profile: Profile, key: string, slot: EquipSlot, itemId: number | null): Profile {
  const { p, b: build } = editable(profile, key);
  const starter = getStarterWeapon(key);
  if (itemId == null && slot === "weapon" && build.equipment.weapon === starter) throw new ProfileError("A weapon is required");
  if (itemId != null) {
    if ((p.stash[itemId] ?? 0) <= 0) throw new ProfileError("You don't have that");
    if (!canEquip(key, getItem(itemId), slot)) throw new ProfileError("Can't equip that there");
  }
  const old = build.equipment[slot];
  // Is this a new loadout piece (filling a slot that was empty / held the free starting weapon)?
  const addsPiece = itemId != null && (old == null || (slot === "weapon" && old === starter)) && !(slot === "weapon" && itemId === starter);
  if (addsPiece && loadoutUsed(build).length >= loadoutSlots(build)) {
    throw new ProfileError(
      loadoutSlots(build) === 0 ? "No gear slots yet — buy one with Completion Points" : `All ${loadoutSlots(build)} gear slots are full — buy another with CP`,
    );
  }
  if (itemId != null) {
    p.stash[itemId]!--;
    if (p.stash[itemId] === 0) delete p.stash[itemId];
  }
  if (old != null && !(slot === "weapon" && old === starter)) p.stash[old] = (p.stash[old] ?? 0) + 1;
  build.equipment[slot] = itemId ?? (slot === "weapon" ? starter : null);
  build.supports = build.supports.filter((id) => activeSupports(build).has(id));
  return p;
}

export function setProfileSupports(profile: Profile, key: string, supports: number[]): Profile {
  const { p, b: build } = editable(profile, key);
  const candidate = { ...build, supports: [...new Set(supports)] };
  if (activeSupports(candidate).size !== candidate.supports.length) throw new ProfileError("Not enough magic stones, or ability not available");
  build.supports = candidate.supports;
  return p;
}

// ── camp shop & workshop (banked gil) ────────────────────────────────────────
/** Gear sold at camp: the FF9 shops of every world you've reached. Prices in banked gil. */
export function campShopStock(profile: Profile): { itemId: number; price: number }[] {
  const reached = WORLDS.slice(0, Math.min(WORLDS.length, profile.stats.bestWorld + 1));
  const ids = new Set(reached.flatMap((w) => w.shops.flatMap((id) => shops.find((s) => s.id === id)?.items ?? [])));
  return [...ids]
    .map((id) => getItem(id))
    .filter((i) => i.kind !== "item" && !i.effect && i.price > 0)
    .sort((a, b) => a.price - b.price)
    .map((i) => ({ itemId: i.id, price: i.price }));
}

/** Buy gear at camp with banked gil; it goes straight to the stash. */
export function buyAtCamp(profile: Profile, itemId: number): Profile {
  const entry = campShopStock(profile).find((e) => e.itemId === itemId);
  if (!entry) throw new ProfileError("Not sold here yet — reach further worlds");
  if (profile.gil < entry.price) throw new ProfileError("Not enough gil");
  const p = structuredClone(profile);
  p.gil -= entry.price;
  p.stash[itemId] = (p.stash[itemId] ?? 0) + 1;
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
