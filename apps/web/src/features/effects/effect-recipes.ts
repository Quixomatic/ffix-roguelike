/**
 * Effect recipes that are code, not gallery assignments: plain attacks by weapon type and the defaults for FF9
 * monster moves nobody has assigned. Pure data (no Phaser) so build scripts can list the files the game uses
 * (`usedEffectPaths` → e.g. which sounds to download).
 */
import type { FF9EnemyAction } from "@ffix-roguelike/game-data";

import effectMap from "./ability-effects.json";

export type Recipe = Record<string, string>;
export const MAP = (effectMap as { abilities: Record<string, { phases: Recipe }> }).abilities;

/** Battle action ids for FF9 monster attacks start here (game-core FF9_ACTION_BASE). */
export const FF9_ACTION_BASE = 2000;

/** Battle action ids of the plain Attack command: the party's (FF9 action 176) and monsters' (engine 1000). */
export const PARTY_ATTACK = 176;
export const MONSTER_ATTACK = 1000;

/**
 * Plain attacks play FFRK's weapon-type attack effect (FFRK's own recipes, from captured party data: an empty
 * launch, a 0.65 s gap while the character swings, then the slash). FF9 weapons are per character, so by hero.
 */
export const weapon = (id: number, launch = false, shot = false): Recipe => ({
  launch: launch ? `ab/ability/${id}/${id}_launch.json` : "ab/ability/common/launch_empty.json",
  shot: shot ? `ab/ability/${id}/${id}_shot.json` : "ab/ability/common/shot_empty.json",
  hit: `ab/ability/${id}/${id}_hit.json`,
});
export const WEAPON_EFFECTS: Record<string, Recipe> = {
  zidane: weapon(30004), // dagger
  steiner: weapon(30003), // sword
  beatrix: weapon(30003),
  blank: weapon(30003),
  marcus: weapon(30003),
  freya: weapon(30044), // spear
  quina: weapon(30044), // forks ≈ spear
  amarant: weapon(30054), // claws = FFRK fist
  garnet: weapon(30064, true), // rod
  vivi: weapon(30074, true), // staff
  eiko: weapon(30093, false, true), // flute = FFRK instrument (a flying note)
};
/** Monsters' plain attack: FFRK's claw swipe (enemy "Cat Scratch"). */
export const MONSTER_WEAPON = weapon(30051);

// ---------- defaults for monster moves without an assignment ----------

const LAUNCH = { none: "ab/ability/common/launch_empty.json", black: "ab/ability/common/launch_black.json", white: "ab/ability/common/launch_white.json", blue: "ab/ability/common/launch_blue.json" };
const fx = (hit: string, launch = LAUNCH.none, shot = "ab/ability/common/shot_empty.json"): Recipe => ({ launch, shot, hit });
/** FFRK effects used as defaults (recipes from captured game data; see effects/catalog.json). */
const D = {
  claw: fx("ab/ability/30051/30051_hit.json"), // Cat Scratch
  bite: fx("ab/ability/50220/50220_hit.json", LAUNCH.blue), // Bite
  fire: fx("ab/ability/11001/11001_hit.json", LAUNCH.black), // Fira
  ice: fx("ab/ability/12001/12001_hit.json", LAUNCH.black), // Blizzara
  thunder: fx("ab/ability/13001/13001_hit.json", LAUNCH.black), // Thundara
  wind: fx("ab/ability/50889/hit.json", LAUNCH.blue), // Aerospark
  earth: fx("ab/ability/33052/hit.json", "ab/ability/61670/launch.json", "ab/ability/33052/shot.json"), // Quake
  holy: fx("ab/ability/33077/hit.json", "ab/ability/61760/launch.json", "ab/ability/common/shot_empty_fast.json"), // Holy
  dark: fx("ab/ability/31029/31029_hit.json", LAUNCH.black), // Dark Buster
  fireStrike: fx("ab/ability/31001/31001_hit.json"), // Fire Strike
  thunderStrike: fx("ab/ability/31009/31009_hit.json"), // Thunder Strike
  venom: fx("ab/ability/31032/31032_hit.json", LAUNCH.blue), // Venom Buster
  status: fx("ab/ability/20302/20302_hit.json", LAUNCH.blue), // Eye Drops' sparkle
  heal: fx("ab/ability/20007/20007_hit.json", LAUNCH.white), // Curaga
  protect: fx("ab/ability/20509/20509_hit.json", LAUNCH.white),
  shell: fx("ab/ability/20517/20517_hit.json", LAUNCH.white),
  berserk: fx("ab/ability/20514/20514_hit.json", LAUNCH.white),
  haste: fx("ab/ability/33013/hit.json", "ab/ability/61760/skill_3_launch.json", "ab/ability/common/shot_empty_fast.json"),
  meteor: fx("ab/ability/40164/hit.json", "ab/ability/40164/launch.json"), // Meteor Crush
};
const MAGIC_BY_ELEMENT: Record<string, Recipe> = { fire: D.fire, ice: D.ice, thunder: D.thunder, water: D.ice, wind: D.wind, earth: D.earth, holy: D.holy, shadow: D.dark };
const PHYSICAL_BY_ELEMENT: Record<string, Recipe> = { fire: D.fireStrike, thunder: D.thunderStrike, shadow: D.dark };

/**
 * A default effect for an FF9 monster move nobody has assigned yet, from what the move is (FF9 battle script id,
 * category and element): physical hits swipe (or bite), elemental magic plays FFRK's matching spell, heals sparkle,
 * buffs and statuses play their FFRK spell, drains go dark. Script 64 moves are staging (taunts, phase changes) — none.
 */
export function monsterDefault(a: FF9EnemyAction | undefined): Recipe | null {
  if (!a || a.scriptId === 64) return null;
  const el = a.elements[0];
  const st = new Set<string>(a.statuses);
  if (a.scriptId === 10) return D.heal;
  if (a.scriptId === 15 || a.scriptId === 16) return D.dark; // drain / osmose
  if (a.scriptId === 18) return D.meteor; // Comet, Meteor
  if (a.scriptId === 11 || a.scriptId === 12 || a.scriptId === 103) {
    if (st.has("protect")) return D.protect;
    if (st.has("shell")) return D.shell;
    if (st.has("haste")) return D.haste;
    if (st.has("berserk")) return D.berserk;
    if (st.has("poison") || st.has("venom")) return D.venom;
    return (el && MAGIC_BY_ELEMENT[el]) || D.status;
  }
  const physical = (a.category & 8) !== 0 || a.scriptId === 8 || a.scriptId === 100;
  if (physical) return (el && PHYSICAL_BY_ELEMENT[el]) || (/bite|fang|chomp|jaw|devour/i.test(a.name) ? D.bite : D.claw);
  if (el && MAGIC_BY_ELEMENT[el]) return MAGIC_BY_ELEMENT[el];
  if ((a.category & 16) !== 0) return D.status;
  return D.claw;
}

/** Every effect file the game can play: gallery assignments, weapon attacks and the monster defaults. */
export function usedEffectPaths(): string[] {
  const recipes = [...Object.values(MAP).map((a) => a.phases), ...Object.values(WEAPON_EFFECTS), MONSTER_WEAPON, ...Object.values(D)];
  return [...new Set(recipes.flatMap((r) => Object.values(r)))].sort();
}
