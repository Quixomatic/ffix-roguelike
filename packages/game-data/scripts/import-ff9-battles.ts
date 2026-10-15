#!/usr/bin/env bun
/**
 * import-ff9-battles — FF9's real bestiary from Memoria's battle export.
 *
 *   1. In the FF9 folder's Memoria.ini set [Export] Enabled = 1 and Battle = 1, launch the game once
 *      (it exports, then quits on purpose), then restore the ini.
 *   2. pnpm -F @ffix-roguelike/game-data import:battles [path/to/StreamingAssets/BattleMap]
 *
 * Reads every BattleScene/<scene>/{Enemies,Actions,Patterns}.json and writes src/generated/bestiary.json:
 * unique monsters (same name + stats merged across scenes) with their real attacks.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ELEMENTS, STATUSES, type Element, type FF9Bestiary, type FF9Enemy, type FF9EnemyAction, type FF9Scene, type Status, type TargetType } from "../src/types";

const HERE = dirname(fileURLToPath(import.meta.url));
// Seed data for the ff9_* tables (the server upserts it on startup when it changes).
const CACHE = join(HERE, "..", "..", "db", "seed", "ff9");
const OUT = join(CACHE, "bestiary.json");
mkdirSync(CACHE, { recursive: true });
const FF9 = "C:/Program Files (x86)/Steam/steamapps/common/FINAL FANTASY IX/StreamingAssets";
const SRC = process.argv[2] ?? process.env.FF9_BATTLE_EXPORT ?? join(FF9, "BattleMap");
const DATA = process.env.FF9_DATA_DIR ?? join(FF9, "Data");
if (!existsSync(join(SRC, "BattleScene"))) {
  console.error(`No battle export at ${SRC}. See the header of this script.`);
  process.exit(1);
}

/** Memoria's JsonWriter omits commas between members; add them back. */
function parse<T>(file: string): T {
  const text = readFileSync(file, "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/("|\d|\]|\}|True|False)\s*\n(\s*")/g, "$1,\n$2")
    // Actions carry a second, numeric "name" (text index) that would overwrite the real one.
    .replace(/"name": (\d+)/g, '"nameIndex": $1')
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false");
  return JSON.parse(text) as T;
}

const clean = (name: string) =>
  name
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
const elementsOf = (mask: number): Element[] => ELEMENTS.filter((_, i) => mask & (1 << i));
const statusesOf = (mask: number): Status[] => STATUSES.filter((_, i) => Number((BigInt(mask) >> BigInt(i)) & 1n) === 1);
const num = (s: string | number) => (typeof s === "number" ? s : Number(s.match(/\((\d+)\)/)?.[1] ?? s));

// Status sets (an attack's addNo) from the game's own table.
const statusSets = new Map<number, Status[]>();
for (const line of readFileSync(join(DATA, "Battle/StatusSets.csv"), "utf8").split(/\r?\n/)) {
  if (!line.trim() || line.startsWith("#")) continue;
  const c = line.split(";");
  statusSets.set(
    Number(c[1]),
    [...(c[2] ?? "").matchAll(/\((\d+)\)/g)].map((m) => STATUSES[Number(m[1])]!).filter(Boolean),
  );
}

const TARGETS: TargetType[] = ["singleAny", "singleAlly", "singleEnemy", "manyAny", "manyAlly", "manyEnemy", "all", "allAlly", "allEnemy", "random", "randomAlly", "randomEnemy", "everyone", "self", "automatic"];
/** FF9 stores targets from the player's side; flip Ally/Enemy so they read from the monster's side. */
function flip(t: TargetType): TargetType {
  if (t.endsWith("Ally")) return t.replace("Ally", "Enemy") as TargetType;
  if (t.endsWith("Enemy")) return t.replace("Enemy", "Ally") as TargetType;
  return t;
}
/** Scripts that help their target (heals, buffs) — aimed at the monster's own side. */
const SUPPORT_SCRIPTS = new Set([10, 12, 13, 37, 41, 43, 44, 96, 103]);

