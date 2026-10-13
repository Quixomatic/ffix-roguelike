import { describe, expect, test } from "bun:test";

import { itemByName } from "@ffix-roguelike/game-data";

import { ENEMIES } from "../content/enemies";
import { WORLDS } from "../content/worlds";
import { newBuild, deriveStats } from "../stats";
import { autoBattle } from "./autoplay";
import { BattleEngine, createBattle, replayBattle } from "./engine";
import { enemyGroup, enemyUnit, partyUnit } from "./units";

const potions = () => [
  { itemId: itemByName("Potion").id, count: 5 },
  { itemId: itemByName("Phoenix Down").id, count: 2 },
];

function party(level: number, keys = ["zidane", "vivi", "steiner"]) {
  return keys.map((k, i) => partyUnit(newBuild(k, level), i));
}

describe("stats", () => {
  test("Zidane Lv1 matches FF9 (105 HP / 36 MP)", () => {
    const s = deriveStats(newBuild("zidane", 1));
    expect(s.maxHp).toBe(105);
    expect(s.maxMp).toBe(36);
  });
});

describe("content", () => {
  test("every enemy builds (items/actions resolve)", () => {
    for (const def of ENEMIES) expect(() => enemyUnit(def, 0)).not.toThrow();
  });
  test("every world encounter references real enemies", () => {
    for (const w of WORLDS) for (const g of [...w.encounters, ...w.elites, w.boss]) expect(() => enemyGroup(g)).not.toThrow();
  });
});

describe("engine", () => {
  test("auto battle finishes and replays identically", () => {
    const initial = createBattle({ seed: 1234, party: party(4), enemies: enemyGroup(["goblin", "wolf"]), inventory: potions() });
    const done = autoBattle(new BattleEngine(structuredClone(initial))).state;
    expect(done.outcome).not.toBeNull();
    const replayed = replayBattle(initial, done.inputs);
    expect(replayed.outcome).toBe(done.outcome);
    expect(replayed.tick).toBe(done.tick);
    expect(replayed.units.map((u) => u.hp)).toEqual(done.units.map((u) => u.hp));
  });

  test("tampered input log is rejected", () => {
    const initial = createBattle({ seed: 99, party: party(4), enemies: enemyGroup(["goblin"]), inventory: potions() });
    const done = autoBattle(new BattleEngine(structuredClone(initial))).state;
    const forged = done.inputs.map((r) => ({ ...r, command: { ...r.command, actorId: "p9" } }));
    expect(() => replayBattle(initial, forged)).toThrow();
  });

  test("wait mode does not advance time while a command is pending", () => {
    const e = new BattleEngine(createBattle({ seed: 5, party: party(4), enemies: enemyGroup(["goblin"]), inventory: [] }));
    while (!e.readyUnits().length && !e.state.outcome) e.step();
    if (e.state.queue.length === 0 && e.state.busy === 0) {
      const t = e.state.tick;
      e.step();
      e.step();
      expect(e.state.tick).toBe(t);
    }
  });
});

/** Win rate of the auto AI over many seeds — a coarse difficulty check per world. */
function winRate(level: number, groups: string[][], runs = 40): number {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const g = groups[i % groups.length]!;
    const s = createBattle({ seed: 1000 + i, party: party(level), enemies: enemyGroup(g), inventory: potions() });
    if (autoBattle(new BattleEngine(s)).state.outcome === "victory") wins++;
  }
  return wins / runs;
}

describe("balance (auto AI, default gear)", () => {
  test("world 1 normal fights are winnable at Lv4", () => {
    expect(winRate(4, WORLDS[0]!.encounters)).toBeGreaterThan(0.8);
  });
  test("Garland is risky at Lv4 and beatable at Lv7", () => {
    expect(winRate(4, [WORLDS[0]!.boss], 20)).toBeLessThan(0.8);
    expect(winRate(7, [WORLDS[0]!.boss], 20)).toBeGreaterThan(0.6);
  });
});
