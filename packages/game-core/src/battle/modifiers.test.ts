/**
 * Relic and synergy effects in battle (battle/modifiers.ts), with the placeholder relics seeded in
 * packages/db/seed/rewards/relics.json.
 */
import { describe, expect, test } from "bun:test";

import { rewardTables } from "@ffix-roguelike/game-data";

import { getEnemy } from "../content/enemies";
import { newProfile } from "../meta/profile";
import { relicSlotCount, relicUnlocked, starterRelics } from "../meta/relics";
import { newBuild } from "../stats";
import { autoBattle } from "./autoplay";
import { BattleEngine, createBattle, getBattleAction, replayBattle } from "./engine";
import { activeSynergies, partySynergies, relicModifiers, sumPct, synergyModifiers } from "./modifiers";
import { TRANCE_MAX, type ModifierSpec } from "./types";
import { enemyUnit, partyUnit } from "./units";

const FIRE = 25;

function battle(keys: string[], modifiers: ModifierSpec[] = [], level = 20, enemies = ["goblin"]) {
  return createBattle({
    seed: 7,
    party: keys.map((k, i) => partyUnit(newBuild(k, level), i)),
    enemies: enemies.map((id, i) => enemyUnit(getEnemy(id), i)),
    inventory: [],
    noSurprise: true,
    modifiers,
  });
}
const unit = (s: ReturnType<typeof battle>, key: string) => s.units.find((u) => u.key === key)!;

describe("relic effects", () => {
  test("stat: Power Wrist raises the party's Strength by 10%", () => {
    const plain = unit(battle(["zidane", "vivi"]), "zidane");
    const s = battle(["zidane", "vivi"], relicModifiers(["power-wrist"]));
    expect(unit(s, "zidane").strength).toBe(Math.round(plain.strength * 1.1));
    expect(unit(s, "vivi").strength).toBe(Math.round(unit(battle(["zidane", "vivi"]), "vivi").strength * 1.1));
    expect(s.modifiers?.[0]).toMatchObject({ source: "relic:power-wrist", units: ["p0", "p1"] });
  });

  test("a negative stat effect lowers it (cursed Kuja's Mirror)", () => {
    const plain = unit(battle(["vivi"]), "vivi");
    const v = unit(battle(["vivi"], relicModifiers(["kujas-mirror"])), "vivi");
    expect(v.magic).toBe(Math.round(plain.magic * 1.3));
    expect(v.defence).toBe(Math.round(plain.defence * 0.8));
  });

  test("scope: Tantalus Bandana covers only Tantalus members", () => {
    const s = battle(["zidane", "vivi"], relicModifiers(["tantalus-bandana"]));
    expect(sumPct(s.modifiers, unit(s, "zidane").id, "steal", "ratePct")).toBe(100);
    expect(sumPct(s.modifiers, unit(s, "vivi").id, "steal", "ratePct")).toBe(0);
  });

  test("startStatus: Protect Ring starts the party with Protect", () => {
    const s = battle(["zidane", "steiner"], relicModifiers(["protect-ring"]));
    for (const u of s.units.filter((x) => x.side === "party")) expect(u.statuses.protect).toBeDefined();
    expect(unit(battle(["zidane"]), "zidane").statuses.protect).toBeUndefined();
  });

  test("trance: Pumice Piece starts Trance half full", () => {
    const z = unit(battle(["zidane"], relicModifiers(["pumice-piece"])), "zidane");
    expect(z.trance).toBe(Math.floor(TRANCE_MAX / 2));
  });

  test("mpDiscount: Ether Pouch makes Fire cheaper", () => {
    const fire = getBattleAction(FIRE);
    const plain = new BattleEngine(battle(["vivi"]));
    const pouch = new BattleEngine(battle(["vivi"], relicModifiers(["ether-pouch"])));
    const v = (e: BattleEngine) => e.state.units.find((u) => u.key === "vivi")!;
    expect(pouch.mpCost(v(pouch), fire)).toBe(Math.floor((plain.mpCost(v(plain), fire) * 85) / 100));
  });

  test("onKill: Blood Fang heals whoever lands the killing blow", () => {
    const s = battle(["zidane"], relicModifiers(["blood-fang"]), 30, ["goblin", "goblin"]);
    const z = unit(s, "zidane");
    z.hp = Math.floor(z.maxHp / 2);
    const healed: number[] = [];
    const e = new BattleEngine(s);
    for (let i = 0; i < 20000 && !e.state.outcome; i++) {
      for (const u of e.readyUnits()) e.submit({ actorId: u.id, kind: "attack", targetIds: [e.opponents(u).find((x) => e.isTargetable(x))!.id] });
      for (const ev of e.step()) if (ev.type === "heal" && ev.targetId === z.id) healed.push(ev.amount);
    }
    expect(e.state.outcome).toBe("victory");
    expect(healed.length).toBe(2);
    expect(healed[0]).toBe(Math.floor((z.maxHp * 5) / 100));
  });

  test("a battle with relics replays exactly (the effects are stored in its state)", () => {
    const initial = battle(["zidane", "vivi", "garnet"], [...relicModifiers(["power-wrist", "ether-pouch", "blood-fang"]), ...synergyModifiers(["zidane", "vivi", "garnet"])], 25, ["goblin", "goblin", "fang"]);
    const played = autoBattle(new BattleEngine(structuredClone(initial))).state;
    const replayed = replayBattle(initial, played.inputs);
    expect(replayed.outcome).toBe(played.outcome);
    expect(replayed.tick).toBe(played.tick);
    expect(replayed.units.map((u) => [u.hp, u.mp])).toEqual(played.units.map((u) => [u.hp, u.mp]));
  });
});

