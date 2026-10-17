/**
 * Reward and gear-availability tables (`.plans/rewards.md`): our own game design, stored in Postgres (reward_* and
 * gear_availability, seeded from packages/db/seed/rewards) and edited on the admin page. Like the FF9 tables they're a
 * runtime registry: the server registers them from the DB, the web app from `content.rewards`, tests and the sim
 * from the seed files (`loadRewardCache` in ./cache). Never read at module load.
 */

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type RarityId = (typeof RARITIES)[number];

export const CARD_TYPES = ["gear", "boon", "ap", "supplies", "gil"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const REWARD_SOURCES = ["surprise", "elite", "treasure", "semiboss", "boss"] as const;
export type RewardSourceId = (typeof REWARD_SOURCES)[number];

/** Stats a role weighs when judging gear (the same names as game-core's compared stats). */
export const ROLE_STATS = ["maxHp", "maxMp", "strength", "magic", "spirit", "speed", "attack", "defence", "evade", "magicDefence", "magicEvade", "gemsMax"] as const;
export type RoleStat = (typeof ROLE_STATS)[number];

/** What a boon raises. `maxHpPct` / `maxMpPct` are percentages; `levels` are real level-ups. */
export const BOON_STATS = ["strength", "magic", "spirit", "speed", "attack", "defence", "evade", "magicDefence", "magicEvade", "maxHpPct", "maxMpPct", "levels"] as const;
export type BoonStat = (typeof BOON_STATS)[number];

export interface RewardRarity {
  id: RarityId;
  name: string;
  /** CSS colour for the card frame. */
  color: string;
  sort: number;
  /** AP an AP-surge card of this rarity gives. */
  apSurge: number;
  /** Gil a gil card of this rarity gives, per tier + 1. */
  gil: number;
  /** How many of a consumable a supplies card of this rarity gives. */
  supplies: number;
  /** Chance (0–100) that a gear card of this rarity comes from a higher area's band. */
  nextBand: number;
  /** How many areas up that higher band is (unset: common 0, uncommon / rare 1, epic 2, legendary 3). */
  bandSteps?: number;
}

const DEFAULT_BAND_STEPS: Record<RarityId, number> = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 3 };
/** How many area bands up a gear card of this rarity can reach. */
export const bandStepsOf = (r: RewardRarity) => r.bandSteps ?? DEFAULT_BAND_STEPS[r.id];

/** What a character values (per character key), for judging which gear is an upgrade for them. */
export interface RewardRole {
  key: string;
  /** Weight per stat change (0 = ignored). */
  weights: Partial<Record<RoleStat, number>>;
  /** Value of each new ability the gear would teach (unmastered). */
  abilityWeight: number;
  /** Abilities (refs, e.g. "action:Fira") worth extra. */
  preferredAbilities: string[];
  notes?: string;
}

export interface RewardSource {
  id: RewardSourceId;
  /** Cards offered (pick one). */
  cards: number;
  rarityWeights: Record<RarityId, number>;
  typeWeights: Record<CardType, number>;
  /** Minimum upgrade score for a gear card. */
  upgradeThreshold: number;
  /** "oneGear": at least one gear upgrade when any exists; "allGear": every card is one (boons when none). */
  guarantee: "none" | "oneGear" | "allGear";
  /** Lowest rarity offered. */
  minRarity: RarityId;
  /** Surprise only: chance (0–100) after a plain battle. */
  chance?: number;
  /** Gil for skipping, per tier + 1. */
  skipGil: number;
}

export interface RewardBoon {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** One member, or the whole party. */
  scope: "member" | "party";
  stat: BoonStat;
  /** Amount per rarity (a rarity missing = not offered at that rarity). */
  amounts: Partial<Record<RarityId, number>>;
  weight: number;
  /** Characters who roll it more (×2). */
  affinity?: string[];
  /** Lowest area tier it appears in. */
  minTier: number;
}

/** How one gear piece can show up in runs (every gear piece has a row). */
export interface GearAvailability {
  itemId: number;
  /** Item name, for reading the table. */
  name: string;
  /** Areas (WorldDef ids) where it drops without being unlocked. `bossOnly`: only from that area's boss rewards. */
  mapPools: { area: string; bossOnly?: boolean }[];
  /** Buyable at camp (gear catalog). */
  catalog: boolean;
  /** Catalog price in banked gil. */
  catalogPrice: number | null;
  /** Catalog shows it once the player has reached this progression tier. */
  catalogFromTier: number;
  /** Achievements only: never drops, never sold. */
  legendary: boolean;
  enabled: boolean;
  notes?: string;
}

export interface RewardTables {
  rarities: RewardRarity[];
  roles: RewardRole[];
  sources: RewardSource[];
  boons: RewardBoon[];
  gear: GearAvailability[];
}

let tables: RewardTables | null = null;
/** Bumped on every registration (lookups re-index). */
export let rewardTablesVersion = 0;

export function registerRewardTables(next: RewardTables): void {
  tables = next;
  rewardTablesVersion++;
  gearIndex = null;
}

export function rewardTables(): RewardTables {
  if (!tables) throw new Error("Reward tables aren't loaded (server: ensureRewardContent; web: content.rewards; tests: loadRewardCache)");
  return tables;
}

export const hasRewardTables = () => tables !== null;

let gearIndex: Map<number, GearAvailability> | null = null;
/** A gear piece's availability row (undefined: not in the table — it can't show up). */
export function gearAvailability(itemId: number): GearAvailability | undefined {
  gearIndex ??= new Map(rewardTables().gear.map((g) => [g.itemId, g]));
  return gearIndex.get(itemId);
}

export const rarityOf = (id: RarityId) => rewardTables().rarities.find((r) => r.id === id)!;
export const sourceOf = (id: RewardSourceId) => rewardTables().sources.find((s) => s.id === id)!;
export const roleOf = (key: string) => rewardTables().roles.find((r) => r.key === key);