interface RawEnemy {
  name: string;
  invalidStatus: number;
  permanentStatus: number;
  currentStatus: number;
  maxHp: number;
  maxMp: number;
  winGil: number;
  winExp: number;
  winItems: number[];
  stealItems: number[];
  flags: number;
  element: { dex: number; str: number; mgc: number; wpr: number };
  attributes: { invalid: number; absorb: number; half: number; weak: number };
  level: number;
  category: number;
  pdp: number;
  pav: number;
  mdp: number;
  mav: number;
  blue: number;
}
interface RawAction {
  name: string;
  targets: string;
  defaultAlly: boolean;
  animationId1: number;
  scriptId: number;
  power: number;
  elements: string[];
  rate: number;
  category: number;
  addNo: string;
  mp: number;
  type: number;
}
interface RawPattern {
  ap?: number;
  rate?: number;
  enemyCount?: number;
  spawn?: { typeNo: number; flags: string[] }[];
}
interface RawMain {
  flags: string[];
}

const sceneTable: FF9Scene[] = [];

const actions: FF9EnemyAction[] = [];
const actionKey = new Map<string, number>();
function addAction(a: RawAction): number {
  const targets = flip(TARGETS[num(a.targets)] ?? "singleAny");
  const support = SUPPORT_SCRIPTS.has(a.scriptId);
  const action: Omit<FF9EnemyAction, "uid"> = {
    name: clean(a.name) || "Attack",
    targets,
    defaultAlly: support || targets.endsWith("Ally") || targets === "self",
    scriptId: a.scriptId,
    power: a.power,
    elements: a.elements.flatMap((e) => elementsOf(num(e))),
    rate: a.rate,
    category: a.category,
    statuses: statusSets.get(num(a.addNo)) ?? [],
    mp: a.mp,
    type: a.type,
    vfx: a.animationId1,
  };
  const key = JSON.stringify(action);
  const found = actionKey.get(key);
  if (found != null) return found;
  const uid = actions.length;
  actions.push({ uid, ...action });
  actionKey.set(key, uid);
  return uid;
}

type Draft = FF9Enemy & { soloAttacks?: number[] };
const enemies: Draft[] = [];
const enemyKey = new Map<string, Draft>();

const scenes = readdirSync(join(SRC, "BattleScene"))
  .filter((d) => d.startsWith("EVT_BATTLE_"))
  .sort();
