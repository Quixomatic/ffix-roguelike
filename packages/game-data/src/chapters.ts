/**
 * Chapters (`.plans/chapters.md`): what a run plays. A chapter is an ordered list of journeys (game-core JOURNEYS)
 * played as one seamless run, their maps end to end. A chapter of one journey *is* that journey, and shows as it.
 * Our own design, in Postgres (the `chapter` table, seeded from packages/db/seed/rewards/chapters.json), grouped on
 * the admin page: never chosen by players, so they can't chain journeys to over-level early on.
 */

/** Journey / chapter categories, as game-core's JourneyDef has them. */
export type ChapterCategory = "story" | "echoes" | "hidden" | "challenge";

export interface ChapterData {
  id: string;
  /** Journey ids, in order; each one's `unlockAfter` is the one before it, so the run unlocks them on the way. */
  journeys: string[];
  /** Display name and subtitle. Omitted for a one-journey chapter: it shows as its journey. */
  name?: string;
  subtitle?: string;
  /**
   * `challenge` for challenge runs (Disc 1, The Whole Story…), which overlap the other chapters. Otherwise omitted:
   * the chapter takes its journeys' category.
   */
  category?: "challenge";
  /** Order on the Story / Challenges pages. */
  sort: number;
  enabled: boolean;
  notes?: string;
}
