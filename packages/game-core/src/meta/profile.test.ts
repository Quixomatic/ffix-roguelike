import { describe, expect, test } from "bun:test";

import { itemByName } from "@ffix-roguelike/game-data";

import { abandonRun, runOutcome, startRun } from "../run/run";
import { accrueGrowth, deriveStats, gemsMax, loadoutSlots, newBuild } from "../stats";
import { applyRunOutcome, equipFromStash, newProfile } from "./profile";

const mythril = itemByName("Mythril Dagger").id;
const shirt = itemByName("Leather Shirt").id;

describe("loadout slots", () => {
  test("a new character has zero loadout slots — only the free starting weapon", () => {
    const p = newProfile();
    p.stash[mythril] = 1;
    expect(loadoutSlots(p.builds.zidane!)).toBe(0);
    expect(() => equipFromStash(p, "zidane", "weapon", mythril)).toThrow(/No loadout slots/);
  });

  test("slots unlock from the character's own runs; the budget is enforced", () => {
    let p = newProfile();
    p.stash[mythril] = 1;
    p.stash[shirt] = 1;
    p.builds.zidane!.record = { runs: 3, wins: 0, bossKills: 0 };
    expect(loadoutSlots(p.builds.zidane!)).toBe(1);
    p = equipFromStash(p, "zidane", "weapon", mythril);
    expect(p.builds.zidane!.equipment.weapon).toBe(mythril);
    expect(() => equipFromStash(p, "zidane", "armor", shirt)).toThrow(/Loadout full/);
  });

  test("runs only bring loadout gear; finishing a run adds to the record", () => {
    const p = newProfile();
    const build = { ...p.builds.zidane!, equipment: { ...p.builds.zidane!.equipment, armor: shirt } };
    const run = startRun({ seed: "x", tier: 0, party: [build] });
    expect(run.party[0]!.build.equipment.armor).toBeNull(); // 0 slots → left at camp
    const report = applyRunOutcome(p, runOutcome(abandonRun(run)), 0);
    expect(report.profile.builds.zidane!.record?.runs).toBe(1);
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
