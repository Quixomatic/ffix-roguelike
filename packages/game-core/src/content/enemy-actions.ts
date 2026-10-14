/**
 * Enemy-only moves (ids ≥ 1000). Spells enemies share with the party (Fire, Bio, Doom, …) come straight from
 * FF9's action table instead — see `ff9` below.
 */
import { actionByName, type Element, type Status, type TargetType } from "@ffix-roguelike/game-data";

import type { BattleAction } from "../battle/types";

/** Engine-internal script ids (outside FF9's range). */
export const SCRIPT = {
  /** Physical hit: (power − Def) × (Str + rnd). */
  enemyPhysical: 1000,
  /** Physical hit that also inflicts statuses at `rate`. */
  enemyPhysicalStatus: 1001,
  /** Percent of the target's current HP (power = percent). */
  gravity: 1002,
  /** Fixed damage = power × 10. */
  fixed: 1003,
  /** Self-destruct: damage = own current HP, then the user dies. */
  selfDestruct: 1004,
} as const;

function move(
  id: number,
  name: string,
  opts: {
    targets?: TargetType;
    script?: number;
    power?: number;
    elements?: Element[];
    rate?: number;
    statuses?: Status[];
    mp?: number;
    physical?: boolean;
    magic?: boolean;
  },
): BattleAction {
  const physical = opts.physical ?? (opts.script ?? SCRIPT.enemyPhysical) <= SCRIPT.enemyPhysicalStatus;
  return {
    id,
    name,
    targets: opts.targets ?? "singleEnemy",
    defaultAlly: false,
    forDead: false,
    scriptId: opts.script ?? SCRIPT.enemyPhysical,
    power: opts.power ?? 0,
    elements: opts.elements ?? [],
    rate: opts.rate ?? 0,
    // bit 3 = physical, bit 1 = magical (silence-able), bit 0 = reflectable
    category: physical ? 8 : opts.magic ? 3 : 4,
    statuses: opts.statuses ?? [],
    mp: opts.mp ?? 0,
    physical,
    enemyOnly: true,
  };
}

