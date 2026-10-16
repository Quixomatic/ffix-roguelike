/**
 * Character builds → battle-ready stats, using FF9's formulas:
 *   Max HP = HPTable[lv] × Str / 50     (Zidane Lv1: 250 × 21 / 50 = 105 — matches the game)
 *   Max MP = MPTable[lv] × Mag / 100    (Zidane Lv1: 200 × 18 / 100 = 36)
 *   Str/Mag grow by Lv×3/10, Spirit by Lv×3/20, Speed by Lv/10.
 * Equipment adds flat stat bonuses, defence/evade and elemental properties; abilities on equipped gear are
 * usable while worn and are learned permanently once their AP is filled.
 */
import {
  ELEMENTS,
  getCharacter,
  getItem,
  getSupportAbility,
  leveling,
  MAX_LEVEL,
  parseAbilityRef,
  type AbilityRef,
  type CharacterData,
  type Element,
  type EquipSlot,
  type Equipment,
  type ItemData,
  type WeaponData,
} from "@ffix-roguelike/game-data";

export const EQUIP_SLOTS: EquipSlot[] = ["weapon", "head", "wrist", "armor", "accessory"];
export const SLOT_KIND: Record<EquipSlot, ItemData["kind"]> = {
  weapon: "weapon",
  head: "head",
  wrist: "wrist",
  armor: "armor",
  accessory: "accessory",
};

export const MAX_HP = 9999;
export const MAX_MP = 999;

/** Persistent per-character state (lives in the player's profile). */
export interface CharacterBuild {
  key: string;
  /**
   * In a run: current level. At camp: the character's START level — every run begins here (1 until raised with
   * Memoria).
   */
  level: number;
  exp: number;
  equipment: Equipment;
  /** AP earned toward each ability. Reaching the ability's AP cost masters it permanently. */
  ap: Partial<Record<AbilityRef, number>>;
  /** Support ability ids switched on (must fit in the gem budget). */
  supports: number[];
  backRow: boolean;
  /** Runs/wins/bosses with this character in the party (stats). Optional for older saves. */
  record?: CharacterRecord;
  /** Unspent Completion Points — earned when a run ends, spent before a run on start level or gear slots. */
  points?: number;
  /** Equipment slots unlocked with Completion Points (the weapon slot is always open). */
  unlockedSlots?: EquipSlot[];
  /** Training ranks bought with Completion Points (0–TRAIN_MAX per stat), raising base stats for every run. */
  training?: Partial<Record<TrainStat, number>>;
  /**
   * FF9's hidden level-up bonus pool (FF9LEVEL_BONUS). Every level-up adds Str/Mag +3, Spirit +1, Stones +5,
   * plus the stat bonuses of the gear worn at that moment; stats gain pool ÷ 32. Optional for older saves.
   */
  growth?: GrowthPool;
}

export interface GrowthPool {
  speed: number;
  strength: number;
  magic: number;
  spirit: number;
  gems: number;
}

export const emptyGrowth = (): GrowthPool => ({ speed: 0, strength: 0, magic: 0, spirit: 0, gems: 0 });

/** FF9 stat caps (FF9PLAY_STAT_MAX): Speed 50, Strength 99, Magic 99, Spirit 50. */
export const STAT_CAPS = { speed: 50, strength: 99, magic: 99, spirit: 50 } as const;

/**
 * Apply level-ups from `from` to `build.level` to the growth pool, exactly like ff9level.cs: each level adds the
 * fixed bonus plus the equipped gear's stat bonuses.
 */
export function accrueGrowth(build: CharacterBuild, from: number): void {
  const pool = (build.growth ??= emptyGrowth());
  const gear = equippedItems(build);
  const sum = (k: "speed" | "strength" | "magic" | "spirit") => gear.reduce((n, i) => n + (i.bonus?.[k] ?? 0), 0);
  for (let lv = from; lv < build.level; lv++) {
    pool.speed += sum("speed");
    pool.strength += 3 + sum("strength");
    pool.magic += 3 + sum("magic");
    pool.spirit += 1 + sum("spirit");
    pool.gems += 5;
  }
}

export interface ElementProfile {
  weak: Element[];
  half: Element[];
  immune: Element[];
  absorb: Element[];
}

export interface DerivedStats {
  level: number;
  maxHp: number;
  maxMp: number;
  speed: number;
  strength: number;
  magic: number;
  spirit: number;
  /** Weapon power. */
  attack: number;
  defence: number;
  evade: number;
  magicDefence: number;
  magicEvade: number;
  weapon: WeaponData | null;
  attackElements: Element[];
  elements: ElementProfile;
  gemsMax: number;
  gemsUsed: number;
}

/** A character's own run history (counts only runs they were in the party for). */
export interface CharacterRecord {
  runs: number;
  wins: number;
  bossKills: number;
}

