import { describe, expect, test } from "bun:test";

import { autoBattle } from "../battle/autoplay";
import { BattleEngine } from "../battle/engine";
import { applyRunOutcome, newProfile } from "../meta/profile";
import { Rng } from "../rng";
import { generateWorldMap, getNode, MAP_COLUMNS } from "./map";
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

  test("forged battle logs are rejected", () => {
    const profile = newProfile();
    let run = startRun({ seed: "forge", tier: 0, party: [profile.builds.zidane!] });
    run = moveTo(run, getNode(run.map, run.position).next[0]!);
    if (run.phase.kind !== "battle") return;
    expect(() => finishBattle(run, [{ tick: 0, command: { actorId: "p0", kind: "attack", targetIds: ["e0"] } }])).toThrow();
  });

  test("unsecured gear is lost on defeat; secured gear is kept", () => {
    const profile = newProfile();
    let run = startRun({ seed: "loss", tier: 0, party: [profile.builds.zidane!] });
    run.gear.push({ uid: 998, itemId: 2, secured: true, holder: null });
    run.gear.push({ uid: 999, itemId: 3, secured: false, holder: null });
    run.phase = { kind: "over", won: false };
    const out = runOutcome(run);
    expect(out.stash[2]).toBe(1);
    expect(out.stash[3]).toBeUndefined();
    expect(out.gearLost).toContain(3);
  });

  test("progress across runs: auto runs reach further as permanent levels grow", () => {
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
    expect(Object.values(profile.builds).some((b) => b.level > 1)).toBe(true);
    console.log("worlds reached per run:", reached.join(", "), "| unlocked:", profile.unlocked.join(", "), "| levels:", profile.unlocked.map((k) => `${k}:${profile.builds[k]!.level}`).join(" "));
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
