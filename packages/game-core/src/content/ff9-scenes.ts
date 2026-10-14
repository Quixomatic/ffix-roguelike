/**
 * FF9's own battle scenes as encounters. An area lists scene refs like "@EF_R004"; when a fight starts, FF9's
 * pattern roll (Rnd 0–99 against cumulative pattern rates, HonoluluBattleMain.ChoicePattern) picks which group
 * of that scene appears, and the encounter is stored as "@EF_R004#2" (scene + pattern) so rewards and replays see
 * exactly the same monsters.
 *
 * Every FF9 monster also gets an auto-generated bestiary entry ("ff9-<uid>") with its real stats, attacks,
 * steals and drops; its battle AI is the scene's own FF9 script (battle/ai), with a fallback that uses only the
 * monster's real attacks.
 */
import { bestiary, type FF9Enemy, type FF9Scene } from "@ffix-roguelike/game-data";

import type { AiRule, EnemyFamily } from "../battle/types";
import type { Rng } from "../rng";
import type { EnemyDef } from "./enemies";
import { FF9_ACTION_BASE } from "./ff9";

const sceneById = new Map(bestiary.scenes.map((s) => [s.id, s]));

export function getScene(id: string): FF9Scene {
  const s = sceneById.get(id);
  if (!s) throw new Error(`Unknown FF9 battle scene ${id}`);
  return s;
}

export const ff9EnemyId = (uid: number) => `ff9-${uid}`;
export const isSceneRef = (token: string) => token.startsWith("@");

/** FF9 category bits → our sprite/killer family. */
function familyOf(m: FF9Enemy): EnemyFamily {
  const c = m.category;
  if (c & 8) return "dragon";
  if (c & 16) return "undead";
  if (c & 32) return "stone";
  if (c & 128) return "bird";
  if (c & 64) return "bug";
  if (c & 4) return "devil";
  if (c & 2) return "beast";
  if (c & 1) return "human";
  return "amorphous";
}

/** Fallback AI (when a scene has no script): the monster's real attacks, physical ones favoured. */
function fallbackAi(m: FF9Enemy): AiRule[] {
  const rules: AiRule[] = [];
  const seen = new Set<string>();
  for (const uid of m.attacks) {
    const a = bestiary.actions[uid]!;
    // Script 64 = scripted/no-effect moves (dialogue, appear/escape animations).
    if (a.scriptId === 64 || a.name === "None" || seen.has(a.name)) continue;
    seen.add(a.name);
    const weight = a.scriptId === 8 || a.scriptId === 100 ? 3 : a.defaultAlly ? 1 : 2;
    rules.push({ actionId: FF9_ACTION_BASE + uid, weight, ...(a.defaultAlly ? { once: true } : {}) });
  }
  return rules.length ? rules : [{ actionId: 1000, weight: 1 }];
}

const defCache = new Map<number, EnemyDef>();

/** The bestiary entry for any FF9 monster. */
export function ff9EnemyDef(uid: number): EnemyDef {
  const cached = defCache.get(uid);
  if (cached) return cached;
  const m = bestiary.enemies[uid];
  if (!m) throw new Error(`Unknown FF9 monster #${uid}`);
  const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const def: EnemyDef = {
    id: ff9EnemyId(uid),
    name: m.name,
    origin: "FF9",
    family: familyOf(m),
    level: m.level,
    sprite: `${m.boss ? "boss" : "enemy"}/${slug}`,
    boss: m.boss,
    ff9: m,
    ai: fallbackAi(m),
  };
  defCache.set(uid, def);
  return def;
}

/** FF9's pattern roll: Rnd(0..99) walked against cumulative rates. */
export function rollPattern(rng: Rng, scene: FF9Scene): number {
  const r = rng.int(0, 99);
  let sum = scene.patterns[0]?.rate ?? 0;
  let i = 0;
  while (r >= sum && i + 1 < scene.patterns.length) {
    i++;
    sum += scene.patterns[i]!.rate;
  }
  return i;
}

/** A concrete encounter: the scene's group for that pattern (targetable monsters only). */
export interface SceneGroup {
  scene: string;
  pattern: number;
  /** Bestiary ids, one per monster, in spawn order. */
  enemies: string[];
  /** FF9 enemy type slot (typeNo) of each monster, for its AI script. */
  types: number[];
}

export function sceneGroup(token: string): SceneGroup {
  const [sceneId, pat] = token.slice(1).split("#");
  const scene = getScene(sceneId!);
  const pattern = Math.min(Number(pat ?? 0), scene.patterns.length - 1);
  const enemies: string[] = [];
  const types: number[] = [];
  for (const s of scene.patterns[pattern]?.spawn ?? []) {
    const uid = scene.types[s.typeNo];
    if (uid == null || uid < 0 || !s.targetable) continue;
    enemies.push(ff9EnemyId(uid));
    types.push(s.typeNo);
  }
  return { scene: scene.id, pattern, enemies, types };
}

/**
 * Roll which group of a scene appears. Small parties prefer patterns that fit (a lone hero meets small groups,
 * as the rest of the game does), re-rolling a few times before taking the smallest.
 */
export function rollSceneGroup(rng: Rng, sceneRef: string, cap: number): string {
  const scene = getScene(sceneRef.replace(/^@/, "").split("#")[0]!);
  let best: number | null = null;
  for (let i = 0; i < 6; i++) {
    const p = rollPattern(rng, scene);
    const size = sceneGroup(`@${scene.id}#${p}`).enemies.length;
    if (size > 0 && size <= cap) return `@${scene.id}#${p}`;
    if (best == null || size < sceneGroup(`@${scene.id}#${best}`).enemies.length) best = p;
  }
  return `@${scene.id}#${best ?? 0}`;
}

/** Bestiary ids an encounter stands for (scene tokens expanded, plain ids kept). */
export function encounterEnemies(group: string[]): string[] {
  return group.flatMap((t) => (isSceneRef(t) ? sceneGroup(t).enemies : [t]));
}
