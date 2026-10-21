/**
 * Game settings (game-data `SETTINGS`, the `game_setting` table): the seed matches the definitions, every value is
 * checked, and changing one changes the game — with caps read as min(stored, cap), so lowering one keeps what players
 * bought and raising it gives it back.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { checkSetting, registerRewardTables, rewardTables, setting, SETTINGS, type SettingKey } from "@ffix-roguelike/game-data";

import { startRun } from "../run/run";
import { deriveStats, trainBonus, trainMax, trainRank } from "../stats";
import { completionPoints, newProfile, routeTiersOpen, startingSupplies, supplyMax } from "./profile";

const seeded = rewardTables();
afterEach(() => registerRewardTables(seeded));
const withSettings = (values: Partial<Record<SettingKey, unknown>>) =>
  registerRewardTables({ ...seeded, settings: [...(seeded.settings ?? []).filter((s) => !(s.key in values)), ...Object.entries(values).map(([key, value]) => ({ key, value: value as never }))] });

describe("game settings", () => {
  test("every definition's default passes its own checks, and the seed has a valid row for every setting", () => {
    for (const [key, def] of Object.entries(SETTINGS)) expect([key, checkSetting(key, def.default)]).toEqual([key, null]);
    const seedKeys = new Set((seeded.settings ?? []).map((s) => s.key));
    for (const key of Object.keys(SETTINGS)) expect(seedKeys.has(key)).toBe(true);
    for (const s of seeded.settings ?? []) expect([s.key, checkSetting(s.key, s.value)]).toEqual([s.key, null]);
  });

  test("checks: type, range, whole numbers, list length, choices, known keys", () => {
    expect(checkSetting("training.maxRanks", "20")).toContain("must be a number");
    expect(checkSetting("training.maxRanks", -1)).toContain("at least 0");
    expect(checkSetting("training.maxRanks", 2.5)).toContain("whole number");
    expect(checkSetting("slots.unlockCosts", [5, 10])).toContain("exactly 4");
    expect(checkSetting("slots.starterArmor", "some")).toContain("one of");
    expect(checkSetting("training.perRank", { luck: 1 })).toContain("unknown key luck");
    expect(checkSetting("nope", 1)).toContain("Unknown setting");
  });

  test("a stored value is used; a missing or invalid one falls back to the default", () => {
    withSettings({ "run.startingGil": 999 });
    expect(setting("run.startingGil")).toBe(999);
    withSettings({ "run.startingGil": "lots" });
    expect(setting("run.startingGil")).toBe(SETTINGS["run.startingGil"].default);
    registerRewardTables({ ...seeded, settings: [] });
    expect(setting("run.startingGil")).toBe(SETTINGS["run.startingGil"].default);
  });

  test("training: lowering the cap keeps the ranks but counts fewer; raising it gives them back", () => {
    const b = newProfile().builds.zidane!;
    b.training = { strength: 18 };
    expect(trainRank(b, "strength")).toBe(18);
    withSettings({ "training.maxRanks": 5 });
    expect(trainMax()).toBe(5);
    expect(trainRank(b, "strength")).toBe(5);
    expect(b.training.strength).toBe(18);
    withSettings({ "training.maxRanks": 20 });
    expect(trainRank(b, "strength")).toBe(18);
    // The gain per rank follows its setting too.
    withSettings({ "training.perRank": { ...SETTINGS["training.perRank"].default, strength: 2 } });
    expect(trainBonus(b, "strength")).toBe(36);
  });

  test("start level: a run starts at most at today's cap; the bought level stays on the profile", () => {
    const p = newProfile();
    p.builds.zidane!.level = 21;
    withSettings({ "startLevel.max": 10 });
    const run = startRun({ seed: "cap", tier: 0, party: [p.builds.zidane!] });
    expect(run.party[0]!.build.level).toBe(10);
    expect(p.builds.zidane!.level).toBe(21);
    expect(run.party[0]!.hp).toBe(deriveStats({ ...p.builds.zidane!, level: 10 }).maxHp);
  });

  test("supplies: a run packs at most today's cap of a supply", () => {
    const p = newProfile();
    const potion = 236;
    p.supplyRanks = { [potion]: 5 };
    withSettings({ "supplies.maxRanks": 2 });
    expect(supplyMax("Potion")).toBe(2);
    expect(startingSupplies(p)[potion]).toBe(2);
    expect(p.supplyRanks[potion]).toBe(5);
  });

  test("tiers, Completion Points and run start follow their settings", () => {
    const p = newProfile();
    p.routeTiers = { "evil-forest": 4 };
    expect(routeTiersOpen(p, "evil-forest")).toEqual([0, 1, 2, 3, 4, 5]);
    withSettings({ "tiers.max": 2 });
    expect(routeTiersOpen(p, "evil-forest")).toEqual([0, 1, 2]);
    withSettings({ "cp.perWin": 25, "cp.perBoss": 0 });
    expect(completionPoints(0, 3, true)).toBe(25);
    withSettings({ "run.startingGil": 1234 });
    expect(startRun({ seed: "gil", tier: 0, party: [p.builds.zidane!] }).gil).toBe(1234);
  });
});
