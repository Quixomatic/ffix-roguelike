/**
 * Journey groupings (`.plans/journey-groups.md`): two or more journeys (game-core JOURNEYS) played as one seamless
 * run, their maps end to end. Journeys not in a grouping have no row and play as themselves. Our own design, in
 * Postgres (the `journey_group` table, seeded from packages/db/seed/rewards/journey-groups.json), set on the admin
 * page: never chosen by players, so they can't chain journeys to over-level early on. Challenge runs (Disc 1, The
 * Whole Story…) are groupings too, overlapping the others.
 */
export interface JourneyGroupData {
  /** Never a journey's id: a run names either a journey or a grouping. */
  id: string;
  /** Journey ids, in order (2+); each one's `unlockAfter` is the one before it, so the run unlocks them on the way. */
  journeys: string[];
  name: string;
  subtitle?: string;
  /** `challenge` for challenge runs, which overlap the other groupings. Otherwise omitted (a story grouping). */
  category?: "challenge";
  /** Order among the challenges. A story grouping sits where its first journey is. */
  sort: number;
  enabled: boolean;
  notes?: string;
}
