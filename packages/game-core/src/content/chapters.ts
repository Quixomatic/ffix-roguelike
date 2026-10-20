/**
 * Chapters (`.plans/chapters.md`): what a run plays. A chapter is an ordered list of journeys played as one seamless
 * run, their maps end to end ("map 5 / 6"). A chapter of one journey is that journey and shows exactly as it.
 * Groupings are data (game-data `ChapterData`, the `chapter` table) and set on the admin page, never by players.
 *
 * Journeys keep everything they had: their clears, recruits, achievements and unlock chain. A run records each
 * journey as it finishes it.
 */
import { hasRewardTables, rewardTables, type ChapterData } from "@ffix-roguelike/game-data";

import { getJourney, JOURNEYS, journeyUnlocked, type JourneyDef } from "./worlds";

/** A chapter with its display fields filled in from its journeys. */
export interface ChapterDef {
  id: string;
  name: string;
  subtitle: string;
  category: JourneyDef["category"];
  /** A challenge run over journeys that also have their own chapters (Disc 1, The Whole Story…). */
  challengeRun: boolean;
  journeys: string[];
  /** Every map of every journey, in order: the run's maps. */
  areas: string[];
  sort: number;
  enabled: boolean;
}

/** One chapter per journey: the chapter table's default, and the fallback before the tables load. */
export function singleChapters(): ChapterData[] {
  return JOURNEYS.map((j, i) => ({ id: j.id, journeys: [j.id], sort: i + 1, enabled: true }));
}

const table = (): ChapterData[] => {
  const rows = hasRewardTables() ? rewardTables().chapters : undefined;
  return rows?.length ? rows : singleChapters();
};

/** Fill in a chapter's name, subtitle, category and maps from its journeys. */
export function resolveChapter(c: ChapterData): ChapterDef {
  const journeys = c.journeys.map(getJourney);
  const first = journeys[0]!;
  return {
    id: c.id,
    name: c.name ?? first.name,
    subtitle: c.subtitle ?? (journeys.length === 1 ? first.subtitle : ""),
    category: c.category ?? first.category,
    challengeRun: c.category === "challenge",
    journeys: [...c.journeys],
    areas: journeys.flatMap((j) => j.areas),
    sort: c.sort,
    enabled: c.enabled !== false,
  };
}

/** The enabled chapters, in order. */
export function chapters(): ChapterDef[] {
  return table()
    .filter((c) => c.enabled !== false)
    .sort((a, b) => a.sort - b.sort)
    .map(resolveChapter);
}

export function getChapter(id: string): ChapterDef {
  const c = table().find((x) => x.id === id);
  if (!c) throw new Error(`Unknown chapter ${id}`);
  return resolveChapter(c);
}

export const hasChapter = (id: string) => table().some((x) => x.id === id);

/** The (non-challenge) chapter a journey is played in: its own one-journey chapter when it isn't grouped. */
export function chapterOf(journeyId: string): ChapterDef {
  const c = table().find((x) => x.enabled !== false && x.category !== "challenge" && x.journeys.includes(journeyId));
  return resolveChapter(c ?? { id: journeyId, journeys: [journeyId], sort: 0, enabled: true });
}

/**
 * Whether a chapter can be started: its first journey is unlocked (the run unlocks the rest on the way). A challenge
 * needs every journey in it cleared first.
 */
export function chapterUnlocked(id: string, journeysCleared: readonly string[]): boolean {
  const c = getChapter(id);
  if (!c.enabled) return false;
  if (c.challengeRun) return c.journeys.every((j) => journeysCleared.includes(j));
  return journeyUnlocked(c.journeys[0]!, journeysCleared);
}

/**
 * The grouping rules (the admin page refuses a save that breaks them; a test checks the seed). Returns one line per
 * problem, none when the chapters are valid:
 * - ids are unique and every journey exists;
 * - a chapter's journeys follow the unlock chain (each one's `unlockAfter` is the one before it);
 * - a grouped (2+ journeys) chapter has a name;
 * - every journey is in exactly one enabled non-challenge chapter, with journeys of one category.
 */
export function checkChapters(list: readonly ChapterData[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const known = new Set(JOURNEYS.map((j) => j.id));
  const home = new Map<string, string[]>();
  for (const c of list) {
    if (ids.has(c.id)) problems.push(`Chapter id "${c.id}" is used twice`);
    ids.add(c.id);
    if (!c.journeys.length) problems.push(`Chapter "${c.id}" has no journeys`);
    const unknown = c.journeys.filter((j) => !known.has(j));
    if (unknown.length) {
      problems.push(`Chapter "${c.id}": unknown journey ${unknown.join(", ")}`);
      continue;
    }
    c.journeys.forEach((j, i) => {
      if (i > 0 && getJourney(j).unlockAfter !== c.journeys[i - 1])
        problems.push(`Chapter "${c.id}": "${getJourney(j).name}" doesn't follow "${getJourney(c.journeys[i - 1]!).name}" (it opens after ${getJourney(j).unlockAfter ?? "nothing"})`);
    });
    if (c.journeys.length > 1 && !c.name?.trim()) problems.push(`Chapter "${c.id}" groups several journeys but has no name`);
    if (c.enabled === false || c.category === "challenge") continue;
    const cats = new Set(c.journeys.map((j) => getJourney(j).category));
    if (cats.size > 1) problems.push(`Chapter "${c.id}" mixes journey categories (${[...cats].join(", ")})`);
    for (const j of c.journeys) home.set(j, [...(home.get(j) ?? []), c.id]);
  }
  for (const j of JOURNEYS) {
    const in_ = home.get(j.id) ?? [];
    if (!in_.length) problems.push(`"${j.name}" isn't in any chapter`);
    else if (in_.length > 1) problems.push(`"${j.name}" is in several chapters (${in_.join(", ")})`);
  }
  return problems;
}
