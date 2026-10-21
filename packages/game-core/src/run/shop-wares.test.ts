/**
 * The shop node's wares (`.plans/shop-wares.md`): a shelf of consumables plus six reward cards for sale, each for one
 * member, applied like a taken reward (gear equipped on and bound to its member), each once, as many as the gil allows.
 */
import { describe, expect, test } from "bun:test";

import { baseRelicSlots, findItem, getItem, rarityOf, shopMarkupOf, shopPriceOf } from "@ffix-roguelike/game-data";

import { newProfile } from "../meta/profile";
import { bagValue } from "../metrics/collect";
import { rollOffer, warePrice, type RewardCard } from "../rewards/cards";
import { Rng } from "../rng";
import { effectivePrice } from "./loot";
import { getNode } from "./map";
import { buyWare, moveTo, startRun, type RunState } from "./run";

const RELICS = ["thiefs-gloves", "ether-pouch", "power-wrist", "rosetta-ring", "protect-ring", "blood-fang", "tantalus-bandana", "hermes-sandals", "pumice-piece", "kujas-mirror"];
const profile = newProfile();

/** A run standing in a shop: its first stage is turned into a shop and walked onto. */
function inShop(seed = "shop", gil = 100_000): RunState {
  const run = startRun({ seed, tier: 0, party: [profile.builds.zidane!, profile.builds.vivi!], unlockedRelics: RELICS, relicSlots: baseRelicSlots() });
  const id = getNode(run.map, run.position).next[0]!;
  run.map.nodes.find((n) => n.id === id)!.kind = "shop";
  run.gil = gil;
  return moveTo(run, id);
}

const wares = (run: RunState) => {
  if (run.phase.kind !== "shop" || !run.phase.wares) throw new Error("not in a shop with wares");
  return run.phase.wares;
};

describe("the shop's counter", () => {
  test("the shelf is consumables only; six wares, each priced", () => {
    const run = inShop();
    expect(run.phase.kind).toBe("shop");
    if (run.phase.kind !== "shop") return;
    expect(run.phase.stock.length).toBeGreaterThan(0);
    for (const e of run.phase.stock) expect(findItem(e.itemId)?.kind).toBe("item");
    const w = wares(run);
    expect(w.cards).toHaveLength(6);
    expect(w.prices).toEqual(w.cards.map((c) => warePrice(c, run.tier)));
    expect(w.cards.some((c) => c.kind === "gear")).toBe(true);
    // No supplies or gil cards: the shelf covers supplies.
    expect(w.cards.some((c) => c.kind === "supplies" || c.kind === "gil")).toBe(false);
  });

  test("ware prices: gear at its FF9 price × the rarity's markup, the rest at the rarity's shop price × (tier + 1)", () => {
    const gear: RewardCard = { kind: "gear", rarity: "rare", key: "zidane", itemId: 2, slot: "weapon", score: 1, teaches: [], stopsLearning: [] };
    expect(warePrice(gear, 0)).toBe(Math.round((effectivePrice(getItem(2)) * shopMarkupOf(rarityOf("rare"))) / 10) * 10);
    const boon: RewardCard = { kind: "boon", rarity: "epic", key: "vivi", boonId: "x", name: "X", stat: "magic", amount: 3 };
    expect(warePrice(boon, 2)).toBe(shopPriceOf(rarityOf("epic")) * 3);
  });
});

describe("buying wares", () => {
  test("a gear ware is equipped on and bound to its member; each ware sells once; several can be bought", () => {
    let run = inShop();
    const w = wares(run);
    const gi = w.cards.findIndex((c) => c.kind === "gear");
    const card = w.cards[gi]!;
    if (card.kind !== "gear") return;
    const gil = run.gil;
    run = buyWare(run, gi);
    expect(run.gil).toBe(gil - w.prices[gi]!);
    const m = run.party.find((p) => p.build.key === card.key)!;
    expect(m.build.equipment[card.slot]).toBe(card.itemId);
    expect(run.gear.find((g) => g.itemId === card.itemId && g.holder?.key === card.key)?.boundTo).toBe(card.key);
    expect(wares(run).bought).toEqual([gi]);
    expect(() => buyWare(run, gi)).toThrow(/Sold out/);
    // Another ware too, while the gil lasts.
    const other = w.cards.findIndex((c, i) => i !== gi && c.kind !== "relic");
    run = buyWare(run, other);
    expect(wares(run).bought).toEqual([gi, other]);
    expect(bagValue(run.metrics, "shop.purchases")).toBe(2);
    expect(bagValue(run.metrics, "rewards.taken", { subject: card.kind })).toBeGreaterThanOrEqual(1);
  });

  test("not enough gil, no sale", () => {
    const run = inShop("shop", 0);
    expect(() => buyWare(run, 0)).toThrow(/gil/);
  });
});

describe("relic chances per source", () => {
  test("the shop sometimes stocks a relic; a source at 0% never offers one", () => {
    const run = inShop();
    let shopRelics = 0;
    for (let i = 0; i < 60; i++) {
      if (rollOffer(run, "shop", new Rng(i + 1)).cards.some((c) => c.kind === "relic")) shopRelics++;
      expect(rollOffer(run, "elite", new Rng(i + 1)).cards.some((c) => c.kind === "relic")).toBe(false);
    }
    expect(shopRelics).toBeGreaterThan(0);
    expect(shopRelics).toBeLessThan(60);
  });
});
