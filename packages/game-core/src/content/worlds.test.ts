/**
 * Areas and journeys as content (`.plans/content-db.md`): the seed passes the rules the admin page will enforce, and
 * WORLDS / JOURNEYS follow the registered tables.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { registerRewardTables, rewardTables } from "@ffix-roguelike/game-data";

import { checkContent, getJourney, JOURNEYS, WORLDS } from "./worlds";

const seeded = rewardTables();
afterEach(() => registerRewardTables(seeded));

describe("content", () => {
  test("the seeded areas and journeys pass the rules", () => {
    expect(checkContent(seeded.areas ?? [], seeded.journeys ?? [])).toEqual([]);
  });

  test("WORLDS is every area by its number; JOURNEYS the enabled journeys in order", () => {
    expect(WORLDS.length).toBe(seeded.areas!.length);
    WORLDS.forEach((w, i) => expect(w.index).toBe(i));
    expect(JOURNEYS.map((j) => j.id)).toEqual([...seeded.journeys!].sort((a, b) => a.sort - b.sort).map((j) => j.id));
  });

  test("registering new tables refills WORLDS and JOURNEYS; a disabled journey drops out but can still be looked up", () => {
    const journeys = seeded.journeys!.map((j) => (j.id === "echoes" ? { ...j, enabled: false } : j));
    registerRewardTables({ ...seeded, journeys });
    expect(JOURNEYS.some((j) => j.id === "echoes")).toBe(false);
    expect(getJourney("echoes").name).toBeTruthy();
  });

  test("the rules catch gaps, unknown themes and areas, and broken unlock chains", () => {
    const areas = seeded.areas!;
    const [first, second] = [areas[0]!, areas[1]!];
    expect(checkContent([first, { ...second, index: 5 }], [])).toContainEqual(expect.stringContaining("no gaps"));
    expect(checkContent([{ ...first, theme: "moon" }], [])).toContainEqual(expect.stringContaining('unknown theme "moon"'));
    const j = { id: "j", sort: 0, enabled: true, name: "J", subtitle: "", category: "story" as const, areas: ["nowhere"], unlockAfter: "ghost" };
    const problems = checkContent([first], [j]);
    expect(problems).toContainEqual(expect.stringContaining("unknown area nowhere"));
    expect(problems).toContainEqual(expect.stringContaining("unknown journey ghost"));
  });
});
