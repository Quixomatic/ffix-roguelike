/**
 * FFRK effects for battle actions. A move's effect is a recipe of FFRK rig files per phase (from the effects gallery,
 * `ability-effects.json`): **launch** on the caster, **shot** from the caster to the target, **hit** on every
 * target — chained the way FFRK's client does it, each phase starting at the previous one's `action_next` frame. The
 * hit's own `action_next` is the impact, when damage numbers should appear.
 */
import type Phaser from "phaser";

import effectMap from "./ability-effects.json";
import { FfrkEffectPlayer, loadEffect, type EffectAsset } from "./ffrk-effect";

type Recipe = Record<string, string>;
const MAP = (effectMap as { abilities: Record<string, { phases: Recipe }> }).abilities;

/** Battle action ids for FF9 monster attacks start here (game-core FF9_ACTION_BASE). */
const FF9_ACTION_BASE = 2000;

/** The effect recipe for a battle action (party abilities "a:<id>", FF9 monster attacks "e:<index>"). */
export function recipeFor(actionId: number | undefined): Recipe | null {
  if (actionId == null) return null;
  const key = actionId >= FF9_ACTION_BASE ? `e:${actionId - FF9_ACTION_BASE}` : `a:${actionId}`;
  return MAP[key]?.phases ?? null;
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
export function preloadEffects(scene: Phaser.Scene, actionIds: Iterable<number>) {
  const paths = new Set<string>();
  for (const id of actionIds) {
    const r = recipeFor(id);
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
export function playActionEffect(scene: Phaser.Scene, actionId: number | undefined, at: PlayAt): number | null {
  const recipe = recipeFor(actionId);
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
  const tHit = leadMs(hitA) / speed;

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
