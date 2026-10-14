/** Encounter selection, battle rewards, treasure and shop stock. */
import { findItem, items, itemByName, shops, synthesis, type ItemData, type SynthesisRecipe } from "@ffix-roguelike/game-data";

import type { BattleState } from "../battle/types";
import { baseStats, getEnemy } from "../content/enemies";
import { WORLDS } from "../content/worlds";
import { LEGENDARY_ITEMS } from "../meta/achievements";
import type { Rng } from "../rng";

const GEAR_KINDS = new Set(["weapon", "wrist", "head", "armor", "accessory"]);

export const isGear = (item: ItemData) => GEAR_KINDS.has(item.kind) && !item.effect;

/**
 * Price used for loot bands and unlock costs. FF9 lists never-sold rarities (Ribbon, Genji gear, Pumice…) at a
 * token 2 gil; treat those as late-game treasure instead.
 */
export const RARE_PRICE = 20000;
export const effectivePrice = (item: ItemData) => (item.price < 10 ? RARE_PRICE : item.price);

/** Rough threat of a group: sum of level × HP multiplier. Used to order encounters by difficulty. */
function threat(group: string[]): number {
  return group.reduce((s, id) => {
    const e = getEnemy(id);
    return s + e.level * (e.mult?.hp ?? 1);
  }, 0);
}

/**
 * Pick an encounter for a map stage. Groups are sorted by threat and the window slides with depth, so the
 * first stages of a world are its weakest monsters and the last stages before the castle its toughest.
 */
export function pickEncounter(rng: Rng, world: number, depth: number, kind: BattleNodeKind, partySize = 4): string[] {
  const w = WORLDS[world]!;
  if (kind === "boss") return w.boss;
  if (kind === "semiboss") return w.semiBoss ?? w.elites[0] ?? w.boss;
  // Small parties meet smaller groups: a lone hero fights one monster, a full party up to five.
  const cap = partySize <= 1 ? 1 : partySize + 1;
  return pickGroup(rng, w, depth, kind, cap);
}

function pickGroup(rng: Rng, w: (typeof WORLDS)[number], depth: number, kind: "battle" | "elite", cap: number): string[] {
  // Trim each group to the party-size cap first, then order by the threat of what will actually be fought.
  const pool = (kind === "elite" ? w.elites : w.encounters).map((g) => g.slice(0, cap)).sort((a, b) => threat(a) - threat(b));
  const span = Math.min(pool.length, kind === "elite" ? pool.length : 4);
  const start = Math.round(depth * (pool.length - span));
  return pool[Math.min(pool.length - 1, start + rng.int(0, span - 1))]!;
}

export type BattleNodeKind = "battle" | "elite" | "semiboss" | "boss";

export interface BattleRewards {
  exp: number;
  ap: number;
  gil: number;
  items: number[];
}

/** Experience/AP/gil and drops for a won battle (before per-character support multipliers). */
export function battleRewards(rng: Rng, enemyIds: string[], tier: number, state?: BattleState): BattleRewards {
  let exp = 0;
  let ap = 0;
  let gil = 0;
  const drops: number[] = [];
  for (const id of enemyIds) {
    const def = getEnemy(id);
    const b = baseStats(def.level, tier);
    const r = def.reward ?? 1;
    exp += Math.round(b.exp * r);
    ap += Math.round(b.ap * r);
    gil += Math.round(b.gil * r);
    for (const d of def.drops ?? []) if (rng.chance(d.chance)) drops.push(itemByName(d.item).id);
  }
  return { exp, ap, gil: gil + (state?.gilBonus ?? 0), items: [...drops, ...(state?.stolen ?? [])] };
}

/** Gear stocked by the world's real FF9 shops — always in the drop pool, no unlock needed. */
export function baseGear(world: number): Set<number> {
  const w = WORLDS[world]!;
  return new Set(w.shops.flatMap((id) => shops.find((s) => s.id === id)?.items ?? []).filter((id) => !LEGENDARY_ITEMS.has(id)));
}

/**
 * Gear that can drop in a world: its shops' stock, plus any gear the player has unlocked (camp catalog,
 * achievements, or found in a won run) that fits the world's price band — and that someone in the party can wear.
 */
