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
import { bestiary, bestiaryVersion, type FF9Enemy, type FF9Scene } from "@ffix-roguelike/game-data";

import type { AiRule, EnemyFamily } from "../battle/types";
import type { Rng } from "../rng";
import { getEnemy, type EnemyDef } from "./enemies";
import { FF9_ACTION_BASE } from "./ff9";

// Lookups are rebuilt whenever the bestiary is (re)registered (it starts empty; the server fills it from the DB).
let sceneById = new Map<string, FF9Scene>();
let indexedFor = -1;
function index() {
  if (indexedFor === bestiaryVersion) return;
  sceneById = new Map(bestiary.scenes.map((s) => [s.id, s]));
  defCache.clear();
  indexedFor = bestiaryVersion;
}

export function getScene(id: string): FF9Scene {
  index();
  const s = sceneById.get(id);
  if (!s) throw new Error(`Unknown FF9 battle scene ${id}`);
  return s;
}

/**
 * Boss fights FF9's own script ends with the boss still standing: survive it and it counts as a win (the boss
 * withdraws). Beatrix's three duels end by script after about a minute, whatever her HP. Ralvurahva (Gargan Roo)
 * uses Escape once beaten and flees (he's back as Ralvuimago): FF9's "the enemy fled" ending, with him at full HP.
 */
export const SCRIPTED_WIN_SCENES: ReadonlySet<string> = new Set(["BU_E015", "CY_E022", "AC_E077", "GR_E017"]);

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
  index();
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

/** One monster of a scene group: which bestiary entry, its FF9 type and spawn slot (what its script calls it). */
export interface SceneSpawn {
  id: string;
  /** FF9 enemy type slot (typeNo). */
  type: number;
  /** Position in the pattern's spawn list, counting non-targetable spawns — the script's object order. */
  slot: number;
  /** Untargetable parts (scripted pieces) are fielded but can't be attacked and don't count for victory. */
  targetable: boolean;
}

/** A concrete encounter: the scene's group for that pattern. */
export interface SceneGroup {
  scene: string;
  pattern: number;
  /** Every spawn with a bestiary entry, in spawn order. */
  spawns: SceneSpawn[];
  /** Bestiary ids of the targetable monsters (what you fight and are rewarded for). */
  enemies: string[];
}

/** Token: "@SCENE" (main group), "@SCENE#pattern", or "@SCENE#pattern!n" (only the first n targetable monsters). */
export function sceneGroup(token: string): SceneGroup {
  const [ref, limit] = token.slice(1).split("!");
  const [sceneId, pat] = ref!.split("#");
  const scene = getScene(sceneId!);
  // No pattern given: the scene's main group (FF9's last, catch-all pattern).
  const pattern = pat == null ? scene.patterns.length - 1 : Math.min(Number(pat), scene.patterns.length - 1);
  const spawns: SceneSpawn[] = [];
  let kept = 0;
  (scene.patterns[pattern]?.spawn ?? []).forEach((s, slot) => {
    const uid = scene.types[s.typeNo];
    if (uid == null || uid < 0) return;
    if (s.targetable && limit != null && kept >= Number(limit)) return;
    if (s.targetable) kept++;
    spawns.push({ id: ff9EnemyId(uid), type: s.typeNo, slot, targetable: s.targetable });
  });
  return { scene: scene.id, pattern, spawns, enemies: spawns.filter((s) => s.targetable).map((s) => s.id) };
}

/**
 * Roll which group of a scene appears. Small parties prefer patterns that fit (a lone hero meets small groups,
 * as the rest of the game does), re-rolling a few times before taking the smallest. If even that is bigger than
 * the party allows, the extra monsters stay home ("!n") — except in boss fights (`trim` false).
 */
export function rollSceneGroup(rng: Rng, sceneRef: string, cap: number, trim = true): string {
  const scene = getScene(sceneRef.replace(/^@/, "").split(/[#!]/)[0]!);
  let best: number | null = null;
  for (let i = 0; i < 6; i++) {
    const p = rollPattern(rng, scene);
    const size = sceneGroup(`@${scene.id}#${p}`).enemies.length;
    if (size > 0 && size <= cap) return `@${scene.id}#${p}`;
    if (best == null || size < sceneGroup(`@${scene.id}#${best}`).enemies.length) best = p;
  }
  const token = `@${scene.id}#${best ?? 0}`;
  return trim && sceneGroup(token).enemies.length > cap ? `${token}!${cap}` : token;
}

/**
 * Stable key for boss-kill records and achievements: FF9 monsters by name ("plant-brain", "hades"), since
 * "ff9-<uid>" ids depend on import order; hand-made monsters by their id.
 */
export function killKey(id: string): string {
  if (!id.startsWith("ff9-")) return id;
  const m = bestiary.enemies[Number(id.slice(4))];
  if (!m) return id;
  const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  // An FF9 boss named like a crossover boss (FF9's Garland in Pandemonium vs FF1's in Echoes) is kept apart, so
  // their kills (and the achievements on them) don't mix: "garland-ff9".
  return CROSSOVER_BOSSES.has(slug) ? `${slug}-ff9` : slug;
}

/** Kill keys of the crossover bosses (other Final Fantasy games' bosses, content/enemies.ts). */
const CROSSOVER_BOSSES: ReadonlySet<string> = new Set(["garland", "golbez", "kefka"]);

/** Display names for an encounter ("Plant Brain", "Goblin & Fang"). */
export function encounterNames(group: string[]): string[] {
  return [...new Set(encounterEnemies(group).map((id) => getEnemy(id).name))];
}

/** Bestiary ids an encounter stands for (scene tokens expanded, plain ids kept). */
export function encounterEnemies(group: string[]): string[] {
  return group.flatMap((t) => (isSceneRef(t) ? sceneGroup(t).enemies : [t]));
}
