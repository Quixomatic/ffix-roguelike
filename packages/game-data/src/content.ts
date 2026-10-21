/**
 * The game's content in Postgres (`.plans/content-db.md`): areas (maps), story journeys, challenges and their
 * categories — the `area`, `journey`, `challenge` and `challenge_category` tables, seeded from packages/db/seed/rewards
 * like the reward tables, loaded into the same registry (`rewardTables().areas` …) and read by game-core (`WORLDS`,
 * `JOURNEYS`, routes).
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

/** One story journey: areas played in order as a run; the last area's boss ends it. */
export interface JourneyData {
  id: string;
  /** Order on the Story page and in the unlock chain. */
  sort: number;
  enabled: boolean;
  name: string;
  subtitle: string;
  /** Area ids visited in order. */
  areas: string[];
  /** Journey that must be cleared first (null = open from the start). */
  unlockAfter: string | null;
  /** Characters who join the roster the first time it's cleared. */
  unlocks?: string[];
  notes?: string;
}

/** A section of the Challenges page: side journeys, hidden bosses, boss gauntlets, story runs… */
export interface ChallengeCategoryData {
  id: string;
  /** Order of the sections. */
  sort: number;
  enabled: boolean;
  name: string;
  description?: string;
}

/**
 * What a challenge plays:
 * - `areas`: its own maps, in order (a one-off: a side journey, a hidden boss, a gauntlet);
 * - `group`: a journey grouping's journeys end to end (Disc 1, The Whole Story);
 * - `journey`: one story journey (with the challenge's own rules).
 */
export type ChallengeRoute = { kind: "areas"; areas: string[] } | { kind: "group"; group: string } | { kind: "journey"; journey: string };

/** What opens a challenge: every condition given must hold; none at all = open from the start. */
export interface ChallengeUnlock {
  /** Journeys or challenges to have cleared (ids). */
  cleared?: string[];
  /** Every journey the challenge plays cleared first (for grouping challenges). */
  allJourneys?: boolean;
  /** An achievement to have earned. */
  achievement?: string;
}

/** Limits on how a challenge is started. */
export interface ChallengeRules {
  /** Every party member's start level at least this. */
  minStartLevel?: number;
  /** At most this many in the party (1 = solo). */
  maxParty?: number;
}

/** One challenge: anything on the Challenges page. Its rewards are its achievements'. */
export interface ChallengeData {
  /** Never a story journey's id. It may be the id of the grouping it plays. Clears are recorded under it. */
  id: string;
  /** Order within its category. */
  sort: number;
  enabled: boolean;
  name: string;
  subtitle: string;
  /** A `ChallengeCategoryData` id. */
  category: string;
  route: ChallengeRoute;
  unlock: ChallengeUnlock;
  rules?: ChallengeRules;
  notes?: string;
}
