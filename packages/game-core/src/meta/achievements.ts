/**
 * Achievements. Their definitions are data — the `achievement` table (seeded from packages/db/seed/rewards, edited on
 * the admin page), loaded with the reward tables — and each one's condition is checked against the profile when a run
 * ends, its reward granted once. Most pay banked gil and/or Completion Points; only the legendary achievements award
 * gear — every character's best-in-slot FF9 items. Awarding gear *unlocks* it into run drop pools (it never drops
 * before that).
 */
import {
  achievementTable,
  gameDataVersion,
  itemByName,
  items,
  rewardTablesVersion,
  type AchievementCategory,
  type AchievementCondition,
  type AchievementData,
} from "@ffix-roguelike/game-data";

import { bagValue, parseBagKey } from "../metrics/collect";
import { canEquip, gearScore, isMastered } from "../stats";
import type { Profile } from "./profile";

export type { AchievementCategory, AchievementCondition };
/** An achievement definition (the `achievement` table's record). */
export type AchievementDef = AchievementData;

/** Every enabled achievement, by category then order (the `achievement` table). */
export const achievements = (): AchievementDef[] => achievementTable();

export function achievement(id: string): AchievementDef | undefined {
  return achievements().find((a) => a.id === id);
}

const kills = (p: Profile, id: string) => (p.stats.bossKills[id] ?? 0) > 0;

/**
 * A `metric` condition's current value: the player's total, the best of any one character (`"any"`), or one
 * character's — overall or for one subject.
 */
function metricValue(p: Profile, c: Extract<AchievementCondition, { kind: "metric" }>): number {
  const bag = p.metrics ?? {};
  if (c.character !== "any") return bagValue(bag, c.metric, { subject: c.subject, character: c.character });
  let best = 0;
  for (const [k, v] of Object.entries(bag)) {
    const e = parseBagKey(k);
    if (e.key === c.metric && e.subject === (c.subject ?? "") && e.character) best = Math.max(best, v);
  }
  return best;
}
const masteredCount = (p: Profile) =>
  Object.values(p.builds).reduce((n, b) => n + Object.keys(b.ap).filter((ref) => isMastered(b, ref as never)).length, 0);

/** Whether the profile meets an achievement's condition. */
export function achievementMet(a: AchievementDef, p: Profile): boolean {
  const c = a.condition;
  switch (c.kind) {
    case "stat":
      return (p.stats[c.stat] ?? 0) >= c.min;
    // A journey or a challenge: one with its own maps clears under its id (journeysCleared); one that plays a grouping
    // or a journey records its win under its id (groupsCleared).
    case "journey":
      return (p.journeysCleared?.includes(c.journey) || p.groupsCleared?.includes(c.journey)) ?? false;
    case "group":
      return p.groupsCleared?.includes(c.group) ?? false;
    case "bosses":
      return c.bosses.length > 0 && c.bosses.every((b) => kills(p, b));
    case "roster":
      return p.unlocked.length >= c.min;
    case "heroes":
      return c.heroes.length > 0 && c.heroes.every((k) => p.unlocked.includes(k));
    case "mastered":
      return masteredCount(p) >= c.min;
    case "solo":
      return p.stats.soloWins?.includes(c.hero) ?? false;
    case "legendClear":
      return p.stats.legendClears?.includes(c.hero) ?? false;
    case "metric":
      return metricValue(p, c) >= c.min;
  }
}

/**
 * How far along an achievement that counts toward a number is (`have` of `need`), for its progress bar; null for
 * yes / no conditions (a journey, one boss, a solo clear) and counts of one.
 */
export function achievementProgress(a: AchievementDef, p: Profile): { have: number; need: number } | null {
  const c = a.condition;
  const count = (have: number, need: number) => (need > 1 ? { have: Math.min(have, need), need } : null);
  switch (c.kind) {
    case "stat":
      return count(p.stats[c.stat] ?? 0, c.min);
    case "roster":
      return count(p.unlocked.length, c.min);
    case "mastered":
      return count(masteredCount(p), c.min);
    case "bosses":
      return count(c.bosses.filter((b) => kills(p, b)).length, c.bosses.length);
    case "heroes":
      return count(c.heroes.filter((k) => p.unlocked.includes(k)).length, c.heroes.length);
    case "metric":
      return count(metricValue(p, c), c.min);
    default:
      return null;
  }
}

/** A character's best-in-slot armour (head, arm, body, accessory) from FF9's item table. */
export function bestInSlot(key: string): number[] {
  return (["head", "wrist", "armor", "accessory"] as const)
    .map((slot) =>
      items
        .filter((i) => !i.effect && i.price > 0 && canEquip(key, i, slot))
        .sort((a, b) => gearScore(b) - gearScore(a))[0],
    )
    .filter((i) => !!i)
    .map((i) => i!.id);
}

/** Gear that only achievements award — excluded from drops, shops, treasure and Stiltzkin. */
export function legendaryItems(): Set<number> {
  const version = `${gameDataVersion}:${rewardTablesVersion}`;
  if (legendaryFor !== version) {
    legendary = new Set(achievements().flatMap(rewardItemIds));
    legendaryFor = version;
  }
  return legendary;
}
let legendary = new Set<number>();
let legendaryFor = "";

export function rewardItemIds(a: Pick<AchievementDef, "reward">): number[] {
  return [...(a.reward.items ?? []).map((name) => itemByName(name).id), ...(a.reward.bestInSlotFor ? bestInSlot(a.reward.bestInSlotFor) : [])];
}

/** Check every achievement not yet earned; grant rewards for new ones (mutates `p`). Returns the new ids. */
export function awardAchievements(p: Profile): string[] {
  const earned = new Set(p.achievements ?? []);
  const fresh: string[] = [];
  for (const a of achievements()) {
    if (earned.has(a.id) || !achievementMet(a, p)) continue;
    fresh.push(a.id);
    earned.add(a.id);
    p.gil += a.reward.gil ?? 0;
    if (a.reward.cp) {
      for (const key of a.reward.cpFor ? [a.reward.cpFor] : p.unlocked) {
        const b = p.builds[key];
        if (b) b.points = (b.points ?? 0) + a.reward.cp;
      }
    }
    // Gear rewards unlock the item into run drop pools (it can then show up in a run to equip).
    p.gearUnlocked = [...new Set([...(p.gearUnlocked ?? []), ...rewardItemIds(a)])];
  }
  p.achievements = [...earned];
  return fresh;
}
