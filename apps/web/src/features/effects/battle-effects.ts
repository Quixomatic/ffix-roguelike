/**
 * FFRK effects for battle actions. A move's effect is a recipe of FFRK rig files per phase (from the effects gallery,
 * `ability-effects.json`): **launch** on the caster, **shot** from the caster to the target, **hit** on every
 * target — chained the way FFRK's client does it, each phase starting at the previous one's `action_next` frame. The
 * hit's own `action_next` is the impact, when damage numbers should appear.
 */
import { bestiary, type FF9EnemyAction } from "@ffix-roguelike/game-data";
import type Phaser from "phaser";

import effectMap from "./ability-effects.json";
import { FfrkEffectPlayer, loadEffect, type EffectAsset } from "./ffrk-effect";

type Recipe = Record<string, string>;
const MAP = (effectMap as { abilities: Record<string, { phases: Recipe }> }).abilities;

/** Battle action ids for FF9 monster attacks start here (game-core FF9_ACTION_BASE). */
const FF9_ACTION_BASE = 2000;

/** Battle action ids of the plain Attack command: the party's (FF9 action 176) and monsters' (engine 1000). */
const PARTY_ATTACK = 176;
const MONSTER_ATTACK = 1000;

/**
 * Plain attacks play FFRK's weapon-type attack effect (FFRK's own recipes, from captured party data: an empty
 * launch, a 0.65 s gap while the character swings, then the slash). FF9 weapons are per character, so by hero.
 */
const weapon = (id: number, launch = false, shot = false): Recipe => ({
  launch: launch ? `ab/ability/${id}/${id}_launch.json` : "ab/ability/common/launch_empty.json",
  shot: shot ? `ab/ability/${id}/${id}_shot.json` : "ab/ability/common/shot_empty.json",
  hit: `ab/ability/${id}/${id}_hit.json`,
});
const WEAPON_EFFECTS: Record<string, Recipe> = {
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
const MONSTER_WEAPON = weapon(30051);

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
function monsterDefault(a: FF9EnemyAction | undefined): Recipe | null {
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

/**
 * The effect recipe for a battle action (party abilities "a:<id>", FF9 monster attacks "e:<index>"); plain attacks
 * use the attacker's weapon effect (`actorSprite` = the unit's sprite key, e.g. "hero/vivi").
 */
export function recipeFor(actionId: number | undefined, actorSprite?: string): Recipe | null {
  if (actionId == null) return null;
  if (actionId === PARTY_ATTACK) return WEAPON_EFFECTS[actorSprite?.split("/")[1] ?? ""] ?? weapon(30003);
  if (actionId === MONSTER_ATTACK) return MONSTER_WEAPON;
  const key = actionId >= FF9_ACTION_BASE ? `e:${actionId - FF9_ACTION_BASE}` : `a:${actionId}`;
  return MAP[key]?.phases ?? (actionId >= FF9_ACTION_BASE ? monsterDefault(bestiary.actions[actionId - FF9_ACTION_BASE]) : null);
}

/** Loaded rigs by path (null = missing), filled as loads finish so playback can be decided synchronously. */
const ready = new WeakMap<Phaser.Scene, Map<string, EffectAsset | null>>();
const readyFor = (scene: Phaser.Scene) => {
  let m = ready.get(scene);
  if (!m) ready.set(scene, (m = new Map()));
  return m;
};

const phasesOf = (recipe: Recipe) => {
  const hit = recipe.hit ?? Object.entries(recipe).find(([k]) => /^hit_\d+$/.test(k))?.[1];
  return { launch: recipe.launch, shot: recipe.shot, hit };
};

/** Start loading every effect these actions use (call when the battle starts). */
export function preloadEffects(scene: Phaser.Scene, actionIds: Iterable<number>, heroSprites: Iterable<string> = []) {
  const paths = new Set<string>();
  const recipes = [...[...actionIds].map((id) => recipeFor(id)), ...[...heroSprites].map((s) => recipeFor(PARTY_ATTACK, s))];
  for (const r of recipes) {
    if (!r) continue;
    for (const p of Object.values(phasesOf(r))) if (p) paths.add(p);
  }
  const m = readyFor(scene);
  for (const p of paths) {
    if (m.has(p)) continue;
    void loadEffect(scene, p).then((a) => m.set(p, a));
  }
}

/** Frames from a rig's start to its `action_next` (when FFRK moves on), in ms at speed 1. */
function leadMs(a: EffectAsset | null | undefined): number {
  if (!a) return 0;
  const next = a.rig.action?.find((x) => x.actionName === "action_next")?.frame ?? a.range[1];
  return (Math.max(0, next - a.range[0]) / (a.rig.fps || 60)) * 1000;
}

/**
 * When a hit visibly lands, in ms at speed 1. FFRK's hand-off frame (`action_next`) often comes before the burst
 * peaks (Fire hands off at frame 5 of 80), so the impact is the later of that frame and a third of the way in.
 */
function impactMs(a: EffectAsset | null | undefined): number {
  if (!a) return 0;
  const len = Math.max(0, a.range[1] - a.range[0]);
  return Math.max(leadMs(a), (len / 3 / (a.rig.fps || 60)) * 1000);
}

const isEmpty = (p: string | undefined) => !p || /common\/(shot|hit|launch)_empty/.test(p);

export interface PlayAt {
  from: { x: number; y: number };
  to: { x: number; y: number }[];
  /** Pixel scale (FFRK draws characters and effects at the same scale). */
  scale: number;
  speed: number;
  depth?: number;
}

/**
 * Play a battle action's effect. Returns the ms (at the given speed) until the hit lands, or null when the action
 * has no effect or its files haven't finished loading (the caller then shows results at once).
 */
export function playActionEffect(scene: Phaser.Scene, actionId: number | undefined, at: PlayAt, actorSprite?: string): number | null {
  const recipe = recipeFor(actionId, actorSprite);
  if (!recipe) return null;
  const { launch, shot, hit } = phasesOf(recipe);
  const m = readyFor(scene);
  const assets = [launch, shot, hit].filter((p): p is string => !!p).map((p) => m.get(p));
  if (assets.some((a) => a === undefined)) return null; // still loading
  const launchA = launch ? m.get(launch) : null;
  const shotA = shot ? m.get(shot) : null;
  const hitA = hit ? m.get(hit) : null;
  const speed = Math.max(0.25, at.speed);
  const opts = { scale: at.scale, speed, depth: at.depth ?? 60 };

  const tLaunch = leadMs(launchA) / speed;
  const tShot = leadMs(shotA) / speed;
  const tHit = impactMs(hitA) / speed;

  if (launchA && !isEmpty(launch)) new FfrkEffectPlayer(scene, launchA, { ...opts, x: at.from.x, y: at.from.y });
  if (shotA && !isEmpty(shot)) {
    scene.time.delayedCall(tLaunch, () => {
      const target = at.to[0] ?? at.from;
      const p = new FfrkEffectPlayer(scene, shotA, { ...opts, x: at.from.x, y: at.from.y });
      // FFRK flies the shot node from the caster to the target while the shot plays.
      scene.tweens.add({ targets: p.container, x: target.x, y: target.y, duration: Math.max(1, tShot) });
    });
  }
  if (hitA && !isEmpty(hit)) {
    scene.time.delayedCall(tLaunch + tShot, () => {
      for (const t of at.to) new FfrkEffectPlayer(scene, hitA, { ...opts, x: t.x, y: t.y });
    });
  }
  return tLaunch + tShot + tHit;
}
