import type { ActionData, Element, Status, TargetType, WeaponData } from "@ffix-roguelike/game-data";

import type { ElementProfile } from "../stats";
import type { AiState } from "./ai/vm";

export type Side = "party" | "enemy";

/** Monster families (sprites + killer abilities). Mapped onto FF9's enemy category bits. */
export type EnemyFamily = "beast" | "bird" | "bug" | "stone" | "undead" | "dragon" | "devil" | "human" | "machine" | "amorphous";

/** FF9 enemy category bits (Memoria EnemyCategory). */
export const ENEMY_CATEGORY = {
  humanoid: 1,
  beast: 2,
  devil: 4,
  dragon: 8,
  undead: 16,
  stone: 32,
  soul: 64,
  flight: 128,
} as const;

/** FF9 character category bits (Memoria CharacterCategory). */
export const PLAYER_CATEGORY = { male: 1, female: 2, gaia: 4, terra: 8, subpc: 16 } as const;

/**
 * Time model — FF9 (Memoria, default settings): the battle runs at 15 ticks per second; every tick each unit's
 * ATB rises by `at_coef × 4` (at_coef 10 normally, 15 with Haste, 6 with Slow) towards a maximum of
 * `(60 − Speed) × 160`. Status timers count down by `at_coef` per tick.
 */
export const TICKS_PER_SECOND = 15;
export const ATB_COEF = 10;
export const ATB_SPEED_FACTOR = 4;
export const TRANCE_MAX = 255;
export const DAMAGE_LIMIT = 9999;
export const MP_DAMAGE_LIMIT = 999;

export const atbMaxFor = (speed: number) => Math.max(160, (60 - speed) * 160);

export interface StatusTimer {
  /** ATB units left before the status wears off (null = until cured). */
  conti?: number | null;
  /** ATB units until the next poison/regen/doom tick. */
  opr?: number;
  /** Doom / gradual-petrify countdown shown to the player. */
  counter?: number;
}

export interface CommandDef {
  /** FF9 command id (Commands.csv): drives special behaviour (Double Black, Eidolon, Jump in Trance…). */
  id: number;
  name: string;
  actionIds: number[];
}

export interface AiRule {
  actionId: number;
  weight: number;
  /** Only when own HP% is at or below this. */
  hpBelow?: number;
  /** Only on turns where (turn - offset) % every === 0. */
  every?: number;
  offset?: number;
  /** Who to aim at (default: random valid target). */
  aim?: "random" | "lowestHp" | "highestHp" | "self" | "weakestAlly" | "backRow";
  /** Use at most once per battle. */
  once?: boolean;
}

export interface StealSlot {
  itemId: number;
  /** Out of 256 (FF9 steal rate). Slots are tried rarest (last) first. */
  chance: number;
}

export interface BattleUnit {
  id: string;
  side: Side;
  /** Character key or enemy id. */
  key: string;
  name: string;
  sprite: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  speed: number;
  strength: number;
  magic: number;
  spirit: number;
  /** Party: weapon power. Enemies: power of their basic attack. */
  attack: number;
  defence: number;
  evade: number;
  magicDefence: number;
  magicEvade: number;
  weapon: WeaponData | null;
  weaponId: number | null;
  /** The weapon's elements (what the Attack command hits with). */
  attackElements: Element[];
  /** Elements this unit's gear boosts (+50% to abilities of that element). */
  bonusElements: Element[];
  elements: ElementProfile;
  statusImmune: Status[];
  statuses: Partial<Record<Status, StatusTimer>>;
  /** Statuses that can't be removed (Auto-Haste, Auto-Reflect…). */
  permanent: Status[];
  atb: number;
  atbMax: number;
  trance: number;
  backRow: boolean;
  supports: number[];
  turns: number;
  /** Has a command selected or queued (FF9 `sel_mode`): the gauge doesn't fill meanwhile. */
  busyCommand: boolean;
  /** Taken out of the battle entirely (swallowed). */
  removed?: boolean;
  /** FF9 player category bits (male/female…), 0 for enemies. */
  playerCategory: number;
  /** FF9 enemy category bits (humanoid/beast…), 0 for party members. */
  enemyCategory: number;
  // party only
  commands: CommandDef[];
  tranceCommands: CommandDef[];
  /** Freya's Jump: ATB units until she lands, and where. */
  jump?: { countdown: number; targetIds: string[]; trance: boolean };
  /** Garnet's Trance: the Eidolon that keeps recasting, and when. */
  phantom?: { actionId: number; countdown: number };
  // enemy only
  family?: EnemyFamily;
  ai?: AiRule[];
  /** Abilities the enemy answers attacks with (FF9 battle scripts' counters). */
  counters?: AiRule[];
  usedOnce?: number[];
  steal?: StealSlot[];
  boss?: boolean;
  /** Blue magic Quina learns by eating this enemy. */
  eatTeaches?: number;
  // FF9 battle scripts (battle/ai)
  /** FF9 enemy type slot (typeNo) in the battle's scene. */
  ff9Type?: number;
  /** Spawn position in the scene's pattern (FF9 btl index 4 + slot); defaults to the unit's id number. */
  ff9Slot?: number;
  /** Set by the battle script: can't be targeted. */
  untargetable?: boolean;
  /** Set by the battle script: not shown (and not targetable). */
  hidden?: boolean;
  /** Takes no ATB turns (FF9 bi.atb = 0: scripted parts that only act through their script). */
  noAtb?: boolean;
  /** A boss whose HP ran out, held for its script to stage the end (FF9's "HP < 10,000" dying state). */
  ff9Dying?: boolean;
}

