/**
 * Steiner's Magic Sword (FF9's Swd Mag, battle script 63). Steiner never learns these: each sword is there when Vivi,
 * in the same party, knows its spell (Fire Sword ← Fire, Doomsday Sword ← Doomsday…), and it's usable on a turn when
 * Vivi can act (`BattleEngine.magicSwordReady`).
 */
import { actionByName, getAction } from "@ffix-roguelike/game-data";

import type { BattleUnit } from "./types";

/** Magic Sword's battle script. */
export const MAGIC_SWORD_SCRIPT = 63;

export const isMagicSword = (actionId: number) => getAction(actionId).scriptId === MAGIC_SWORD_SCRIPT;

/** The spell Vivi must know for a sword: its name without " Sword" (Fire Sword → Fire). */
export function magicSwordSpell(actionId: number): number | null {
  const name = getAction(actionId).name.replace(/ Sword$/, "");
  try {
    return actionByName(name).id;
  } catch {
    return null;
  }
}

/**
 * At battle start: each party member's Magic Sword list becomes the swords whose spell the party's Vivi can cast
 * (none without Vivi). Mutates `units`.
 */
export function limitMagicSwords(units: BattleUnit[]): void {
  const vivi = units.find((u) => u.side === "party" && u.key === "vivi");
  const known = new Set(vivi?.commands.flatMap((c) => c.actionIds) ?? []);
  for (const u of units) {
    if (u.side !== "party") continue;
    for (const c of u.commands) {
      if (c.actionIds.length && c.actionIds.every(isMagicSword)) c.actionIds = c.actionIds.filter((id) => known.has(magicSwordSpell(id) ?? -1));
    }
  }
}