export function gearPool(world: number, partyKeys: string[], unlocked: readonly number[] = []): ItemData[] {
  const [lo, hi] = WORLDS[world]!.gearPrice;
  const base = baseGear(world);
  const extra = new Set(unlocked);
  return items.filter(
    (i) =>
      isGear(i) &&
      i.equippableBy.some((k) => partyKeys.includes(k)) &&
      (base.has(i.id) || (extra.has(i.id) && effectivePrice(i) >= lo && effectivePrice(i) <= hi)),
  );
}

/** The area whose loot band is the next step up from this one (itself if none is higher). */
export function nextTierArea(world: number): number {
  const top = WORLDS[world]!.gearPrice[1];
  const higher = WORLDS.filter((w) => w.gearPrice[1] > top).sort((a, b) => a.gearPrice[1] - b.gearPrice[1])[0];
  return higher?.index ?? world;
}

/** Pick `count` distinct gear items, weighted toward the cheaper end (better gear is rarer). */
export function rollGear(rng: Rng, world: number, partyKeys: string[], count: number, bonus = 0, unlocked: readonly number[] = []): number[] {
  const pool = gearPool(bonus > 0 && rng.chance(bonus) ? nextTierArea(world) : world, partyKeys, unlocked);
  const out: number[] = [];
  const [lo, hi] = WORLDS[world]!.gearPrice;
  for (let i = 0; i < count && pool.length; i++) {
    const pick = rng.weighted(
      pool.filter((p) => !out.includes(p.id)).map((p) => ({ weight: 1.6 - (p.price - lo) / (hi - lo + 1), value: p.id })),
    );
    out.push(pick);
  }
  return out;
}

export interface ShopEntry {
  itemId: number;
  price: number;
}

export interface ShopVisit {
  name: string;
  stock: ShopEntry[];
}

/** A real FF9 shop for this world: its equipment list plus a general store's consumables. */
export function shopStock(rng: Rng, world: number, partyKeys: string[]): ShopVisit {
  const w = WORLDS[world]!;
  const shopId = rng.pick(w.shops);
  const storeId = rng.pick(w.itemStores);
  const shop = shops.find((s) => s.id === shopId)!;
  const store = shops.find((s) => s.id === storeId);
  const ids = [...new Set([...(store?.items ?? []), ...shop.items])];
  const stock = ids
    .map((id) => findItem(id))
    .filter((i): i is ItemData => !!i && i.price > 0 && !LEGENDARY_ITEMS.has(i.id))
    // Only gear someone in the party can use (consumables always).
    .filter((i) => i.kind === "item" || i.equippableBy.some((k) => partyKeys.includes(k)))
    .map((i) => ({ itemId: i.id, price: i.price }));
  return { name: shop.name, stock };
}

/** Recipes on sale up to an FF9 synthesis-shop tier (32–39). */
export function recipesUpTo(tier: number): SynthesisRecipe[] {
  return synthesis.filter((r) => Math.min(...r.shops) <= tier);
}

const SYNTH_NAMES: Record<number, string> = {
  32: "Lindblum Synthesis Shop",
  33: "Treno Synthesis Shop",
  34: "Black Mage Village Synthesist",
  35: "Lindblum Synthesis Shop",
  36: "Daguerreo Synthesist",
  37: "Black Mage Village Synthesist",
  38: "Daguerreo Synthesist",
  39: "Hades Workshop",
};

export function synthShopName(world: number): string {
  return SYNTH_NAMES[WORLDS[world]!.synthTier] ?? "Synthesis Shop";
}

/** Half the shop price, as in FF9. */
export const sellPrice = (itemId: number) => Math.floor((findItem(itemId)?.price ?? 0) / 2);

/** Starter consumables for every run. */
export function starterKit(): { itemId: number; count: number }[] {
  return [
    { itemId: itemByName("Potion").id, count: 4 },
    { itemId: itemByName("Phoenix Down").id, count: 1 },
    { itemId: itemByName("Antidote").id, count: 1 },
  ];
}
