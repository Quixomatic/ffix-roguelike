import { describe, expect, test } from "bun:test";
import { RARITIES, sourceOf } from "@ffix-roguelike/game-data";

import { newProfile } from "../meta/profile";
import { Rng } from "../rng";
import { gearPool } from "../run/loot";
import { applyCard, claimReward, runOutcome, startRun, type RunState } from "../run/run";
import { deriveStats } from "../stats";
import { learning, rollOffer, type RewardCard } from "./cards";

/** A run with three members whose gear slots are all open (so there are upgrades to find). */
function testRun(seed = "cards"): RunState {
  const profile = newProfile();
  const keys = ["zidane", "vivi", "steiner"];
  for (const k of keys) profile.builds[k]!.unlockedSlots = ["head", "wrist", "armor", "accessory"];
  const run = startRun({ seed, tier: 0, party: keys.map((k) => ({ ...profile.builds[k]!, level: 5 })) });
  run.phase = { kind: "map" };
  return run;
}
const rank = (r: RewardCard["rarity"]) => RARITIES.indexOf(r);

describe("reward cards", () => {
  test("a boss offers three gear upgrades, rare or better, for different members, from the area's pool", () => {
    const run = testRun();
    const offer = rollOffer(run, "boss", new Rng(1));
    expect(offer.cards.length).toBe(3);
    const pool = new Set(gearPool(run.world, run.party.map((m) => m.build.key), run.unlockedGear).map((i) => i.id));
    for (const c of offer.cards) {
      expect(c.kind).toBe("gear");
      if (c.kind !== "gear") continue;
      expect(rank(c.rarity)).toBeGreaterThanOrEqual(rank("rare"));
      expect(c.score).toBeGreaterThanOrEqual(sourceOf("boss").upgradeThreshold);
      expect(pool.has(c.itemId) || c.rarity !== "rare").toBe(true); // rarer cards may come from the next area's band
    }
    expect(new Set(offer.cards.map((c) => (c.kind === "gear" ? c.key : null))).size).toBeGreaterThan(1);
  });

  test("an elite offers three cards and leads with a gear upgrade", () => {
    const offer = rollOffer(testRun(), "elite", new Rng(2));
    expect(offer.cards.length).toBe(3);
    expect(offer.cards[0]!.kind).toBe("gear");
  });

  test("with no upgrades left, a boss offers strong boons instead", () => {
    const boss = sourceOf("boss");
    const threshold = boss.upgradeThreshold;
    boss.upgradeThreshold = 1e9;
    try {
      const offer = rollOffer(testRun(), "boss", new Rng(3));
      for (const c of offer.cards) {
        expect(c.kind).toBe("boon");
        expect(rank(c.rarity)).toBeGreaterThanOrEqual(rank("epic"));
      }
    } finally {
      boss.upgradeThreshold = threshold;
    }
  });

  test("the same seed rolls the same offer", () => {
    expect(rollOffer(testRun(), "elite", new Rng(9))).toEqual(rollOffer(testRun(), "elite", new Rng(9)));
  });

  test("taking a gear card equips it on its member, bound to them; the old piece goes to the bag", () => {
    const run = testRun();
    const card = rollOffer(run, "boss", new Rng(4)).cards.find((c) => c.kind === "gear")!;
    if (card.kind !== "gear") throw new Error("no gear card");
    const before = run.party.find((m) => m.build.key === card.key)!.build.equipment[card.slot];
    const next = applyCard(run, card);
    const m = next.party.find((x) => x.build.key === card.key)!;
    expect(m.build.equipment[card.slot]).toBe(card.itemId);
    const inst = next.gear.find((g) => g.itemId === card.itemId && g.holder?.key === card.key)!;
    expect(inst.boundTo).toBe(card.key);
    expect(inst.secured).toBe(false);
    if (before != null) expect(next.gear.some((g) => g.itemId === before && !g.holder)).toBe(true);
  });

  test("a stat boon raises the stat for the run, and the run's end drops it", () => {
    const run = testRun();
    const card: RewardCard = { kind: "boon", rarity: "rare", key: "zidane", boonId: "thiefs-vigor", name: "Thief's Vigor", stat: "strength", amount: 3 };
    const before = deriveStats(run.party[0]!.build).strength;
    const next = applyCard(run, card);
    expect(deriveStats(next.party[0]!.build).strength).toBe(Math.min(99, before + 3));
    next.phase = { kind: "over", won: false };
    expect(runOutcome(next).builds[0]!.boons).toBeUndefined();
  });

  test("a party boon reaches everyone; a level boon is real level-ups", () => {
    const run = testRun();
    const hp = run.party.map((m) => deriveStats(m.build).maxHp);
    const party = applyCard(run, { kind: "boon", rarity: "epic", key: null, boonId: "moogle-blessing", name: "Moogle Blessing", stat: "maxHpPct", amount: 8 });
    party.party.forEach((m, i) => expect(deriveStats(m.build).maxHp).toBeGreaterThan(hp[i]!));
    const lv = run.party[1]!.build.level;
    const levelled = applyCard(run, { kind: "boon", rarity: "rare", key: "vivi", boonId: "burst-of-growth", name: "Burst of Growth", stat: "levels", amount: 2 });
    expect(levelled.party[1]!.build.level).toBe(lv + 2);
    expect(levelled.party[1]!.build.growth).toBeDefined();
  });

  test("an AP surge feeds the ability; skipping pays the offer's gil", () => {
    const run = testRun();
    const ap = rollOffer(run, "elite", new Rng(5));
    const ref = learning(run.party[1]!.build)[0]!;
    expect(ref).toBeDefined(); // Vivi's starting staff teaches something
    const surge: RewardCard = { kind: "ap", rarity: "rare", key: "vivi", ref, amount: 15 };
    expect(applyCard(run, surge).party[1]!.build.ap[ref]).toBe((run.party[1]!.build.ap[ref] ?? 0) + 15);
    const withOffer: RunState = { ...run, phase: { kind: "treasure", gearChoices: [], gil: 0, offer: ap } };
    expect(claimReward(withOffer, null).gil).toBe(run.gil + ap.skipGil);
  });
});
