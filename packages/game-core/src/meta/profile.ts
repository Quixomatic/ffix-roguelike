/**
 * Permanent progression between runs: unlocked characters, their builds (start level, Completion Points, gear
 * slots, AP, FF9 growth pool, loadout), the gear stash, banked gil and lifetime stats. The server persists this
 * in Postgres; these are the pure rules.
 *
 * Inside a run, characters level with FF9's normal EXP system from their start level. When the run ends, levels
 * reset and each party member earns Completion Points (CP), spent before the next run on a higher start level or
 * a loadout gear slot. Gear found in a run is only kept if the run is won.
 */
import { getItem, itemByName, rewardTables, ROSTER, starterUpgradesFor, type AbilityRef, type EquipSlot, type StarterUpgrade } from "@ffix-roguelike/game-data";

import { challengeRoutes, routes, routeUnlocked, type RouteProgress } from "../content/journey-groups";
import { getArea, getJourney, JOURNEYS, journeyUnlocked } from "../content/worlds";
import { effectivePrice } from "../run/loot";
import type { RunOutcome } from "../run/run";
import {
  activeSupports,
  emptyRecord,
  expForLevel,
  newBuild,
  nextSlotCost,
  slotUnlocked,
  starterGear,
  TRAIN_MAX,
  TRAIN_STATS,
  trainCost,
  trainRank,
  UNLOCKABLE_SLOTS,
  type CharacterBuild,
  type TrainStat,
} from "../stats";
import type { MetricBag } from "../metrics/collect";
import { achievements, awardAchievements } from "./achievements";

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
  /** One-off supplies bought at camp before supply ranks existed, packed into the next run (then gone). */
  stash: Record<number, number>;
  /** Permanent starting-kit upgrades: item id → extra copies every run starts with (0–SUPPLY_MAX). */
  supplyRanks?: Record<number, number>;
  /** Gear unlocked into run drop pools (catalog, achievements, won runs). */
  gearUnlocked?: number[];
  /** Relics unlocked by sources other than an achievement or `free` (meta/relics.ts `relicUnlocked`). */
  relicsUnlocked?: string[];
  /** Journeys cleared at least once (each unlocks the next). */
  journeysCleared?: string[];
  /** Journey groupings won at least once (content/journey-groups.ts; challenge achievements). */
  groupsCleared?: string[];
  stats: ProfileStats;
  /**
   * The best tier won on each journey, challenge and grouping (route id → tier, 0 = Normal). Normal is always open;
   * tier n+1 opens on a route once tier n is won on it (`routeTiersOpen`). A journey cleared inside a grouping or
   * challenge run counts too, at the run's tier.
   */
  routeTiers?: Record<string, number>;
  /** Before tiers per route: the highest tier the player could start anywhere. Only read to carry old profiles over. */
  maxTier: number;
  /** Earned achievement ids (meta/achievements.ts). */
  achievements?: string[];
  /**
   * Lifetime metrics (the `player_metric` table, read-only here: the server adds to them as runs and camp actions are
   * saved). Achievements with a `metric` condition read them.
   */
  metrics?: MetricBag;
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
/**
 * Milestone unlocks for characters no journey recruits. Empty since every character joins through the story (Eiko in
 * journey 11, Amarant in 12, Beatrix and Blank in 14); the interim ones (steal 15 items, defeat Golbez / Kefka, win
 * on Tier 1) are retired, and players who unlocked a character that way keep them.
 */
export const UNLOCKS: UnlockRule[] = [];

/** The journey whose clear is a "Terra & Memoria" clear for the party (the Legend of <hero> achievements). */
export const LEGEND_JOURNEY = "memoria";

/** Unlocked characters as they start a run (starter gear in their open slots) — what found gear compares against. */
export function rosterAtStart(p: Pick<Profile, "unlocked" | "builds">): CharacterBuild[] {
  return p.unlocked.filter((k) => p.builds[k]).map((k) => ({ ...p.builds[k]!, equipment: starterGear(p.builds[k]!) }));
}

/**
 * Characters not on the roster yet, with how to get them: story recruits in journey order ("Clear The Evil
 * Forest"), then the interim milestone unlocks.
 */
