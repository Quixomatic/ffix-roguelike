/**
 * A simple party AI: used by tests/balance sims, and available to the client as an "Auto" battle option.
 * Heals when someone is low, otherwise uses the strongest affordable damaging ability or attacks.
 */
import { findItem } from "@ffix-roguelike/game-data";

import type { BattleEngine } from "./engine";
import { getBattleAction } from "./engine";
import type { BattleCommand, BattleUnit } from "./types";

const HEAL_SCRIPTS = new Set([10]);
const DAMAGE_SCRIPTS = new Set([9, 18, 19, 20, 63, 85, 21]);

export function autoCommand(e: BattleEngine, u: BattleUnit): BattleCommand {
  const foes = e.opponents(u).filter((x) => e.isActive(x));
  const allies = e.allies(u);
  const hurt = allies.filter((x) => e.isActive(x) && x.hp < x.maxHp * 0.4).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const downed = allies.find((x) => !e.isAlive(x));
  const abilities = e.commandsOf(u).flatMap((c) => c.actionIds).map(getBattleAction);
  const affordable = abilities.filter((a) => a.mp <= u.mp && !(e.isMagical(a) && e.has(u, "silence")));

  if (downed) {
    const life = affordable.find((a) => a.scriptId === 13);
    if (life) return { actorId: u.id, kind: "ability", actionId: life.id, targetIds: [downed.id] };
    const pd = e.state.inventory.find((s) => s.count > 0 && findItem(s.itemId)?.effect?.scriptId === 72);
    if (pd) return { actorId: u.id, kind: "item", itemId: pd.itemId, targetIds: [downed.id] };
  }
  if (hurt) {
    const cure = affordable.filter((a) => HEAL_SCRIPTS.has(a.scriptId)).sort((a, b) => b.power - a.power)[0];
    if (cure) return { actorId: u.id, kind: "ability", actionId: cure.id, targetIds: [hurt.id] };
    const potion = e.state.inventory.find((s) => s.count > 0 && findItem(s.itemId)?.effect?.scriptId === 69);
    if (potion) return { actorId: u.id, kind: "item", itemId: potion.itemId, targetIds: [hurt.id] };
  }
  const target = foes.reduce((a, b) => (b.hp < a.hp ? b : a), foes[0]!);
  const nuke = affordable
    .filter((a) => DAMAGE_SCRIPTS.has(a.scriptId) && a.power > 0 && a.mp <= u.mp * 0.6)
    .sort((a, b) => b.power - a.power)[0];
  if (nuke && target) {
    const all = nuke.targets.startsWith("all") || nuke.targets === "everyone";
    return { actorId: u.id, kind: "ability", actionId: nuke.id, targetIds: all ? [] : [target.id] };
  }
  return { actorId: u.id, kind: "attack", targetIds: target ? [target.id] : [] };
}

/** Run a battle to completion with the auto AI. Returns the engine (state includes the input log). */
export function autoBattle(e: BattleEngine, maxSteps = 200_000): BattleEngine {
  for (let i = 0; i < maxSteps && !e.state.outcome; i++) {
    for (const u of e.readyUnits()) {
      const res = e.submit(autoCommand(e, u));
      if (!res.ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
    }
    e.step();
  }
  return e;
}
