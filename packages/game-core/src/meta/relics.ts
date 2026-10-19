/**
 * The player's relic collection (`.plans/relics-and-synergies.md` §3): which relics are unlocked, which can start a run,
 * and how many relic slots runs get. Relics themselves are data (game-data `relicTable`).
 */
import { achievementTable, BASE_RELIC_SLOTS, relicTable, type RelicData } from "@ffix-roguelike/game-data";

import type { Profile } from "./profile";

/**
 * Unlocked: free for everyone, unlocked by an achievement the player has (so earning it, or having earned it before the
 * relic existed, both count), or listed in the profile by some other source.
 */
export function relicUnlocked(p: Pick<Profile, "achievements" | "relicsUnlocked">, r: RelicData): boolean {
  return !!r.free || (!!r.unlockedBy && (p.achievements ?? []).includes(r.unlockedBy)) || (p.relicsUnlocked ?? []).includes(r.id);
}

/** The player's unlocked relics, in collection order. */
export const unlockedRelics = (p: Pick<Profile, "achievements" | "relicsUnlocked">): RelicData[] => relicTable().filter((r) => relicUnlocked(p, r));

/** Relics the player can pick to start a run with (unlocked and flagged `starter`). */
export const starterRelics = (p: Pick<Profile, "achievements" | "relicsUnlocked">): RelicData[] => unlockedRelics(p).filter((r) => r.starter);

/** Relic slots a run gets: the base three plus every earned achievement's `reward.relicSlots`. */
export function relicSlotCount(p: Pick<Profile, "achievements">): number {
  const earned = new Set(p.achievements ?? []);
  return BASE_RELIC_SLOTS + achievementTable().reduce((n, a) => n + (earned.has(a.id) ? (a.reward.relicSlots ?? 0) : 0), 0);
}