export function lockedCharacters(p: Profile): { key: string; hint: string }[] {
  const out: { key: string; hint: string }[] = [];
  for (const j of JOURNEYS)
    for (const key of j.unlocks ?? [])
      if (!p.unlocked.includes(key) && !out.some((x) => x.key === key)) out.push({ key, hint: `Clear the journey "${j.name.replace(/^\d+ · /, "")}"` });
  for (const u of UNLOCKS) if (!p.unlocked.includes(u.key) && !out.some((x) => x.key === u.key)) out.push({ key: u.key, hint: u.hint });
  return out;
}

export function newProfile(): Profile {
  const builds: Record<string, CharacterBuild> = {};
  for (const key of ROSTER) builds[key] = newBuild(key, 1);
  return {
    gil: 0,
    unlocked: [...STARTING_CAST],
    builds,
    stash: {},
    supplyRanks: {},
    stats: { runs: 0, wins: 0, battles: 0, bossKills: {}, eaten: 0, steals: 0, bestWorld: 0, highestTierWon: -1, soloWins: [] },
    achievements: [],
    gearUnlocked: [],
    journeysCleared: [],
    groupsCleared: [],
    routeTiers: {},
    maxTier: 0,
  };
}

/** The best tier won on a route (-1: never won / cleared). */
export const bestRouteTier = (p: Pick<Profile, "routeTiers">, routeId: string): number => p.routeTiers?.[routeId] ?? -1;

/** The tiers a route can be started at: Normal, and one above the best won on it (up to MAX_TIER). */
export function routeTiersOpen(p: Pick<Profile, "routeTiers">, routeId: string): number[] {
  const top = Math.min(MAX_TIER, bestRouteTier(p, routeId) + 1);
  return Array.from({ length: top + 1 }, (_, i) => i);
}

/** Record a tier won on a route (keeps the best). Returns true when it's a new best. */
function recordRouteTier(p: Profile, routeId: string, tier: number): boolean {
  if (tier <= bestRouteTier(p, routeId)) return false;
  p.routeTiers = { ...(p.routeTiers ?? {}), [routeId]: tier };
  return true;
}

/**
 * Tiers for a profile from before tiers were per route: every journey, challenge or grouping it has cleared counts as
 * won at the tier below its old account-wide top, so each keeps exactly the tiers it could start before.
 */
export function carryOverRouteTiers(p: Profile): Profile {
  if (p.routeTiers && Object.keys(p.routeTiers).length) return p;
  const best = Math.max(0, p.maxTier - 1);
  const routeTiers: Record<string, number> = {};
  for (const id of [...(p.journeysCleared ?? []), ...(p.groupsCleared ?? [])]) routeTiers[id] = best;
  return { ...p, routeTiers };
}

export class ProfileError extends Error {}

