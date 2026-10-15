import { describe, expect, test } from "bun:test";

import { itemByName } from "@ffix-roguelike/game-data";

import { getItem } from "@ffix-roguelike/game-data";

import { gearPool } from "../run/loot";
import { abandonRun, equip, runOutcome, startRun } from "../run/run";
import { accrueGrowth, deriveStats, gemsMax, newBuild, STARTER_ARMOR } from "../stats";
import { applyRunOutcome, buySupply, completionPoints, gearCatalog, lockedCharacters, newProfile, raiseStartLevel, unlockGear, unlockSlot } from "./profile";

const mythril = itemByName("Mythril Dagger").id;
const shirt = itemByName("Leather Shirt").id;

describe("Completion Points", () => {
  test("a run resets levels to the start level and pays CP: +1/level, +1/3 wins, +3/boss, +10/win", () => {
    const p = newProfile();
    let run = startRun({ seed: "cp", tier: 0, party: [p.builds.zidane!] });
    run.party[0]!.build.level = 7;
    run.stats.bossKills.push("garland");
    run.stats.battles = 7;
    run = abandonRun(run);
    const report = applyRunOutcome(p, runOutcome(run), 0);
    const z = report.profile.builds.zidane!;
    expect(z.level).toBe(1);
    expect(report.points.zidane).toBe(completionPoints(6, 1, false, 7));
    expect(report.points.zidane).toBe(6 + 2 + 3);
    // Achievements earned on the way (e.g. "The Journey Begins") can add CP on top.
    expect(z.points).toBeGreaterThanOrEqual(11);
  });

  test("CP buys start levels (cost = current level) and slot unlocks (5, 10, 20, 35)", () => {
    let p = newProfile();
    p.builds.zidane!.points = 8;
    p = raiseStartLevel(p, "zidane"); // 1 → 2 costs 1
    p = raiseStartLevel(p, "zidane"); // 2 → 3 costs 2
    expect(p.builds.zidane!.level).toBe(3);
    expect(p.builds.zidane!.points).toBe(5);
    p = unlockSlot(p, "zidane", "armor");
    expect(p.builds.zidane!.unlockedSlots).toEqual(["armor"]);
    expect(p.builds.zidane!.points).toBe(0);
    expect(() => unlockSlot(p, "zidane", "head")).toThrow(/Need 10 CP/);
  });

  test("the next run starts at the bought start level", () => {
    let p = newProfile();
    p.builds.zidane!.points = 3;
    p = raiseStartLevel(raiseStartLevel(p, "zidane"), "zidane");
    const run = startRun({ seed: "lv", tier: 0, party: [p.builds.zidane!] });
    expect(run.party[0]!.build.level).toBe(3);
  });
});

describe("gear slots & unlocks", () => {
  test("runs start in FF9 starter gear (per STARTER_ARMOR); locked slots can't be changed", () => {
    const p = newProfile();
    let run = startRun({ seed: "x", tier: 0, party: [p.builds.zidane!] });
    expect(run.party[0]!.build.equipment.armor).toBe(STARTER_ARMOR === "none" ? null : shirt);
    const unlocked = { ...p.builds.zidane!, unlockedSlots: ["armor" as const] };
    run = startRun({ seed: "x", tier: 0, party: [unlocked] });
    expect(run.party[0]!.build.equipment.armor).toBe(shirt); // Zidane's FF9 Leather Shirt
    expect(() => equip(run, "zidane", "head", null)).toThrow(/locked/);
  });

  test("gear found in a won run is unlocked into the drop pool; a lost run unlocks nothing", () => {
    const p = newProfile();
    const run = startRun({ seed: "keep", tier: 0, party: [p.builds.zidane!] });
    run.gear.push({ uid: 900, itemId: mythril, secured: false, holder: null });
    const lost = applyRunOutcome(p, runOutcome(abandonRun(run)), 0);
    expect(lost.profile.gearUnlocked ?? []).not.toContain(mythril);
    const won = structuredClone(run);
    won.phase = { kind: "over", won: true };
    const report = applyRunOutcome(p, runOutcome(won), 0);
    expect(report.profile.gearUnlocked).toContain(mythril);
    expect(report.gearUnlocked).toContain(mythril);
  });

  test("unlocked gear joins its world's drop pool", () => {
    const p = newProfile();
    p.stats.bestWorld = 2;
    // A World of Ruin catalog item Zidane can wear (catalog price = 2× its band price).
    const rare = gearCatalog(p).find((e) => e.price / 2 >= 4000 && getItem(e.itemId).equippableBy.includes("zidane"))!.itemId;
    expect(gearPool(2, ["zidane"]).some((i) => i.id === rare)).toBe(false);
    expect(gearPool(2, ["zidane"], [rare]).some((i) => i.id === rare)).toBe(true);
  });
});

describe("camp", () => {
  test("the catalog unlocks gear with banked gil; supplies are bought into the stash", () => {
    let p = newProfile();
    const entry = gearCatalog(p)[0]!;
    p.gil = entry.price + 50;
    p = unlockGear(p, entry.itemId);
    expect(p.gearUnlocked).toContain(entry.itemId);
    expect(gearCatalog(p).some((e) => e.itemId === entry.itemId)).toBe(false);
    p = buySupply(p, itemByName("Potion").id);
    expect(p.stash[itemByName("Potion").id]).toBe(1);
  });

  test("legendary gear is never in the catalog or base pools", () => {
    const ultima = itemByName("Ultima Weapon").id;
    expect(gearCatalog(newProfile()).some((e) => e.itemId === ultima)).toBe(false);
    expect([0, 1, 2].some((w) => gearPool(w, ["zidane"]).some((i) => i.id === ultima))).toBe(false);
    expect(gearPool(2, ["zidane"], [ultima]).some((i) => i.id === ultima)).toBe(true);
  });
});

describe("FF9 growth (ff9level.cs)", () => {
  test("level-ups feed the bonus pool: Str/Mag +3, Spirit +1, Stones +5 per level, plus worn gear bonuses", () => {
    const b = newBuild("zidane", 33);
    accrueGrowth(b, 1);
    expect(b.growth).toEqual({ speed: 0, strength: 96, magic: 96, spirit: 32, gems: 160 });
    // 96 >> 5 = 3 extra Strength, 160 >> 5 = 5 extra stones
    const plain = deriveStats(newBuild("zidane", 33));
    expect(deriveStats(b).strength).toBe(plain.strength + 3);
    expect(gemsMax(b)).toBe(18 + Math.floor((33 * 4) / 10) + 5);
  });
});

describe("locked roster", () => {
  test("lists story recruits in journey order, then milestone unlocks", () => {
    const p = newProfile();
    const locked = lockedCharacters(p);
    expect(locked.slice(0, 5).map((l) => l.key)).toEqual(["vivi", "steiner", "garnet", "freya", "quina"]);
    expect(locked[0]!.hint).toBe('Clear the journey "The Evil Forest"');
    expect(locked.map((l) => l.key)).toContain("amarant");
    expect(locked.map((l) => l.key)).not.toContain("zidane");
    expect(lockedCharacters({ ...p, unlocked: [...p.unlocked, "vivi"] }).map((l) => l.key)).not.toContain("vivi");
  });
});