export type CommandKind = "attack" | "ability" | "item" | "throw" | "defend" | "flee" | "change";

export interface BattleCommand {
  actorId: string;
  kind: CommandKind;
  actionId?: number;
  itemId?: number;
  targetIds: string[];
  /** Double Black / Double White: the second spell and its targets. */
  second?: { actionId: number; targetIds: string[] };
  /** Chosen by an FF9 battle script: its targets are used as given. */
  scripted?: boolean;
}

/**
 * Why a command is in the queue (FF9 command slots: main, counter, Jump, Trance…). "dying" is an enemy's death
 * move (FF9 EnemyDying), "script" a move a battle script plays outside the queue (AttackSpecial).
 */
export type CommandSource = "main" | "counter" | "magicCounter" | "autoPotion" | "auto" | "spear" | "phantom" | "second" | "dying" | "script";

export interface QueuedCommand {
  command: BattleCommand;
  source: CommandSource;
}

export interface InputRecord {
  tick: number;
  command: BattleCommand;
}

export type BattleEvent =
  | { type: "turnReady"; unitId: string }
  | { type: "actionStart"; actorId: string; name: string; kind: CommandKind; targetIds: string[] }
  | { type: "damage"; targetId: string; amount: number; crit?: boolean; mp?: boolean }
  | { type: "heal"; targetId: string; amount: number; mp?: boolean }
  | { type: "miss"; targetId: string }
  | { type: "guard"; targetId: string }
  | { type: "statusOn"; targetId: string; status: Status }
  | { type: "statusOff"; targetId: string; status: Status }
  | { type: "ko"; targetId: string }
  | { type: "revive"; targetId: string }
  | { type: "tranceStart"; unitId: string }
  | { type: "tranceEnd"; unitId: string }
  | { type: "steal"; actorId: string; targetId: string; itemId: number | null }
  | { type: "learn"; unitId: string; actionId: number }
  | { type: "message"; text: string }
  /** An FF9 battle script shows a line of the scene's battle text. */
  | { type: "scriptText"; scene: string; textId: number; actorId?: string }
  | { type: "end"; outcome: BattleOutcome };

export type BattleOutcome = "victory" | "defeat" | "fled";

export interface ConsumableStock {
  itemId: number;
  count: number;
}

export interface BattleState {
  seed: number;
  rng: number;
  tick: number;
  mode: "wait" | "active";
  units: BattleUnit[];
  /** Party members whose gauge is full and who are waiting for a command, in order. */
  ready: string[];
  /** Commands waiting to execute, in order. */
  queue: QueuedCommand[];
  /** Ticks until the next queued command may execute (animation time). */
  busy: number;
  inventory: ConsumableStock[];
  inputs: InputRecord[];
  outcome: BattleOutcome | null;
  canFlee: boolean;
  /** Spoils collected during the fight (steals, Quina's blue magic). */
  stolen: number[];
  learned: { unitId: string; actionId: number }[];
  gilBonus: number;
  /** Fled by luck (Flee command, not Zidane's Flee skill) — Flee-Gil pays out. */
  fledByLuck?: boolean;
  /** Party gil at the start (Spare Change), and how much the fight spent. */
  gil: number;
  gilSpent: number;
  /** Lifetime counters some abilities scale with (Thievery, Dragon's Crest, Tonberry Karma). */
  meta: { thefts: number; dragonKills: number; tonberryKills: number };
  start: "normal" | "preemptive" | "back";
  /** FF9 battle scene (e.g. "EF_E009") whose AI script drives the FF9 monsters. */
  scene?: string;
  /** Battle AI (FF9 event engine) state, present when the scene's script is registered. */
  ai?: AiState;
}

/** An action as the engine sees it: FF9 data or an enemy-only move from the content tables. */
export type BattleAction = ActionData & { physical?: boolean; enemyOnly?: boolean };

export const SINGLE_TARGETS: TargetType[] = ["singleAny", "singleAlly", "singleEnemy", "self"];