// ── end of run ───────────────────────────────────────────────────────────────
export interface RunReport {
  profile: Profile;
  newlyUnlocked: string[];
  /** The tier this run opened on the route it played (won at a new best tier), if any. */
  tierUnlocked: number | null;
  /** Completion Points earned per character this run. */
  points: Record<string, number>;
  /** Achievements earned by this run (rewards already granted). */
  achievements: string[];
  /** Gear newly unlocked into the drop pool by winning this run. */
  gearUnlocked: number[];
  /** Journeys cleared for the first time by this run, in order (each unlocks the next). */
  journeysCleared: string[];
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
    // A run plays a snapshot of the character taken when it started, and camp stays open meanwhile (training, slots,
    // supports can change). So merge onto the character as it is NOW, taking from the run only what a run earns: AP
    // (abilities mastered or progressed — the higher of the two, per ability) and FF9's growth pool. Everything set at
    // camp (start level, CP, training, slots, supports, equipment, row) stays as camp has it.
    const base = before ?? b;
    const ap: CharacterBuild["ap"] = { ...base.ap };
    for (const [ref, v] of Object.entries(b.ap) as [AbilityRef, number][]) ap[ref] = Math.max(ap[ref] ?? 0, v ?? 0);
    p.builds[b.key] = {
      ...base,
      ap,
      growth: b.growth ?? base.growth,
      record,
      level: startLevel,
      exp: expForLevel(startLevel),
      points: (before?.points ?? 0) + earned,
      unlockedSlots: before?.unlockedSlots ?? [],
    };
  }
  // A won run brings its gear home: everything found is unlocked into future drop pools. Synthesized gear is
  // unlocked either way (it's hard enough to make).
  const gearUnlocked: number[] = [];
  const have = new Set(p.gearUnlocked ?? []);
  for (const id of [...(outcome.won ? outcome.foundGear : []), ...(outcome.synthesized ?? [])]) {
    if (have.has(id)) continue;
    have.add(id);
    gearUnlocked.push(id);
  }
  p.gearUnlocked = [...have];
  p.gil += outcome.gilEarned;
  p.stats.runs++;
  p.stats.battles += outcome.stats.battles;
  p.stats.eaten += outcome.stats.eaten;
  p.stats.steals += outcome.stats.steals;
  p.stats.bestWorld = Math.max(p.stats.bestWorld, outcome.worldReached);
  for (const id of outcome.stats.bossKills) p.stats.bossKills[id] = (p.stats.bossKills[id] ?? 0) + 1;
  let tierUnlocked: number | null = null;
  // Every journey whose final boss the run beat counts as cleared, won or lost (a grouping's run that falls in its
  // third journey keeps the first two).
  const journeysCleared = recordJourneyClears(p, outcome.cleared, outcome.builds.map((b) => b.key));
  // Tiers per route: every journey the run cleared counts at its tier (a grouping or challenge run that falls later on
  // keeps them), and a won run's route too. Winning a route at a new best tier opens the next one on it.
  const route = outcome.journeyGroup ?? outcome.journey;
  const routeBest = bestRouteTier(p, route);
  for (const j of outcome.cleared) recordRouteTier(p, j, tier);
  if (outcome.won) {
    if (outcome.journeyGroup) p.groupsCleared = [...new Set([...(p.groupsCleared ?? []), outcome.journeyGroup])];
    p.stats.wins++;
    p.stats.highestTierWon = Math.max(p.stats.highestTierWon, tier);
    recordRouteTier(p, route, tier);
    if (tier > routeBest && tier < MAX_TIER) tierUnlocked = tier + 1;
  }
  const newlyUnlocked = unlockCharacters(p, journeysCleared);
  const achievements = awardAchievements(p);
  return { profile: p, newlyUnlocked, tierUnlocked, points, achievements, gearUnlocked, journeysCleared };
}

/**
 * Record journeys a run cleared (mutates `p`): journeysCleared, solo clears, Legend clears. Returns those cleared for
 * the first time, in order.
 */
export function recordJourneyClears(p: Profile, cleared: readonly string[], party: readonly string[]): string[] {
  const first: string[] = [];
  for (const id of cleared) {
    if (!(p.journeysCleared ?? []).includes(id)) first.push(id);
    p.journeysCleared = [...new Set([...(p.journeysCleared ?? []), id])];
    // Solo clears only count on late-game journeys (final area tier 2+): the early story is meant to be soloable.
    const finalArea = getArea(getJourney(id).areas.at(-1)!);
    if (party.length === 1 && finalArea.tier >= 2) p.stats.soloWins = [...new Set([...(p.stats.soloWins ?? []), party[0]!])];
    // "Terra & Memoria with a hero" (the Legend of <hero> achievements): clearing Memoria, the journey after Terra,
    // counts for everyone in the party.
    if (id === LEGEND_JOURNEY) p.stats.legendClears = [...new Set([...(p.stats.legendClears ?? []), ...party])];
  }
  return first;
}

/**
 * Unlock characters for future runs (mutates `p`): story journeys' recruits on their first clear, then the milestone
 * rules. Returns who was unlocked.
 */
export function unlockCharacters(p: Profile, firstCleared: readonly string[]): string[] {
  const fromJourney = [...new Set(firstCleared.flatMap((id) => getJourney(id).unlocks ?? []))].filter((k) => !p.unlocked.includes(k));
  const fromMilestones = UNLOCKS.filter((u) => !p.unlocked.includes(u.key) && !fromJourney.includes(u.key) && u.check(p)).map((u) => u.key);
  const newlyUnlocked = [...fromJourney, ...fromMilestones];
  p.unlocked.push(...newlyUnlocked);
  return newlyUnlocked;
}

/**
 * A run wiped by starting another (`run.start` with `replace`) folds nothing in, except the journeys it cleared:
 * those are kept, with their recruits and achievements.
 */
