import { describe, expect, test } from "bun:test";

import { autoBattle } from "../battle/autoplay";
import { BattleEngine } from "../battle/engine";
import { newProfile } from "../meta/profile";
import { getNode } from "../run/map";
import { finishBattle, moveTo, startRun } from "../run/run";
import { bagDelta, bagEntries, bagValue, campMetrics, mergeBags, record, runEndMetrics, type MetricBag } from "./collect";
import { METRICS, metricDef } from "./registry";

describe("metric bags", () => {
  test("record keeps the player's total, per subject and per character, as the registry allows", () => {
    const bag: MetricBag = {};
    record(bag, "enemies.killed", 1, { character: "zidane", subject: "goblin" });
    record(bag, "enemies.killed", 2, { character: "vivi", subject: "goblin" });
    expect(bagValue(bag, "enemies.killed")).toBe(3);
    expect(bagValue(bag, "enemies.killed", { subject: "goblin" })).toBe(3);
    expect(bagValue(bag, "enemies.killed", { character: "vivi" })).toBe(2);
    expect(bagValue(bag, "enemies.killed", { subject: "goblin", character: "zidane" })).toBe(1);
    // Not per character: the character is ignored.
    record(bag, "battles.preemptive", 1, { character: "zidane" });
    expect(bagValue(bag, "battles.preemptive", { character: "zidane" })).toBe(0);
    expect(bagValue(bag, "battles.preemptive")).toBe(1);
  });

  test("records keep the best; merge and delta follow each metric's aggregation", () => {
    const a: MetricBag = {};
    record(a, "damage.best_hit", 120, { character: "steiner" });
    record(a, "battles.fastest_win", 300);
    record(a, "damage.dealt", 500, { character: "steiner" });
    const b = mergeBags({ ...a }, (() => {
      const x: MetricBag = {};
      record(x, "damage.best_hit", 90, { character: "steiner" });
      record(x, "battles.fastest_win", 200);
      record(x, "damage.dealt", 250, { character: "steiner" });
      return x;
    })());
    expect(bagValue(b, "damage.best_hit", { character: "steiner" })).toBe(120);
    expect(bagValue(b, "battles.fastest_win")).toBe(200);
    expect(bagValue(b, "damage.dealt", { character: "steiner" })).toBe(750);
    const d = bagDelta(b, a);
    expect(bagValue(d, "damage.dealt", { character: "steiner" })).toBe(250);
    expect(bagValue(d, "battles.fastest_win")).toBe(200);
    expect(bagValue(d, "damage.best_hit", { character: "steiner" })).toBe(0); // not beaten
  });

  test("every metric is registered once, with a known section and aggregation", () => {
    const keys = METRICS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of METRICS) expect(["sum", "max", "min"]).toContain(m.agg);
    expect(metricDef("enemies.killed")?.subject).toBe("enemy");
  });
});

describe("metrics from play", () => {
  test("a battle's verified replay counts kills, damage and actions per character, into the run's metrics", () => {
    const profile = newProfile();
    let run = startRun({ seed: "metrics", tier: 0, party: [{ ...profile.builds.zidane!, level: 10 }] });
    run = moveTo(run, getNode(run.map, run.position).next[0]!);
    expect(run.phase.kind).toBe("battle");
    expect(bagValue(run.metrics, "stages.entered", { subject: "battle" })).toBe(1);
    if (run.phase.kind !== "battle") return;
    const done = autoBattle(new BattleEngine(structuredClone(run.phase.battle))).state;
    run = finishBattle(run, done.inputs);
    const m = run.metrics!;
    expect(bagValue(m, "battles.fought")).toBe(1);
    expect(bagValue(m, "battles.fought", { character: "zidane" })).toBe(1);
    expect(bagValue(m, "actions.taken", { character: "zidane" })).toBeGreaterThan(0);
    if (done.outcome === "victory") {
      const enemies = done.units.filter((u) => u.side === "enemy" && u.hp <= 0).length;
      expect(bagValue(m, "enemies.killed")).toBe(enemies);
      expect(bagValue(m, "enemies.killed", { character: "zidane" })).toBeLessThanOrEqual(enemies);
      expect(bagValue(m, "damage.dealt", { character: "zidane" })).toBeGreaterThan(0);
      expect(bagValue(m, "battles.won", { subject: "battle" })).toBe(1);
    }
    // Every entry names a registered metric.
    for (const e of bagEntries(m)) expect(metricDef(e.key)).toBeDefined();
  });

  test("a run's end and camp spending", () => {
    const end = runEndMetrics({ journey: "evil-forest", won: true, tier: 1, gilEarned: 900, builds: [{ ...newProfile().builds.zidane!, level: 6 }], startLevels: { zidane: 1 } });
    expect(bagValue(end, "runs.won", { subject: "evil-forest", character: "zidane" })).toBe(1);
    expect(bagValue(end, "levels.gained", { character: "zidane" })).toBe(5);
    expect(bagValue(end, "runs.best_tier")).toBe(1);
    const before = newProfile();
    const after = structuredClone(before);
    after.gil = before.gil - 500;
    after.builds.zidane!.points = (before.builds.zidane!.points ?? 0) - 3;
    after.builds.zidane!.training = { strength: 2 };
    const camp = campMetrics({ ...before, gil: before.gil }, after);
    expect(bagValue(camp, "camp.gil_spent")).toBe(500);
    expect(bagValue(camp, "camp.training_ranks", { character: "zidane" })).toBe(2);
  });
});