export const emptyRecord = (): CharacterRecord => ({ runs: 0, wins: 0, bossKills: 0 });

/**
 * Equipment slots: every character can always use their weapon slot. Body, Head, Arm and Accessory are locked
 * until unlocked with Completion Points — a locked slot can't hold gear at all, at camp or during a run.
 * Each unlock costs more than the last; the player chooses which slot to open.
 */
export const UNLOCKABLE_SLOTS: EquipSlot[] = ["armor", "head", "wrist", "accessory"];
export const SLOT_UNLOCK_COSTS = [5, 10, 20, 35];

export function slotUnlocked(build: CharacterBuild, slot: EquipSlot): boolean {
  return slot === "weapon" || (build.unlockedSlots ?? []).includes(slot);
}

/** CP cost of the next slot unlock, or null when all four are open. */
export function nextSlotCost(build: CharacterBuild): number | null {
  return SLOT_UNLOCK_COSTS[(build.unlockedSlots ?? []).length] ?? null;
}

/**
 * Balance switch — which FF9 starting gear characters wear in slots they haven't unlocked yet.
 * FF9's monster stats assume armour: a Goblin's Knife hits Zidane for ~18 in his starting gear, ~72 without.
 *   "all"  — full FF9 starting outfit (head, arm, body, accessory) every run
 *   "body" — starting body armour only
 *   "none" — nothing until the slot is unlocked with Completion Points
 * Locked slots can't be changed either way: unlocking a slot is what lets found gear go there.
 */
export const STARTER_ARMOR: "all" | "body" | "none" = "all";

function wearsStarter(slot: EquipSlot): boolean {
  if (STARTER_ARMOR === "all") return true;
  if (STARTER_ARMOR === "body") return slot === "armor";
  return false;
}

/**
 * What a character starts every run wearing: their FF9 starting weapon, their FF9 starting gear in each slot
 * they've unlocked, and in locked slots whatever STARTER_ARMOR allows. Some characters have no starting piece
 * for a slot.
 */
export function starterGear(build: CharacterBuild): Equipment {
  const def = getCharacter(build.key).defaultEquipment;
  const pick = (slot: Exclude<EquipSlot, "weapon">) => (slotUnlocked(build, slot) || wearsStarter(slot) ? def[slot] : null);
  return {
    weapon: def.weapon,
    head: pick("head"),
    wrist: pick("wrist"),
    armor: pick("armor"),
    accessory: pick("accessory"),
  };
}

/** The character's FF9 starting weapon — always free to bring, never counts against the loadout. */
export function getStarterWeapon(key: string): number | null {
  return getCharacter(key).defaultEquipment.weapon;
}

/** A fresh character: their FF9 starting weapon only (gear slots are bought with Completion Points). */
export function newBuild(key: string, level = 1): CharacterBuild {
  const data = getCharacter(key);
  return {
    key,
    level,
    exp: expForLevel(level),
    equipment: { weapon: data.defaultEquipment.weapon, head: null, wrist: null, armor: null, accessory: null },
    ap: {},
    supports: [],
    backRow: data.backRow,
  };
}

export function expForLevel(level: number): number {
  return leveling[Math.max(0, Math.min(MAX_LEVEL, level) - 1)]!.exp;
}

/** Level reached with `exp` total experience. */
export function levelForExp(exp: number): number {
  let lv = 1;
  for (const row of leveling) if (exp >= row.exp) lv = row.level;
  return lv;
}

export function equippedItems(build: CharacterBuild): ItemData[] {
  return EQUIP_SLOTS.map((s) => build.equipment[s])
    .filter((id): id is number => id != null)
    .map(getItem);
}

/** Abilities granted by currently equipped gear (only ones this character can learn). */
export function gearAbilities(build: CharacterBuild): AbilityRef[] {
  const learnable = new Set(getCharacter(build.key).abilities.map((a) => a.ref));
  const out = new Set<AbilityRef>();
  for (const item of equippedItems(build)) for (const ref of item.abilities) if (learnable.has(ref)) out.add(ref);
  return [...out];
}

export function apCost(character: CharacterData, ref: AbilityRef): number {
  return character.abilities.find((a) => a.ref === ref)?.ap ?? 0;
}

export function isMastered(build: CharacterBuild, ref: AbilityRef): boolean {
  const cost = apCost(getCharacter(build.key), ref);
  return cost > 0 && (build.ap[ref] ?? 0) >= cost;
}

/** Every ability usable right now: mastered ones plus those on equipped gear. */
export function availableAbilities(build: CharacterBuild): AbilityRef[] {
  const character = getCharacter(build.key);
  const gear = new Set(gearAbilities(build));
  return character.abilities.map((a) => a.ref).filter((ref) => gear.has(ref) || isMastered(build, ref));
}