export const ENEMY_ACTIONS: BattleAction[] = [
  move(1000, "Attack", {}),
  move(1001, "Bite", { power: 2 }),
  move(1002, "Claw", { power: 4 }),
  move(1003, "Tackle", { power: 6 }),
  move(1004, "Poison Fang", { script: SCRIPT.enemyPhysicalStatus, rate: 40, statuses: ["poison"] }),
  move(1005, "Stone Gaze", { script: SCRIPT.enemyPhysicalStatus, power: -4, rate: 30, statuses: ["gradualPetrify"] }),
  move(1006, "Sleep Powder", { script: 11, targets: "allEnemy", rate: 35, statuses: ["sleep"], mp: 6, magic: true }),
  move(1007, "Blaster", { script: 11, rate: 25, statuses: ["death"], mp: 8, magic: true }),
  move(1008, "Gravity", { script: SCRIPT.gravity, power: 25, mp: 6, magic: true }),
  move(1009, "Self-Destruct", { script: SCRIPT.selfDestruct, elements: ["fire"] }),
  move(1010, "Blaze", { script: 9, power: 18, elements: ["fire"], mp: 6, magic: true }),
  move(1011, "Ice Storm", { script: 9, targets: "allEnemy", power: 22, elements: ["ice"], mp: 10, magic: true }),
  move(1012, "Lightning", { script: 9, power: 30, elements: ["thunder"], mp: 8, magic: true }),
  move(1013, "Tidal Wave", { script: 9, targets: "allEnemy", power: 34, elements: ["water"], mp: 14, magic: true }),
  move(1014, "Quake", { script: 9, targets: "allEnemy", power: 40, elements: ["earth"], mp: 16, magic: true }),
  move(1015, "Dark Wave", { script: 9, targets: "allEnemy", power: 44, elements: ["shadow"], mp: 18, magic: true }),
  move(1016, "Karate Chop", { power: 10 }),
  move(1017, "Everyone's Grudge", { script: SCRIPT.fixed, power: 40 }),
  move(1018, "Knife", { power: 18, rate: 0 }),
  move(1019, "Heavy Swing", { power: 14, targets: "allEnemy" }),
  move(1020, "Horn", { power: 12 }),
  move(1021, "Tail Whip", { power: 8, targets: "allEnemy" }),
  move(1022, "Mind Blast", { script: 11, targets: "allEnemy", rate: 30, statuses: ["confuse"], mp: 10, magic: true }),
  move(1023, "Wing Buffet", { power: 9, targets: "allEnemy" }),
  move(1024, "Mucus", { script: SCRIPT.enemyPhysicalStatus, rate: 50, statuses: ["slow"] }),
  move(1025, "Bad Breath", { script: 11, targets: "allEnemy", rate: 40, statuses: ["poison", "blind", "silence", "confuse", "slow"], mp: 20, magic: true }),
  move(1026, "Death Sentence", { script: 11, rate: 60, statuses: ["doom"], mp: 12, magic: true }),
  move(1027, "Light of Judgment", { script: 9, targets: "allEnemy", power: 70, elements: ["holy"], mp: 40, magic: true }),
  move(1028, "Havoc Wing", { power: 24, targets: "allEnemy" }),
  move(1029, "Forsaken", { script: 9, targets: "allEnemy", power: 90, elements: [], mp: 60, magic: true }),
  move(1030, "Meteor Strike", { script: 9, targets: "allEnemy", power: 60, mp: 0, magic: true }),
  move(1031, "Black Hole", { script: SCRIPT.gravity, targets: "allEnemy", power: 50, mp: 30, magic: true }),
  move(1032, "Grand Cross", { script: 11, targets: "allEnemy", rate: 45, statuses: ["petrify", "confuse", "mini", "silence", "blind"], mp: 40, magic: true }),
  move(1033, "Tsunami", { script: 9, targets: "allEnemy", power: 50, elements: ["water"], mp: 30, magic: true }),
  move(1034, "Barrier", { script: 103, targets: "self", rate: 255, statuses: ["protect", "shell"], mp: 10, magic: true }),
  move(1035, "Hasteja", { script: 103, targets: "allAlly", rate: 255, statuses: ["haste"], mp: 20, magic: true }),
  // ── FF9 enemy moves (Disc 1) ──
  move(1036, "Pollen", { script: 11, targets: "allEnemy", rate: 40, statuses: ["blind"], mp: 6, magic: true }),
  move(1037, "Silent Voice", { script: 11, targets: "allEnemy", rate: 45, statuses: ["silence"], mp: 10, magic: true }),
  move(1038, "Crash", { power: 10 }),
  move(1039, "Electrocute", { script: 9, targets: "allEnemy", power: 18, elements: ["thunder"], mp: 8, magic: true }),
  move(1040, "Absorb", { script: 16, power: 14, mp: 4, magic: true }),
  move(1041, "Sword Drain", { script: SCRIPT.enemyPhysicalStatus, power: 4, rate: 30, statuses: ["silence"] }),
  move(1042, "Stinger", { script: SCRIPT.enemyPhysicalStatus, power: 3, rate: 35, statuses: ["poison"] }),
  move(1043, "Freeze", { script: 11, rate: 30, statuses: ["freeze"], mp: 8, magic: true }),
  move(1044, "Heave", { power: 8, targets: "allEnemy" }),
  move(1045, "Tsunami Wave", { script: 9, targets: "allEnemy", power: 26, elements: ["water"], mp: 14, magic: true }),
];

const byId = new Map(ENEMY_ACTIONS.map((a) => [a.id, a]));
export const enemyAction = (id: number) => byId.get(id);

/** FF9 action id by name — enemies cast the real spells. */
export const ff9 = (name: string) => actionByName(name).id;
