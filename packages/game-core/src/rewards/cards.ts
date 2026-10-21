/**
 * Reward cards (`.plans/rewards.md` §3.1–3.3): what elites, treasure, semi-bosses, bosses and the rare surprise
 * after a plain battle offer. Every card is for someone and says exactly what it does; taking it applies it
 * (`applyCard` in run.ts). The rules come from the reward tables (sources, rarities, boons, roles, gear
 * availability), so they're tuned on the admin page.
 *
 * Rolling is pure: it reads the run and an Rng and returns the offer (stored in the run's phase).
 */
import {
  bandStepsOf,
  getCharacter,
  getItem,
  itemByName,
  rarityOf,
  RARITIES,
  relicById,
  relicChanceOf,
  rewardTables,
  setting,
  shopMarkupOf,
  shopPriceOf,
  sourceOf,
  type AbilityRef,
  type BoonStat,
  type CardType,
  type EquipSlot,
  type RarityId,
  type RewardBoon,
  type RewardSourceId,
} from "@ffix-roguelike/game-data";

import { WORLDS } from "../content/worlds";
import type { Rng } from "../rng";
import { baseGear, effectivePrice, gearPool, nextTierArea } from "../run/loot";
import type { RunMember, RunState } from "../run/run";
import { apCost, gearAbilities, isMastered, type CharacterBuild } from "../stats";
import { upgradesFor, type UpgradeEval } from "./upgrade";

export type RewardCard =
  | {
      kind: "gear";
      rarity: RarityId;
      key: string;
      itemId: number;
      slot: EquipSlot;
      score: number;
      teaches: AbilityRef[];
      stopsLearning: { ref: AbilityRef; ap: number; cost: number }[];
    }
  | { kind: "boon"; rarity: RarityId; /** null: the whole party. */ key: string | null; boonId: string; name: string; stat: BoonStat; amount: number }
  | { kind: "ap"; rarity: RarityId; key: string; ref: AbilityRef; amount: number }
  | { kind: "supplies"; rarity: RarityId; itemId: number; count: number }
  | { kind: "gil"; rarity: RarityId; amount: number }
  /** A relic for the run's rack (its rarity is the relic's own). */
  | { kind: "relic"; rarity: RarityId; relicId: string; name: string };

/**
 * A relic the run could be offered: unlocked (the run's snapshot), not already held, in tier for this area, weighted
 * by its `weight`. Null when there's none left.
 */
export function rollRelicCard(run: RunState, rng: Rng): RewardCard | null {
  const tier = WORLDS[run.world]!.tier;
  const held = new Set(run.relics ?? []);
  const options = (run.unlockedRelics ?? []).flatMap((id) => {
    const r = relicById(id);
    return r && !held.has(r.id) && r.minTier <= tier && r.weight > 0 ? [r] : [];
  });
  if (!options.length) return null;
  const r = rng.weighted(options.map((x) => ({ weight: x.weight, value: x })));
  return { kind: "relic", rarity: r.rarity, relicId: r.id, name: r.name };
}

/**
 * The relics a won fight offers on its own screen after the reward (pokelike's relic pick): up to `count` different
 * ones (setting `relics.choices`), each drawn like `rollRelicCard`. Fewer when the run has fewer left to find.
 */
export function rollRelicChoices(run: RunState, rng: Rng, count = setting("relics.choices")): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const card = rollRelicCard({ ...run, relics: [...(run.relics ?? []), ...out] }, rng);
    if (!card || card.kind !== "relic") break;
    out.push(card.relicId);
  }
  return out;
}

export interface RewardOffer {
  source: RewardSourceId;
  cards: RewardCard[];
  /** Gil for taking none. */
  skipGil: number;
}

const rarityRank = (r: RarityId) => RARITIES.indexOf(r);

/** Consumables a supplies card can give, by the area's progression tier (0–5; tiers past the list use its last row). */
const SUPPLIES: string[][] = [
  ["Potion", "Phoenix Down", "Antidote", "Eye Drops", "Echo Screen"],
  ["Hi-Potion", "Phoenix Down", "Ether", "Soft", "Remedy"],
  ["Hi-Potion", "Phoenix Down", "Ether", "Elixir", "Remedy"],
  ["Hi-Potion", "Phoenix Pinion", "Ether", "Elixir", "Remedy"],
];

