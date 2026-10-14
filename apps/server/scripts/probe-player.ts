/**
 * Inspector: a player's saved game — profile, characters, unlocks, the active run — and whether the stored
 * state still loads under the current rules. A permanent tool; extend it whenever you need to see more.
 *
 * No argument: every account with its profile summary and active run (if any).
 * With an email (or a prefix of one):
 *   - profile: banked gil, tier, lifetime stats, achievements, journeys cleared, gear unlocks, boss kills, stash
 *   - characters: unlocked, start level, unspent CP, unlocked slots, gear, supports, mastered abilities
 *   - active run: journey/area/map position, phase, party (level, HP/MP, lasting statuses), gil, items, gear
 *   - checks: the run state upgrades under the current rules (upgradeRunState); a fight in progress replays
 *     from its recorded inputs (what the server does to verify battles); recent verified battles
 *
 * READ-ONLY. Run from apps/server: bun scripts/probe-player.ts [email]
 */
import "varlock/auto-load";

import { encounterNames, getJourney, replayBattle, upgradeRunState, WORLDS, type RunState } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";

import { ensureFf9Content } from "../../../packages/api/src/services/content";
import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  h: (s: string) => `\n\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
let problems = 0;
const fail = (s: string) => {
  problems++;
  console.log(c.bad(s));
};
const item = (id: number | null | undefined) => (id == null ? "—" : (findItem(id)?.name ?? `#${id}`));

// Game rules need FF9's data, loaded exactly as the server does.
await ensureFf9Content(db);

const arg = process.argv[2]?.toLowerCase();
const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, createdAt: true } });

if (!arg) {
  console.log(c.h(`${users.length} account(s)`));
  for (const u of users) {
    const p = await db.playerProfile.findUnique({ where: { userId: u.id }, include: { characters: true, runsList: { where: { status: "ACTIVE" } } } });
    const unlocked = p?.characters.filter((ch) => ch.unlocked).map((ch) => ch.key) ?? [];
    const run = p?.runsList[0];
    console.log(
      `  ${u.email.padEnd(32)} ${p ? `runs ${p.runs} · wins ${p.wins} · gil ${p.gil} · ${unlocked.join("/") || "no characters"}` : c.dim("no profile yet")}${run ? ` · ACTIVE ${run.journey} (world ${run.world})` : ""}`,
    );
  }
  console.log(c.dim("\nPass an email (or prefix) for details."));
  await db.$disconnect();
  process.exit(0);
}

const user = users.find((u) => u.email.toLowerCase() === arg) ?? users.find((u) => u.email.toLowerCase().startsWith(arg));
if (!user) {
  console.log(c.bad(`no account matching "${arg}"`));
  process.exit(1);
}
const p = await db.playerProfile.findUnique({
  where: { userId: user.id },
  include: { characters: { include: { abilities: true }, orderBy: { createdAt: "asc" } }, stash: true, bossKills: true },
});
console.log(c.h(`${user.email}`) + c.dim(`  user ${user.id} · since ${user.createdAt.toISOString()}`));
if (!p) {
  console.log(c.dim("  no profile yet (created on first visit to camp)"));
  process.exit(0);
}

// ── profile ──────────────────────────────────────────────────────────────────
console.log(`  banked gil ${p.gil} · max tier ${p.maxTier} · ${p.battleMode}`);
console.log(`  runs ${p.runs} · wins ${p.wins} · battles ${p.battles} · steals ${p.steals} · eaten ${p.eaten} · best world ${p.bestWorld}`);
console.log(`  journeys cleared: ${p.journeysCleared.join(", ") || "—"}`);
console.log(`  achievements (${p.achievements.length}): ${p.achievements.join(", ") || "—"}`);
console.log(`  gear unlocked: ${p.gearUnlocked.length}${p.gearUnlocked.length ? c.dim(` (${p.gearUnlocked.slice(0, 12).map(item).join(", ")}${p.gearUnlocked.length > 12 ? "…" : ""})`) : ""}`);
console.log(`  boss kills: ${p.bossKills.map((b) => `${b.enemyId}×${b.count}`).join(", ") || "—"}`);
if (p.stash.length) console.log(`  stash: ${p.stash.map((s) => item(s.itemId)).join(", ")}`);

