import { describe, expect, test } from "bun:test";

import { itemByName } from "@ffix-roguelike/game-data";

import { abandonRun, runOutcome, startRun } from "../run/run";
import { accrueGrowth, deriveStats, gemsMax, loadoutSlots, newBuild } from "../stats";
import { applyRunOutcome, buyAtCamp, buyLoadoutSlot, completionPoints, equipFromStash, newProfile, raiseStartLevel } from "./profile";

const mythril = itemByName("Mythril Dagger").id;
const shirt = itemByName("Leather Shirt").id;

describe("Completion Points", () => {
  test("a run resets levels to the start level and pays CP: +1/level, +3/boss, +10/win", () => {
    const p = newProfile();
    let run = startRun({ seed: "cp", tier: 0, party: [p.builds.zidane!] });
    run.party[0]!.build.level = 7;
    run.stats.bossKills.push("garland");
    run = abandonRun(run);
    const report = applyRunOutcome(p, runOutcome(run), 0);
    const z = report.profile.builds.zidane!;
    expect(z.level).toBe(1);
    expect(report.points.zidane).toBe(completionPoints(6, 1, false));
    expect(z.points).toBe(9);
  });

  test("CP buys start levels (cost = current level) and gear slots (5, 10, 20, 35, 50)", () => {
    let p = newProfile();
    p.builds.zidane!.points = 8;
    p = raiseStartLevel(p, "zidane"); // 1 → 2 costs 1
    p = raiseStartLevel(p, "zidane"); // 2 → 3 costs 2
    expect(p.builds.zidane!.level).toBe(3);
    expect(p.builds.zidane!.points).toBe(5);
    p = buyLoadoutSlot(p, "zidane");
    expect(loadoutSlots(p.builds.zidane!)).toBe(1);
    expect(p.builds.zidane!.points).toBe(0);
    expect(() => buyLoadoutSlot(p, "zidane")).toThrow(/Need 10 CP/);
  });

  test("the next run starts at the bought start level", () => {
    let p = newProfile();
    p.builds.zidane!.points = 3;
    p = raiseStartLevel(raiseStartLevel(p, "zidane"), "zidane");
    const run = startRun({ seed: "lv", tier: 0, party: [p.builds.zidane!] });
    expect(run.party[0]!.build.level).toBe(3);
  });
});

describe("loadout slots", () => {
  test("no gear slots until one is bought; the budget is enforced", () => {
    let p = newProfile();
    p.stash[mythril] = 1;
    p.stash[shirt] = 1;
    expect(() => equipFromStash(p, "zidane", "weapon", mythril)).toThrow(/No gear slots/);
    p.builds.zidane!.slots = 1;
    p = equipFromStash(p, "zidane", "weapon", mythril);
    expect(p.builds.zidane!.equipment.weapon).toBe(mythril);
    expect(p.stash[mythril]).toBeUndefined();
    expect(() => equipFromStash(p, "zidane", "armor", shirt)).toThrow(/full/);
  });

  test("runs only bring loadout gear", () => {
    const p = newProfile();
    const build = { ...p.builds.zidane!, equipment: { ...p.builds.zidane!.equipment, armor: shirt } };
    const run = startRun({ seed: "x", tier: 0, party: [build] });
    expect(run.party[0]!.build.equipment.armor).toBeNull(); // 0 slots → left at camp
  });

  test("gear found in a run is lost unless the run is won; loadout gear is always kept", () => {
    const p = newProfile();
    let run = startRun({ seed: "keep", tier: 0, party: [p.builds.zidane!] });
    run.gear.push({ uid: 900, itemId: mythril, secured: false, holder: null });
    const lost = runOutcome(abandonRun(run));
    expect(lost.stash[mythril]).toBeUndefined();
    expect(lost.gearLost).toContain(mythril);
    run = structuredClone(run);
    run.phase = { kind: "over", won: true };
    expect(runOutcome(run).stash[mythril]).toBe(1);
  });
});

describe("camp shop", () => {
  test("buys gear from reached worlds' FF9 shops with banked gil", () => {
    const p = newProfile();
    p.gil = 1000;
    const after = buyAtCamp(p, mythril);
    expect(after.stash[mythril]).toBe(1);
    expect(after.gil).toBeLessThan(1000);
    expect(() => buyAtCamp(p, itemByName("Ultima Weapon").id)).toThrow();
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
