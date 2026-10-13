/**
 * Shapes of the FF9 data imported from Memoria's CSV exports (see scripts/import-memoria.ts).
 * Ids are kept identical to the original game so data can be cross-referenced with Memoria/Hades Workshop.
 */

export const ELEMENTS = ["fire", "ice", "thunder", "earth", "water", "wind", "holy", "shadow"] as const;
export type Element = (typeof ELEMENTS)[number];

/** The 32 FF9 statuses, index = Memoria status id. */
export const STATUSES = [
  "petrify",
  "venom",
  "virus",
  "silence",
  "blind",
  "trouble",
  "zombie",
  "easyKill",
  "death",
  "lowHp",
  "confuse",
  "berserk",
  "stop",
  "autoLife",
  "trance",
  "defend",
  "poison",
  "sleep",
  "regen",
  "haste",
  "slow",
  "float",
  "shell",
  "protect",
  "heat",
  "freeze",
  "vanish",
  "doom",
  "mini",
  "reflect",
  "jump",
  "gradualPetrify",
] as const;
export type Status = (typeof STATUSES)[number];

export type TargetType =
  | "singleAny"
  | "singleAlly"
  | "singleEnemy"
  | "manyAny"
  | "manyAlly"
  | "manyEnemy"
  | "all"
  | "allAlly"
  | "allEnemy"
  | "random"
  | "randomAlly"
  | "randomEnemy"
  | "everyone"
  | "self"
  | "automatic";

export interface StatusInfo {
  id: number;
  key: Status;
  name: string;
  /** Seconds between ticks for damage/heal-over-time statuses (0 = no tick). */
  tick: number;
  /** Duration in game-time units (0 = until cured). */
  duration: number;
}

export interface ActionData {
  id: number;
  name: string;
  targets: TargetType;
  defaultAlly: boolean;
  forDead: boolean;
  /** Memoria battle script id — selects the formula (see game-core/formulas). */
  scriptId: number;
  power: number;
  elements: Element[];
  /** Hit rate / status rate (255 = always). */
  rate: number;
  category: number;
  statuses: Status[];
  mp: number;
}

export interface SupportAbilityData {
  id: number;
  name: string;
  gems: number;
}

/** `AA:<actionId>` (active) or `SA:<supportId>` (support). */
export type AbilityRef = `AA:${number}` | `SA:${number}`;

export interface LearnableAbility {
  ref: AbilityRef;
  ap: number;
}

export interface BaseStats {
  speed: number;
  strength: number;
  magic: number;
  spirit: number;
  gems: number;
}

export interface CharacterData {
  id: number;
  key: string;
  name: string;
  base: BaseStats;
  /** True = starts in the back row. */
  backRow: boolean;
  /** The two special commands (e.g. Zidane: Steal + Skill). */
  commands: [CommandData, CommandData];
  trance: [CommandData, CommandData];
  abilities: LearnableAbility[];
  defaultEquipment: Equipment;
}

export interface CommandData {
  id: number;
  name: string;
  /** Abilities this command exposes; filtered by what the character has learned. */
  actionIds: number[];
}

export interface Equipment {
  weapon: number | null;
  head: number | null;
  wrist: number | null;
  armor: number | null;
  accessory: number | null;
}

export type EquipSlot = keyof Equipment;

export type ItemKind = "weapon" | "wrist" | "head" | "armor" | "accessory" | "item" | "gem";

export interface StatBonus {
  speed: number;
  strength: number;
  magic: number;
  spirit: number;
  attackElement: Element[];
  guardElement: Element[];
  absorbElement: Element[];
  halfElement: Element[];
  weakElement: Element[];
}

export interface WeaponData {
  power: number;
  scriptId: number;
  elements: Element[];
  statuses: Status[];
  statusRate: number;
  /** Raw FF9 weapon category bitmask. */
  category: number;
  longRange: boolean;
}

export interface ArmorData {
  defence: number;
  evade: number;
  magicDefence: number;
  magicEvade: number;
}

export interface ItemEffectData {
  targets: TargetType;
  scriptId: number;
  power: number;
  rate: number;
  elements: Element[];
  statuses: Status[];
  forDead: boolean;
}

export interface ItemData {
  id: number;
  name: string;
  kind: ItemKind;
  price: number;
  /** Rough rarity/quality from the original data (1 = early game). */
  quality: number;
  abilities: AbilityRef[];
  equippableBy: string[];
  bonus: StatBonus | null;
  weapon: WeaponData | null;
  armor: ArmorData | null;
  effect: ItemEffectData | null;
}

export interface LevelRow {
  level: number;
  /** Total experience required to reach this level. */
  exp: number;
  hpBonus: number;
  mpBonus: number;
}

export interface SynthesisRecipe {
  id: number;
  /** Item produced. */
  result: number;
  /** Item ids consumed (may repeat, e.g. two Mage Mashers). */
  ingredients: number[];
  price: number;
  /** FF9 synthesis shops that sold the recipe (32–39, in story order; 39 = Hades Workshop). */
  shops: number[];
}

export interface ShopData {
  id: number;
  name: string;
  items: number[];
}
