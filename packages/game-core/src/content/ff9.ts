/**
 * FF9's own monsters (Memoria battle export → game-data bestiary.json): their attacks as battle actions, and
 * lookups for authoring encounter AI with the real moves.
 */
import { bestiary, ff9Enemy, type FF9Enemy } from "@ffix-roguelike/game-data";

import type { BattleAction } from "../battle/types";

/** Battle action ids for FF9 monster attacks: FF9_ACTION_BASE + index in the bestiary's action table. */
export const FF9_ACTION_BASE = 2000;

export function ff9Action(id: number): BattleAction | undefined {
  const a = bestiary.actions[id - FF9_ACTION_BASE];
  if (!a) return undefined;
  return {
    id,
    name: a.name,
    targets: a.targets,
    defaultAlly: a.defaultAlly,
    forDead: false,
    scriptId: a.scriptId,
    power: a.power,
    elements: a.elements,
    rate: a.rate,
    category: a.category,
    statuses: a.statuses,
    mp: a.mp,
    type: a.type,
    vfx: a.vfx,
    enemyOnly: true,
  };
}

/** Action id of one of a monster's real attacks, by name (`nth` picks among same-named ones, e.g. two "Thunder"s). */
export function ff9Move(monster: FF9Enemy, attack: string, nth = 0): number {
  const matches = monster.attacks.filter((uid) => bestiary.actions[uid]!.name === attack);
  const uid = matches[nth];
  if (uid == null) throw new Error(`${monster.name} (Lv${monster.level}) has no attack "${attack}" #${nth}`);
  return FF9_ACTION_BASE + uid;
}

/** Strongest single-target physical attack power (used for the monster's plain "Attack"). */
export function ff9AttackPower(monster: FF9Enemy): number {
  const powers = monster.attacks.map((uid) => bestiary.actions[uid]!).filter((a) => a.scriptId === 8 || a.scriptId === 100).map((a) => a.power);
  return powers.length ? Math.max(...powers) : 6 + Math.round(monster.level * 1.3);
}

export { ff9Enemy };
