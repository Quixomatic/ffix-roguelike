import { describe, expect, test } from "bun:test";

import { autoBattle } from "../battle/autoplay";
import { BattleEngine } from "../battle/engine";
import { applyRunOutcome, newProfile } from "../meta/profile";
import { Rng } from "../rng";
import { generateWorldMap, getNode, MAP_COLUMNS, MAP_SHAPE } from "./map";
import { optimizeParty } from "./optimize";
import {
  buy,
  chooseEvent,
  claimReward,
  finishBattle,
  leave,
  moveTo,
  nextWorld,
  runOutcome,
  setRunBattleMode,
  startRun,
  useConsumable,
  type RunState,
} from "./run";

describe("map", () => {
  test("every stage is reachable and leads to the boss", () => {
    for (let s = 0; s < 50; s++) {
      const map = generateWorldMap(Rng.fromSeed(`m${s}`), s % 3);
      const reach = new Set([map.startId]);
      const queue = [map.startId];
      while (queue.length) for (const n of getNode(map, queue.shift()!).next) if (!reach.has(n)) (reach.add(n), queue.push(n));
      expect(reach.size).toBe(map.nodes.length);
      expect(getNode(map, map.bossId).kind).toBe("boss");
      for (const n of map.nodes) if (n.col < MAP_COLUMNS - 1) expect(n.next.length).toBeGreaterThan(0);
      for (const n of map.nodes.filter((x) => x.col === MAP_COLUMNS - 2)) expect(n.kind).toBe("moogle");
    }
  });

  test("every map has the same symmetrical shape: lanes centred, links one lane apart", () => {
    for (let s = 0; s < 30; s++) {
      const map = generateWorldMap(Rng.fromSeed(`shape${s}`), s % 3);
      expect(map.lattice).toBe(true);
      const shapeKey = (m: typeof map) => m.nodes.map((n) => `${n.col}:${n.row}>${n.next.map((id) => getNode(m, id).row).join(",")}`).join(" ");
      // Same structure whatever the seed (only the stage kinds differ).
      expect(shapeKey(map)).toBe(shapeKey(generateWorldMap(Rng.fromSeed("other"), s % 3)));
      MAP_SHAPE.forEach((count, col) => {
        const lanes = map.nodes.filter((n) => n.col === col).map((n) => n.row);
        expect(lanes.length).toBe(count);
        // Centred: mirrored around 0.
        expect([...lanes].map((l) => 0 - l).sort((a, b) => a - b)).toEqual([...lanes].sort((a, b) => a - b));
      });
      // Neighbouring columns differ by one stage, so every link steps exactly one lane up or down.
      for (const n of map.nodes) for (const id of n.next) expect(Math.abs(getNode(map, id).row - n.row)).toBe(1);
    }
  });

  test("any round size works, 1 included; neighbouring rounds differ by at most one", async () => {
    const { checkMapShape } = await import("./map");
    expect(checkMapShape([1, 2, 3, 4, 5, 4, 3, 2, 1])).toBeNull();
    expect(checkMapShape([1, 1, 1, 1, 1])).toBeNull();
    expect(checkMapShape([1, 3, 1])).not.toBeNull();
    expect(checkMapShape([2, 2, 1])).not.toBeNull();
    expect(() => generateWorldMap(Rng.fromSeed("bad"), 1, [1, 4, 1])).toThrow();
    // A one-stage-per-round gauntlet is a straight line.
    const line = generateWorldMap(Rng.fromSeed("line"), 1, [1, 1, 1, 1, 1]);
    expect(line.nodes.every((n) => n.row === 0 && n.next.length === (n.col < 4 ? 1 : 0))).toBe(true);
    const map = generateWorldMap(Rng.fromSeed("odd"), 1, [1, 1, 2, 3, 2, 1]);
    expect(map.nodes.map((n) => n.col)).toEqual([0, 1, 2, 2, 3, 3, 3, 4, 4, 5]);
    const reach = new Set([map.startId]);
    const queue = [map.startId];
    while (queue.length) for (const id of getNode(map, queue.shift()!).next) if (!reach.has(id)) (reach.add(id), queue.push(id));
    expect(reach.size).toBe(map.nodes.length);
  });
});

