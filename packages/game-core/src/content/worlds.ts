/**
 * Areas: one overworld map each — theme, encounter tables, a semi-boss partway along, the end boss, and the loot
 * tier (gear band, FF9 shops, synthesis tier). Journeys (below) say which areas a run visits.
 *
 * Both are content in Postgres (`.plans/content-db.md`; the `area` and `journey` tables, seeded from
 * packages/db/seed/rewards/areas.json and journeys.json), loaded into game-data's registry. `WORLDS` and `JOURNEYS`
 * follow it: they're filled (in place) whenever the tables are registered — the server at boot and after admin
 * edits, the web from `content.rewards`, tests and the sim from the seed files. Empty until then.
 */
import { onRewardTables, rewardTables, type AreaData, type JourneyData } from "@ffix-roguelike/game-data";

/**
 * Area themes: the overworld's terrain and colours and the battle background (web `map/terrain.ts`, `map-scene.ts`,
 * `sprites/sprites.ts` each have a row per theme).
 */
export const MAP_THEMES = ["grassland", "forest", "castle", "ice", "cave", "marsh", "ruin", "desert", "volcano", "coast", "town", "crystal"] as const;
export type MapTheme = (typeof MAP_THEMES)[number];

/** An area as the game uses it: its row, with the theme checked against the themes the web can draw. */
export interface WorldDef extends Omit<AreaData, "enabled" | "notes" | "theme"> {
  /** Background/tileset key for the overworld and battles. */
  theme: MapTheme;
}

/**
 * Journeys — what you pick at camp. Like pokelike.xyz: a journey is a series of overworld maps (areas); each map ends
 * at a castle with a "gym leader" boss, and the last map's castle holds the journey's final boss.
 */
export type JourneyDef = Omit<JourneyData, "sort" | "enabled" | "notes">;

/** Every area, by `index` (a run's `world` is an index into it). */
export const WORLDS: WorldDef[] = [];
/** Enabled journeys, in order. */
export const JOURNEYS: JourneyDef[] = [];
/** Every journey, disabled ones too (a saved run or a clear can still name one). */
let allJourneys: JourneyDef[] = [];

function toWorld(a: AreaData): WorldDef {
  const { enabled: _e, notes: _n, ...rest } = a;
  return { ...rest, theme: a.theme as MapTheme };
}

function toJourney(j: JourneyData): JourneyDef {
  const { sort: _s, enabled: _e, notes: _n, ...rest } = j;
  return rest;
}

onRewardTables(() => {
  const t = rewardTables();
  const areas = [...(t.areas ?? [])].sort((a, b) => a.index - b.index);
  WORLDS.splice(0, WORLDS.length, ...areas.map(toWorld));
  const journeys = [...(t.journeys ?? [])].sort((a, b) => a.sort - b.sort);
  allJourneys = journeys.map(toJourney);
  JOURNEYS.splice(0, JOURNEYS.length, ...journeys.filter((j) => j.enabled).map(toJourney));
});

export function getArea(id: string): WorldDef {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown area ${id}`);
  return w;
}

export function getJourney(id: string): JourneyDef {
  const j = JOURNEYS.find((x) => x.id === id) ?? allJourneys.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown journey ${id}`);
  return j;
}

export function journeyUnlocked(id: string, cleared: readonly string[]): boolean {
  const j = getJourney(id);
  return j.unlockAfter == null || cleared.includes(j.unlockAfter);
}

/**
 * Problems with the area and journey rows (empty = fine), for the admin page's saves and the seed's test:
 * - areas are numbered 0, 1, 2… with no gaps and no repeats, ids are unique, themes are ones the web can draw;
 * - every area has a boss and at least one encounter;
 * - journeys have unique ids (an area may share one: they're looked up separately), a name, at least one area, areas that exist, and an `unlockAfter`
 *   that's a journey.
 */
export function checkContent(areas: readonly AreaData[], journeys: readonly JourneyData[]): string[] {
  const out: string[] = [];
  const byIndex = [...areas].sort((a, b) => a.index - b.index);
  byIndex.forEach((a, i) => {
    if (a.index !== i) out.push(`Area ${a.id}: number ${a.index}, but areas must be numbered 0–${areas.length - 1} with no gaps`);
  });
  const ids = new Set<string>();
  for (const a of areas) {
    if (ids.has(a.id)) out.push(`Area ${a.id} appears twice`);
    ids.add(a.id);
    if (!(MAP_THEMES as readonly string[]).includes(a.theme)) out.push(`Area ${a.id}: unknown theme "${a.theme}"`);
    if (!a.boss.length) out.push(`Area ${a.id} has no boss`);
    if (!a.encounters.length) out.push(`Area ${a.id} has no encounters`);
  }
  const journeyIds = new Set<string>();
  for (const j of journeys) {
    if (journeyIds.has(j.id)) out.push(`Journey ${j.id} appears twice`);
    journeyIds.add(j.id);
    if (!j.name.trim()) out.push(`Journey ${j.id} has no name`);
    if (!j.areas.length) out.push(`Journey ${j.id} has no areas`);
    for (const a of j.areas) if (!ids.has(a)) out.push(`Journey ${j.id}: unknown area ${a}`);
  }
  for (const j of journeys) if (j.unlockAfter != null && !journeyIds.has(j.unlockAfter)) out.push(`Journey ${j.id}: unlocks after unknown journey ${j.unlockAfter}`);
  return out;
}
