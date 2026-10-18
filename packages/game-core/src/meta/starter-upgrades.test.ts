import { describe, expect, test } from "bun:test";

import { itemByName, starterUpgradesFor } from "@ffix-roguelike/game-data";

import { startRun } from "../run/run";
import { starterGear } from "../stats";
import { buyStarterUpgrade, newProfile, pickStarterTier, starterBlockText, starterUpgradeState, type Profile } from "./profile";

const masher = itemByName("Mage Masher").id;
const mythril = itemByName("Mythril Dagger").id;
const dagger = itemByName("Dagger").id;

/** Zidane at start Lv 5 with plenty of gil and CP, Mage Masher unlocked. */
function ready(): Profile {
  const p = newProfile();
  p.gil = 100_000;
  p.gearUnlocked = [masher];
  p.builds.zidane!.level = 5;
  p.builds.zidane!.points = 100;
  return p;
}

describe("starting-gear upgrades", () => {
  test("the seeded chains cover the cast in tier order, with gil, CP and start levels", () => {
    const tiers = starterUpgradesFor("zidane", "weapon");
    expect(tiers.map((u) => u.name)).toEqual(["Mage Masher", "Mythril Dagger", "Butterfly Sword"]);
    expect(tiers.map((u) => u.minStartLevel)).toEqual([5, 10, 15]);
    expect(tiers.map((u) => u.cp)).toEqual([5, 10, 20]);
    expect(tiers[0]!.gil).toBeGreaterThan(0);
  });

  test("buying a tier spends gil and CP and changes what every run starts with", () => {
    let p = ready();
    const gil = p.gil;
    p = buyStarterUpgrade(p, "zidane", "weapon");
    const z = p.builds.zidane!;
    expect(z.starterTiers).toEqual({ weapon: 1 });
    expect(p.gil).toBe(gil - starterUpgradesFor("zidane", "weapon")[0]!.gil);
    expect(z.points).toBe(95);
    expect(starterGear(z).weapon).toBe(masher);
    const run = startRun({ seed: "s", tier: 0, party: [z] });
    expect(run.party[0]!.build.equipment.weapon).toBe(masher);
  });

  test("each requirement blocks: item not unlocked, start level, previous tier, gil, CP", () => {
    const p = ready();
    p.gearUnlocked = [];
    p.builds.zidane!.level = 4;
    p.gil = 0;
    p.builds.zidane!.points = 0;
    const [t1, t2] = starterUpgradeState(p, "zidane", "weapon");
    expect(t1!.blocks.map((b) => b.kind)).toEqual(["item", "level", "gil", "cp"]);
    expect(t2!.blocks.map((b) => b.kind)).toContain("previous");
    expect(() => buyStarterUpgrade(p, "zidane", "weapon")).toThrow("Unlock Mage Masher first");
    expect(starterBlockText({ kind: "level", level: 5 })).toBe("Needs start Lv 5");
  });

  test("a locked slot blocks its tiers, and its upgrades only apply once the slot is open", () => {
    const p = ready();
    const hat = starterUpgradesFor("zidane", "head")[0]!;
    p.gearUnlocked = [hat.itemId];
    expect(starterUpgradeState(p, "zidane", "head")[0]!.blocks[0]).toEqual({ kind: "slot", slot: "head" });
    expect(() => buyStarterUpgrade(p, "zidane", "head")).toThrow("Unlock the Head slot first");
    // Owned but the slot is locked again (e.g. edited by hand): the FF9 piece stays.
    const z = { ...p.builds.zidane!, starterTiers: { head: 1 } };
    expect(starterGear(z).head).not.toBe(hat.itemId);
    expect(starterGear({ ...z, unlockedSlots: ["head"] }).head).toBe(hat.itemId);
  });

  test("tiers go in order and stop at the last", () => {
    let p = ready();
    p.gearUnlocked = starterUpgradesFor("zidane", "weapon").map((u) => u.itemId);
    p.builds.zidane!.level = 15;
    p = buyStarterUpgrade(p, "zidane", "weapon");
    p = buyStarterUpgrade(p, "zidane", "weapon");
    expect(starterGear(p.builds.zidane!).weapon).toBe(mythril);
    p = buyStarterUpgrade(p, "zidane", "weapon");
    expect(() => buyStarterUpgrade(p, "zidane", "weapon")).toThrow("Fully upgraded");
    expect(starterUpgradeState(p, "zidane", "weapon").every((s) => s.owned)).toBe(true);
    // Pick an earlier tier (or the FF9 piece) to keep learning its abilities; only owned tiers.
    p = pickStarterTier(p, "zidane", "weapon", 1);
    expect(starterGear(p.builds.zidane!).weapon).toBe(masher);
    p = pickStarterTier(p, "zidane", "weapon", 0);
    expect(starterGear(p.builds.zidane!).weapon).toBe(dagger);
    expect(() => pickStarterTier(newProfile(), "zidane", "weapon", 1)).toThrow("You don't own that tier");
    // Nothing bought: the FF9 starting weapon.
    expect(starterGear(newProfile().builds.zidane!).weapon).toBe(dagger);
  });
});