export function keepWipedClears(profile: Profile, cleared: readonly string[], party: readonly string[]): { profile: Profile; achievements: string[] } {
  const p = structuredClone(profile);
  unlockCharacters(p, recordJourneyClears(p, cleared, party));
  return { profile: p, achievements: awardAchievements(p) };
}

// ── spending Completion Points ───────────────────────────────────────────────
/** CP needed to raise a start level from `level` to `level + 1`. */
export const startLevelCost = (level: number) => level;
/** Start level is trained like a stat: 20 ranks above Lv 1 (Lv 21), level n costing n CP (210 CP in all). */
export const START_LEVEL_MAX = 21;

function editable(profile: Profile, key: string) {
  const p = structuredClone(profile);
  const b = p.builds[key];
  if (!b || !p.unlocked.includes(key)) throw new ProfileError("Character not available");
  return { p, b };
}

/** Spend CP to raise a character's start level by one. */
export function raiseStartLevel(profile: Profile, key: string): Profile {
  const { p, b } = editable(profile, key);
  if (b.level >= START_LEVEL_MAX) throw new ProfileError(`Start level is capped at Lv ${START_LEVEL_MAX}`);
  const cost = startLevelCost(b.level);
  if ((b.points ?? 0) < cost) throw new ProfileError(`Need ${cost} CP`);
  b.points = (b.points ?? 0) - cost;
  b.level++;
  b.exp = expForLevel(b.level);
  return p;
}

