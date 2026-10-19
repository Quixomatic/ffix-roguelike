/**
 * Relics, party synergies and character tags (`.plans/relics-and-synergies.md`): the run-power layer over the FF9 rules.
 * Like the reward tables they're our own design, stored in Postgres (relic, synergy, character_tag; seeded from
 * packages/db/seed/rewards), edited on the admin page and registered with the reward tables.
 *
 * Relics and synergies are data: each one lists **effects**, a fixed vocabulary of primitives that game-core
 * implements (battle/modifiers.ts), with the numbers here. A new relic needs code only if it needs a new primitive.
 */
import type { RarityId } from "./rewards";
import type { Status } from "./types";

/** Battle stats a `stat` effect can raise (by percent). Max HP / MP come later, through builds like boons. */
export const MODIFIER_STATS = ["strength", "magic", "spirit", "speed", "attack", "defence", "magicDefence", "evade", "magicEvade"] as const;
export type ModifierStat = (typeof MODIFIER_STATS)[number];

/** Who an effect applies to: the whole party (default), party members with a tag, or one character. */
export type ModifierScope = { kind: "party" } | { kind: "tag"; tag: string } | { kind: "character"; character: string };

/** One effect primitive with its numbers. */
export type ModifierEffect =
  /** +pct% to a battle stat. */
  | { kind: "stat"; stat: ModifierStat; pct: number; scope?: ModifierScope }
  /** Starts every battle with a status (Protect, Haste, Regen…). */
  | { kind: "startStatus"; status: Status; scope?: ModifierScope }
  /** The Trance gauge starts each battle at least this full (percent). */
  | { kind: "trance"; startPct: number; scope?: ModifierScope }
  /** Steal chances +pct% (per item slot, capped at certain). */
  | { kind: "steal"; ratePct: number; scope?: ModifierScope }
  /** Abilities cost pct% less MP. */
  | { kind: "mpDiscount"; pct: number; scope?: ModifierScope }
  /** Defeating an enemy restores this percent of the attacker's max HP / MP. */
  | { kind: "onKill"; hpPct?: number; mpPct?: number; scope?: ModifierScope };
export type ModifierKind = ModifierEffect["kind"];
export const MODIFIER_KINDS = ["stat", "startStatus", "trance", "steal", "mpDiscount", "onKill"] as const satisfies readonly ModifierKind[];

/** A relic (the `relic` table). */
export interface RelicData {
  id: string;
  name: string;
  description: string;
  /** A line of FF9-flavoured text for the collection page. */
  flavor?: string;
  rarity: RarityId;
  /** Power with a real downside. */
  cursed?: boolean;
  /** Can be picked as the starting relic on the embark page (once unlocked). */
  starter?: boolean;
  /** Unlocked for everyone from the start. */
  free?: boolean;
  /**
   * The achievement that unlocks it (an achievement id): earning it adds the relic to the collection, and players who
   * already have it get it at once. Neither `free` nor `unlockedBy`: only other sources (player_profile.relicsUnlocked).
   */
  unlockedBy?: string;
  /** Its icon: a badge number in the achievement badge set. */
  badge?: number;
  effects: ModifierEffect[];
  /** Offer weight among relics of its rarity. */
  weight: number;
  /** Lowest difficulty tier it's offered in. */
  minTier: number;
  /** Order on the collection page (its number, No. 001…). */
  sort: number;
  enabled: boolean;
  notes?: string;
}

/** A party synergy (the `synergy` table): with `count`+ active party members sharing `tag`, that tier's effects apply. */
export interface SynergyData {
  id: string;
  name: string;
  tag: string;
  description?: string;
  badge?: number;
  /** Thresholds, lowest first; only the highest reached applies. */
  tiers: { count: number; text: string; effects: ModifierEffect[] }[];
  enabled: boolean;
}

/** A character's synergy tags (the `character_tag` table). */
export interface CharacterTags {
  character: string;
  tags: string[];
}

/** Relic slots every run has; achievements add more (`reward.relicSlots`). */
export const BASE_RELIC_SLOTS = 3;
