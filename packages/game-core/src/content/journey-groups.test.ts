/**
 * Journey groupings (`.plans/journey-groups.md`): the seed, the rules the admin page enforces, and what a run plays with
 * and without groupings.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { registerRewardTables, rewardTables, type JourneyGroupData } from "@ffix-roguelike/game-data";

import { challengeRoutes, checkJourneyGroups, getRoute, routeOf, routes, routeUnlocked } from "./journey-groups";
import { getJourney, JOURNEYS } from "./worlds";

const seeded = rewardTables();
afterEach(() => registerRewardTables(seeded));
const withGroupings = (list: JourneyGroupData[]) => registerRewardTables({ ...seeded, journeyGroups: list });

const escape: JourneyGroupData = { id: "escape", name: "Escape from Alexandria", journeys: ["return-to-alexandria", "fossil-roo"], sort: 1, enabled: true };
const disc4: JourneyGroupData = { id: "disc-4", name: "Disc 4", category: "challenge", journeys: ["terra", "memoria", "crystal-world"], sort: 1, enabled: true };

describe("journey groupings", () => {
  test("the seed passes the rules", () => {
    expect(checkJourneyGroups(seeded.journeyGroups ?? [])).toEqual([]);
  });

  test("with no groupings, every journey plays on its own", () => {
    withGroupings([]);
    expect(routes().map((c) => c.id)).toEqual(JOURNEYS.map((j) => j.id));
    const c = getRoute("evil-forest");
    const j = getJourney("evil-forest");
    expect([c.name, c.subtitle, c.category, c.grouped]).toEqual([j.name, j.subtitle, j.category, false]);
    expect(c.areas).toEqual(j.areas);
  });

  test("a grouping plays its journeys' maps end to end, in place of them", () => {
    expect(checkJourneyGroups([escape])).toEqual([]);
    withGroupings([escape]);
    const c = getRoute("escape");
    expect(c.grouped).toBe(true);
    expect(c.areas).toEqual([...getJourney("return-to-alexandria").areas, ...getJourney("fossil-roo").areas]);
    expect(routeOf("fossil-roo").id).toBe("escape");
    const ids = routes().map((x) => x.id);
    expect(ids).not.toContain("return-to-alexandria");
    expect(ids).not.toContain("fossil-roo");
    // Where its first journey was.
    expect(ids.indexOf("escape")).toBe(ids.indexOf("cleyra") + 1);
  });

  test("a grouping opens with its first journey; its journeys aren't started on their own", () => {
    withGroupings([escape]);
    expect(routeUnlocked("escape", [])).toBe(false);
    expect(routeUnlocked("escape", ["cleyra"])).toBe(true);
    expect(routeUnlocked("return-to-alexandria", ["cleyra"])).toBe(false);
    // Ungrouped journeys unlock as before.
    expect(routeUnlocked("cleyra", ["treno"])).toBe(true);
  });

  test("breaking a grouping out (deleting it) gives the journeys back", () => {
    withGroupings([]);
    expect(routeOf("fossil-roo").id).toBe("fossil-roo");
    expect(routeUnlocked("return-to-alexandria", ["cleyra"])).toBe(true);
  });

  test("a challenge run needs every journey in it cleared, and leaves the story alone", () => {
    expect(checkJourneyGroups([escape, disc4])).toEqual([]);
    withGroupings([disc4]);
    expect(challengeRoutes().map((c) => c.id)).toEqual(["disc-4"]);
    expect(routes().some((c) => c.id === "disc-4")).toBe(false);
    expect(routeUnlocked("disc-4", ["ipsens-castle", "terra", "memoria"])).toBe(false);
    expect(routeUnlocked("disc-4", ["ipsens-castle", "terra", "memoria", "crystal-world"])).toBe(true);
    expect(routeOf("terra").id).toBe("terra");
  });

  test("the rules catch bad groupings", () => {
    const g = (journeys: string[], extra: Partial<JourneyGroupData> = {}): JourneyGroupData => ({ id: "x", name: "X", journeys, sort: 1, enabled: true, ...extra });
    // Out of order, and a gap (Cleyra → Fossil Roo skips Return to Alexandria).
    expect(checkJourneyGroups([g(["fossil-roo", "return-to-alexandria"])]).join()).toContain("doesn't follow");
    expect(checkJourneyGroups([g(["cleyra", "fossil-roo"])]).join()).toContain("doesn't follow");
    // No name; a single journey; an id that's a journey's.
    expect(checkJourneyGroups([g(["return-to-alexandria", "fossil-roo"], { name: "" })]).join()).toContain("no name");
    expect(checkJourneyGroups([g(["cleyra"])]).join()).toContain("at least 2");
    expect(checkJourneyGroups([g(["return-to-alexandria", "fossil-roo"], { id: "cleyra" })]).join()).toContain("a journey's id");
    // A journey in two story groupings; duplicate ids; unknown journeys.
    expect(checkJourneyGroups([escape, g(["fossil-roo", "outer-continent"], { id: "y" })]).join()).toContain("several groupings");
    expect(checkJourneyGroups([escape, escape]).join()).toContain("used twice");
    expect(checkJourneyGroups([g(["nowhere", "cleyra"])]).join()).toContain("unknown journey");
  });
});
