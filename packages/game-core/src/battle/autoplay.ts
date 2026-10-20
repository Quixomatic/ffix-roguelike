/**
 * A simple party AI: used by tests/balance sims, and available to the client as an "Auto" battle option.
 * Revives the fallen; heals when someone is low (the whole party with a party-wide cure when several are hurt; the
 * strongest cure or healing item otherwise); else uses the damaging ability and target that land best (no element the
 * target absorbs or ignores, Earth never at a floating target, weaknesses first), or attacks.
 */
import { findItem, type Element } from "@ffix-roguelike/game-data";

import type { BattleEngine } from "./engine";
import { getBattleAction } from "./engine";
import type { BattleCommand, BattleUnit } from "./types";

const HEAL_SCRIPTS = new Set([10]);
const DAMAGE_SCRIPTS = new Set([9, 18, 19, 20, 63, 85, 21]);
/** Commands 21 (Double White) and 23 (Double Black) cast two spells per turn. */
const DOUBLE_CAST = new Set([21, 23]);
/** Item scripts: 69 restores HP (Potion, Hi-Potion…), 72 revives (Phoenix Down / Pinion). */
const HEAL_ITEM = 69;
const REVIVE_ITEM = 72;

const isAll = (targets: string) => targets.startsWith("all") || targets === "everyone";

/**
 * How well a move's elements land on a target: 0 when it would do nothing or heal it (absorbed, immune, or Earth at
 * something floating), 1.5 on a weakness, ½ when it's resisted, else 1.
 */
function elementFactor(e: BattleEngine, elements: readonly Element[], t: BattleUnit): number {
  let f = 1;
  for (const el of elements) {
    if (t.elements.absorb.includes(el) || t.elements.immune.includes(el)) return 0;
    if (el === "earth" && e.has(t, "float")) return 0;
    if (t.elements.weak.includes(el)) f = Math.max(f, 1.5);
    else if (t.elements.half.includes(el)) f = Math.min(f, 0.5);
  }
  return f;
}

export function autoCommand(e: BattleEngine, u: BattleUnit): BattleCommand {
  const foes = e.opponents(u).filter((x) => e.isTargetable(x));
  const allies = e.allies(u);
  const standing = allies.filter((x) => e.isTargetable(x));
  const hurt = standing.filter((x) => x.hp < x.maxHp * 0.4).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const worn = standing.filter((x) => x.hp < x.maxHp * 0.6);
  const downed = allies.find((x) => !e.isAlive(x));
  const abilities = e.commandsOf(u).flatMap((c) => c.actionIds).map(getBattleAction);
  const affordable = abilities.filter((a) => a.mp <= u.mp && !(e.isMagical(a) && e.magicBlocked(u)));
  const cures = affordable.filter((a) => HEAL_SCRIPTS.has(a.scriptId)).sort((a, b) => b.power - a.power);

  if (downed) {
    const life = affordable.find((a) => a.scriptId === 13);
    if (life) return { actorId: u.id, kind: "ability", actionId: life.id, targetIds: [downed.id] };
    const pd = e.state.inventory.find((s) => s.count > 0 && findItem(s.itemId)?.effect?.scriptId === REVIVE_ITEM);
    if (pd) return { actorId: u.id, kind: "item", itemId: pd.itemId, targetIds: [downed.id] };
  }
  // Several hurt: a party-wide cure (Curaga, Healing Wind…) when there's one.
  if (worn.length >= 2) {
    const wide = cures.find((a) => isAll(a.targets));
    if (wide) return { actorId: u.id, kind: "ability", actionId: wide.id, targetIds: [] };
  }
  if (hurt) {
    const cure = cures[0];
    if (cure) return { actorId: u.id, kind: "ability", actionId: cure.id, targetIds: isAll(cure.targets) ? [] : [hurt.id] };
    // The strongest healing item in the bag (a Hi-Potion before a Potion).
    const potion = e.state.inventory
      .filter((s) => s.count > 0 && findItem(s.itemId)?.effect?.scriptId === HEAL_ITEM)
      .sort((a, b) => (findItem(b.itemId)?.effect?.power ?? 0) - (findItem(a.itemId)?.effect?.power ?? 0))[0];
    if (potion) return { actorId: u.id, kind: "item", itemId: potion.itemId, targetIds: [hurt.id] };
  }
  const weakest = foes.reduce((a, b) => (b.hp < a.hp ? b : a), foes[0]!);
  // The damaging ability and target that land best: power × how its elements fall on the target (an all-target move
  // counts every foe it would hurt). Moves nothing would feel are skipped.
  let best: { action: ReturnType<typeof getBattleAction>; target: BattleUnit | null; score: number } | null = null;
  for (const a of affordable) {
    if (!DAMAGE_SCRIPTS.has(a.scriptId) || a.power <= 0 || a.mp > u.mp * 0.6) continue;
    if (isAll(a.targets)) {
      const score = a.power * foes.reduce((n, t) => n + elementFactor(e, a.elements, t), 0);
      if (score > 0 && (!best || score > best.score)) best = { action: a, target: null, score };
    } else
      for (const t of foes) {
        // Ties go to the weakest foe, to finish it off.
        const score = a.power * elementFactor(e, a.elements, t) + (t === weakest ? 0.01 : 0);
        if (score > 0 && (!best || score > best.score)) best = { action: a, target: t, score };
      }
  }
  if (best) {
    const cmd: BattleCommand = { actorId: u.id, kind: "ability", actionId: best.action.id, targetIds: best.target ? [best.target.id] : [] };
    // Double Black / Double White (Trance Vivi, Eiko): cast it twice when there's MP for both.
    if (DOUBLE_CAST.has(e.commandOf(u, best.action.id)?.id ?? -1) && e.mpCost(u, best.action) * 2 <= u.mp) cmd.second = { actionId: best.action.id, targetIds: cmd.targetIds };
    return cmd;
  }
  return { actorId: u.id, kind: "attack", targetIds: weakest ? [weakest.id] : [] };
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
