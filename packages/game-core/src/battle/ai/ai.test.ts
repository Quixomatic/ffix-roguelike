import { beforeAll, describe, expect, test } from "bun:test";

import { bestiary, itemByName } from "@ffix-roguelike/game-data";
import { loadBattleScriptCache } from "@ffix-roguelike/game-data/cache";

import { FF9_ACTION_BASE } from "../../content/ff9";
import { ff9EnemyDef, getScene } from "../../content/ff9-scenes";
import { newBuild } from "../../stats";
import { autoCommand } from "../autoplay";
import { BattleEngine, createBattle, replayBattle } from "../engine";
import type { BattleEvent, BattleState, BattleUnit } from "../types";
import { enemyUnit, partyUnit, shownHp } from "../units";
import { decodeInstr, disassemble, instructions, parseScript } from "./disasm";
import { getBattleScript, registerBattleScripts } from "./registry";

let scripts: Record<string, string> = {};

beforeAll(() => {
  scripts = loadBattleScriptCache();
  registerBattleScripts(scripts);
});

const bytesOf = (scene: string) => new Uint8Array(Buffer.from(scripts[scene]!, "base64"));

function party(level: number, keys = ["zidane", "vivi", "garnet", "steiner"]): BattleUnit[] {
  return keys.map((k, i) => partyUnit(newBuild(k, level), i));
}

/** A scene's pattern as battle units (every spawn, in FF9 spawn order). */
function sceneEnemies(sceneId: string, pattern?: number): BattleUnit[] {
  const scene = getScene(sceneId);
  const p = pattern ?? scene.patterns.length - 1;
  const out: BattleUnit[] = [];
  scene.patterns[p]!.spawn.forEach((s, slot) => {
    const uid = scene.types[s.typeNo];
    if (uid == null || uid < 0) return;
    const u = enemyUnit(ff9EnemyDef(uid), out.length);
    u.ff9Type = s.typeNo;
    u.ff9Slot = slot;
    if (!s.targetable) u.untargetable = true;
    out.push(u);
  });
  return out;
}

const inventory = () => [
  { itemId: itemByName("Potion").id, count: 10 },
  { itemId: itemByName("Phoenix Down").id, count: 5 },
];

function battle(sceneId: string, opts: { seed?: number; level?: number; pattern?: number } = {}): BattleState {
  const scene = getScene(sceneId);
  const pattern = opts.pattern ?? scene.patterns.length - 1;
  return createBattle({
    seed: opts.seed ?? 7,
    party: party(opts.level ?? 30),
    enemies: sceneEnemies(sceneId, pattern),
    inventory: inventory(),
    scene: sceneId,
    pattern,
    noSurprise: true,
  });
}

