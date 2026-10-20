/**
 * Journey groupings (`.plans/journey-groups.md`): two or more journeys played as one seamless run, their maps end to
 * end ("map 5 / 6"). Each journey's final boss still gives its rewards; the run then goes on to the next journey's
 * first map. Journeys not in a grouping play as themselves. Groupings are data (game-data `JourneyGroupData`, the
 * `journey_group` table) set on the admin page, never by players; deleting one breaks it back out into its journeys.
 *
 * Journeys keep everything they had: their clears, recruits, achievements and unlock chain.
 *
 * What a run plays is a **route**: a grouping, or a single journey.
 */
import { hasRewardTables, rewardTables, type JourneyGroupData } from "@ffix-roguelike/game-data";

import { getJourney, JOURNEYS, journeyUnlocked, type JourneyDef } from "./worlds";

/** What a run plays: a journey grouping, or one journey on its own (`grouped` false, the journey's own id). */
export interface RouteDef {
  id: string;
  name: string;
  subtitle: string;
  category: JourneyDef["category"];
  /** A grouping (2+ journeys) rather than a single journey. */
  grouped: boolean;
  /** A challenge run over journeys that are also played on their own or in story groupings (Disc 1…). */
  challengeRun: boolean;
  journeys: string[];
  /** Every map of every journey, in order: the run's maps. */
  areas: string[];
}

/** The grouping rows (empty before the tables load). */
const groupings = (): JourneyGroupData[] => (hasRewardTables() ? (rewardTables().journeyGroups ?? []) : []);
const live = () => groupings().filter((g) => g.enabled !== false);

function fromGrouping(g: JourneyGroupData): RouteDef {
  const journeys = g.journeys.map(getJourney);
  return {
    id: g.id,
    name: g.name,
    subtitle: g.subtitle ?? "",
    category: g.category ?? journeys[0]!.category,
    grouped: true,
    challengeRun: g.category === "challenge",
    journeys: [...g.journeys],
    areas: journeys.flatMap((j) => j.areas),
  };
}

function fromJourney(j: JourneyDef): RouteDef {
  return { id: j.id, name: j.name, subtitle: j.subtitle, category: j.category, grouped: false, challengeRun: false, journeys: [j.id], areas: [...j.areas] };
}

/** The story grouping a journey is in, if any. */
const groupingOf = (journeyId: string) => live().find((g) => g.category !== "challenge" && g.journeys.includes(journeyId));

/** What a journey is played in: its story grouping, or the journey on its own. */
export function routeOf(journeyId: string): RouteDef {
  const g = groupingOf(journeyId);
  return g ? fromGrouping(g) : fromJourney(getJourney(journeyId));
}

/**
 * What can be played (the Story page's list), in journey order: each grouping where its first journey is, and every
 * journey that isn't in one. Challenge runs aren't in it (`challengeRoutes`).
 */
export function routes(): RouteDef[] {
  const out: RouteDef[] = [];
  for (const j of JOURNEYS) {
    const g = groupingOf(j.id);
    if (!g) out.push(fromJourney(j));
    else if (g.journeys[0] === j.id) out.push(fromGrouping(g));
  }
  return out;
}

/** The enabled challenge runs, in order. */
export function challengeRoutes(): RouteDef[] {
  return live()
    .filter((g) => g.category === "challenge")
    .sort((a, b) => a.sort - b.sort)
    .map(fromGrouping);
}

/** A grouping by its id, or a journey by its own. */
export function getRoute(id: string): RouteDef {
  const g = groupings().find((x) => x.id === id);
  if (g) return fromGrouping(g);
  return fromJourney(getJourney(id));
}

export const isRoute = (id: string) => groupings().some((x) => x.id === id) || JOURNEYS.some((j) => j.id === id);

/**
 * Whether a route can be started. A story grouping or a journey: its first journey is unlocked (the run unlocks the
 * rest on the way). A journey that's in a grouping is only played through the grouping. A challenge run needs every
 * journey in it cleared first.
 */
export function routeUnlocked(id: string, journeysCleared: readonly string[]): boolean {
  const g = groupings().find((x) => x.id === id);
  if (g) {
    if (g.enabled === false) return false;
    if (g.category === "challenge") return g.journeys.every((j) => journeysCleared.includes(j));
    return journeyUnlocked(g.journeys[0]!, journeysCleared);
  }
  return !groupingOf(id) && journeyUnlocked(id, journeysCleared);
}

/**
 * The grouping rules (the admin page refuses a save that breaks them; a test checks the seed). One line per problem,
 * none when they're valid:
 * - ids are unique and none is a journey's id; every journey exists;
 * - a grouping has a name and 2+ journeys, which follow the unlock chain (each one's `unlockAfter` is the one before);
 * - a journey is in at most one enabled story grouping, whose journeys share a category.
 */
export function checkJourneyGroups(list: readonly JourneyGroupData[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const known = new Set(JOURNEYS.map((j) => j.id));
  const home = new Map<string, string[]>();
  for (const g of list) {
    if (ids.has(g.id)) problems.push(`Grouping id "${g.id}" is used twice`);
    if (known.has(g.id)) problems.push(`Grouping id "${g.id}" is a journey's id`);
    ids.add(g.id);
    if (!g.name?.trim()) problems.push(`Grouping "${g.id}" has no name`);
    if (g.journeys.length < 2) problems.push(`Grouping "${g.id}" needs at least 2 journeys`);
    const unknown = g.journeys.filter((j) => !known.has(j));
    if (unknown.length) {
      problems.push(`Grouping "${g.id}": unknown journey ${unknown.join(", ")}`);
      continue;
    }
    g.journeys.forEach((j, i) => {
      if (i > 0 && getJourney(j).unlockAfter !== g.journeys[i - 1])
        problems.push(`Grouping "${g.id}": "${getJourney(j).name}" doesn't follow "${getJourney(g.journeys[i - 1]!).name}" (it opens after ${getJourney(j).unlockAfter ?? "nothing"})`);
    });
    if (g.enabled === false || g.category === "challenge") continue;
    const cats = new Set(g.journeys.map((j) => getJourney(j).category));
    if (cats.size > 1) problems.push(`Grouping "${g.id}" mixes journey categories (${[...cats].join(", ")})`);
    for (const j of g.journeys) home.set(j, [...(home.get(j) ?? []), g.id]);
  }
  for (const [j, in_] of home) if (in_.length > 1) problems.push(`"${getJourney(j).name}" is in several groupings (${in_.join(", ")})`);
  return problems;
}
