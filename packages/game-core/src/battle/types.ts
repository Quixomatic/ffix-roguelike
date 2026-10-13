import type { ActionData, Element, Status, TargetType, WeaponData } from "@ffix-roguelike/game-data";

import type { ElementProfile } from "../stats";

export type Side = "party" | "enemy";

/** Monster families — FF9's "killer" support abilities deal extra damage to these. */
export type EnemyFamily = "beast" | "bird" | "bug" | "stone" | "undead" | "dragon" | "devil" | "human" | "machine" | "amorphous";

/** 20 ticks = 1 second of battle time. */
export const TICKS_PER_SECOND = 20;
export const ATB_MAX = 10_000;
export const TRANCE_MAX = 255;

export interface StatusTimer {
  /** Ticks left; null = lasts until cured. */
  remaining: number | null;
  /** Ticks until the next poison/regen/doom tick. */
  nextTick: number;
  /** Doom / gradual-petrify countdown shown to the player. */
  counter?: number;
}

export interface CommandDef {
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
  /** Out of 256, as in FF9 (slots are usually 256/64/16/1). */
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
  attack: number;
  defence: number;
  evade: number;
  magicDefence: number;
  magicEvade: number;
  weapon: WeaponData | null;
  attackElements: Element[];
  elements: ElementProfile;
  statusImmune: Status[];
  statuses: Partial<Record<Status, StatusTimer>>;
  atb: number;
  trance: number;
  backRow: boolean;
  supports: number[];
  turns: number;
  // party only
  commands: CommandDef[];
  tranceCommands: CommandDef[];
  // enemy only
  family?: EnemyFamily;
  ai?: AiRule[];
  usedOnce?: number[];
  steal?: StealSlot[];
  boss?: boolean;
  /** Blue magic Quina learns by eating this enemy. */
  eatTeaches?: number;
}

export type CommandKind = "attack" | "ability" | "item" | "defend" | "flee" | "change";

export interface BattleCommand {
  actorId: string;
  kind: CommandKind;
  actionId?: number;
  itemId?: number;
  targetIds: string[];
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
  | { type: "statusOn"; targetId: string; status: Status }
  | { type: "statusOff"; targetId: string; status: Status }
  | { type: "ko"; targetId: string }
  | { type: "revive"; targetId: string }
  | { type: "tranceStart"; unitId: string }
  | { type: "tranceEnd"; unitId: string }
  | { type: "steal"; actorId: string; targetId: string; itemId: number | null }
  | { type: "learn"; unitId: string; actionId: number }
  | { type: "message"; text: string }
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
  queue: BattleCommand[];
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
}

/** An action as the engine sees it: FF9 data or an enemy-only move from the content tables. */
export type BattleAction = ActionData & { physical?: boolean; enemyOnly?: boolean };

export const SINGLE_TARGETS: TargetType[] = ["singleAny", "singleAlly", "singleEnemy", "self"];