/** Auto-play a battle, collecting its events. */
function play(state: BattleState, maxTicks = 15 * 300): { engine: BattleEngine; events: BattleEvent[] } {
  const e = new BattleEngine(state);
  const events: BattleEvent[] = [];
  for (let i = 0; i < maxTicks * 4 && !e.state.outcome && e.state.tick < maxTicks; i++) {
    for (const u of e.readyUnits()) {
      const res = e.submit(autoCommand(e, u));
      if (!res.ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
    }
    events.push(...e.step());
  }
  return { engine: e, events };
}

/** Action ids enemies started (normal turns, counters and specials). */
function enemyMoves(events: BattleEvent[], state: BattleState): Map<string, number[]> {
  const moves = new Map<string, number[]>();
  for (const ev of events) {
    if (ev.type !== "actionStart") continue;
    const u = state.units.find((x) => x.id === ev.actorId);
    if (u?.side !== "enemy") continue;
    const a = bestiary.actions.find((x) => x.name === ev.name);
    if (!a) continue;
    moves.set(u.id, [...(moves.get(u.id) ?? []), a.uid]);
  }
  return moves;
}

/** Enemy commands executed, from the engine's point of view (action ids, via queue tap). */
function tapEnemyActions(state: BattleState, maxTicks = 15 * 240) {
  const e = new BattleEngine(state);
  const used: { actorId: string; actionId: number }[] = [];
  const origEnqueue = e.enqueue.bind(e);
  e.enqueue = (cmd, source, priority) => {
    const actor = e.state.units.find((u) => u.id === cmd.actorId);
    if (actor?.side === "enemy" && cmd.actionId != null) used.push({ actorId: cmd.actorId, actionId: cmd.actionId });
    return origEnqueue(cmd, source, priority);
  };
  const events: BattleEvent[] = [];
  for (let i = 0; !e.state.outcome && e.state.tick < maxTicks && i < maxTicks * 4; i++) {
    for (const u of e.readyUnits()) {
      const res = e.submit(autoCommand(e, u));
      if (!res.ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
    }
    events.push(...e.step());
  }
  return { engine: e, used, events };
}

describe("disassembler", () => {
  test("every battle script parses and disassembles", () => {
    const ids = Object.keys(scripts);
    expect(ids.length).toBeGreaterThan(500);
    let count = 0;
    for (const id of ids) {
      const bytes = bytesOf(id);
      const script = parseScript(bytes);
      for (const _ of instructions(script)) count++;
      expect(disassemble(bytes, id).length).toBeGreaterThan(0);
    }
    expect(count).toBeGreaterThan(100_000);
  });

  test("decodes Attack with an expression argument", () => {
    const script = parseScript(bytesOf("EF_R004"));
    const atb = script.entries[1]!.functions.find((f) => f.tag === 5)!;
    const ops: number[] = [];
    for (let ip = atb.ip; ip < atb.end; ) {
      const ins = decodeInstr(script.entries[1]!.data, ip);
      ops.push(ins.op);
      ip = ins.next;
    }
    expect(ops).toContain(0x38);
  });
});

describe("battle AI VM", () => {
  test("every scene's script runs its intro and turns without throwing", () => {
    const failures: string[] = [];
    for (const id of Object.keys(scripts)) {
      let scene;
      try {
        scene = getScene(id);
      } catch {
        continue;
      }
      if (!scene.patterns.length) continue;
      try {
        const state = battle(id, { seed: 3, level: 40 });
        expect(state.ai).toBeDefined();
        const { engine } = play(state, 15 * 40);
        // JSON-serializable: survives a round trip unchanged.
        expect(JSON.parse(JSON.stringify(engine.state.ai))).toEqual(engine.state.ai);
      } catch (err) {
        failures.push(`${id}: ${(err as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("scripted battles start (leave the intro) in every scene we can field", () => {
    const stuck: string[] = [];
    for (const id of Object.keys(scripts)) {
      let scene;
      try {
        scene = getScene(id);
      } catch {
        continue;
      }
      if (!scene.patterns.length) continue;
      // Story fights against characters our bestiary has no entry for (e.g. Steiner in TH_E003) can't play out.
      if (scene.patterns.at(-1)!.spawn.some((s) => (scene.types[s.typeNo] ?? -1) < 0)) continue;
      const state = battle(id, { seed: 5, level: 40 });
      const e = new BattleEngine(state);
      for (let i = 0; i < 15 * 60 && !e.state.outcome && !e.ai!.isNormal(); i++) e.step();
      if (!e.state.outcome && !e.ai!.isNormal()) stuck.push(`${id} (phase ${e.state.ai!.phase})`);
    }
    expect(stuck).toEqual([]);
  });

  test("Goblin & Fang (EF_R004) use only their own attacks", () => {
    const scene = getScene("EF_R004");
    // pattern 2: one Goblin (type 0) and one Fang (type 1)
    const { used, engine } = tapEnemyActions(battle("EF_R004", { pattern: 2, level: 8, seed: 11 }));
    expect(used.length).toBeGreaterThan(0);
    for (const { actorId, actionId } of used) {
      const u = engine.state.units.find((x) => x.id === actorId)!;
      const own = bestiary.enemies[scene.types[u.ff9Type!]!]!.attacks;
      expect(own).toContain(actionId - FF9_ACTION_BASE);
    }
  });

  test("Plant Brain (EF_E009) fights with its real attacks", () => {
    const scene = getScene("EF_E009");
    const { used } = tapEnemyActions(battle("EF_E009", { level: 12, seed: 21 }), 15 * 180);
    expect(used.length).toBeGreaterThan(2);
    for (const { actionId } of used) expect(scene.attacks).toContain(actionId - FF9_ACTION_BASE);
  });

  test("Plant Brain's script sees boss HP with FF9's +10,000 buffer", () => {
    const state = battle("EF_E009", { level: 12 });
    const pb = state.units.find((u) => u.side === "enemy")!;
    expect(state.ai!.hpBuf[4]).toBe(10000);
    // Its Loop stores (MAX_HP - 10000) / 2 = half its real HP in a map variable once loaded.
    const e = new BattleEngine(state);
    for (let i = 0; i < 30; i++) e.step();
    const map = e.state.ai!.map;
    expect(map[25]! | (map[26]! << 8)).toBe(Math.floor(pb.maxHp / 2));
  });

  test("Gizamaluke's faked 65,535 HP shows as what's left: 13,875, and he falls when it's gone", () => {
    // His script maxes his HP out and ends the fight once he has lost 13,875 (FF9's 3,875 + the boss buffer).
    const e = new BattleEngine(battle("GZ_E014", { level: 40, pattern: 0 }));
    const step = (n: number) => {
      for (let i = 0; i < n && !e.state.outcome; i++) {
        for (const id of [...e.state.ready]) e.submit({ actorId: id, kind: "defend", targetIds: [] });
        e.step();
      }
    };
    step(400);
    const g = e.state.units.find((u) => u.side === "enemy")!;
    expect(g.maxHp).toBe(55535);
    expect(shownHp(g)).toEqual({ hp: 13875, maxHp: 13875 });
    e.damage(g, 9999);
    e.damage(g, 3875);
    expect(shownHp(g).hp).toBe(1);
    step(600);
    expect(e.state.outcome).toBeNull();
    e.damage(g, 1);
    expect(shownHp(g).hp).toBe(0);
    step(3000);
    expect(e.state.outcome).toBe("victory");
  });

  test("Plant Brain at 0 HP is held for its script, which brings in its second phase", () => {
    const state = battle("EF_E009", { level: 12 });
    state.mode = "active"; // the party never acts here; Wait mode would stop the clock for them
    const e = new BattleEngine(state);
    for (let i = 0; i < 40; i++) e.step();
    const pb = e.state.units.find((u) => u.side === "enemy")!;
    const half = Math.floor(pb.maxHp / 2);
    e.damage(pb, pb.hp);
    expect(pb.ff9Dying).toBe(true);
    expect(e.isAlive(pb)).toBe(true);
    for (let i = 0; i < 15 * 20 && pb.ff9Dying; i++) e.step();
    // The script reset its HP to half (Zidane & Blank arrive) and the fight goes on.
    expect(pb.ff9Dying).toBeFalsy();
    expect(pb.hp).toBe(half);
    expect(e.state.outcome).toBeNull();
  });

  for (const [name, id] of [
    ["Hades", "CW_E0XX"],
    ["Ozma", "CH_E093"],
  ] as const)
    test(`${name} (${id}) runs its script and picks legal attacks`, () => {
      const scene = getScene(id);
      const { used, engine } = tapEnemyActions(battle(id, { level: 70, seed: 4 }), 15 * 240);
      expect(engine.state.ai!.phase).not.toBe(2);
      expect(used.length).toBeGreaterThan(0);
      for (const { actionId } of used) expect(scene.attacks).toContain(actionId - FF9_ACTION_BASE);
    });

  test("deterministic: same seed, same fight; replay matches", () => {
    const a = tapEnemyActions(battle("EF_E009", { level: 12, seed: 99 }));
    const b = tapEnemyActions(battle("EF_E009", { level: 12, seed: 99 }));
    expect(a.used).toEqual(b.used);
    expect(a.engine.state.tick).toBe(b.engine.state.tick);
    const initial = battle("EF_R004", { pattern: 2, level: 8, seed: 5 });
    const done = play(structuredClone(initial), 15 * 200).engine.state;
    const replayed = replayBattle(initial, done.inputs, done.tick);
    expect(replayed.tick).toBe(done.tick);
    expect(replayed.units.map((u) => u.hp)).toEqual(done.units.map((u) => u.hp));
    expect(replayed.ai).toEqual(done.ai);
  });

  test("a script's long intro plays out at once (Valia Pira's nine taunts)", () => {
    const e = new BattleEngine(battle("SP_E053", { level: 60 }));
    e.state.mode = "active";
    const events: BattleEvent[] = [];
    for (let i = 0; i < 15 * 3; i++) events.push(...e.step());
    // FF9 spends ~33 s on these lines; with no text window to read there's nothing to wait for.
    expect(events.filter((x) => x.type === "scriptText").length).toBeGreaterThanOrEqual(9);
    expect(e.state.ai!.phase).toBe(4);
  });

  test("hidden is not untargetable: Sealion can be hit before Black Waltz No.1 calls it in", () => {
    const e = new BattleEngine(battle("IC_E011", { level: 15 }));
    const sealion = e.state.units.find((u) => u.name === "Sealion")!;
    for (let i = 0; i < 5; i++) e.step();
    expect(sealion.hidden).toBe(true);
    expect(e.isTargetable(sealion)).toBe(true);
    expect(e.isShown(sealion)).toBe(true);
    const { engine } = play(battle("IC_E011", { level: 15 }), 15 * 600);
    expect(engine.state.outcome).toBe("victory");
  });

  test("script props that are hidden and untargetable aren't shown (Masked Man's masks)", () => {
    const e = new BattleEngine(battle("TH_E001", { level: 5 }));
    for (let i = 0; i < 5; i++) e.step();
    const masks = e.state.units.filter((u) => u.name.startsWith("Baku's Mask"));
    expect(masks.length).toBe(2);
    for (const m of masks) expect(e.isShown(m) || e.isTargetable(m)).toBe(false);
  });

  test("a fight stuck on a story event that can't happen ends instead of freezing (Prison Cage)", () => {
    const { engine, events } = play(battle("EF_E007", { level: 15 }), 15 * 120);
    expect(engine.state.outcome).toBe("victory");
    expect(events.some((x) => x.type === "message" && x.text === "The enemy withdrew")).toBe(true);
    expect(engine.state.tick).toBeLessThan(15 * 60);
  });

  test("scenes without a registered script fall back to the AI rules", () => {
    expect(getBattleScript("NO_SUCH_SCENE")).toBeUndefined();
    const state = createBattle({ seed: 1, party: party(10), enemies: sceneEnemies("EF_R004", 2), inventory: inventory(), scene: "NO_SUCH_SCENE" });
    expect(state.ai).toBeUndefined();
    const { events } = play(state, 15 * 60);
    expect(enemyMoves(events, state).size).toBeGreaterThan(0);
  });
});
