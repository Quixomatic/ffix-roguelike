/**
 * Game settings: every balance number of our design (`.plans/content-db.md` step 4). The values live in Postgres (the
 * `game_setting` table: key → JSON value, seeded from packages/db/seed/rewards/game-settings.json, edited on the admin
 * page's Settings tab) and load into the registry with the other tables. The definitions below — type, range,
 * default, what it does — stay in code, so every value is checked on save and a missing row falls back to its default.
 *
 * The server checks every action with its own copy; the web's copy is display-only.
 *
 * Caps are always read as `min(stored, cap)` where they apply to something a player owns (training ranks, supply
 * ranks, start level), so lowering one never needs a data change and raising it again gives the ranks back.
 */
import { hasRewardTables, onRewardTables, rewardTables } from "./rewards";

export type SettingValue = number | number[] | string | string[] | Record<string, number>;

/** How a setting is edited and checked. */
export type SettingKind =
  | { kind: "number"; min?: number; max?: number; integer?: boolean }
  | { kind: "numbers"; min?: number; max?: number; integer?: boolean; length?: number }
  | { kind: "choice"; options: readonly string[] }
  | { kind: "names" }
  | { kind: "weights"; keys?: readonly string[]; min?: number };

export type SettingDef<T extends SettingValue = SettingValue> = SettingKind & {
  group: string;
  label: string;
  description: string;
  default: T;
};

const num = (d: Omit<SettingDef<number>, "kind"> & { min?: number; max?: number; integer?: boolean }): SettingDef<number> => ({ kind: "number", ...d });
const nums = (d: Omit<SettingDef<number[]>, "kind"> & { min?: number; max?: number; integer?: boolean; length?: number }): SettingDef<number[]> => ({ kind: "numbers", ...d });
const names = (d: Omit<SettingDef<string[]>, "kind">): SettingDef<string[]> => ({ kind: "names", ...d });
const weights = (d: Omit<SettingDef<Record<string, number>>, "kind"> & { keys?: readonly string[]; min?: number }): SettingDef<Record<string, number>> => ({ kind: "weights", ...d });
const choice = <T extends string>(d: Omit<SettingDef<T>, "kind"> & { options: readonly T[] }): SettingDef<T> => ({ kind: "choice", ...d });

const TRAIN_STAT_KEYS = ["strength", "magic", "spirit", "speed", "hp", "mp"] as const;
const STAGE_KINDS = ["battle", "elite", "treasure", "shop", "synth", "stiltzkin", "chocobo", "event", "moogle"] as const;

