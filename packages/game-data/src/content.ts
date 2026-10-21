/**
 * The game's content: areas (maps) and journeys, in Postgres (`.plans/content-db.md`): the `area` and `journey`
 * tables, seeded from packages/db/seed/rewards (areas.json, journeys.json) like the reward tables, loaded into the
 * same registry (`rewardTables().areas` / `.journeys`) and read by game-core (`WORLDS`, `JOURNEYS`, which follow it).
 */

/** One area: an overworld map — its look, fights, boss, shops and shape. */
export interface AreaData {
  id: string;
  /** Permanent number (saved runs hold it). Areas are numbered 0, 1, 2… with no gaps; a new area takes the next. */
  index: number;
  enabled: boolean;
  /**
   * Progression tier, 0–5 (0 Disc 1 early, 1 Disc 1 late, 2 Disc 2, 3 Disc 3, 4 Disc 4, 5 post-game): gates the camp
   * catalog, supplies, events and specials, not loot. Tables keyed by it treat their last row as "and later".
   */
  tier: number;
  name: string;
  subtitle: string;
  /** The look: the overworld's terrain and colours and the battle background (a map theme's id). */
  theme: string;
  /** Normal encounter groups: enemy ids, or an FF9 battle scene ("@EF_R004") whose spawn pattern is rolled like FF9. */
  encounters: string[][];
  /** Elite ("fortress") encounters. */
  elites: string[][];
  /** Optional semi-boss fortress at the middle of the map (every path passes it). */
  semiBoss?: string[];
  /** Stages per round on this area's map, start to boss (the default shape when unset). */
  mapShape?: number[];
  boss: string[];
  /** Gear price band rewards are drawn from (FF9 shop prices as a power proxy). */
  gearPrice: [number, number];
  /** FF9 equipment shops (ShopItems.csv ids) whose stock appears here, in story order. */
  shops: number[];
  /** FF9 general item stores mixed into every shop for consumables. */
  itemStores: number[];
  /** Highest FF9 synthesis shop (32–39) whose recipes are available here. */
  synthTier: number;
  notes?: string;
}

/** One journey: areas played in order as a run; the last area's boss ends it. */
export interface JourneyData {
  id: string;
  /** Order on the page (and in the unlock chain's listing). */
  sort: number;
  enabled: boolean;
  name: string;
  subtitle: string;
  category: "story" | "echoes" | "hidden" | "challenge";
  /** Area ids visited in order. */
  areas: string[];
  /** Journey that must be cleared first (null = open from the start). */
  unlockAfter: string | null;
  /** Characters who join the roster the first time it's cleared. */
  unlocks?: string[];
  notes?: string;
}