/** Spend CP on one training rank of a stat (raises that base stat for every run). */
export function trainStat(profile: Profile, key: string, stat: TrainStat): Profile {
  const { p, b } = editable(profile, key);
  if (!TRAIN_STATS.includes(stat)) throw new ProfileError("Unknown stat");
  const rank = trainRank(b, stat);
  if (rank >= TRAIN_MAX) throw new ProfileError("Fully trained");
  const cost = trainCost(rank);
  if ((b.points ?? 0) < cost) throw new ProfileError(`Need ${cost} CP`);
  b.points = (b.points ?? 0) - cost;
  b.training = { ...b.training, [stat]: rank + 1 };
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

// ── starting-gear upgrades (gil + CP) ────────────────────────────────────────
/** Why a starting-gear upgrade tier can't be bought yet. */
export type StarterTierBlock =
  | { kind: "slot"; slot: EquipSlot }
  | { kind: "previous" }
  | { kind: "item"; itemId: number }
  | { kind: "level"; level: number }
  | { kind: "journey"; journey: string }
  | { kind: "achievement"; achievement: string }
  | { kind: "gil"; gil: number }
  | { kind: "cp"; cp: number };

export interface StarterTierState {
  upgrade: StarterUpgrade;
  owned: boolean;
  /** Empty for the next tier when it can be bought now; always empty for owned tiers. */
  blocks: StarterTierBlock[];
}

const SLOT_NAME: Record<EquipSlot, string> = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory" };

/**
 * Every upgrade tier of one character's slot, with what stands in the way of each (`.plans/starter-upgrades.md`): the
 * slot must be unlocked, tiers go in order, the item must be unlocked for good (catalog, won run, synthesis,
 * achievement), the start level high enough, any journey / achievement requirement met, and the gil and CP there.
 */
export function starterUpgradeState(profile: Profile, key: string, slot: EquipSlot): StarterTierState[] {
  const b = profile.builds[key];
  if (!b) return [];
  const owned = b.starterTiers?.[slot] ?? 0;
  const unlockedGear = new Set(profile.gearUnlocked ?? []);
  return starterUpgradesFor(key, slot).map((u) => {
    if (u.tier <= owned) return { upgrade: u, owned: true, blocks: [] };
    const blocks: StarterTierBlock[] = [];
    if (!slotUnlocked(b, slot)) blocks.push({ kind: "slot", slot });
    if (u.tier > owned + 1) blocks.push({ kind: "previous" });
    if (!unlockedGear.has(u.itemId)) blocks.push({ kind: "item", itemId: u.itemId });
    if (b.level < u.minStartLevel) blocks.push({ kind: "level", level: u.minStartLevel });
    if (u.requires?.journey && !(profile.journeysCleared ?? []).includes(u.requires.journey)) blocks.push({ kind: "journey", journey: u.requires.journey });
    if (u.requires?.achievement && !(profile.achievements ?? []).includes(u.requires.achievement)) blocks.push({ kind: "achievement", achievement: u.requires.achievement });
    if (profile.gil < u.gil) blocks.push({ kind: "gil", gil: u.gil });
    if ((b.points ?? 0) < u.cp) blocks.push({ kind: "cp", cp: u.cp });
    return { upgrade: u, owned: false, blocks };
  });
}

/** One line per reason a tier is blocked (shown on the character page; the first is the server's error). */
export function starterBlockText(block: StarterTierBlock): string {
  switch (block.kind) {
    case "slot":
      return `Unlock the ${SLOT_NAME[block.slot]} slot first`;
    case "previous":
      return "Buy the tier before it first";
    case "item":
      return `Unlock ${getItem(block.itemId).name} first`;
    case "level":
      return `Needs start Lv ${block.level}`;
    case "journey":
      return `Clear "${getJourney(block.journey).name}" first`;
    case "achievement":
      return `Earn "${achievements().find((a) => a.id === block.achievement)?.name ?? block.achievement}" first`;
    case "gil":
      return `Needs ${block.gil.toLocaleString()} gil`;
    case "cp":
      return `Needs ${block.cp} CP`;
  }
}

/** Buy a character's next starting-gear upgrade tier for a slot (banked gil + their CP). Applies from the next run. */
export function buyStarterUpgrade(profile: Profile, key: string, slot: EquipSlot): Profile {
  const { p, b } = editable(profile, key);
  const next = starterUpgradeState(profile, key, slot).find((s) => !s.owned);
  if (!next) throw new ProfileError("Fully upgraded");
  if (next.blocks.length) throw new ProfileError(starterBlockText(next.blocks[0]!));
  p.gil -= next.upgrade.gil;
  b.points = (b.points ?? 0) - next.upgrade.cp;
  b.starterTiers = { ...b.starterTiers, [slot]: next.upgrade.tier };
  // A new tier is worn straight away (pick an earlier one to keep learning its abilities).
  b.starterPicks = { ...b.starterPicks, [slot]: next.upgrade.tier };
  b.equipment = starterGear(b);
  return p;
}

/** Choose which owned tier a slot starts runs with (0 = the FF9 piece) — e.g. to keep learning an earlier piece's abilities. Free. */
export function pickStarterTier(profile: Profile, key: string, slot: EquipSlot, tier: number): Profile {
  const { p, b } = editable(profile, key);
  if (!Number.isInteger(tier) || tier < 0 || tier > (b.starterTiers?.[slot] ?? 0)) throw new ProfileError("You don't own that tier");
  b.starterPicks = { ...b.starterPicks, [slot]: tier };
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
  const unlocked = new Set(profile.gearUnlocked ?? []);
  // The gear_availability table says what the catalog sells, from which progression tier, and for how much.
  return rewardTables()
    .gear.filter((g) => g.enabled && g.catalog && !g.legendary && g.catalogPrice != null && g.catalogFromTier <= profile.stats.bestWorld && !unlocked.has(g.itemId))
    .sort((a, b) => a.catalogPrice! - b.catalogPrice!)
    .map((g) => ({ itemId: g.itemId, price: g.catalogPrice! }));
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

/** Supplies every camp has from the start; the rest are unlocked by achievements (their `reward.supplies`). */
const BASIC_SUPPLIES = ["Potion", "Phoenix Down", "Antidote", "Eye Drops", "Echo Screen"];
/** Every supply the camp can stock, in display order. */
const ALL_SUPPLIES = [...BASIC_SUPPLIES, "Hi-Potion", "Soft", "Magic Tag", "Vaccine", "Tent", "Annoyntment", "Ether", "Remedy", "Elixir"];

/** Most extra copies of one supply a run can start with (Elixir is capped lower). */
export const SUPPLY_MAX = 5;
const SUPPLY_MAX_BY_NAME: Record<string, number> = { Elixir: 2 };
/** Rank n of a supply costs this many times the item's FF9 price × n — far above buying it in a run. */
export const SUPPLY_COST_FACTOR = 10;

export interface SupplyEntry {
  itemId: number;
  /** FF9 price the rank costs are based on (never-sold rarities use the rare price). */
  price: number;
  max: number;
  unlocked: boolean;
  /** The achievement that unlocks it (locked supplies). */
  unlockedBy?: { id: string; name: string; description: string };
}

/** Every camp supply with whether it's unlocked yet (basic ones always; others by an achievement). */
export function campSupplyCatalog(profile: Profile): SupplyEntry[] {
  const earned = new Set(profile.achievements ?? []);
  return ALL_SUPPLIES.map((name) => {
    const item = getItem(itemByName(name).id);
    const by = achievements().find((a) => a.reward.supplies?.includes(name));
    return {
      itemId: item.id,
      price: effectivePrice(item),
      max: SUPPLY_MAX_BY_NAME[name] ?? SUPPLY_MAX,
      unlocked: BASIC_SUPPLIES.includes(name) || (!!by && earned.has(by.id)),
      unlockedBy: by ? { id: by.id, name: by.name, description: by.description } : undefined,
    };
  });
}

/** Supplies the camp can rank up now. */
export function campSupplyStock(profile: Profile): SupplyEntry[] {
  return campSupplyCatalog(profile).filter((e) => e.unlocked);
}

/** Extra copies of `itemId` every run starts with. */
export const supplyRank = (profile: Profile, itemId: number) => profile.supplyRanks?.[itemId] ?? 0;

/** Gil for the next rank of a supply (null when maxed or not sold yet). */
export function supplyRankCost(profile: Profile, itemId: number): number | null {
  const entry = campSupplyStock(profile).find((e) => e.itemId === itemId);
  const rank = supplyRank(profile, itemId);
  if (!entry || rank >= entry.max) return null;
  return entry.price * SUPPLY_COST_FACTOR * (rank + 1);
}

/** Buy the next rank of a supply: every run from now on starts with one more. */
export function buySupplyRank(profile: Profile, itemId: number): Profile {
  if (!campSupplyStock(profile).some((e) => e.itemId === itemId)) throw new ProfileError("Not unlocked yet — see its achievement");
  const cost = supplyRankCost(profile, itemId);
  if (cost == null) throw new ProfileError("Already at the most a run can start with");
  if (profile.gil < cost) throw new ProfileError(`Need ${cost} gil`);
  const p = structuredClone(profile);
  p.gil -= cost;
  p.supplyRanks = { ...(p.supplyRanks ?? {}), [itemId]: supplyRank(profile, itemId) + 1 };
  return p;
}

/**
 * Consumables a run starts with on top of the starter kit: the permanent supply ranks, plus any one-off supplies
 * bought before ranks existed (packed once, then gone — see `campSupplies`).
 */
export function startingSupplies(profile: Profile): Record<number, number> {
  const out: Record<number, number> = { ...(profile.supplyRanks ?? {}) };
  for (const [id, n] of Object.entries(campSupplies(profile))) out[Number(id)] = (out[Number(id)] ?? 0) + n;
  return out;
}

/** One-off supplies still waiting in the stash (bought before supply ranks), packed into the next run. */
export function campSupplies(profile: Profile): Record<number, number> {
  return Object.fromEntries(Object.entries(profile.stash).filter(([id, n]) => n > 0 && getItem(Number(id)).kind === "item"));
}

/** Journeys the player can start, in order. */
export function availableJourneys(profile: Profile): string[] {
  return JOURNEYS.filter((j) => journeyUnlocked(j.id, profile.journeysCleared ?? [])).map((j) => j.id);
}

/**
 * What opens routes for this player: every journey and challenge cleared (journeysCleared; a challenge with its own
 * maps clears under its id) and every grouping or challenge run won (groupsCleared), plus their achievements.
 */
export function routeProgress(profile: Pick<Profile, "journeysCleared" | "groupsCleared" | "achievements">): RouteProgress {
  return { cleared: [...(profile.journeysCleared ?? []), ...(profile.groupsCleared ?? [])], achievements: profile.achievements ?? [] };
}

/**
 * What the player can start (journey-groups.ts routes), in order: ungrouped journeys and story groupings whose first
 * journey is open, then the challenges they've opened.
 */
export function availableRoutes(profile: Profile): string[] {
  const progress = routeProgress(profile);
  return [...routes(), ...challengeRoutes()].filter((r) => routeUnlocked(r.id, progress)).map((r) => r.id);
}
