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
  /** Loadout gear slots bought with Completion Points (0–5). */
  slots?: number;
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
 * Loadout slots: how many pieces of stash gear a character may pre-equip before a run (in any equipment slot;
 * their FF9 starting weapon is always free). Everyone starts with none; each is bought with Completion Points,
 * because starting a run geared up is a big advantage.
 */
export const LOADOUT_SLOT_COSTS = [5, 10, 20, 35, 50];

export function loadoutSlots(build: CharacterBuild): number {
  return Math.min(LOADOUT_SLOT_COSTS.length, build.slots ?? 0);
}

/** CP cost of the next loadout slot, or null when all five are owned. */
export function nextSlotCost(build: CharacterBuild): number | null {
  return LOADOUT_SLOT_COSTS[loadoutSlots(build)] ?? null;
}

/** Equipment slots holding loadout gear (the starting weapon doesn't count). */
export function loadoutUsed(build: CharacterBuild): EquipSlot[] {
  const starter = getCharacter(build.key).defaultEquipment.weapon;
  return EQUIP_SLOTS.filter((slot) => build.equipment[slot] != null && !(slot === "weapon" && build.equipment.weapon === starter));
}

/** Loadout order when trimming over-budget gear: weapon first, then body, head, arm, accessory. */
export const LOADOUT_PRIORITY: EquipSlot[] = ["weapon", "armor", "head", "wrist", "accessory"];

/**
 * Remove gear beyond the loadout budget (mutates). A removed weapon falls back to the starting weapon.
 * Returns the slots that were emptied.
 */
export function trimLoadout(build: CharacterBuild): EquipSlot[] {
  const budget = loadoutSlots(build);
  const used = LOADOUT_PRIORITY.filter((slot) => loadoutUsed(build).includes(slot));
  const removed = used.slice(budget);
  for (const slot of removed) build.equipment[slot] = slot === "weapon" ? getCharacter(build.key).defaultEquipment.weapon : null;
  return removed;
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

export function canEquip(key: string, item: ItemData, slot: EquipSlot): boolean {
  return item.kind === SLOT_KIND[slot] && item.equippableBy.includes(key);
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

export function deriveStats(build: CharacterBuild): DerivedStats {
  const data = getCharacter(build.key);
  const lv = Math.max(1, Math.min(MAX_LEVEL, build.level));
  const row = leveling[lv - 1]!;
  const gear = equippedItems(build);
  const supports = activeSupports(build);

  // "Basis" stats (ff9level.cs): base + level growth + bonus pool ÷ 32. Max HP/MP use these, before gear.
  const pool = build.growth ?? emptyGrowth();
  const basisStr = Math.min(STAT_CAPS.strength, data.base.strength + Math.floor((lv * 3) / 10) + (pool.strength >> 5));
  const basisMag = Math.min(STAT_CAPS.magic, data.base.magic + Math.floor((lv * 3) / 10) + (pool.magic >> 5));
  let speed = Math.min(STAT_CAPS.speed, data.base.speed + Math.floor(lv / 10) + (pool.speed >> 5));
  let strength = basisStr;
  let magic = basisMag;
  let spirit = Math.min(STAT_CAPS.spirit, data.base.spirit + Math.floor((lv * 3) / 20) + (pool.spirit >> 5));
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
