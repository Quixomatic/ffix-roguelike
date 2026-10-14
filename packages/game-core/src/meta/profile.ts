/**
 * Permanent progression between runs: unlocked characters, their builds (start level, Completion Points, gear
 * slots, AP, FF9 growth pool, loadout), the gear stash, banked gil and lifetime stats. The server persists this
 * in Postgres; these are the pure rules.
 *
 * Inside a run, characters level with FF9's normal EXP system from their start level. When the run ends, levels
 * reset and each party member earns Completion Points (CP), spent before the next run on a higher start level or
 * a loadout gear slot. Gear found in a run is only kept if the run is won.
 */
import { getItem, itemByName, items, MAIN_CAST, type EquipSlot } from "@ffix-roguelike/game-data";

import { getArea, getJourney, JOURNEYS, journeyUnlocked, WORLDS } from "../content/worlds";
import { baseGear, effectivePrice, isGear } from "../run/loot";
import type { RunOutcome } from "../run/run";
import {
  activeSupports,
  emptyRecord,
  expForLevel,
  newBuild,
  nextSlotCost,
  slotUnlocked,
  starterGear,
  UNLOCKABLE_SLOTS,
  type CharacterBuild,
} from "../stats";
import { awardAchievements, LEGENDARY_ITEMS } from "./achievements";

export interface ProfileStats {
  runs: number;
  wins: number;
  battles: number;
  bossKills: Record<string, number>;
  eaten: number;
  steals: number;
  bestWorld: number;
  highestTierWon: number;
  /** Characters who have won a run as the only party member. */
  soloWins?: string[];
  /** Characters who were in the party when the final journey (Terra & Memoria) was cleared. */
  legendClears?: string[];
}

export interface Profile {
  /** Banked gil — the out-of-run currency (camp shop, workshop). */
  gil: number;
  unlocked: string[];
  builds: Record<string, CharacterBuild>;
  /** Supplies (consumables) bought at camp, packed into the next run. */
  stash: Record<number, number>;
  /** Gear unlocked into run drop pools (catalog, achievements, won runs). */
  gearUnlocked?: number[];
  /** Journeys cleared at least once (each unlocks the next). */
  journeysCleared?: string[];
  stats: ProfileStats;
  /** Highest difficulty tier the player may start (wins unlock the next). */
  maxTier: number;
  /** Earned achievement ids (meta/achievements.ts). */
  achievements?: string[];
}

export const STARTING_CAST = ["zidane"];
export const MAX_TIER = 5;

export interface UnlockRule {
  key: string;
  hint: string;
  check(p: Profile): boolean;
}

/**
 * Milestone unlocks — INTERIM, for characters whose story journey doesn't exist yet. Vivi, Steiner, Garnet, Freya
 * and Quina join by clearing FF9 story journeys 1–5 (JourneyDef.unlocks).
 */
export const UNLOCKS: UnlockRule[] = [
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
    stats: { runs: 0, wins: 0, battles: 0, bossKills: {}, eaten: 0, steals: 0, bestWorld: 0, highestTierWon: -1, soloWins: [] },
    achievements: [],
    gearUnlocked: [],
    journeysCleared: [],
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
  /** Achievements earned by this run (rewards already granted). */
  achievements: string[];
  /** Gear newly unlocked into the drop pool by winning this run. */
  gearUnlocked: number[];
  /** Journey cleared for the first time by this run (unlocks the next). */
  journeyCleared: string | null;
}

/**
 * Completion Points for one character at the end of a run: +1 per level gained, +1 per 3 battles won (so a run
 * that hits a wall still moves you forward), +3 per boss, +10 for a win.
 */
export function completionPoints(levelsGained: number, bossesDefeated: number, won: boolean, battlesWon = 0): number {
  return levelsGained + Math.floor(battlesWon / 3) + bossesDefeated * 3 + (won ? 10 : 0);
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
    const earned = completionPoints(Math.max(0, b.level - startLevel), outcome.stats.bossKills.length, outcome.won, outcome.stats.battles);
    points[b.key] = earned;
    p.builds[b.key] = {
      ...b,
      record,
      level: startLevel,
      exp: expForLevel(startLevel),
      points: (before?.points ?? 0) + earned,
      unlockedSlots: before?.unlockedSlots ?? [],
    };
  }
  // A won run brings its gear home: everything found is unlocked into future drop pools.
  const gearUnlocked: number[] = [];
  if (outcome.won) {
    const have = new Set(p.gearUnlocked ?? []);
    for (const id of outcome.foundGear) if (!have.has(id)) gearUnlocked.push(id);
    p.gearUnlocked = [...have, ...gearUnlocked];
  }
  p.gil += outcome.gilEarned;
  p.stats.runs++;
  p.stats.battles += outcome.stats.battles;
  p.stats.eaten += outcome.stats.eaten;
  p.stats.steals += outcome.stats.steals;
  p.stats.bestWorld = Math.max(p.stats.bestWorld, outcome.worldReached);
  for (const id of outcome.stats.bossKills) p.stats.bossKills[id] = (p.stats.bossKills[id] ?? 0) + 1;
  let tierUnlocked: number | null = null;
  let journeyCleared: string | null = null;
  if (outcome.won) {
    if (!(p.journeysCleared ?? []).includes(outcome.journey)) journeyCleared = outcome.journey;
    p.journeysCleared = [...new Set([...(p.journeysCleared ?? []), outcome.journey])];
    p.stats.wins++;
    p.stats.highestTierWon = Math.max(p.stats.highestTierWon, tier);
    // Solo wins only count on late-game journeys (final area tier 2+) — the early story is meant to be soloable.
    const finalArea = getArea(getJourney(outcome.journey).areas.at(-1)!);
    if (outcome.builds.length === 1 && finalArea.tier >= 2) p.stats.soloWins = [...new Set([...(p.stats.soloWins ?? []), outcome.builds[0]!.key])];
    if (tier === p.maxTier && p.maxTier < MAX_TIER) {
      p.maxTier++;
      tierUnlocked = p.maxTier;
    }
  }
  // Story journeys bring characters into the roster on their first clear; milestone rules cover the rest.
  const fromJourney = journeyCleared ? (getJourney(journeyCleared).unlocks ?? []).filter((k) => !p.unlocked.includes(k)) : [];
  const fromMilestones = UNLOCKS.filter((u) => !p.unlocked.includes(u.key) && !fromJourney.includes(u.key) && u.check(p)).map((u) => u.key);
  const newlyUnlocked = [...fromJourney, ...fromMilestones];
  p.unlocked.push(...newlyUnlocked);
  const achievements = awardAchievements(p);
  return { profile: p, newlyUnlocked, tierUnlocked, points, achievements, gearUnlocked, journeyCleared };
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