export function availableActions(build: CharacterBuild): number[] {
  return availableAbilities(build)
    .map(parseAbilityRef)
    .filter((a) => a.kind === "active")
    .map((a) => a.id);
}

/** FF9: base stones + Lv × 4/10 + pool ÷ 32 (ff9level.FF9Level_GetCap). */
export function gemsMax(build: CharacterBuild): number {
  return getCharacter(build.key).base.gems + Math.floor((build.level * 4) / 10) + ((build.growth?.gems ?? 0) >> 5);
}

export function gemsUsed(build: CharacterBuild): number {
  return build.supports.reduce((sum, id) => sum + getSupportAbility(id).gems, 0);
}

/** Supports that are actually active: switched on, available, and within the gem budget (in order). */
export function activeSupports(build: CharacterBuild): Set<number> {
  const available = new Set(
    availableAbilities(build)
      .map(parseAbilityRef)
      .filter((a) => a.kind === "support")
      .map((a) => a.id),
  );
  const out = new Set<number>();
  let budget = gemsMax(build);
  for (const id of build.supports) {
    const cost = getSupportAbility(id).gems;
    if (available.has(id) && cost <= budget) {
      out.add(id);
      budget -= cost;
    }
  }
  return out;
}

/** Rough power of a piece of gear (Optimize, best-in-slot, sims). */
export function gearScore(item: ItemData): number {
  const b = item.bonus;
  const stats = b ? (b.speed + b.strength + b.magic + b.spirit) * 3 : 0;
  if (item.weapon) return item.weapon.power * 4 + stats;
  const a = item.armor;
  return (a ? a.defence * 3 + a.magicDefence * 3 + a.evade + a.magicEvade : 0) + stats + item.price / 2000;
}

