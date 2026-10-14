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
  /** FF9 OprCnt: interval factor for poison/regen/doom ticks (0 = no tick). */
  tick: number;
  /** FF9 ContiCnt: duration factor (0 = until cured). */
  duration: number;
  /** Statuses removed when this one is applied. */
  clearOnApply: Status[];
  /** Statuses that can't be applied while this one is active. */
  immunityProvided: Status[];
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
  /** FF9 ability type flags (4 = summon). */
  type: number;
  /** Special-effect id (FF9 uses it to tell e.g. Comet from other spells). */
  vfx: number;
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
  /** FF9 character category bits: 1 male, 2 female, 4 Gaia, 8 Terra, 16 sub-character. */
  category: number;
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

/** An enemy attack from FF9's battle scenes (Memoria battle export). Targets read from the monster's side. */
export interface FF9EnemyAction {
  /** Index in bestiary.json's action table. */
  uid: number;
  name: string;
  targets: TargetType;
  defaultAlly: boolean;
  scriptId: number;
  power: number;
  elements: Element[];
  rate: number;
  category: number;
  statuses: Status[];
  mp: number;
  type: number;
  vfx: number;
}

/** A monster from FF9's battle scenes, with its real stats. */
export interface FF9Enemy {
  uid: number;
  name: string;
  level: number;
  /** Real HP (FF9's +10,000 "scripted death" buffer already removed). */
  hp: number;
  mp: number;
  speed: number;
  strength: number;
  magic: number;
  spirit: number;
  defence: number;
  evade: number;
  magicDefence: number;
  magicEvade: number;
  exp: number;
  gil: number;
  ap: number;
  /** FF9 enemy category bits: 1 humanoid, 2 beast, 4 devil, 8 dragon, 16 undead, 32 stone, 64 soul, 128 flight. */
  category: number;
  resist: Status[];
  autoStatus: Status[];
  startStatus: Status[];
  guard: Element[];
  absorb: Element[];
  half: Element[];
  weak: Element[];
  /** Steal slots, common → rare (FF9 rates 256/64/16/1); -1 = empty. */
  steal: number[];
  /** Drops (FF9 rates 256/96/32/1); -1 = empty. */
  drops: number[];
  /** Blue magic Quina learns by eating it (FF9 ability id), 0 = none. */
  blue: number;
  /** Scripted-death boss (FF9 FLG_NON_DYING_BOSS). */
  boss: boolean;
  /** Its attacks (indexes into the action table). */
  attacks: number[];
  /** Battle scenes it appears in (Memoria scene names, e.g. EF_E009 = Evil Forest). */
  scenes: string[];
}

/** One FF9 battle scene: which bestiary monster each enemy type is, its attack table, spawn patterns. */
export interface FF9Scene {
  /** Memoria scene name without the EVT_BATTLE_ prefix, e.g. "EF_E009" (Plant Brain). */
  id: string;
  flags: string[];
  /** Enemy type slot (typeNo) → bestiary enemy uid (-1 = dummy/unnamed). */
  types: number[];
  /** Attack slot (the index the AI script picks) → bestiary action uid. */
  attacks: number[];
  patterns: { rate: number; ap: number; spawn: { typeNo: number; targetable: boolean }[] }[];
}

export interface FF9Bestiary {
  enemies: FF9Enemy[];
  actions: FF9EnemyAction[];
  scenes: FF9Scene[];
}
