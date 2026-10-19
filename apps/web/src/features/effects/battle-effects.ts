/**
 * FFRK effects for battle actions. A move's effect is a recipe of FFRK rig files per phase (from the effects gallery,
 * `ability-effects.json`): **launch** on the caster, **shot** from the caster to the target, **hit** on every
 * target — chained the way FFRK's client does it, each phase starting at the previous one's `action_next` frame. The
 * hit's own `action_next` is the impact, when damage numbers should appear.
 */
import { bestiary } from "@ffix-roguelike/game-data";
import type Phaser from "phaser";

import { FF9_ACTION_BASE, itemDefault, MAP, monsterDefault, MONSTER_ATTACK, MONSTER_WEAPON, PARTY_ATTACK, weapon, WEAPON_EFFECTS, type Recipe } from "./effect-recipes";
import { FfrkEffectPlayer, loadEffect, type EffectAsset } from "./ffrk-effect";

/**
 * The effect recipe for a battle action (party abilities "a:<id>", FF9 monster attacks "e:<index>", items "i:<item id>"
 * — an item's battle action id is minus its item id); plain attacks use the attacker's weapon effect (`actorSprite` =
 * the unit's sprite key, e.g. "hero/vivi").
 */
export function recipeFor(actionId: number | undefined, actorSprite?: string): Recipe | null {
  if (actionId == null) return null;
  if (actionId < 0) return MAP[`i:${-actionId}`]?.phases ?? itemDefault(-actionId);
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

/**
 * FFRK places characters, bosses and the status rig on them at 1.5× its stage scale (their `base_visible_nul`), but
 * ability effects at 1× (`visible_nul`). Our evaluator leaves those root nodes out, so an effect drawn at the
 * characters' pixel scale came out 1.5× too big next to them.
 */
const CHARACTER_STAGE_SCALE = 1.5;

export interface PlayAt {
  from: { x: number; y: number };
  to: { x: number; y: number }[];
  /** The characters' pixel scale (the effect is drawn at FFRK's size relative to them). */
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
  const opts = { scale: at.scale / CHARACTER_STAGE_SCALE, speed, depth: at.depth ?? 60 };

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