export const SETTINGS = {
  // ── Training ──
  "training.maxRanks": num({ group: "Training", label: "Ranks per stat", description: "How many ranks each stat can be trained. Lowering it keeps players' ranks but only this many count.", default: 20, min: 0, max: 99, integer: true }),
  "training.perRank": weights({
    group: "Training",
    label: "Gain per rank",
    description: "What one rank adds: Strength / Magic / Spirit / Speed in points (fractions add up over ranks), HP / MP in percent of max.",
    default: { strength: 1, magic: 1, spirit: 1, speed: 0.5, hp: 2, mp: 2 },
    keys: TRAIN_STAT_KEYS,
    min: 0,
  }),
  "training.costBase": num({ group: "Training", label: "Cost of rank 1 (CP)", description: "CP for a stat's first rank.", default: 1, min: 0, integer: true }),
  "training.costStep": num({ group: "Training", label: "Cost increase per rank (CP)", description: "Each further rank costs this much more than the last (1: rank n costs n).", default: 1, min: 0, integer: true }),

  // ── Start level ──
  "startLevel.max": num({ group: "Start level", label: "Highest start level", description: "The most a character's start level can be raised to. Lowering it caps existing ones too.", default: 21, min: 1, max: 99, integer: true }),
  "startLevel.costPerLevel": num({ group: "Start level", label: "CP per level", description: "Raising Lv n to n+1 costs n × this.", default: 1, min: 0 }),

  // ── Gear slots ──
  "slots.unlockCosts": nums({ group: "Gear slots", label: "Slot unlock costs (CP)", description: "CP for the 1st, 2nd, 3rd and 4th slot unlocked (any order of slots).", default: [5, 10, 20, 35], min: 0, integer: true, length: 4 }),
  "slots.starterArmor": choice({
    group: "Gear slots",
    label: "Starting outfit in locked slots",
    description: "Which FF9 starting gear characters wear in slots they haven't unlocked: all of it, body armour only, or nothing.",
    default: "all",
    options: ["all", "body", "none"] as const,
  }),

  // ── Completion Points ──
  "cp.perLevel": num({ group: "Completion Points", label: "Per level gained", description: "CP per level a character gained in the run.", default: 1, min: 0 }),
  "cp.battlesPerPoint": num({ group: "Completion Points", label: "Battles per point", description: "1 CP per this many battles won (0 = none).", default: 3, min: 0, integer: true }),
  "cp.perBoss": num({ group: "Completion Points", label: "Per boss", description: "CP per boss defeated.", default: 3, min: 0 }),
  "cp.perWin": num({ group: "Completion Points", label: "For a win", description: "CP for winning the run.", default: 10, min: 0 }),

  // ── Tiers ──
  "tiers.max": num({ group: "Tiers", label: "Highest tier", description: "The highest difficulty tier (0 = Normal).", default: 5, min: 0, max: 20, integer: true }),
  "tiers.enemyHpPerTier": num({ group: "Tiers", label: "Enemy HP per tier", description: "Enemy HP × (1 + tier × this).", default: 0.2, min: 0 }),
  "tiers.enemyAttackPerTier": num({ group: "Tiers", label: "Enemy attack per tier", description: "Enemy attack power × (1 + tier × this).", default: 0.1, min: 0 }),
  "tiers.rewardPerTier": num({ group: "Tiers", label: "Rewards per tier", description: "Reward gil and shop prices × (1 + tier × this).", default: 1, min: 0 }),

  // ── Supplies ──
  "supplies.basic": names({ group: "Supplies", label: "Always stocked", description: "Camp supplies open from the start (item names).", default: ["Potion", "Phoenix Down", "Antidote", "Eye Drops", "Echo Screen"] }),
  "supplies.all": names({
    group: "Supplies",
    label: "Every supply",
    description: "Every camp supply in display order (item names). Ones not always stocked open with the achievement that rewards them.",
    default: ["Potion", "Phoenix Down", "Antidote", "Eye Drops", "Echo Screen", "Hi-Potion", "Soft", "Magic Tag", "Vaccine", "Tent", "Annoyntment", "Ether", "Remedy", "Elixir"],
  }),
  "supplies.maxRanks": num({ group: "Supplies", label: "Ranks per supply", description: "Most extra copies of one supply a run can start with.", default: 5, min: 0, integer: true }),
  "supplies.maxRanksByItem": weights({ group: "Supplies", label: "Rank caps by item", description: "Lower caps for particular supplies (item name → ranks).", default: { Elixir: 2 }, min: 0 }),
  "supplies.costFactor": num({ group: "Supplies", label: "Cost factor", description: "Rank n of a supply costs its FF9 price × this × n.", default: 10, min: 0 }),

  // ── Relics ──
  "relics.baseSlots": num({ group: "Relics", label: "Relic slots", description: "Relic slots a run has before achievements add more.", default: 3, min: 1, max: 12, integer: true }),
  "relics.choices": num({ group: "Relics", label: "Relics to pick from", description: "How many relics the relic screen after a won fight offers (by the fight's relic chance).", default: 3, min: 1, max: 6, integer: true }),

  // ── Runs ──
  "run.startingGil": num({ group: "Runs", label: "Starting gil", description: "Gil a run starts with.", default: 300, min: 0, integer: true }),
  "run.starterKit": weights({ group: "Runs", label: "Starter kit", description: "Consumables every run starts with (item name → count), before supply ranks.", default: { Potion: 4, "Phoenix Down": 1, Antidote: 1 }, min: 0 }),
  "run.lossGilKept": num({ group: "Runs", label: "Gil kept on a loss", description: "Share of the run's gil banked when it's lost (0–1).", default: 0.5, min: 0, max: 1 }),
  "run.treasureGil": nums({ group: "Runs", label: "Treasure gil", description: "Treasure stage gil, low and high, × (area tier + 1).", default: [80, 160], min: 0, integer: true, length: 2 }),
  "run.sellFraction": num({ group: "Runs", label: "Sell price", description: "Selling pays this share of the FF9 price.", default: 0.5, min: 0, max: 1 }),
  "run.rarePrice": num({ group: "Runs", label: "Price of never-sold items", description: "The price used for items FF9 never sells (price under 10).", default: 20000, min: 0, integer: true }),
  "run.chocoboDigs": num({ group: "Runs", label: "Chocobo digs", description: "Digs at a Chocobo stage.", default: 3, min: 1, max: 9, integer: true }),

  // ── Encounters ──
  "encounters.extraOverParty": num({ group: "Encounters", label: "Monsters over party size", description: "A fight has at most party size + this many monsters (a solo hero always meets one).", default: 1, min: 0, integer: true }),
  "encounters.window": num({ group: "Encounters", label: "Encounter window", description: "How many encounter groups (by threat) are in play at each depth of a map.", default: 4, min: 1, integer: true }),

  // ── Maps ──
  "map.defaultShape": nums({ group: "Maps", label: "Default map shape", description: "Stages per round, start to boss, for areas without their own shape. First and last are 1; neighbours differ by at most 1.", default: [1, 2, 3, 4, 3, 4, 3, 2, 1], min: 1, integer: true }),
  "map.earlyWeights": weights({ group: "Maps", label: "Early stage weights", description: "The first quarter of a map: plain fights, and at its end treasure and events.", default: { battle: 8, treasure: 2, event: 1 }, keys: STAGE_KINDS, min: 0 }),
  "map.weights": weights({
    group: "Maps",
    label: "Stage weights",
    description: "How often each kind of stage appears after the first quarter (the Moogle's weight is for rounds other than the middle one).",
    default: { battle: 6, elite: 2, treasure: 1.5, shop: 1.2, synth: 1, stiltzkin: 0.45, chocobo: 0.8, event: 1.5, moogle: 0.3 },
    keys: STAGE_KINDS,
    min: 0,
  }),
  "map.middleMoogleWeight": num({ group: "Maps", label: "Moogle weight, middle round", description: "The Moogle's weight in a map's middle round (a rest halfway).", default: 1.5, min: 0 }),

  // ── Reward cards ──
  "cards.gearReach": num({ group: "Reward cards", label: "Gear reach by rarity", description: "Rarer gear cards pick nearer the top of the upgrade list: the list is cut to ÷ (1 + rarity rank × this).", default: 1.5, min: 0 }),
  "cards.spreadPerUpgrade": num({ group: "Reward cards", label: "Member weight per upgrade", description: "How much a member's number of possible upgrades raises their chance of a card.", default: 0.2, min: 0 }),
  "cards.spreadPerCard": num({ group: "Reward cards", label: "Member weight per card given", description: "How much each card already for a member lowers their chance of another.", default: 3, min: 0 }),
  "cards.boonAffinity": num({ group: "Reward cards", label: "Boon affinity", description: "A boon's weight × this for characters it favours.", default: 2, min: 1 }),
  "upgrade.abilityWeight": num({ group: "Reward cards", label: "Ability value", description: "Default worth of a new ability a piece of gear teaches (roles can set their own).", default: 6, min: 0 }),
  "upgrade.preferredAbilityMult": num({ group: "Reward cards", label: "Preferred ability ×", description: "A role's preferred abilities are worth this many times more.", default: 2, min: 1 }),
  "upgrade.lossShare": num({ group: "Reward cards", label: "Lost ability cost", description: "Share of an ability's worth counted against gear that stops teaching it (0–1).", default: 0.6, min: 0, max: 1 }),
} satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
type ValueOf<K extends SettingKey> = (typeof SETTINGS)[K] extends SettingDef<infer T> ? T : never;

