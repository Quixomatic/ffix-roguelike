/**
 * Relic and party-synergy effects in battle (`.plans/relics-and-synergies.md` §4): the run-power layer over FF9's rules.
 *
 * A run's relics and its active synergies become **specs** (effect + source). `createBattle` ties each spec to the party
 * units its scope covers and stores the result in `BattleState.modifiers`. From then on the engine reads only that,
 * so a battle replays exactly however relics are re-tuned later. The engine's hooks (battle start, MP cost, steal,
 * kills) ask `effectsFor` what applies to a unit.
 */
import { characterTags, relicById, synergyTable, type ModifierEffect, type ModifierKind, type ModifierScope, type SynergyData } from "@ffix-roguelike/game-data";

import { atbMaxFor, TRANCE_MAX, type ActiveModifier, type BattleUnit, type ModifierSpec } from "./types";

/** The effects of these relics (unknown or disabled ids are skipped). */
export function relicModifiers(relicIds: string[]): ModifierSpec[] {
  return relicIds.flatMap((id) => (relicById(id)?.effects ?? []).map((effect) => ({ source: `relic:${id}`, effect })));
}

export interface ActiveSynergy {
  synergy: SynergyData;
  /** Party members sharing its tag. */
  count: number;
  /** The highest tier reached. */
  tier: SynergyData["tiers"][number];
}

/** The synergies a party (character keys, the active members only) has reached a tier of. */
export function activeSynergies(partyKeys: string[]): ActiveSynergy[] {
  const out: ActiveSynergy[] = [];
  for (const synergy of synergyTable()) {
    const count = partyKeys.filter((k) => characterTags(k).includes(synergy.tag)).length;
    const tier = [...synergy.tiers].sort((a, b) => b.count - a.count).find((t) => count >= t.count);
    if (tier) out.push({ synergy, count, tier });
  }
  return out;
}

export interface PartySynergy {
  synergy: SynergyData;
  /** Party members sharing its tag (at least one). */
  count: number;
  /** The highest tier reached; undefined while short of the first. */
  tier?: SynergyData["tiers"][number];
  /** Members needed for the next tier up (undefined at the top). */
  next?: number;
}

/**
 * Every synergy the party has at least one member of: the active ones (a tier reached) and the ones still short
 * (to show as not yet active, "1/2"). Active first, then by how close.
 */
export function partySynergies(partyKeys: string[]): PartySynergy[] {
  const out: PartySynergy[] = [];
  for (const synergy of synergyTable()) {
    const count = partyKeys.filter((k) => characterTags(k).includes(synergy.tag)).length;
    if (!count) continue;
    const tiers = [...synergy.tiers].sort((a, b) => a.count - b.count);
    const tier = [...tiers].reverse().find((t) => count >= t.count);
    out.push({ synergy, count, tier, next: tiers.find((t) => t.count > count)?.count });
  }
  return out.sort((a, b) => Number(!!b.tier) - Number(!!a.tier) || b.count / (b.next ?? b.count) - a.count / (a.next ?? a.count));
}

export function synergyModifiers(partyKeys: string[]): ModifierSpec[] {
  return activeSynergies(partyKeys).flatMap(({ synergy, tier }) => tier.effects.map((effect) => ({ source: `synergy:${synergy.id}`, effect })));
}

/** Whether a scope covers a character (by key). No scope = the whole party. */
export function inScope(scope: ModifierScope | undefined, key: string): boolean {
  if (!scope || scope.kind === "party") return true;
  if (scope.kind === "character") return scope.character === key;
  return characterTags(key).includes(scope.tag);
}

/** Tie specs to the party units their scopes cover (enemies are never covered). */
export function resolveModifiers(specs: ModifierSpec[], units: BattleUnit[]): ActiveModifier[] {
  const party = units.filter((u) => u.side === "party");
  return specs.map((s) => ({ ...s, units: party.filter((u) => inScope(s.effect.scope, u.key)).map((u) => u.id) }));
}

/** A unit's effects of one kind. */
export function effectsFor<K extends ModifierKind>(mods: ActiveModifier[] | undefined, unitId: string, kind: K): Extract<ModifierEffect, { kind: K }>[] {
  return (mods ?? []).filter((m) => m.effect.kind === kind && m.units.includes(unitId)).map((m) => m.effect as Extract<ModifierEffect, { kind: K }>);
}

/** Stat effects, applied once to the units before the battle starts (percentages add up per stat). */
export function applyStatModifiers(units: BattleUnit[], mods: ActiveModifier[]) {
  for (const u of units) {
    const pct = new Map<string, number>();
    for (const e of effectsFor(mods, u.id, "stat")) pct.set(e.stat, (pct.get(e.stat) ?? 0) + e.pct);
    for (const [stat, p] of pct) {
      const key = stat as keyof BattleUnit & ("strength" | "magic" | "spirit" | "speed" | "attack" | "defence" | "magicDefence" | "evade" | "magicEvade");
      u[key] = Math.max(stat === "speed" ? 1 : 0, Math.round((u[key] * (100 + p)) / 100));
    }
    if (pct.has("speed")) u.atbMax = atbMaxFor(u.speed);
  }
}

/** The Trance gauge a unit starts with: the largest `trance` effect (only units that can Trance). */
export function startTrance(mods: ActiveModifier[] | undefined, u: BattleUnit): number {
  if (!u.tranceCommands.length) return u.trance;
  const pct = Math.max(0, ...effectsFor(mods, u.id, "trance").map((e) => e.startPct));
  return Math.max(u.trance, Math.min(TRANCE_MAX - 1, Math.floor((TRANCE_MAX * pct) / 100)));
}

/** Total percent of one numeric field over a unit's effects of a kind (e.g. steal ratePct). */
export function sumPct<K extends ModifierKind>(mods: ActiveModifier[] | undefined, unitId: string, kind: K, field: keyof Extract<ModifierEffect, { kind: K }>): number {
  return effectsFor(mods, unitId, kind).reduce((n, e) => n + (Number(e[field]) || 0), 0);
}
