/** Special stages: Stiltzkin's traveling deals and Chocobo Hot & Cold. */
import { findItem, itemByName } from "@ffix-roguelike/game-data";

import { WORLDS } from "../content/worlds";
import type { Rng } from "../rng";
import { rollGear } from "./loot";

export interface StiltzkinOffer {
  label: string;
  items: number[];
  price: number;
}

const priceOf = (ids: number[]) => ids.reduce((s, id) => s + (findItem(id)?.price || 100), 0);
const many = (name: string, n: number) => Array.from({ length: n }, () => itemByName(name).id);

/** Three deals: a supply bundle, a restorative pack, and one rare piece of gear from the next world's band. */
export function stiltzkinOffers(rng: Rng, world: number, partyKeys: string[], unlocked: readonly number[] = []): StiltzkinOffer[] {
  const bundle = world === 0 ? [...many("Potion", 4), ...many("Phoenix Down", 1)] : [...many("Hi-Potion", 3), ...many("Phoenix Down", 2)];
  const pack = world === 0 ? [...many("Antidote", 2), ...many("Eye Drops", 2), ...many("Echo Screen", 1)] : [...many("Ether", 2), ...many("Remedy", 1)];
  const offers: StiltzkinOffer[] = [
    { label: "Traveler's bundle", items: bundle, price: Math.round(priceOf(bundle) * 0.7) },
    { label: world === 0 ? "Remedy kit" : "Mage's pack", items: pack, price: Math.round(priceOf(pack) * 0.7) },
  ];
  const rare = rollGear(rng, Math.min(WORLDS.length - 1, world + 1), partyKeys, 1, 0, unlocked)[0];
  if (rare != null) offers.push({ label: "Something special, kupo!", items: [rare], price: Math.round((findItem(rare)?.price ?? 1000) * 0.8) });
  return offers;
}

export type ChocoboSpot = { type: "gil"; amount: number } | { type: "item"; itemId: number } | { type: "nothing" };

export const CHOCOBO_DIGS = 3;

/** Nine dig spots: one buried gear piece, two gil caches, three consumables, three duds. */
export function chocoboSpots(rng: Rng, world: number, partyKeys: string[], unlocked: readonly number[] = []): ChocoboSpot[] {
  const scale = world + 1;
  const consumables = world === 0 ? ["Potion", "Antidote", "Phoenix Down", "Ether"] : ["Hi-Potion", "Ether", "Phoenix Down", "Remedy", "Elixir"];
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