/** A setting row as stored (`game_setting`). */
export interface GameSettingData {
  key: string;
  value: SettingValue;
}

let values: Map<string, SettingValue> | null = null;
onRewardTables(() => {
  values = new Map((rewardTables().settings ?? []).map((s) => [s.key, s.value]));
});

/**
 * A setting's value: the stored one when it's valid, else its default. A name → number table with fixed keys comes
 * back in its definition's key order whatever order it was stored in (Postgres reorders JSON object keys), so code
 * that walks it — weighted picks — behaves the same with values from the database, the seed file or the defaults.
 */
export function setting<K extends SettingKey>(key: K): ValueOf<K> {
  const stored = hasRewardTables() ? values?.get(key) : undefined;
  const value = stored !== undefined && checkSetting(key, stored) === null ? stored : SETTINGS[key].default;
  const def: SettingDef = SETTINGS[key];
  if (def.kind === "weights" && def.keys) {
    const table = value as Record<string, number>;
    return Object.fromEntries(def.keys.filter((k) => k in table).map((k) => [k, table[k]!])) as ValueOf<K>;
  }
  return value as ValueOf<K>;
}

export const isSettingKey = (key: string): key is SettingKey => key in SETTINGS;

/** Why a value can't be saved for a setting (null: it can). */
export function checkSetting(key: string, value: unknown): string | null {
  if (!isSettingKey(key)) return `Unknown setting ${key}`;
  const def: SettingDef = SETTINGS[key];
  const numberProblem = (n: unknown, d: { min?: number; max?: number; integer?: boolean }) => {
    if (typeof n !== "number" || !Number.isFinite(n)) return "must be a number";
    if (d.integer && !Number.isInteger(n)) return "must be a whole number";
    if (d.min != null && n < d.min) return `must be at least ${d.min}`;
    if (d.max != null && n > d.max) return `must be at most ${d.max}`;
    return null;
  };
  switch (def.kind) {
    case "number": {
      const p = numberProblem(value, def);
      return p ? `${def.label} ${p}` : null;
    }
    case "numbers": {
      if (!Array.isArray(value) || !value.length) return `${def.label} must be a list of numbers`;
      if (def.length != null && value.length !== def.length) return `${def.label} needs exactly ${def.length} numbers`;
      for (const n of value) {
        const p = numberProblem(n, def);
        if (p) return `${def.label}: every number ${p}`;
      }
      return null;
    }
    case "choice":
      return typeof value === "string" && def.options.includes(value) ? null : `${def.label} must be one of ${def.options.join(", ")}`;
    case "names":
      return Array.isArray(value) && value.every((x) => typeof x === "string" && x.trim()) ? null : `${def.label} must be a list of names`;
    case "weights": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return `${def.label} must be name → number pairs`;
      for (const [k, n] of Object.entries(value)) {
        if (def.keys && !def.keys.includes(k)) return `${def.label}: unknown key ${k} (use ${def.keys.join(", ")})`;
        const p = numberProblem(n, { min: def.min });
        if (p) return `${def.label}: ${k} ${p}`;
      }
      return null;
    }
  }
}

/** JSON with object keys sorted: Postgres's jsonb stores keys in its own order, so plain JSON text can't compare them. */
const stableJson = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Whether two setting values are the same (object key order doesn't count). */
export const sameSettingValue = (a: unknown, b: unknown): boolean => stableJson(a) === stableJson(b);

/** Every setting with its definition and current value, by group (the admin page). */
export function settingsList(): { key: SettingKey; def: SettingDef; value: SettingValue; isDefault: boolean }[] {
  return (Object.keys(SETTINGS) as SettingKey[]).map((key) => {
    const value = setting(key) as SettingValue;
    return { key, def: SETTINGS[key], value, isDefault: sameSettingValue(value, SETTINGS[key].default) };
  });
}
