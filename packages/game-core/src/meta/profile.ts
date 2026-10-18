/**
 * Permanent progression between runs: unlocked characters, their builds (start level, Completion Points, gear
 * slots, AP, FF9 growth pool, loadout), the gear stash, banked gil and lifetime stats. The server persists this
 * in Postgres; these are the pure rules.
 *
 * Inside a run, characters level with FF9's normal EXP system from their start level. When the run ends, levels
 * reset and each party member earns Completion Points (CP), spent before the next run on a higher start level or
 * a loadout gear slot. Gear found in a run is only kept if the run is won.
 */
import { getItem, itemByName, MAIN_CAST, rewardTables, starterUpgradesFor, type AbilityRef, type EquipSlot, type StarterUpgrade } from "@ffix-roguelike/game-data";

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
import { ACHIEVEMENTS, awardAchievements } from "./achievements";

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
  for (const key of [...MAIN_CAST, "beatrix", "blank"]) builds[key] = newBuild(key, 1);
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
      return `Earn "${ACHIEVEMENTS.find((a) => a.id === block.achievement)?.name ?? block.achievement}" first`;
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
    const by = ACHIEVEMENTS.find((a) => a.reward.supplies?.includes(name));
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
