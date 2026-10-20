/** Expected loadouts for Practice and the sim: gear and abilities a party at a level can be expected to have. */
import { describe, expect, test } from "bun:test";

import { getItem } from "@ffix-roguelike/game-data";

import { activeSupports, deriveStats, EQUIP_SLOTS, gemsMax, gemsUsed, isMastered, newBuild, starterGear } from "../stats";
import { areasReachedAt, expectedBuild, expectedGearPool } from "./expected";

describe("expected loadouts", () => {
  test("off: the starting gear, nothing learned (as a fresh run)", () => {
    const b = expectedBuild("zidane", 20);
    const fresh = newBuild("zidane", 20);
    expect(b.equipment).toEqual(starterGear(fresh));
    expect(b.supports).toEqual([]);
  });

  test("higher levels reach more areas, and the gear pool only grows", () => {
    expect(areasReachedAt(5).length).toBeGreaterThan(0);
    expect(areasReachedAt(30).length).toBeGreaterThanOrEqual(areasReachedAt(10).length);
    const low = new Set(expectedGearPool(10));
    for (const id of low) expect(expectedGearPool(30)).toContain(id);
  });

  test("expected gear is at least as strong as the starting gear, from the pool, worn in every slot it can", () => {
    for (const key of ["zidane", "vivi", "steiner"]) {
      const start = deriveStats({ ...newBuild(key, 25), equipment: starterGear(newBuild(key, 25)) });
      const b = expectedBuild(key, 25, { gear: true });
      const st = deriveStats(b);
      expect(st.attack + st.magic + st.defence + st.magicDefence).toBeGreaterThanOrEqual(start.attack + start.magic + start.defence + start.magicDefence);
      const pool = new Set([...expectedGearPool(25), ...EQUIP_SLOTS.map((s) => starterGear(newBuild(key, 25))[s])]);
      for (const s of EQUIP_SLOTS) if (b.equipment[s] != null) expect(pool.has(b.equipment[s])).toBe(true);
    }
  });

  test("expected abilities: what the gear teaches is mastered, supports on within the stones", () => {
    const b = expectedBuild("vivi", 25, { gear: true, abilities: true });
    for (const s of EQUIP_SLOTS) {
      const id = b.equipment[s];
      if (id == null) continue;
      for (const ref of getItem(id).abilities) if (b.ap[ref] != null) expect(isMastered(b, ref)).toBe(true);
    }
    expect(b.supports.length).toBeGreaterThan(0);
    expect(gemsUsed(b)).toBeLessThanOrEqual(gemsMax(b));
    expect(activeSupports(b).size).toBe(b.supports.length);
  });
});