export function canEquip(key: string, item: ItemData, slot: EquipSlot): boolean {
  return item.kind === SLOT_KIND[slot] && item.equippableBy.includes(key);
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

// ── training (CP → base stats) ───────────────────────────────────────────────

export const TRAIN_STATS = ["strength", "magic", "spirit", "speed", "hp", "mp"] as const;
export type TrainStat = (typeof TRAIN_STATS)[number];
/** Ranks per stat. */
export const TRAIN_MAX = 20;
/**
 * What each rank adds. Strength/Magic raise the "basis" stats (so HP/MP follow, as in FF9); Speed is FF9's
 * strongest stat, so it takes two ranks per point; HP/MP are percentages. Tuning lives here.
 */
export const TRAIN_EFFECT: Record<TrainStat, { per: number; unit: "point" | "percent"; label: string }> = {
  strength: { per: 1, unit: "point", label: "Strength" },
  magic: { per: 1, unit: "point", label: "Magic" },
  spirit: { per: 1, unit: "point", label: "Spirit" },
  speed: { per: 0.5, unit: "point", label: "Speed" },
  hp: { per: 2, unit: "percent", label: "HP" },
  mp: { per: 2, unit: "percent", label: "MP" },
};
/** CP for the next rank: rank n costs n (a full stat is 210 CP). */
export const trainCost = (rank: number) => rank + 1;
export const trainRank = (build: CharacterBuild, stat: TrainStat) => Math.max(0, Math.min(TRAIN_MAX, build.training?.[stat] ?? 0));
/** The bonus a stat gets from its ranks (points, or percent for HP/MP). */
export const trainBonus = (build: CharacterBuild, stat: TrainStat) => Math.floor(trainRank(build, stat) * TRAIN_EFFECT[stat].per);

export function deriveStats(build: CharacterBuild): DerivedStats {
  const data = getCharacter(build.key);
  const lv = Math.max(1, Math.min(MAX_LEVEL, build.level));
  const row = leveling[lv - 1]!;
  const gear = equippedItems(build);
  const supports = activeSupports(build);

  // "Basis" stats (ff9level.cs): base + level growth + bonus pool ÷ 32. Max HP/MP use these, before gear.
  const pool = build.growth ?? emptyGrowth();
  const basisStr = Math.min(STAT_CAPS.strength, data.base.strength + Math.floor((lv * 3) / 10) + (pool.strength >> 5) + trainBonus(build, "strength"));
  const basisMag = Math.min(STAT_CAPS.magic, data.base.magic + Math.floor((lv * 3) / 10) + (pool.magic >> 5) + trainBonus(build, "magic"));
  let speed = Math.min(STAT_CAPS.speed, data.base.speed + Math.floor(lv / 10) + (pool.speed >> 5) + trainBonus(build, "speed"));
  let strength = basisStr;
  let magic = basisMag;
  let spirit = Math.min(STAT_CAPS.spirit, data.base.spirit + Math.floor((lv * 3) / 20) + (pool.spirit >> 5) + trainBonus(build, "spirit"));
  let defence = 0;
  let evade = 0;
  let magicDefence = 0;
  let magicEvade = 0;
  const attackElements: Element[] = [];
  const elements: ElementProfile = { weak: [], half: [], immune: [], absorb: [] };
  let weapon: WeaponData | null = null;

  for (const item of gear) {
    if (item.weapon) weapon = item.weapon;
    if (item.armor) {
      defence += item.armor.defence;
      evade += item.armor.evade;
      magicDefence += item.armor.magicDefence;
      magicEvade += item.armor.magicEvade;
    }
    const b = item.bonus;
    if (b) {
      speed += b.speed;
      strength += b.strength;
      magic += b.magic;
      spirit += b.spirit;
      attackElements.push(...b.attackElement);
      elements.immune.push(...b.guardElement);
      elements.absorb.push(...b.absorbElement);
      elements.half.push(...b.halfElement);
      elements.weak.push(...b.weakElement);
    }
  }
  if (weapon) attackElements.push(...weapon.elements);

  strength = Math.min(STAT_CAPS.strength, strength);
  magic = Math.min(STAT_CAPS.magic, magic);
  spirit = Math.min(STAT_CAPS.spirit, spirit);
  speed = Math.min(STAT_CAPS.speed, speed);

  let maxHp = Math.floor((row.hpBonus * basisStr) / 50);
  let maxMp = Math.floor((row.mpBonus * basisMag) / 100);
  maxHp = Math.floor((maxHp * (100 + trainBonus(build, "hp"))) / 100);
  maxMp = Math.floor((maxMp * (100 + trainBonus(build, "mp"))) / 100);
  // HP+10%/20%, MP+10%/20% (support ids 5–8)
  if (supports.has(5)) maxHp = Math.floor(maxHp * 1.1);
  if (supports.has(6)) maxHp = Math.floor(maxHp * 1.2);
  if (supports.has(7)) maxMp = Math.floor(maxMp * 1.1);
  if (supports.has(8)) maxMp = Math.floor(maxMp * 1.2);

  return {
    level: lv,
    maxHp: Math.min(MAX_HP, Math.max(1, maxHp)),
    maxMp: Math.min(MAX_MP, maxMp),
    speed,
    strength,
    magic,
    spirit,
    attack: weapon?.power ?? 5,
    defence,
    evade,
    magicDefence,
    magicEvade,
    weapon,
    attackElements: uniq(attackElements).filter((e) => ELEMENTS.includes(e)),
    elements: {
      weak: uniq(elements.weak),
      half: uniq(elements.half),
      immune: uniq(elements.immune),
      absorb: uniq(elements.absorb),
    },
    gemsMax: gemsMax(build),
    gemsUsed: gemsUsed(build),
  };
}

// ── gear comparison ──────────────────────────────────────────────────────────

/** Stats a gear comparison reports, in display order. */
export const COMPARED_STATS = ["maxHp", "maxMp", "strength", "magic", "spirit", "speed", "attack", "defence", "evade", "magicDefence", "magicEvade", "gemsMax"] as const;
export type ComparedStat = (typeof COMPARED_STATS)[number];

export interface GearChange {
  slot: EquipSlot;
  /** What's in that slot now (null = empty). */
  replaces: number | null;
  /** Already wearing this exact item. */
  same: boolean;
  /** Can this character wear it at all (their gear type), and is the slot open for them? */
  canEquip: boolean;
  slotLocked: boolean;
  /** Stat changes from swapping it in (only non-zero ones). */
  deltas: Partial<Record<ComparedStat, number>>;
  /** Abilities that become usable / stop being usable (taught by the new / old item). */
  gains: AbilityRef[];
  loses: AbilityRef[];
}

/**
 * What equipping `itemId` would do to a character, compared with what they wear in that slot now — the full
 * derived stats (level growth, support abilities, everything), not just the item's own numbers.
 */
export function gearChange(build: CharacterBuild, itemId: number): GearChange | null {
  const item = getItem(itemId);
  const slot = EQUIP_SLOTS.find((s) => SLOT_KIND[s] === item.kind);
  if (!slot) return null;
  const replaces = build.equipment[slot] ?? null;
  const before = deriveStats(build);
  const next: CharacterBuild = { ...build, equipment: { ...build.equipment, [slot]: itemId } };
  const after = deriveStats(next);
  const deltas: GearChange["deltas"] = {};
  for (const k of COMPARED_STATS) {
    const d = after[k] - before[k];
    if (d) deltas[k] = d;
  }
  const had = new Set(availableAbilities(build));
  const has = new Set(availableAbilities(next));
  return {
    slot,
    replaces,
    same: replaces === itemId,
    canEquip: canEquip(build.key, item, slot),
    slotLocked: !slotUnlocked(build, slot),
    deltas,
    gains: [...has].filter((r) => !had.has(r)),
    loses: [...had].filter((r) => !has.has(r)),
  };
}
