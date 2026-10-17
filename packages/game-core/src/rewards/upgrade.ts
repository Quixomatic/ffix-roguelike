/**
 * Is this gear an upgrade for this character? (`.plans/rewards.md` §3.2.) The judge behind reward cards: a gear card
 * is only offered when its score clears the reward source's threshold.
 *
 *   score = stat value (the real stat changes, `gearChange`, weighted by the character's role)
 *         + ability value (each unmastered ability it would start teaching)
 *         − loss (each unmastered ability the replaced piece was teaching that nothing else will)
 *
 * Roles live in the reward_role table (`roleOf`); a character without a row weighs every stat 1.
 */
import { getCharacter, getItem, roleOf, ROLE_STATS, type AbilityRef, type RoleStat } from "@ffix-roguelike/game-data";

import { apCost, gearAbilities, gearChange, isMastered, type CharacterBuild, type GearChange } from "../stats";

export interface UpgradeEval {
  itemId: number;
  score: number;
  /** Role-weighted stat changes. */
  statScore: number;
  /** Value of the abilities it starts teaching. */
  abilityScore: number;
  /** Cost of the abilities the replaced piece stops teaching. */
  lossScore: number;
  change: GearChange;
  /** Unmastered abilities it would start teaching. */
  teaches: AbilityRef[];
  /** Abilities the character would stop learning (taught by the replaced piece only), with their progress. */
  stopsLearning: { ref: AbilityRef; ap: number; cost: number }[];
}

/** Weight per stat when a character has no role row. */
const FLAT: Partial<Record<RoleStat, number>> = Object.fromEntries(ROLE_STATS.map((s) => [s, s === "maxHp" || s === "maxMp" ? 0.05 : 1]));
/** A lost ability costs this share of a taught one (the old piece goes to the bag, so it can be swapped back). */
const LOSS_SHARE = 0.6;

/** How good `itemId` would be for this character in its slot (null: they can't wear it, the slot is locked, or it's what they wear). */
export function upgradeScore(build: CharacterBuild, itemId: number): UpgradeEval | null {
  const change = gearChange(build, itemId);
  if (!change || !change.canEquip || change.slotLocked || change.same) return null;
  const role = roleOf(build.key);
  const weights = role?.weights ?? FLAT;
  const abilityWeight = role?.abilityWeight ?? 6;
  const preferred = new Set(role?.preferredAbilities ?? []);

  let statScore = 0;
  for (const [k, d] of Object.entries(change.deltas) as [RoleStat, number][]) statScore += (weights[k] ?? 0) * d;

  const next: CharacterBuild = { ...build, equipment: { ...build.equipment, [change.slot]: itemId } };
  const taughtBefore = new Set(gearAbilities(build));
  const taughtAfter = new Set(gearAbilities(next));
  const teaches = [...taughtAfter].filter((r) => !taughtBefore.has(r) && !isMastered(build, r));
  const character = getCharacter(build.key);
  const stopsLearning = [...taughtBefore]
    .filter((r) => !taughtAfter.has(r) && !isMastered(build, r))
    .map((ref) => ({ ref, ap: build.ap[ref] ?? 0, cost: apCost(character, ref) }));

  const abilityScore = teaches.reduce((sum, r) => sum + abilityWeight * (preferred.has(r) ? 2 : 1), 0);
  const lossScore = stopsLearning.reduce((sum, l) => sum + abilityWeight * LOSS_SHARE * (preferred.has(l.ref) ? 2 : 1), 0);
  const score = Math.round((statScore + abilityScore - lossScore) * 100) / 100;
  return { itemId, score, statScore, abilityScore, lossScore, change, teaches, stopsLearning };
}

/** The best upgrades for a character among `itemIds`, best first, at or above `threshold`. */
export function upgradesFor(build: CharacterBuild, itemIds: Iterable<number>, threshold: number): UpgradeEval[] {
  const out: UpgradeEval[] = [];
  for (const id of itemIds) {
    if (!getItem(id).equippableBy.includes(build.key)) continue;
    const e = upgradeScore(build, id);
    if (e && e.score >= threshold) out.push(e);
  }
  return out.sort((a, b) => b.score - a.score);
}