/** Abilities a member's equipped gear is teaching them, not yet mastered (what an AP surge can feed). */
export function learning(build: CharacterBuild): AbilityRef[] {
  return gearAbilities(build).filter((r) => !isMastered(build, r));
}

/** Roll a reward offer for `source`. */
export function rollOffer(run: RunState, source: RewardSourceId, rng: Rng): RewardOffer {
  const src = sourceOf(source);
  const tier = WORLDS[run.world]!.tier;
  const mult = 1 + run.tier * setting("tiers.rewardPerTier");
  const keys = run.party.map((m) => m.build.key);
  const boss = source === "boss" || source === "semiboss";

  // The gear that can be offered here: the area's pool (+ its boss-only pieces for bosses) and unlocked gear in band.
  const poolFor = (world: number) => {
    const ids = new Set(gearPool(world, keys, run.unlockedGear).map((i) => i.id));
    if (boss) for (const id of baseGear(world, { bossOnly: true })) ids.add(id);
    return ids;
  };
  const here = poolFor(run.world);
  // Rarer gear cards can reach higher areas' bands (epic two areas up, legendary three — the rarity table's bandSteps).
  const higher = new Map<number, Set<number>>();
  const poolUp = (steps: number) => {
    if (steps <= 0) return here;
    let world = run.world;
    for (let i = 0; i < steps; i++) world = nextTierArea(world);
    if (!higher.has(world)) higher.set(world, new Set([...here, ...poolFor(world)]));
    return higher.get(world)!;
  };
  const upgrades = (m: RunMember, rarity: RarityId) => {
    const r = rarityOf(rarity);
    return upgradesFor(m.build, rng.chance(r.nextBand) ? poolUp(bandStepsOf(r)) : here, src.upgradeThreshold);
  };

  const cards: RewardCard[] = [];
  const used = new Map<string, number>(); // member key → cards for them so far (spread the offer)
  const pickMember = (candidates: RunMember[]) => {
    if (!candidates.length) return null;
    // Spread across the party, and lean toward whoever has the most room to improve (the most upgrades waiting).
    const perUpgrade = setting("cards.spreadPerUpgrade");
    const perCard = setting("cards.spreadPerCard");
    return rng.weighted(
      candidates.map((m) => ({ weight: (1 + upgradesFor(m.build, here, src.upgradeThreshold).length * perUpgrade) / (1 + perCard * (used.get(m.build.key) ?? 0)), value: m })),
    );
  };
  const note = (key: string | null) => key && used.set(key, (used.get(key) ?? 0) + 1);

  const rollRarity = (min: RarityId): RarityId => {
    const options = RARITIES.filter((r) => rarityRank(r) >= Math.max(rarityRank(min), rarityRank(src.minRarity)) && (src.rarityWeights[r] ?? 0) > 0);
    if (!options.length) return min;
    return rng.weighted(options.map((r) => ({ weight: src.rarityWeights[r], value: r })));
  };

  const gearCard = (rarity: RarityId): RewardCard | null => {
    const candidates = run.party.filter((m) => upgradesFor(m.build, here, src.upgradeThreshold).length);
    const m = pickMember(candidates);
    if (!m) return null;
    const taken = new Set(cards.flatMap((c) => (c.kind === "gear" ? [`${c.key}:${c.slot}`, `item:${c.itemId}`] : [])));
    const list = upgrades(m, rarity).filter((u) => !taken.has(`${m.build.key}:${u.change.slot}`) && !taken.has(`item:${u.itemId}`));
    if (!list.length) return null;
    // Rarer cards pick from nearer the top of the list.
    const reach = Math.max(1, Math.ceil(list.length / (1 + rarityRank(rarity) * setting("cards.gearReach"))));
    const pick: UpgradeEval = rng.pick(list.slice(0, reach));
    note(m.build.key);
    return { kind: "gear", rarity, key: m.build.key, itemId: pick.itemId, slot: pick.change.slot, score: pick.score, teaches: pick.teaches, stopsLearning: pick.stopsLearning };
  };

  const boonCard = (rarity: RarityId): RewardCard | null => {
    const takenBoons = new Set(cards.flatMap((c) => (c.kind === "boon" ? [c.boonId] : [])));
    const options = rewardTables().boons.filter((b) => b.enabled && b.minTier <= tier && b.amounts[rarity] != null && !takenBoons.has(b.id) && !(run.rewardBans ?? []).includes(b.id));
    if (!options.length) return null;
    const m = pickMember(run.party)!;
    const weightFor = (b: RewardBoon) => b.weight * (b.affinity?.includes(m.build.key) ? setting("cards.boonAffinity") : 1);
    const b = rng.weighted(options.map((x) => ({ weight: weightFor(x), value: x })));
    const key = b.scope === "party" ? null : m.build.key;
    note(key);
    return { kind: "boon", rarity, key, boonId: b.id, name: b.name, stat: b.stat, amount: b.amounts[rarity]! };
  };

  const apCard = (rarity: RarityId): RewardCard | null => {
    const m = pickMember(run.party.filter((x) => learning(x.build).length));
    if (!m) return null;
    const refs = learning(m.build);
    const ref = rng.pick(refs);
    note(m.build.key);
    const left = apCost(getCharacter(m.build.key), ref) - (m.build.ap[ref] ?? 0);
    return { kind: "ap", rarity, key: m.build.key, ref, amount: Math.min(left, rarityOf(rarity).apSurge) };
  };

  const suppliesCard = (rarity: RarityId): RewardCard => {
    const name = rng.pick(SUPPLIES[Math.min(tier, SUPPLIES.length - 1)]!);
    return { kind: "supplies", rarity, itemId: itemByName(name).id, count: rarityOf(rarity).supplies };
  };
  const gilCard = (rarity: RarityId): RewardCard => ({ kind: "gil", rarity, amount: Math.round(rarityOf(rarity).gil * mult) });

  const make = (type: CardType, rarity: RarityId): RewardCard | null =>
    type === "gear" ? gearCard(rarity) : type === "boon" ? boonCard(rarity) : type === "ap" ? apCard(rarity) : type === "supplies" ? suppliesCard(rarity) : gilCard(rarity);

  for (let i = 0; i < src.cards; i++) {
    let rarity = rollRarity(src.minRarity);
    const wantGear = src.guarantee === "allGear" || (src.guarantee === "oneGear" && i === 0);
    let card: RewardCard | null = null;
    if (wantGear) card = gearCard(rarity);
    if (!card && src.guarantee === "allGear") {
      // Nobody has an upgrade left: a strong boon instead (epic or better).
      rarity = rollRarity(rarityRank(rarity) < rarityRank("epic") ? "epic" : rarity);
      card = boonCard(rarity);
    }
    for (let tries = 0; !card && tries < 6; tries++) {
      const types = (Object.entries(src.typeWeights) as [CardType, number][]).filter(([, w]) => w > 0);
      const type = types.length ? rng.weighted(types.map(([t, w]) => ({ weight: w, value: t }))) : "gil";
      card = make(type, rarity);
    }
    cards.push(card ?? gilCard(rarity));
  }
  // The shop's wares can include a relic, by its relic chance (it takes the last card's place). Fights offer relics on
  // their own screen after the reward instead (`rollRelicChoices`), never as a reward card.
  if (source === "shop" && cards.length && rng.chance(relicChanceOf(src))) {
    const relic = rollRelicCard(run, rng);
    if (relic) cards[cards.length - 1] = relic;
  }
  return { source, cards, skipGil: Math.round(src.skipGil * mult) };
}

/** The rarer cards first is how they read best; keep the roll order (the offer shows them as rolled). */
export const cardRarityRank = (c: RewardCard) => rarityRank(c.rarity);

/**
 * What a card costs as one of the shop's wares: gear at its FF9 price × its rarity's shop markup; anything else
 * (boons, AP surges, relics, supplies, gil) at its rarity's shop price × (run tier + 1).
 */
export function warePrice(card: RewardCard, runTier: number): number {
  const r = rarityOf(card.rarity);
  if (card.kind === "gear") return Math.round((effectivePrice(getItem(card.itemId)) * shopMarkupOf(r)) / 10) * 10;
  return Math.round(shopPriceOf(r) * (1 + runTier * setting("tiers.rewardPerTier")));
}
