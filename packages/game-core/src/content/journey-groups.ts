/**
 * Routes: what a run plays. A story journey, a story grouping (`.plans/journey-groups.md`: two or more journeys played
 * as one seamless run, their maps end to end), or a challenge (`.plans/content-db.md`).
 *
 * - Groupings are data (game-data `JourneyGroupData`, the `journey_group` table) set on the admin page, never by
 *   players. A story grouping replaces its journeys on the Story page; a grouping marked `challenge` is only played
 *   through a challenge that points at it.
 * - Challenges are data too (`ChallengeData`, the `challenge` table), each in a category (`challenge_category`): their
 *   own maps, a grouping or a journey, with what opens them and their rules.
 *
 * Each journey's final boss gives its rewards; the run then goes on to the next journey's first map. Journeys keep
 * their clears, recruits, achievements and unlock chain.
 */
import {
  hasRewardTables,
  rewardTables,
  type ChallengeCategoryData,
  type ChallengeData,
  type ChallengeRules,
  type ChallengeUnlock,
  type JourneyGroupData,
} from "@ffix-roguelike/game-data";

import { getJourney, JOURNEYS, journeyUnlocked, WORLDS, type JourneyDef } from "./worlds";

/** What a run plays. */
export interface RouteDef {
  id: string;
  name: string;
  subtitle: string;
  /** "story": a journey or story grouping (the Story page); "challenge": a challenge (the Challenges page). */
  category: JourneyDef["category"];
  /** A challenge's category (`challenge_category` id). */
  challengeCategory?: string;
  /** Plays 2+ journeys end to end. */
  grouped: boolean;
  /** The journeys it plays, in order (a challenge with its own maps: itself). */
  journeys: string[];
  /** Every map, in order: the run's maps. */
  areas: string[];
  /** A challenge's unlock and rules. */
  unlock?: ChallengeUnlock;
  rules?: ChallengeRules;
}

const tables = () => (hasRewardTables() ? rewardTables() : null);
/** The grouping rows (empty before the tables load). */
const groupings = (): JourneyGroupData[] => tables()?.journeyGroups ?? [];
const live = () => groupings().filter((g) => g.enabled !== false);

/** Enabled challenge categories, in order. */
export function challengeCategories(): ChallengeCategoryData[] {
  return (tables()?.challengeCategories ?? []).filter((c) => c.enabled !== false).sort((a, b) => a.sort - b.sort);
}

/** Enabled challenges in enabled categories, by category then their own order. */
export function challenges(): ChallengeData[] {
  const order = challengeCategories().map((c) => c.id);
  return (tables()?.challenges ?? [])
    .filter((c) => c.enabled !== false && order.includes(c.category))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.sort - b.sort);
}

const challengeById = (id: string): ChallengeData | undefined => (tables()?.challenges ?? []).find((c) => c.id === id);

function fromGrouping(g: JourneyGroupData): RouteDef {
  const journeys = g.journeys.map(getJourney);
  return {
    id: g.id,
    name: g.name,
    subtitle: g.subtitle ?? "",
    category: journeys[0]!.category,
    grouped: true,
    journeys: [...g.journeys],
    areas: journeys.flatMap((j) => j.areas),
  };
}

function fromJourney(j: JourneyDef): RouteDef {
  return { id: j.id, name: j.name, subtitle: j.subtitle, category: j.category, grouped: false, journeys: [j.id], areas: [...j.areas] };
}

/** The journeys a challenge plays (its own maps count as one journey, under its id). */
function challengeJourneys(c: ChallengeData): string[] {
  if (c.route.kind === "areas") return [c.id];
  if (c.route.kind === "journey") return [c.route.journey];
  const { group } = c.route;
  const g = groupings().find((x) => x.id === group);
  if (!g) throw new Error(`Challenge ${c.id}: unknown grouping ${group}`);
  return [...g.journeys];
}

function fromChallenge(c: ChallengeData): RouteDef {
  const journeys = challengeJourneys(c);
  return {
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    category: "challenge",
    challengeCategory: c.category,
    grouped: journeys.length > 1,
    journeys,
    areas: journeys.flatMap((j) => getJourney(j).areas),
    unlock: c.unlock,
    ...(c.rules ? { rules: c.rules } : {}),
  };
}

/** The story grouping a journey is in, if any. */
const groupingOf = (journeyId: string) => live().find((g) => g.category !== "challenge" && g.journeys.includes(journeyId));

/** What a journey is played in: its story grouping, or the journey on its own. */
export function routeOf(journeyId: string): RouteDef {
  const g = groupingOf(journeyId);
  return g ? fromGrouping(g) : fromJourney(getJourney(journeyId));
}

/**
 * The Story page's list, in journey order: each story grouping where its first journey is, and every journey that
 * isn't in one.
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

/** The Challenges page's list (challenges whose route is broken are left out; the admin page lists the problems). */
export function challengeRoutes(): RouteDef[] {
  return challenges().flatMap((c) => {
    try {
      return [fromChallenge(c)];
    } catch {
      return [];
    }
  });
}

/** A challenge, grouping or journey by its id. */
export function getRoute(id: string): RouteDef {
  const c = challengeById(id);
  if (c) return fromChallenge(c);
  const g = groupings().find((x) => x.id === id);
  if (g) return fromGrouping(g);
  return fromJourney(getJourney(id));
}

export const isRoute = (id: string) => !!challengeById(id) || groupings().some((x) => x.id === id) || JOURNEYS.some((j) => j.id === id);

/** What the player has: route ids cleared (journeys, challenges, groupings) and achievements. */
export interface RouteProgress {
  cleared: readonly string[];
  achievements?: readonly string[];
}

