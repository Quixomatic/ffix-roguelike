/**
 * Relics in runs (`.plans/relics-and-synergies.md` phase 3): the starting relic, relics and synergies in battle, relic
 * reward cards and the rack (swap only). Uses the placeholder relics in packages/db/seed/rewards/relics.json.
 */
import { describe, expect, test } from "bun:test";

import { BASE_RELIC_SLOTS } from "@ffix-roguelike/game-data";

import { newProfile } from "../meta/profile";
import { bagValue } from "../metrics/collect";
import { rollOffer, rollRelicCard, type RewardCard } from "../rewards/cards";
import { Rng } from "../rng";
import { getNode } from "./map";
import { applyCard, moveTo, startRun, type RunState } from "./run";

const ALL = ["thiefs-gloves", "ether-pouch", "power-wrist", "rosetta-ring", "protect-ring", "blood-fang", "tantalus-bandana", "hermes-sandals", "pumice-piece", "kujas-mirror"];
const profile = newProfile();
const start = (o: Partial<Parameters<typeof startRun>[0]> = {}) =>
  startRun({ seed: "relic", tier: 0, party: [profile.builds.zidane!, profile.builds.vivi!], unlockedRelics: ALL, relicSlots: BASE_RELIC_SLOTS, ...o });
const relicCard = (id: string): RewardCard => ({ kind: "relic", rarity: "common", relicId: id, name: id });

describe("starting a run with a relic", () => {
  test("the starting relic is held, counted, and must be an unlocked starter", () => {
    const run = start({ relic: "power-wrist" });
    expect(run.relics).toEqual(["power-wrist"]);
    expect(run.relicSlots).toBe(3);
    expect(bagValue(run.metrics, "relics.taken", { subject: "power-wrist" })).toBe(1);
    expect(() => start({ relic: "blood-fang" })).toThrow(); // unlocked but not a starter
    expect(() => start({ relic: "power-wrist", unlockedRelics: [] })).toThrow(); // not unlocked
    expect(start().relics).toEqual([]);
  });

  test("battles carry the relics' and the party's synergy effects", () => {
    let run = start({ relic: "power-wrist", party: [profile.builds.garnet!, profile.builds.eiko!] });
    run = moveTo(run, getNode(run.map, run.position).next[0]!);
    expect(run.phase.kind).toBe("battle");
    if (run.phase.kind !== "battle") return;
    const sources = new Set((run.phase.battle.modifiers ?? []).map((m) => m.source));
    expect(sources).toContain("relic:power-wrist");
    expect(sources).toContain("synergy:summoners");
  });
});

describe("relic cards and the rack", () => {
  test("a relic fills a free slot; a full rack needs one given up (swap only)", () => {
    let run: RunState = start({ relic: "power-wrist", relicSlots: 2 });
    run = applyCard(run, relicCard("ether-pouch"));
    expect(run.relics).toEqual(["power-wrist", "ether-pouch"]);
    expect(() => applyCard(run, relicCard("protect-ring"))).toThrow(/full/);
    const swapped = applyCard(run, relicCard("protect-ring"), "power-wrist");
    expect(swapped.relics).toEqual(["protect-ring", "ether-pouch"]);
    expect(() => applyCard(run, relicCard("ether-pouch"), "power-wrist")).toThrow(/already/);
    expect(bagValue(swapped.metrics, "relics.taken", { subject: "protect-ring" })).toBe(1);
  });

  test("a relic card offers only unlocked relics not held, in tier", () => {
    const run = start({ relic: "power-wrist", unlockedRelics: ["power-wrist", "ether-pouch", "kujas-mirror"] });
    for (let i = 0; i < 30; i++) {
      const card = rollRelicCard(run, new Rng(i + 1));
      // Kuja's Mirror is tier 2+: in the first area only Ether Pouch can come up.
      expect(card?.kind === "relic" && card.relicId).toBe("ether-pouch");
    }
    expect(rollRelicCard({ ...run, relics: ["power-wrist", "ether-pouch"] }, new Rng(1))).toBeNull();
  });

  test("a boss reward offer includes a relic card", () => {
    const run = start();
    const offer = rollOffer(run, "boss", new Rng(5));
    expect(offer.cards.some((c) => c.kind === "relic")).toBe(true);
    const none = rollOffer({ ...run, unlockedRelics: [] }, "boss", new Rng(5));
    expect(none.cards.some((c) => c.kind === "relic")).toBe(false);
  });
});