for (const dir of scenes) {
  const scene = dir.replace("EVT_BATTLE_", "");
  const base = join(SRC, "BattleScene", dir);
  const raw = parse<RawEnemy[]>(join(base, "Enemies.json"));
  const acts = parse<RawAction[]>(join(base, "Actions.json")).map(addAction);
  const patterns = parse<RawPattern[]>(join(base, "Patterns.json"));
  const ap = Math.max(0, ...patterns.map((p) => p.ap ?? 0));
  const kinds = new Set(raw.map((x) => clean(x.name)).filter((n) => n && n !== "Dummy"));
  const main = parse<RawMain>(join(base, "Main.json"));
  const typeUids: number[] = [];
  for (const e of raw) {
    const name = clean(e.name);
    if (!name || name === "Dummy") {
      typeUids.push(-1);
      continue;
    }
    const boss = (e.flags & 4) !== 0;
    const record: Draft = {
      uid: 0,
      name,
      level: e.level,
      hp: boss && e.maxHp > 10000 ? e.maxHp - 10000 : e.maxHp,
      mp: e.maxMp,
      speed: e.element.dex,
      strength: e.element.str,
      magic: e.element.mgc,
      spirit: e.element.wpr,
      defence: e.pdp,
      evade: e.pav,
      magicDefence: e.mdp,
      magicEvade: e.mav,
      exp: e.winExp,
      gil: e.winGil,
      ap,
      category: e.category,
      resist: statusesOf(e.invalidStatus),
      autoStatus: statusesOf(e.permanentStatus),
      startStatus: statusesOf(e.currentStatus),
      guard: elementsOf(e.attributes.invalid),
      absorb: elementsOf(e.attributes.absorb),
      half: elementsOf(e.attributes.half),
      weak: elementsOf(e.attributes.weak),
      steal: e.stealItems,
      drops: e.winItems,
      blue: e.blue,
      boss,
      attacks: [],
      scenes: [],
    };
    const { scenes: _s, attacks: _a, uid: _u, ap: _ap, ...stats } = record;
    const key = JSON.stringify(stats);
    let entry = enemyKey.get(key);
    if (!entry) {
      entry = { ...record, uid: enemies.length };
      enemies.push(entry);
      enemyKey.set(key, entry);
    }
    entry.ap = Math.max(entry.ap, ap);
    if (!entry.scenes.includes(scene)) entry.scenes.push(scene);
    // A scene with a single kind of monster tells us exactly which attacks are its own.
    if (kinds.size === 1) entry.soloAttacks ??= acts;
    if (!entry.attacks.length) entry.attacks = acts;
    typeUids.push(entry.uid);
  }
  // Attack sequences (.seq, one per attack slot) that switch the caster's idle stance (ToggleStandAnimation →
  // bi.def_idle, which scripts read as STAND_ANIMATION: Zorn & Thorn, Black Waltz No.3…). Last toggle wins.
  const stance: (0 | 1 | null)[] = acts.map(() => null);
  for (const f of readdirSync(base).filter((x) => x.endsWith(".seq"))) {
    const slot = Number(f.slice(0, 2));
    const last = readFileSync(join(base, f), "utf8").split(/\r?\n/).filter((l) => l.includes("ToggleStandAnimation")).at(-1);
    if (last && slot < stance.length) stance[slot] = last.includes("Alternate=True") ? 1 : 0;
  }
  sceneTable.push({
    id: scene,
    flags: main.flags.map((f) => f.replace(/\(\d+\)/, "")),
    types: typeUids,
    attacks: acts,
    patterns: patterns.map((p) => ({ rate: p.rate ?? 0, ap: p.ap ?? 0, spawn: (p.spawn ?? []).slice(0, p.enemyCount ?? 4).map((s) => ({ typeNo: s.typeNo, targetable: s.flags.some((f) => f.startsWith("Target")) })) })),
    ...(stance.some((x) => x != null) ? { stance } : {}),
  });
}
for (const e of enemies) {
  if (e.soloAttacks) e.attacks = e.soloAttacks;
  delete e.soloAttacks;
}

const out: FF9Bestiary = { enemies, actions, scenes: sceneTable };
writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(`✓ bestiary.json — ${enemies.length} monsters, ${actions.length} attacks from ${scenes.length} battle scenes`);

// Battle AI scripts (compiled FF9 event code, EVT_BATTLE_<scene>.eb), extracted from p0data7.bin by
// scripts/extract-battle-scripts.py. Server-side only: each battle carries its own scene's script in its state.
const EB_DIR = process.env.FF9_BATTLE_SCRIPTS ?? join(SRC, "..", "battle-eb");
if (existsSync(EB_DIR)) {
  const scripts: Record<string, string> = {};
  for (const f of readdirSync(EB_DIR).filter((x) => x.endsWith(".eb")).sort()) {
    scripts[f.replace(/^evt_battle_/, "").replace(/\.eb$/, "").toUpperCase()] = readFileSync(join(EB_DIR, f)).toString("base64");
  }
  writeFileSync(join(CACHE, "battle-scripts.json"), `${JSON.stringify(scripts)}\n`);
  console.log(`✓ battle-scripts.json — ${Object.keys(scripts).length} battle AI scripts`);
} else console.log(`(no battle scripts at ${EB_DIR} — run scripts/extract-battle-scripts.py first)`);