/** Spend CP to unlock an equipment slot (Body, Head, Arm or Accessory) for a character. */
export function unlockSlot(profile: Profile, key: string, slot: EquipSlot): Profile {
  const { p, b } = editable(profile, key);
  if (!UNLOCKABLE_SLOTS.includes(slot)) throw new ProfileError("That slot is always open");
  if (slotUnlocked(b, slot)) throw new ProfileError("Already unlocked");
  const cost = nextSlotCost(b);
  if (cost == null) throw new ProfileError("All slots unlocked");
  if ((b.points ?? 0) < cost) throw new ProfileError(`Need ${cost} CP`);
  b.points = (b.points ?? 0) - cost;
  b.unlockedSlots = [...(b.unlockedSlots ?? []), slot];
  b.equipment = starterGear(b);
  return p;
}

// ── abilities before a run ───────────────────────────────────────────────────
export function setProfileSupports(profile: Profile, key: string, supports: number[]): Profile {
  const { p, b: build } = editable(profile, key);
  build.equipment = starterGear(build);
  const candidate = { ...build, supports: [...new Set(supports)] };
  if (activeSupports(candidate).size !== candidate.supports.length) throw new ProfileError("Not enough magic stones, or ability not available");
  build.supports = candidate.supports;
  return p;
}

// ── camp: gear catalog & supplies (banked gil) ───────────────────────────────
/** Unlocking gear costs more than its FF9 shop price — it's permanent. */
export const UNLOCK_PRICE_MULT = 2;

/**
 * The gear catalog: gear that isn't already in a reached world's drop pool, isn't legendary (achievements only)
 * and isn't unlocked yet. Unlocking puts it into future runs' drops, shops and treasure for its world.
 */
export function gearCatalog(profile: Profile): { itemId: number; price: number }[] {
  const base = new Set(WORLDS.flatMap((w) => [...baseGear(w.index)]));
  const unlocked = new Set(profile.gearUnlocked ?? []);
  // The best loot band among areas at or below the furthest progression tier reached.
  const maxPrice = Math.max(...WORLDS.filter((w) => w.tier <= profile.stats.bestWorld).map((w) => w.gearPrice[1]));
  return items
    .filter((i) => isGear(i) && i.price > 0 && effectivePrice(i) <= maxPrice && !base.has(i.id) && !unlocked.has(i.id) && !LEGENDARY_ITEMS.has(i.id))
    .sort((a, b) => effectivePrice(a) - effectivePrice(b))
    .map((i) => ({ itemId: i.id, price: effectivePrice(i) * UNLOCK_PRICE_MULT }));
}

export function unlockGear(profile: Profile, itemId: number): Profile {
  const entry = gearCatalog(profile).find((e) => e.itemId === itemId);
  if (!entry) throw new ProfileError("Can't unlock that yet");
  if (profile.gil < entry.price) throw new ProfileError("Not enough gil");
  const p = structuredClone(profile);
  p.gil -= entry.price;
  p.gearUnlocked = [...(p.gearUnlocked ?? []), itemId];
  return p;
}

const SUPPLY_TIERS: string[][] = [
  ["Potion", "Phoenix Down", "Antidote", "Eye Drops", "Echo Screen"],
  ["Hi-Potion", "Ether", "Soft", "Tent"],
  ["Remedy", "Elixir"],
];

/** Consumables sold at camp (more as you reach further worlds). They go into your next run and are used up there. */
export function campSupplyStock(profile: Profile): { itemId: number; price: number }[] {
  return SUPPLY_TIERS.slice(0, Math.min(SUPPLY_TIERS.length, profile.stats.bestWorld + 1))
    .flat()
    .map((name) => getItem(itemByName(name).id))
    .map((i) => ({ itemId: i.id, price: i.price || 500 }));
}

/** Supplies packed for the next run (the stash only holds consumables now). */
export function campSupplies(profile: Profile): Record<number, number> {
  return Object.fromEntries(Object.entries(profile.stash).filter(([id, n]) => n > 0 && getItem(Number(id)).kind === "item"));
}

export function buySupply(profile: Profile, itemId: number): Profile {
  const entry = campSupplyStock(profile).find((e) => e.itemId === itemId);
  if (!entry) throw new ProfileError("Not sold here yet — reach further worlds");
  if (profile.gil < entry.price) throw new ProfileError("Not enough gil");
  const p = structuredClone(profile);
  p.gil -= entry.price;
  p.stash[itemId] = (p.stash[itemId] ?? 0) + 1;
  return p;
}

/** Journeys the player can start, in order. */
export function availableJourneys(profile: Profile): string[] {
  return JOURNEYS.filter((j) => journeyUnlocked(j.id, profile.journeysCleared ?? [])).map((j) => j.id);
}