describe("synergies", () => {
  test("Garnet + Eiko reach Summoners; three Alexandrians reach its top tier", () => {
    expect(activeSynergies(["garnet", "eiko"]).map((a) => a.synergy.id)).toContain("summoners");
    const alex = activeSynergies(["steiner", "beatrix", "garnet"]).find((a) => a.synergy.id === "alexandria")!;
    expect(alex.count).toBe(3);
    expect(alex.tier.count).toBe(3);
    expect(activeSynergies(["vivi"])).toEqual([]);
  });

  test("partySynergies lists the ones still short of a tier too, active first", () => {
    // Zidane: Tantalus + Outsiders (both need 2); Garnet + Eiko: Summoners (active), Mages 2 (active).
    const list = partySynergies(["zidane", "garnet", "eiko"]);
    const byId = Object.fromEntries(list.map((x) => [x.synergy.id, x]));
    expect(byId.summoners).toMatchObject({ count: 2, next: undefined });
    expect(byId.summoners!.tier).toBeDefined();
    expect(byId.outsiders).toMatchObject({ count: 1, tier: undefined, next: 2 });
    expect(byId.mages).toMatchObject({ count: 2, next: 3 });
    expect(list.findIndex((x) => !x.tier)).toBeGreaterThan(list.findLastIndex((x) => !!x.tier));
  });

  test("a synergy's tag-scoped effect covers only those members", () => {
    const s = battle(["steiner", "beatrix", "vivi"], synergyModifiers(["steiner", "beatrix", "vivi"]));
    const plain = battle(["steiner", "beatrix", "vivi"]);
    expect(unit(s, "steiner").strength).toBe(Math.round(unit(plain, "steiner").strength * 1.1));
    expect(unit(s, "vivi").strength).toBe(unit(plain, "vivi").strength);
  });
});

describe("relic collection", () => {
  test("free relics are unlocked; others by their achievement (even one earned before)", () => {
    const p = newProfile();
    const relics = rewardTables().relics!;
    const free = relics.find((r) => r.free)!;
    const ring = relics.find((r) => r.id === "protect-ring")!;
    expect(relicUnlocked(p, free)).toBe(true);
    expect(relicUnlocked(p, ring)).toBe(false);
    p.achievements = [ring.unlockedBy!];
    expect(relicUnlocked(p, ring)).toBe(true);
    expect(starterRelics(p).map((r) => r.id)).toContain("protect-ring");
    expect(starterRelics(p).every((r) => r.starter)).toBe(true);
  });

  test("relic slots: three, plus achievements' relicSlots", () => {
    const p = newProfile();
    expect(relicSlotCount(p)).toBe(3);
    const a = rewardTables().achievements.find((x) => x.enabled)!;
    const before = a.reward.relicSlots;
    a.reward.relicSlots = 1;
    try {
      p.achievements = [a.id];
      expect(relicSlotCount(p)).toBe(4);
    } finally {
      a.reward.relicSlots = before;
    }
  });
});