console.log(c.h("Characters"));
for (const ch of p.characters) {
  if (!ch.unlocked) {
    console.log(c.dim(`  ${ch.key.padEnd(8)} locked`));
    continue;
  }
  const gear = [ch.weaponId, ch.headId, ch.wristId, ch.armorId, ch.accessoryId].map(item).join(" / ");
  console.log(`  ${ch.key.padEnd(8)} start Lv${ch.level} · CP ${ch.points} · slots ${ch.unlockedSlots.join(",") || "weapon only"} · runs ${ch.runs} wins ${ch.wins} bosses ${ch.bossKills}`);
  console.log(c.dim(`           gear ${gear} · supports [${ch.supports.join(",")}] · AP on ${ch.abilities.length} abilities`));
}

// ── active run ───────────────────────────────────────────────────────────────
const row = await db.run.findFirst({ where: { profileId: p.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
if (!row) console.log(c.h("No active run"));
else {
  console.log(c.h(`Active run ${row.id}`) + c.dim(`  revision ${row.revision} · started ${row.createdAt.toISOString()}`));
  let run: RunState | null = null;
  try {
    run = upgradeRunState(row.state as unknown as RunState);
    console.log(c.ok("state loads under the current rules"));
  } catch (err) {
    fail(`state doesn't load: ${(err as Error).message}`);
  }
  if (run) {
    const journey = getJourney(run.journey);
    console.log(`  ${journey.name} · map ${run.stage + 1}/${journey.areas.length} ${WORLDS[run.world]?.name ?? "?"} · node ${run.position} · tier ${run.tier}`);
    console.log(`  phase: ${run.phase.kind}${run.phase.kind === "battle" ? ` (${run.phase.nodeKind}: ${encounterNames(run.phase.enemies).join(", ")} · ${run.phase.enemies.join(" ")})` : ""}`);
    console.log(`  gil ${run.gil} · battles won ${run.stats.battles} · bosses ${run.stats.bossKills.join(", ") || "—"}`);
    for (const m of run.party) {
      console.log(`  ${m.build.key.padEnd(8)} Lv${m.build.level} · HP ${m.hp} · MP ${m.mp}${m.statuses?.length ? ` · ${m.statuses.join(", ")}` : ""} · ${Object.values(m.build.equipment).map(item).join(" / ")}`);
    }
    console.log(c.dim(`  items: ${run.consumables.map((s) => `${item(s.itemId)}×${s.count}`).join(", ") || "—"}`));
    console.log(c.dim(`  gear: ${run.gear.map((g) => `${item(g.itemId)}${g.holder ? `@${g.holder.key}` : ""}`).join(", ") || "—"}`));
    if (run.phase.kind === "battle") {
      const b = run.phase.battle;
      try {
        const replayed = replayBattle(b, b.inputs);
        console.log(c.ok(`fight in progress replays (${b.inputs.length} inputs → tick ${replayed.tick}, ${replayed.outcome ?? "unfinished"})`));
      } catch (err) {
        fail(`fight in progress doesn't replay: ${(err as Error).message}`);
      }
    }
  }
  const battles = await db.runBattle.findMany({ where: { runId: row.id }, orderBy: { createdAt: "desc" }, take: 8 });
  if (battles.length) {
    console.log(c.h("Recent verified battles"));
    for (const b of battles)
      console.log(`  ${b.createdAt.toISOString().slice(11, 19)} ${b.outcome.padEnd(8)} ${encounterNames(b.enemies).join(", ").padEnd(36)} ${String(Math.round(b.ticks / 15)).padStart(4)}s · ${(b.inputs as unknown[]).length} inputs`);
  }
}

console.log(problems ? `\n${c.bad(`${problems} problem(s)`)}` : `\n${c.ok("all good")}`);
await db.$disconnect();
process.exit(problems ? 1 : 0);
