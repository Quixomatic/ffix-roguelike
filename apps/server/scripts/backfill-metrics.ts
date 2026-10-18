/**
 * Backfill lifetime metrics (`player_metric`, `.plans/metrics.md`) from the history that was recorded before metrics
 * existed (v0.3.1). A permanent tool.
 *
 * What can be rebuilt exactly, from what's stored:
 *   - each verified battle (`run_battle`): fought / won / lost / fled, time in battle, fastest win, enemies defeated (by
 *     enemy) and bosses (by boss) — for the player and for every member of that run's party
 *   - each finished run (`run`): finished / won / lost by journey (player and party), highest tier won, gil earned
 * What can't: per-character combat detail (damage, who landed the kill, steals…). `run_battle` keeps a battle's seed and
 * inputs but not its starting state (the party's levels, gear and HP then), so old battles can't be replayed exactly;
 * those metrics count from v0.3.1 on.
 *
 * Players who already have live metrics would be double-counted: the script refuses them unless `--before <ISO time>`
 * limits the backfill to history before metrics started (e.g. the v0.3.1 restart).
 *
 * Dry run by default (prints what it would add). Run from apps/server:
 *   bun scripts/backfill-metrics.ts [email-prefix] [--before 2026-10-18T23:00:00Z] [--apply]
 */
import "varlock/auto-load";

import { bagEntries, encounterEnemies, getEnemy, getNode, record, type MetricBag, type RunState } from "@ffix-roguelike/game-core";

import { addMetrics } from "../../../packages/api/src/services/metrics";
import { ensureFf9Content, ensureRewardContent } from "../../../packages/api/src/services/content";
import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  h: (s: string) => `\n\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const beforeArg = args.includes("--before") ? args[args.indexOf("--before") + 1] : undefined;
const before = beforeArg ? new Date(beforeArg) : undefined;
if (before && Number.isNaN(before.getTime())) {
  console.log(c.bad(`--before needs an ISO time, got "${beforeArg}"`));
  process.exit(1);
}
const who = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--before");

await ensureFf9Content(db);
await ensureRewardContent(db);

const users = await db.user.findMany({
  where: who ? { email: { startsWith: who, mode: "insensitive" } } : {},
  select: { email: true, profile: { select: { id: true } } },
});
let problems = 0;
for (const u of users) {
  if (!u.profile) continue;
  const profileId = u.profile.id;
  console.log(c.h(u.email));
  const live = await db.playerMetric.count({ where: { profileId, key: "battles.fought", character: "", subject: "" } });
  if (live && !before) {
    console.log(c.bad(`already has live metrics: pass --before <ISO time> (when metrics started) so they aren't counted twice`));
    problems++;
    continue;
  }
  const cutoff = before ? { lt: before } : undefined;
  const runs = await db.run.findMany({ where: { profileId, ...(cutoff ? { createdAt: cutoff } : {}) }, select: { id: true, status: true, journey: true, tier: true, gilEarned: true, state: true } });
  const bag: MetricBag = {};
  let battles = 0;
  for (const run of runs) {
    const state = run.state as unknown as RunState;
    const party = state.party?.map((m) => m.build.key) ?? [];
    // The player's total, plus each party member's share (everyone in the party took part).
    const each = (key: string, value: number, subject?: string) => {
      record(bag, key, value, { subject });
      for (const k of party) addFor(bag, key, value, k, subject);
    };
    const rows = await db.runBattle.findMany({ where: { runId: run.id, ...(cutoff ? { createdAt: cutoff } : {}) }, select: { nodeId: true, enemies: true, outcome: true, ticks: true } });
    for (const b of rows) {
      battles++;
      const stage = (() => {
        try {
          return getNode(state.map, b.nodeId).kind;
        } catch {
          return "battle";
        }
      })();
      each("battles.fought", 1);
      record(bag, "battles.ticks", b.ticks);
      if (b.outcome === "VICTORY") {
        each("battles.won", 1, stage);
        record(bag, "battles.fastest_win", b.ticks);
        for (const id of encounterEnemies(b.enemies)) {
          record(bag, "enemies.killed", 1, { subject: id });
          const isBoss = (() => {
            try {
              return !!getEnemy(id).boss;
            } catch {
              return false;
            }
          })();
          if (isBoss) each("bosses.defeated", 1, id);
        }
      } else if (b.outcome === "DEFEAT") each("battles.lost", 1);
      else each("battles.fled", 1);
    }
    if (run.status === "ACTIVE") continue;
    const won = run.status === "WON";
    each("runs.finished", 1, run.journey);
    each(won ? "runs.won" : "runs.lost", 1, run.journey);
    if (won) record(bag, "runs.best_tier", run.tier);
    record(bag, "runs.gil_earned", run.gilEarned ?? 0);
  }
  const entries = bagEntries(bag).filter((e) => e.value);
  const total = (key: string) => bag[`${key}||`] ?? 0;
  console.log(
    `  ${runs.length} runs, ${battles} battles → ${entries.length} metric entries ${c.dim(
      `(battles won ${total("battles.won")}, enemies defeated ${total("enemies.killed")}, bosses ${total("bosses.defeated")}, runs won ${total("runs.won")})`,
    )}`,
  );
  if (!apply) continue;
  await db.$transaction(async (tx) => addMetrics(tx as never, profileId, bag));
  console.log(c.ok("added"));
}
if (!apply) console.log(c.dim("\ndry run — pass --apply to write"));
console.log(`\n${problems ? c.bad(`${problems} player(s) skipped`) : c.ok("done")}`);
await db.$disconnect();
process.exit(problems ? 1 : 0);

/** One member's per-character entries of a value (the player's total is recorded once). */
function addFor(bag: MetricBag, key: string, value: number, character: string, subject?: string) {
  const one: MetricBag = {};
  record(one, key, value, { character, subject });
  // `record` also wrote the player's totals; keep only this character's entries.
  for (const [k, v] of Object.entries(one)) if (k.endsWith(`|${character}`)) bag[k] = (bag[k] ?? 0) + v;
}
