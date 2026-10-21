/**
 * Challenges (`.plans/content-db.md`): the seed, the rules the admin page enforces, unlocks, rules, and what a run
 * plays for each kind of route.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { registerRewardTables, rewardTables, type ChallengeData } from "@ffix-roguelike/game-data";

import { challengeCategories, challengeRoutes, challengeRuleProblem, checkChallenges, getRoute, routeUnlocked } from "./journey-groups";
import { getJourney, JOURNEYS } from "./worlds";
import { routeLegs } from "../run/run";

const seeded = rewardTables();
afterEach(() => registerRewardTables(seeded));

const one = (c: Partial<ChallengeData> & Pick<ChallengeData, "id" | "route">): ChallengeData => ({
  sort: 0, enabled: true, name: c.id, subtitle: "", category: "side", unlock: {}, ...c,
});

describe("challenges", () => {
  test("the seed passes the rules, and every challenge is listed in its category's order", () => {
    expect(checkChallenges(seeded.challenges ?? [], seeded.challengeCategories ?? [])).toEqual([]);
    const listed = challengeRoutes();
    expect(listed.length).toBe(seeded.challenges!.length);
    const order = challengeCategories().map((c) => c.id);
    const positions = listed.map((r) => order.indexOf(r.challengeCategory!));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test("story journeys are only story journeys: the old side and hidden journeys are challenges now", () => {
    expect(JOURNEYS.every((j) => j.category === "story")).toBe(true);
    for (const id of ["echoes", "the-gourmand", "boss-gauntlet"]) {
      expect(JOURNEYS.some((j) => j.id === id)).toBe(false);
      expect(getRoute(id).category).toBe("challenge");
    }
  });

  test("a challenge with its own maps plays them, and clears under its own id", () => {
    const r = getRoute("the-gourmand");
    expect(r.journeys).toEqual(["the-gourmand"]);
    expect(r.areas).toEqual(getJourney("the-gourmand").areas);
    expect(routeLegs(r)).toEqual([{ journey: "the-gourmand", last: r.areas.length - 1 }]);
  });

  test("a grouping challenge plays its grouping's journeys end to end", () => {
    const r = getRoute("c-disc-4");
    expect(r.grouped).toBe(true);
    expect(r.areas).toEqual(r.journeys.flatMap((j) => getJourney(j).areas));
  });

  test("unlocks: cleared ids, every journey, an achievement; nothing means open", () => {
    registerRewardTables({
      ...seeded,
      challenges: [
        one({ id: "open", route: { kind: "areas", areas: ["cornelia"] } }),
        one({ id: "after", route: { kind: "areas", areas: ["cornelia"] }, unlock: { cleared: ["dali", "the-gourmand"] } }),
        one({ id: "earned", route: { kind: "journey", journey: "dali" }, unlock: { achievement: "triumph" } }),
      ],
    });
    expect(routeUnlocked("open", { cleared: [] })).toBe(true);
    expect(routeUnlocked("after", { cleared: ["dali"] })).toBe(false);
    expect(routeUnlocked("after", { cleared: ["dali", "the-gourmand"] })).toBe(true);
    expect(routeUnlocked("earned", { cleared: [], achievements: [] })).toBe(false);
    expect(routeUnlocked("earned", { cleared: [], achievements: ["triumph"] })).toBe(true);
    // A journey challenge plays that journey but records its own id.
    expect(getRoute("earned").journeys).toEqual(["dali"]);
  });

  test("a disabled challenge or category isn't listed or startable", () => {
    const cats = seeded.challengeCategories!.map((c) => (c.id === "hidden" ? { ...c, enabled: false } : c));
    const list = seeded.challenges!.map((c) => (c.id === "echoes" ? { ...c, enabled: false } : c));
    registerRewardTables({ ...seeded, challengeCategories: cats, challenges: list });
    const ids = challengeRoutes().map((r) => r.id);
    expect(ids).not.toContain("echoes");
    expect(ids).not.toContain("the-gourmand");
    expect(routeUnlocked("echoes", { cleared: ["lindblum"] })).toBe(false);
  });

  test("rules: party size and start level", () => {
    const solo = { rules: { maxParty: 1, minStartLevel: 10 } };
    expect(challengeRuleProblem(solo, [{ name: "Zidane", startLevel: 12 }])).toBeNull();
    expect(challengeRuleProblem(solo, [{ name: "Zidane", startLevel: 12 }, { name: "Vivi", startLevel: 12 }])).toContain("solo");
    expect(challengeRuleProblem(solo, [{ name: "Zidane", startLevel: 5 }])).toContain("Zidane");
    expect(challengeRuleProblem({}, [{ name: "Zidane", startLevel: 1 }])).toBeNull();
  });

  test("the rules catch bad challenges", () => {
    const cats = seeded.challengeCategories!;
    const problems = (c: ChallengeData) => checkChallenges([c], cats).join(" | ");
    expect(problems(one({ id: "dali", route: { kind: "areas", areas: ["cornelia"] } }))).toContain("story journey's id");
    expect(problems(one({ id: "x", category: "nope", route: { kind: "areas", areas: ["cornelia"] } }))).toContain("unknown category");
    expect(problems(one({ id: "x", route: { kind: "areas", areas: ["moon"] } }))).toContain("unknown area moon");
    expect(problems(one({ id: "x", route: { kind: "group", group: "ghost" } }))).toContain("unknown grouping");
    expect(problems(one({ id: "x", route: { kind: "journey", journey: "ghost" } }))).toContain("unknown journey");
    expect(problems(one({ id: "x", route: { kind: "areas", areas: ["cornelia"] }, unlock: { cleared: ["ghost"] } }))).toContain("unknown ghost");
    expect(problems(one({ id: "g-queens-war", route: { kind: "areas", areas: ["cornelia"] } }))).toContain("grouping's id");
    expect(problems(one({ id: "x", route: { kind: "areas", areas: ["cornelia"] }, rules: { maxParty: 6 } }))).toContain("1–4");
  });
});