/** Whether a challenge's unlock is met. */
export function challengeUnlockMet(route: Pick<RouteDef, "unlock" | "journeys">, { cleared, achievements = [] }: RouteProgress): boolean {
  const u = route.unlock ?? {};
  if (u.cleared?.some((id) => !cleared.includes(id))) return false;
  if (u.allJourneys && route.journeys.some((j) => !cleared.includes(j))) return false;
  if (u.achievement && !achievements.includes(u.achievement)) return false;
  return true;
}

/**
 * Whether a route can be started. A challenge: it's enabled and its unlock is met. A story grouping or journey: its
 * first journey is unlocked (the run unlocks the rest on the way); a journey in a story grouping is only played
 * through the grouping. A grouping marked `challenge` is only played through a challenge.
 */
export function routeUnlocked(id: string, progress: RouteProgress): boolean {
  const c = challengeById(id);
  if (c) {
    if (!challenges().includes(c)) return false;
    try {
      return challengeUnlockMet(fromChallenge(c), progress);
    } catch {
      return false;
    }
  }
  const g = groupings().find((x) => x.id === id);
  if (g) return g.enabled !== false && g.category !== "challenge" && journeyUnlocked(g.journeys[0]!, progress.cleared);
  return !groupingOf(id) && journeyUnlocked(id, progress.cleared);
}

/** Why a party can't start a challenge under its rules (null: it can). */
export function challengeRuleProblem(route: Pick<RouteDef, "rules">, party: readonly { name: string; startLevel: number }[]): string | null {
  const r = route.rules;
  if (!r) return null;
  if (r.maxParty != null && party.length > r.maxParty) return r.maxParty === 1 ? "This challenge is played solo" : `At most ${r.maxParty} in the party`;
  if (r.minStartLevel != null) {
    const low = party.filter((m) => m.startLevel < r.minStartLevel!);
    if (low.length) return `Needs start level ${r.minStartLevel}+ (${low.map((m) => m.name).join(", ")})`;
  }
  return null;
}

/**
 * The grouping rules (the admin page refuses a save that breaks them; a test checks the seed). One line per problem,
 * none when they're valid:
 * - ids are unique and none is a journey's id; every journey exists;
 * - a grouping has a name and 2+ journeys, which follow the unlock chain (each one's `unlockAfter` is the one before);
 * - a journey is in at most one enabled story grouping.
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
    for (const j of g.journeys) home.set(j, [...(home.get(j) ?? []), g.id]);
  }
  for (const [j, in_] of home) if (in_.length > 1) problems.push(`"${getJourney(j).name}" is in several groupings (${in_.join(", ")})`);
  return problems;
}

/**
 * The challenge rules (admin saves, and a test over the seed). One line per problem:
 * - ids are unique, never a story journey's or a story grouping's (a challenge may share its own grouping's id);
 * - a name, a category that exists, and a route that resolves: areas that exist (at least one), a grouping that
 *   exists, or a story journey;
 * - unlocks name journeys / challenges / groupings that exist and an achievement that exists;
 * - rules are sensible (party 1–4, start level 1+).
 */
export function checkChallenges(
  list: readonly ChallengeData[],
  categories: readonly ChallengeCategoryData[],
  { groups = groupings(), achievements = tables()?.achievements?.map((a) => a.id) ?? [] }: { groups?: readonly JourneyGroupData[]; achievements?: readonly string[] } = {},
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const journeyIds = new Set(JOURNEYS.map((j) => j.id));
  const areaIds = new Set(WORLDS.map((w) => w.id));
  const catIds = new Set(categories.map((c) => c.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const known = new Set([...journeyIds, ...groupIds, ...list.map((c) => c.id)]);
  for (const c of list) {
    if (ids.has(c.id)) problems.push(`Challenge id "${c.id}" is used twice`);
    ids.add(c.id);
    if (journeyIds.has(c.id)) problems.push(`Challenge id "${c.id}" is a story journey's id`);
    const g = groups.find((x) => x.id === c.id);
    if (g && !(c.route.kind === "group" && c.route.group === c.id)) problems.push(`Challenge id "${c.id}" is a grouping's id (only allowed when it plays that grouping)`);
    if (!c.name?.trim()) problems.push(`Challenge "${c.id}" has no name`);
    if (!catIds.has(c.category)) problems.push(`Challenge "${c.id}": unknown category ${c.category}`);
    const r = c.route;
    if (r.kind === "areas") {
      if (!r.areas.length) problems.push(`Challenge "${c.id}" has no maps`);
      for (const a of r.areas) if (!areaIds.has(a)) problems.push(`Challenge "${c.id}": unknown area ${a}`);
    } else if (r.kind === "group") {
      if (!groupIds.has(r.group)) problems.push(`Challenge "${c.id}": unknown grouping ${r.group}`);
    } else if (!journeyIds.has(r.journey)) problems.push(`Challenge "${c.id}": unknown journey ${r.journey}`);
    for (const id of c.unlock?.cleared ?? []) if (!known.has(id)) problems.push(`Challenge "${c.id}": unlocks after unknown ${id}`);
    if (c.unlock?.achievement && !achievements.includes(c.unlock.achievement)) problems.push(`Challenge "${c.id}": unknown achievement ${c.unlock.achievement}`);
    const rules = c.rules;
    if (rules?.maxParty != null && (rules.maxParty < 1 || rules.maxParty > 4)) problems.push(`Challenge "${c.id}": party size must be 1–4`);
    if (rules?.minStartLevel != null && rules.minStartLevel < 1) problems.push(`Challenge "${c.id}": start level must be 1+`);
  }
  return problems;
}
