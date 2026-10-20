/**
 * Chapters (`.plans/chapters.md`): the seed's groupings, the grouping rules the admin page enforces, and how a grouped
 * chapter resolves and unlocks.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { registerRewardTables, rewardTables, type ChapterData } from "@ffix-roguelike/game-data";

import { chapterOf, chapters, chapterUnlocked, checkChapters, getChapter, singleChapters } from "./chapters";
import { getJourney, JOURNEYS } from "./worlds";

const seeded = rewardTables();
afterEach(() => registerRewardTables(seeded));
const withChapters = (list: ChapterData[]) => registerRewardTables({ ...seeded, chapters: list });

/** The singles with journeys `ids` merged into one chapter named `name`. */
function grouped(id: string, name: string, ids: string[]): ChapterData[] {
  const rest = singleChapters().filter((c) => !ids.includes(c.journeys[0]!));
  return [...rest, { id, name, journeys: ids, sort: 9.5, enabled: true }];
}

describe("chapters", () => {
  test("the seed passes the rules and covers every journey", () => {
    expect(checkChapters(seeded.chapters ?? [])).toEqual([]);
    const covered = new Set(chapters().filter((c) => !c.challengeRun).flatMap((c) => c.journeys));
    expect([...covered].sort()).toEqual(JOURNEYS.map((j) => j.id).sort());
  });

  test("a one-journey chapter shows as its journey", () => {
    const c = getChapter("evil-forest");
    const j = getJourney("evil-forest");
    expect([c.name, c.subtitle, c.category]).toEqual([j.name, j.subtitle, j.category]);
    expect(c.areas).toEqual(j.areas);
  });

  test("a grouped chapter plays its journeys' maps end to end", () => {
    const list = grouped("escape", "Escape from Alexandria", ["return-to-alexandria", "fossil-roo"]);
    expect(checkChapters(list)).toEqual([]);
    withChapters(list);
    const c = getChapter("escape");
    expect(c.areas).toEqual([...getJourney("return-to-alexandria").areas, ...getJourney("fossil-roo").areas]);
    expect(chapterOf("fossil-roo").id).toBe("escape");
    expect(chapters().some((x) => x.id === "fossil-roo")).toBe(false);
  });

  test("a chapter opens with its first journey; the run unlocks the rest", () => {
    withChapters(grouped("escape", "Escape from Alexandria", ["return-to-alexandria", "fossil-roo"]));
    expect(chapterUnlocked("escape", [])).toBe(false);
    expect(chapterUnlocked("escape", ["cleyra"])).toBe(true);
  });

  test("a challenge needs every journey in it cleared", () => {
    const disc4: ChapterData = { id: "disc-4", name: "Disc 4", category: "challenge", journeys: ["terra", "memoria", "crystal-world"], sort: 100, enabled: true };
    withChapters([...singleChapters(), disc4]);
    expect(checkChapters([...singleChapters(), disc4])).toEqual([]);
    expect(chapterUnlocked("disc-4", ["ipsens-castle", "terra", "memoria"])).toBe(false);
    expect(chapterUnlocked("disc-4", ["ipsens-castle", "terra", "memoria", "crystal-world"])).toBe(true);
    // A challenge run overlapping the story doesn't take its journeys' own chapters away.
    expect(chapterOf("terra").id).toBe("terra");
  });

  test("the rules catch bad groupings", () => {
    const singles = singleChapters();
    // Out of order: Fossil Roo opens after Return to Alexandria, not before it.
    expect(checkChapters(grouped("x", "X", ["fossil-roo", "return-to-alexandria"])).join()).toContain("doesn't follow");
    // A gap: Cleyra → Fossil Roo skips Return to Alexandria.
    expect(checkChapters(grouped("x", "X", ["cleyra", "fossil-roo"])).join()).toContain("doesn't follow");
    // No name on a group.
    expect(checkChapters(grouped("x", "", ["return-to-alexandria", "fossil-roo"])).join()).toContain("no name");
    // A journey in two chapters, and one in none.
    expect(checkChapters([...singles, { id: "x", name: "X", journeys: ["cleyra"], sort: 99, enabled: true }]).join()).toContain("several chapters");
    expect(checkChapters(singles.filter((c) => c.id !== "cleyra")).join()).toContain("isn't in any chapter");
    // A disabled chapter doesn't cover its journeys.
    expect(checkChapters(singles.map((c) => (c.id === "cleyra" ? { ...c, enabled: false } : c))).join()).toContain("isn't in any chapter");
    // Duplicate ids and unknown journeys.
    expect(checkChapters([...singles, singles[0]!]).join()).toContain("used twice");
    expect(checkChapters([...singles, { id: "x", journeys: ["nowhere"], sort: 99, enabled: true }]).join()).toContain("unknown journey");
  });
});