/** Play a whole run with simple choices; returns the final state. */
function autoRun(seed: string, partyKeys = ["zidane", "vivi", "steiner"], levels = 1): RunState {
  const profile = newProfile();
  let run = startRun({ seed, tier: 0, party: partyKeys.map((k) => ({ ...profile.builds[k]!, level: levels })) });
  const rng = Rng.fromSeed(`choices:${seed}`);
  for (let step = 0; step < 400 && run.phase.kind !== "over"; step++) {
    const p = run.phase;
    switch (p.kind) {
      case "map": {
        run = optimizeParty(run);
        for (const m of run.party) {
          const potion = run.consumables.find((c) => c.itemId === 236 && c.count > 0);
          if (m.hp > 0 && potion && m.hp < 100) run = useConsumable(run, 236, m.build.key);
        }
        const here = getNode(run.map, run.position);
        run = moveTo(run, rng.pick(here.next));
        break;
      }
      case "battle": {
        const done = autoBattle(new BattleEngine(structuredClone(p.battle))).state;
        run = finishBattle(run, done.inputs);
        break;
      }
      case "rewards":
      case "treasure":
        run = claimReward(run, p.gearChoices.length ? 0 : null);
        break;
      case "shop": {
        const potion = p.stock.findIndex((s) => s.itemId === 236);
        while (run.gil > 400 && potion >= 0) run = buy(run, potion);
        run = leave(run);
        break;
      }
      case "event":
        run = p.result ? leave(run) : chooseEvent(run, 1 % (p.eventId ? 2 : 1));
        break;
      case "synth":
      case "stiltzkin":
      case "chocobo":
      case "moogle":
        run = leave(run);
        break;
      case "worldClear":
        run = nextWorld(run);
        break;
    }
  }
  return run;
}

describe("run", () => {
  test("a full auto-played run ends, and its outcome folds into the profile", () => {
    const run = autoRun("test-run-1");
    expect(run.phase.kind).toBe("over");
    const outcome = runOutcome(run);
    expect(outcome.builds.every((b) => b.level >= 1)).toBe(true);
    const report = applyRunOutcome(newProfile(), outcome, 0);
    expect(report.profile.stats.runs).toBe(1);
    expect(report.profile.stats.battles).toBeGreaterThan(0);
  });

  test("runs are deterministic for a seed", () => {
    const a = autoRun("same-seed");
    const b = autoRun("same-seed");
    expect(a.world).toBe(b.world);
    expect(a.visited).toEqual(b.visited);
    expect(a.party.map((m) => m.build.exp)).toEqual(b.party.map((m) => m.build.exp));
  });

  test("battles use the run's Wait/Active setting, and a switch applies from the next battle", () => {
    const profile = newProfile();
    let run = startRun({ seed: "mode", tier: 0, party: [profile.builds.zidane!], battleMode: "active" });
    run = moveTo(run, getNode(run.map, run.position).next[0]!);
    expect(run.phase.kind).toBe("battle");
    if (run.phase.kind !== "battle") return;
    expect(run.phase.battle.mode).toBe("active");
    const switched = setRunBattleMode(run, "wait");
    expect(switched.battleMode).toBe("wait");
    expect(switched.phase.kind === "battle" && switched.phase.battle.mode).toBe("active"); // the fight in progress keeps its mode
    expect(startRun({ seed: "mode", tier: 0, party: [profile.builds.zidane!] }).battleMode).toBe("wait");
  });

  test("forged battle logs are rejected", () => {
    const profile = newProfile();
    let run = startRun({ seed: "forge", tier: 0, party: [profile.builds.zidane!] });
    run = moveTo(run, getNode(run.map, run.position).next[0]!);
    if (run.phase.kind !== "battle") return;
    expect(() => finishBattle(run, [{ tick: 0, command: { actorId: "p0", kind: "attack", targetIds: ["e0"] } }])).toThrow();
  });

  test("progress across runs: every run pays Completion Points; levels reset to the start level", () => {
    let profile = newProfile();
    const reached: number[] = [];
    for (let i = 0; i < 4; i++) {
      const keys = profile.unlocked.slice(0, 4);
      let run = startRun({ seed: `meta-${i}`, tier: 0, party: keys.map((k) => profile.builds[k]!) });
      run = autoRunFrom(run, `meta-${i}`);
      const report = applyRunOutcome(profile, runOutcome(run), 0);
      profile = report.profile;
      reached.push(run.world);
    }
    expect(profile.stats.runs).toBe(4);
    expect(Object.values(profile.builds).some((b) => (b.points ?? 0) > 0)).toBe(true);
    expect(Object.values(profile.builds).every((b) => b.level === 1)).toBe(true);
    console.log("worlds reached per run:", reached.join(", "), "| unlocked:", profile.unlocked.join(", "), "| CP:", profile.unlocked.map((k) => `${k}:${profile.builds[k]!.points ?? 0}`).join(" "));
  });
});

function autoRunFrom(start: RunState, seed: string): RunState {
  let run = start;
  const rng = Rng.fromSeed(`choices:${seed}`);
  for (let step = 0; step < 400 && run.phase.kind !== "over"; step++) {
    const p = run.phase;
    if (p.kind === "map") {
      run = optimizeParty(run);
      run = moveTo(run, rng.pick(getNode(run.map, run.position).next));
    } else if (p.kind === "battle") run = finishBattle(run, autoBattle(new BattleEngine(structuredClone(p.battle))).state.inputs);
    else if (p.kind === "rewards" || p.kind === "treasure") run = claimReward(run, p.gearChoices.length ? 0 : null);
    else if (p.kind === "event") run = p.result ? leave(run) : chooseEvent(run, 1);
    else if (p.kind === "worldClear") run = nextWorld(run);
    else run = leave(run);
  }
  return run;
}

