/**
 * Achievements. Each has a condition checked against the profile when a run ends, and a reward granted once.
 * Most pay banked gil and/or Completion Points; only the legendary achievements award gear — every character's
 * best-in-slot FF9 items. Awarding gear *unlocks* it into run drop pools (it never drops before that).
 */
import { gameDataVersion, itemByName, items, MAIN_CAST } from "@ffix-roguelike/game-data";

import { canEquip, gearScore, isMastered } from "../stats";
import type { Profile } from "./profile";

export type AchievementCategory = "story" | "milestone" | "boss" | "challenge" | "legend";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  reward: {
    gil?: number;
    /** Completion Points for every unlocked character (or only `cpFor`). */
    cp?: number;
    cpFor?: string;
    items?: string[];
    /** A hero's best-in-slot armour, computed from FF9's item table when needed. */
    bestInSlotFor?: string;
    /** Camp supplies this unlocks (item names) — they can then be ranked up to start every run with more. */
    supplies?: string[];
  };
  /** Hidden until earned (shown as ???). */
  secret?: boolean;
  check(p: Profile): boolean;
  /** For achievements that count toward a number: how far along the profile is (`have` of `need`). */
  progress?(p: Profile): { have: number; need: number };
}

const count = (have: number, need: number) => ({ have: Math.min(have, need), need });
const MAIN_HEROES = ["zidane", "vivi", "garnet", "steiner", "freya", "quina", "eiko", "amarant"];
const SUPERBOSSES = ["soulcage", "deathguise", "kuja", "hades", "ozma", "necron"];

const kills = (p: Profile, id: string) => (p.stats.bossKills[id] ?? 0) > 0;
const cleared = (p: Profile, journey: string) => p.journeysCleared?.includes(journey) ?? false;
const solo = (p: Profile, key: string) => p.stats.soloWins?.includes(key) ?? false;
const masteredCount = (p: Profile) =>
  Object.values(p.builds).reduce((n, b) => n + Object.keys(b.ap).filter((ref) => isMastered(b, ref as never)).length, 0);

const SOLO_HEROES: [string, string][] = [
  ["zidane", "Zidane"],
  ["vivi", "Vivi"],
  ["steiner", "Steiner"],
  ["garnet", "Garnet"],
  ["freya", "Freya"],
  ["quina", "Quina"],
  ["eiko", "Eiko"],
  ["amarant", "Amarant"],
];

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

