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
  level: number;
  exp: number;
  equipment: Equipment;
  /** AP earned toward each ability. Reaching the ability's AP cost masters it permanently. */
  ap: Partial<Record<AbilityRef, number>>;
  /** Support ability ids switched on (must fit in the gem budget). */
  supports: number[];
  backRow: boolean;
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

/**
 * Character level needed before a slot can be pre-equipped at camp. Gear found during a run can go in any
 * slot; these unlocks are what let you start each run a little stronger.
 */
export const PRE_EQUIP_LEVELS: Record<EquipSlot, number> = { weapon: 1, armor: 3, head: 6, wrist: 10, accessory: 15 };

export function preEquipUnlocked(level: number, slot: EquipSlot): boolean {
  return level >= PRE_EQUIP_LEVELS[slot];
}

/** A fresh character: their FF9 starting weapon only (other slots unlock with levels). */
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

export function gemsMax(build: CharacterBuild): number {
  return getCharacter(build.key).base.gems + Math.floor((build.level * 4) / 5);
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

  let speed = data.base.speed + Math.floor(lv / 10);
  let strength = data.base.strength + Math.floor((lv * 3) / 10);
  let magic = data.base.magic + Math.floor((lv * 3) / 10);
  let spirit = data.base.spirit + Math.floor((lv * 3) / 20);
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

  const cap = (n: number) => Math.min(99, n);
  strength = cap(strength);
  magic = cap(magic);
  spirit = cap(spirit);
  speed = cap(speed);

  let maxHp = Math.floor((row.hpBonus * strength) / 50);
  let maxMp = Math.floor((row.mpBonus * magic) / 100);
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