describe("synthesis & selling", () => {
  test("synthesis consumes ingredients and gil; result is secured only if all ingredients were", async () => {
    const { synthesize, sell } = await import("./run");
    const { synthesis, itemByName } = await import("@ffix-roguelike/game-data");
    const profile = newProfile();
    let run = startRun({ seed: "synth", tier: 0, party: [profile.builds.zidane!] });
    const recipe = synthesis.find((r) => r.result === itemByName("Butterfly Sword").id)!; // Dagger + Mage Masher
    run.gil = 1000;
    run.gear.push({ uid: 501, itemId: recipe.ingredients[0]!, secured: true, holder: null });
    run.gear.push({ uid: 502, itemId: recipe.ingredients[1]!, secured: false, holder: null });
    run.phase = { kind: "synth", name: "test", recipes: [recipe.id] };
    run = synthesize(run, recipe.id);
    expect(run.gil).toBe(1000 - recipe.price);
    const made = run.gear.find((g) => g.itemId === recipe.result)!;
    expect(made.secured).toBe(false);
    expect(run.gear.some((g) => g.uid === 501 || g.uid === 502)).toBe(false);
    const gil = run.gil;
    run = sell(run, made.uid);
    expect(run.gil).toBeGreaterThan(gil);
  });

});

describe("special stages & supplies", () => {
  test("Stiltzkin sells each deal once; Chocobo digs 3 of 9 spots", async () => {
    const { buyOffer, dig } = await import("./run");
    const { stiltzkinOffers, chocoboSpots, CHOCOBO_DIGS } = await import("./specials");
    const profile = newProfile();
    let run = startRun({ seed: "sp", tier: 0, party: [profile.builds.zidane!] });
    run.gil = 99999;
    run.phase = { kind: "stiltzkin", offers: stiltzkinOffers(Rng.fromSeed("s"), 0, ["zidane"]), bought: [] };
    run = buyOffer(run, 0);
    expect(() => buyOffer(run, 0)).toThrow(/Already/);
    run.phase = { kind: "chocobo", spots: chocoboSpots(Rng.fromSeed("c"), 0, ["zidane"]), digsLeft: CHOCOBO_DIGS, dug: [] };
    for (let i = 0; i < 3; i++) run = dig(run, i);
    expect(() => dig(run, 3)).toThrow(/no digs left/);
  });

  test("camp supplies are packed into the run on top of the starter kit", () => {
    const profile = newProfile();
    const run = startRun({ seed: "sup", tier: 0, party: [profile.builds.zidane!], supplies: { 236: 3 } });
    expect(run.consumables.find((c) => c.itemId === 236)?.count).toBe(4 + 3);
  });
});

describe("journeys", () => {
  test("an area with a semi-boss puts a single fortress stage mid-map that every path crosses", async () => {
    const { SEMIBOSS_COLUMN } = await import("./map");
    const { WORLDS } = await import("../content/worlds");
    WORLDS[0]!.semiBoss = ["gigas-worm"];
    for (let s = 0; s < 20; s++) {
      const map = generateWorldMap(Rng.fromSeed(`j${s}`), 0);
      const mid = map.nodes.filter((n) => n.col === SEMIBOSS_COLUMN);
      expect(mid.length).toBe(1);
      expect(mid[0]!.kind).toBe("semiboss");
    }
    delete WORLDS[0]!.semiBoss;
  });

  test("each map's boss leads to the next map; the last map's boss ends the journey", async () => {
    const { applyRunOutcome, availableJourneys } = await import("../meta/profile");
    const profile = newProfile();
    expect(availableJourneys(profile)).toEqual(["evil-forest"]);
    const bossWin = { kind: "rewards" as const, summary: { exp: 0, gil: 0, ap: 0, items: [], levelUps: [], mastered: [], members: [] }, gearChoices: [], boss: true };
    let run = startRun({ seed: "j", tier: 0, party: [profile.builds.zidane!], journey: "echoes" });
    for (let area = 0; area < 2; area++) {
      run.phase = bossWin;
      run = claimReward(run, null);
      expect(run.phase.kind).toBe("worldClear");
      run = nextWorld(run);
      expect(run.stage).toBe(area + 1);
    }
    run.phase = bossWin;
    run = claimReward(run, null);
    expect(run.phase).toEqual({ kind: "over", won: true });
    const report = applyRunOutcome(profile, runOutcome(run), 0);
    expect(report.journeyCleared).toBe("echoes");
  });
});