const legendClear = (p: Profile, key: string) => p.stats.legendClears?.includes(key) ?? false;
/** "zidane" → "Zidane" (the eight main heroes' names are their keys). */
const heroName = (key: string) => key[0]!.toUpperCase() + key.slice(1);

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── story: clearing FF9's journeys (they also open camp supplies, roughly when FF9's shops start selling them) ──
  { id: "story-evil-forest", name: "Out of the Forest", description: "Clear The Evil Forest", category: "story", reward: { gil: 1000, supplies: ["Hi-Potion", "Soft"] }, check: (p) => cleared(p, "evil-forest") },
  { id: "story-ice-cavern", name: "Through the Ice", description: "Clear The Ice Cavern", category: "story", reward: { gil: 1500, supplies: ["Magic Tag", "Vaccine"] }, check: (p) => cleared(p, "ice-cavern") },
  { id: "story-dali", name: "The Secret Under Dali", description: "Clear Dali", category: "story", reward: { gil: 2000, supplies: ["Tent", "Annoyntment"] }, check: (p) => cleared(p, "dali") },
  { id: "story-lindblum", name: "Hunter's Chance", description: "Clear Lindblum", category: "story", reward: { gil: 3000, supplies: ["Ether"] }, check: (p) => cleared(p, "lindblum") },
  { id: "story-gizamaluke", name: "The Bell Tolls", description: "Clear Gizamaluke's Grotto", category: "story", reward: { gil: 4000, cp: 3 }, check: (p) => cleared(p, "gizamaluke") },

  // ── milestones ──
  { id: "first-victory", name: "First Blood", description: "Win a battle", category: "milestone", reward: { gil: 300 }, check: (p) => p.stats.battles >= 1 },
  { id: "first-run", name: "The Journey Begins", description: "Finish a run", category: "milestone", reward: { gil: 500, cp: 2 }, check: (p) => p.stats.runs >= 1 },
  { id: "first-win", name: "Triumph", description: "Win a run", category: "milestone", reward: { gil: 2000, cp: 3, supplies: ["Remedy"] }, check: (p) => p.stats.wins >= 1 },
  {
    id: "veteran",
    name: "Veteran",
    description: "Win 100 battles",
    category: "milestone",
    reward: { gil: 5000, cp: 5 },
    check: (p) => p.stats.battles >= 100,
    progress: (p) => count(p.stats.battles, 100),
  },
  {
    id: "fellowship",
    name: "Fellowship",
    description: "Have 4 characters on your roster",
    category: "milestone",
    reward: { gil: 2000, cp: 3 },
    check: (p) => p.unlocked.length >= 4,
    progress: (p) => count(p.unlocked.length, 4),
  },
  {
    id: "all-together",
    name: "All Together Now",
    description: "Unlock all eight heroes",
    category: "milestone",
    reward: { gil: 10000, cp: 10 },
    check: (p) => MAIN_HEROES.every((k) => p.unlocked.includes(k)),
    progress: (p) => count(MAIN_HEROES.filter((k) => p.unlocked.includes(k)).length, MAIN_HEROES.length),
  },
  {
    id: "studious",
    name: "Studious",
    description: "Learn 10 abilities across your roster",
    category: "milestone",
    reward: { gil: 2000, cp: 3 },
    check: (p) => masteredCount(p) >= 10,
    progress: (p) => count(masteredCount(p), 10),
  },
  {
    id: "scholar",
    name: "Scholar",
    description: "Learn 50 abilities across your roster",
    category: "milestone",
    reward: { gil: 8000, cp: 8 },
    check: (p) => masteredCount(p) >= 50,
    progress: (p) => count(masteredCount(p), 50),
  },
  {
    id: "master-thief",
    name: "Master Thief",
    description: "Steal 25 items",
    category: "milestone",
    reward: { gil: 4000 },
    check: (p) => p.stats.steals >= 25,
    progress: (p) => count(p.stats.steals, 25),
  },
  {
    id: "gourmand",
    name: "Gourmand",
    description: "Eat 10 monsters with Quina",
    category: "milestone",
    reward: { gil: 3000, cp: 3 },
    check: (p) => p.stats.eaten >= 10,
    progress: (p) => count(p.stats.eaten, 10),
  },

  // ── bosses ──
  { id: "boss-garland", name: "Light of Cornelia", description: "Defeat Garland", category: "boss", reward: { gil: 1500, cp: 3 }, check: (p) => kills(p, "garland") },
  { id: "boss-golbez", name: "Red Wings Grounded", description: "Defeat Golbez", category: "boss", reward: { gil: 4000, cp: 5 }, check: (p) => kills(p, "golbez") },
  { id: "boss-kefka", name: "The Light Returns", description: "Defeat Kefka and win a run", category: "boss", reward: { gil: 10000, cp: 10 }, check: (p) => kills(p, "kefka") },

  // ── challenges ──
  ...SOLO_HEROES.map(
    ([key, name]): AchievementDef => ({
      id: `solo-${key}`,
      name: `${name} Alone`,
      description: `Clear a late-game journey with ${name} as your only party member (+25 CP for ${name})`,
      category: "challenge",
      reward: { gil: 8000, cp: 25, cpFor: key },
      check: (p) => solo(p, key),
    }),
  ),
  { id: "tier-1", name: "Tougher Stuff", description: "Win a run on Tier 1", category: "challenge", reward: { gil: 6000, cp: 8 }, check: (p) => p.stats.highestTierWon >= 1 },
  {
    id: "tier-3",
    name: "Iron Will",
    description: "Win a run on Tier 3",
    category: "challenge",
    reward: { gil: 15000, cp: 15, supplies: ["Elixir"] },
    check: (p) => p.stats.highestTierWon >= 3,
    progress: (p) => count(p.stats.highestTierWon, 3),
  },
  {
    id: "tier-5",
    name: "Unbreakable",
    description: "Win a run on Tier 5",
    category: "challenge",
    reward: { gil: 30000, cp: 25 },
    check: (p) => p.stats.highestTierWon >= 5,
    progress: (p) => count(p.stats.highestTierWon, 5),
  },

  // ── legends (Terra & Memoria superbosses — the ultimate weapons) ──
  { id: "legend-soulcage", name: "Roots of the Tree", description: "Defeat Soulcage at the Iifa Tree", category: "legend", reward: { items: ["Gastro Fork"] }, secret: true, check: (p) => kills(p, "soulcage") },
  { id: "legend-deathguise", name: "Death's Disguise", description: "Defeat Deathguise", category: "legend", reward: { items: ["Dragon's Hair"] }, secret: true, check: (p) => kills(p, "deathguise") },
  { id: "legend-kuja", name: "Angel of Death", description: "Defeat Trance Kuja", category: "legend", reward: { items: ["Rune Claws"] }, secret: true, check: (p) => kills(p, "kuja") },
  { id: "legend-hades", name: "The Underworld's Smith", description: "Defeat Hades", category: "legend", reward: { items: ["Mace of Zeus"] }, secret: true, check: (p) => kills(p, "hades") },
  { id: "legend-ozma", name: "Beyond the Sphere", description: "Defeat Ozma", category: "legend", reward: { items: ["Ultima Weapon"] }, secret: true, check: (p) => kills(p, "ozma") },
  { id: "legend-necron", name: "Eternal Darkness", description: "Defeat Necron and clear Terra & Memoria", category: "legend", reward: { items: ["Excalibur II"] }, secret: true, check: (p) => kills(p, "necron") },
  ...MAIN_CAST.map(
    (key): AchievementDef => ({
      id: `legend-set-${key}`,
      name: `Legend of ${heroName(key)}`,
      description: `Clear Terra & Memoria with ${heroName(key)} in the party — awards their best-in-slot armour`,
      category: "legend",
      reward: { bestInSlotFor: key },
      secret: true,
      check: (p) => legendClear(p, key),
    }),
  ),
  {
    id: "legend-all",
    name: "Final Fantasy",
    description: "Defeat every superboss",
    category: "legend",
    reward: { items: ["Whale Whisker", "Tiger Racket"] },
    secret: true,
    check: (p) => SUPERBOSSES.every((b) => kills(p, b)),
    progress: (p) => count(SUPERBOSSES.filter((b) => kills(p, b)).length, SUPERBOSSES.length),
  },
];

/** Gear that only achievements award — excluded from drops, shops, treasure and Stiltzkin. */
export function legendaryItems(): Set<number> {
  if (legendaryFor !== gameDataVersion) {
    legendary = new Set(ACHIEVEMENTS.flatMap(rewardItemIds));
    legendaryFor = gameDataVersion;
  }
  return legendary;
}
let legendary = new Set<number>();
let legendaryFor = -1;

export function rewardItemIds(a: AchievementDef): number[] {
  return [...(a.reward.items ?? []).map((name) => itemByName(name).id), ...(a.reward.bestInSlotFor ? bestInSlot(a.reward.bestInSlotFor) : [])];
}

/** Check every achievement not yet earned; grant rewards for new ones (mutates `p`). Returns the new ids. */
export function awardAchievements(p: Profile): string[] {
  const earned = new Set(p.achievements ?? []);
  const fresh: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned.has(a.id) || !a.check(p)) continue;
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

export function achievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
