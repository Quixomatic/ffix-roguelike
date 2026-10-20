/** Special stages: Stiltzkin's traveling deals and Chocobo Hot & Cold. */
import { findItem, itemByName } from "@ffix-roguelike/game-data";

import type { Rng } from "../rng";
import { WORLDS } from "../content/worlds";
import { nextTierArea, rollGear } from "./loot";

export interface StiltzkinOffer {
  label: string;
  items: number[];
  price: number;
}

const priceOf = (ids: number[]) => ids.reduce((s, id) => s + (findItem(id)?.price || 100), 0);
const many = (name: string, n: number) => Array.from({ length: n }, () => itemByName(name).id);

/** Three deals: a supply bundle, a restorative pack, and one rare piece of gear from the next world's band. */
export function stiltzkinOffers(rng: Rng, world: number, partyKeys: string[], unlocked: readonly number[] = []): StiltzkinOffer[] {
  const tier = WORLDS[world]?.tier ?? 0;
  // Early, mid, and late (tier 3+: Disc 3 onward) bundles.
  const bundle =
    tier === 0 ? [...many("Potion", 4), ...many("Phoenix Down", 1)] : tier < 3 ? [...many("Hi-Potion", 3), ...many("Phoenix Down", 2)] : [...many("Hi-Potion", 4), ...many("Phoenix Pinion", 1), ...many("Elixir", 1)];
  const pack = tier === 0 ? [...many("Antidote", 2), ...many("Eye Drops", 2), ...many("Echo Screen", 1)] : tier < 3 ? [...many("Ether", 2), ...many("Remedy", 1)] : [...many("Ether", 3), ...many("Remedy", 2)];
  const offers: StiltzkinOffer[] = [
    { label: "Traveler's bundle", items: bundle, price: Math.round(priceOf(bundle) * 0.7) },
    { label: tier === 0 ? "Remedy kit" : "Mage's pack", items: pack, price: Math.round(priceOf(pack) * 0.7) },
  ];
  const rare = rollGear(rng, nextTierArea(world), partyKeys, 1, 0, unlocked)[0];
  if (rare != null) offers.push({ label: "Something special, kupo!", items: [rare], price: Math.round((findItem(rare)?.price ?? 1000) * 0.8) });
  return offers;
}

export type ChocoboSpot = { type: "gil"; amount: number } | { type: "item"; itemId: number } | { type: "nothing" };

export const CHOCOBO_DIGS = 3;

/** Nine dig spots: one buried gear piece, two gil caches, three consumables, three duds. */
export function chocoboSpots(rng: Rng, world: number, partyKeys: string[], unlocked: readonly number[] = []): ChocoboSpot[] {
  const tier = WORLDS[world]?.tier ?? 0;
  const scale = tier + 1;
  const consumables =
    tier === 0 ? ["Potion", "Antidote", "Phoenix Down", "Ether"] : tier < 3 ? ["Hi-Potion", "Ether", "Phoenix Down", "Remedy", "Elixir"] : ["Hi-Potion", "Ether", "Phoenix Pinion", "Remedy", "Elixir"];
  const gear = rollGear(rng, world, partyKeys, 1, 30, unlocked)[0];
  const spots: ChocoboSpot[] = [
    gear != null ? { type: "item", itemId: gear } : { type: "gil", amount: 300 * scale },
    { type: "gil", amount: rng.int(80, 160) * scale },
    { type: "gil", amount: rng.int(200, 400) * scale },
    ...Array.from({ length: 3 }, (): ChocoboSpot => ({ type: "item", itemId: itemByName(rng.pick(consumables)).id })),
    { type: "nothing" },
    { type: "nothing" },
    { type: "nothing" },
  ];
  return rng.shuffle(spots);
}
