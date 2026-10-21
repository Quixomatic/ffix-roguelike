/**
 * Server-authoritative runs. The client never writes game state: every action loads the stored RunState,
 * applies a game-core transition (which validates it — battles are verified by replay), and saves it back
 * with an optimistic `revision` check so two tabs can't double-apply.
 */
import {
  applyRunOutcome,
  availableRoutes,
  challengeRuleProblem,
  getRoute,
  keepWipedClears,
  bagDelta,
  mergeBags,
  record,
  relicSlotCount,
  runEndMetrics,
  unlockedRelics,
  upgradeRunState,
  campSupplies,
  startingSupplies,
  ProfileError,
  RunError,
  runOutcome,
  startRun as coreStartRun,
  type InputRecord,
  type RunState,
} from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import type { Database } from "@ffix-roguelike/db";
import { TRPCError } from "@trpc/server";

import { addMetrics } from "./metrics";
import { loadProfile, saveProfile } from "./profile";

export async function getActiveRun(db: Database, profileId: string) {
  return db.run.findFirst({ where: { profileId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
}

export function toTrpcError(e: unknown): never {
  if (e instanceof RunError || e instanceof ProfileError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  throw e;
}

/**
 * Start a run. With a run already going, `replace` wipes it first (it ends as ABANDONED, nothing folded into the
 * profile — like starting over in Pokelike); without it, the request is refused so a run is never lost by accident.
 */
export async function startRun(db: Database, userId: string, partyKeys: string[], tier: number, journey: string, replace = false, relic?: string) {
  const loaded = await loadProfile(db, userId);
  const { id: profileId, profile } = loaded;
  const current = await getActiveRun(db, profileId);
  if (current && !replace) throw new TRPCError({ code: "CONFLICT", message: "A run is already in progress" });
  if (new Set(partyKeys).size !== partyKeys.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate party member" });
  for (const k of partyKeys) if (!profile.unlocked.includes(k)) throw new TRPCError({ code: "BAD_REQUEST", message: `${k} isn't unlocked yet` });
  if (tier > profile.maxTier) throw new TRPCError({ code: "BAD_REQUEST", message: "That difficulty isn't unlocked yet" });
  if (!availableRoutes(profile).includes(journey)) throw new TRPCError({ code: "BAD_REQUEST", message: "That journey isn't unlocked yet" });
  // A challenge's rules (party size, start level): a profile build's level is the character's start level.
  const ruleProblem = challengeRuleProblem(
    getRoute(journey),
    partyKeys.map((k) => ({ name: getCharacter(k).name, startLevel: profile.builds[k]!.level })),
  );
  if (ruleProblem) throw new TRPCError({ code: "BAD_REQUEST", message: ruleProblem });

  const seed = crypto.randomUUID();
  // The run starts with the starter kit plus the permanent supply ranks; one-off supplies still in the stash (bought
  // before ranks) are packed too and leave the stash.
  const packed = campSupplies(profile);
  const supplies = startingSupplies(profile);
  let state: RunState;
  try {
    state = coreStartRun({
      seed,
      tier,
      party: partyKeys.map((k) => profile.builds[k]!),
      supplies,
      unlockedGear: profile.gearUnlocked ?? [],
      journey,
      battleMode: loaded.battleMode === "ACTIVE" ? "active" : "wait",
      // The starting relic is checked against what's unlocked (and a starter) by the run rules.
      relic,
      unlockedRelics: unlockedRelics(profile).map((r) => r.id),
      relicSlots: relicSlotCount(profile),
    });
  } catch (e) {
    toTrpcError(e);
  }
  // A wiped run folds nothing in except the journeys it cleared (a grouping's run can clear some before it ends).
  const wiped = current ? upgradeRunState(current.state as unknown as RunState) : null;
  const kept = wiped?.cleared?.length ? keepWipedClears(profile, wiped.cleared, wiped.party.map((m) => m.build.key)).profile : profile;
  const stash = Object.fromEntries(Object.entries(kept.stash).filter(([id]) => !(id in packed)));
  return db.$transaction(async (tx) => {
    if (current) await tx.run.update({ where: { id: current.id }, data: { status: "ABANDONED", endedAt: new Date() } });
    if (Object.keys(packed).length || kept !== profile) await saveProfile(tx, profileId, { ...kept, stash });
    return tx.run.create({
      data: { profileId, seed, journey: state.journey, journeyGroup: state.journeyGroup ?? null, tier, party: partyKeys, world: state.world, state: state as object },
    });
  });
}

/**
 * Apply one transition to the player's active run. When the transition ends the run, its outcome is folded
 * into the permanent profile in the same transaction.
 */
export async function act(
  db: Database,
  userId: string,
  transition: (run: RunState) => RunState,
  opts: { battleInputs?: InputRecord[] } = {},
) {
  const { id: profileId, profile } = await loadProfile(db, userId);
  const row = await getActiveRun(db, profileId);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "No active run" });
  const before = upgradeRunState(row.state as unknown as RunState);
  let after: RunState;
  try {
    after = transition(before);
  } catch (e) {
    toTrpcError(e);
  }
  const over = after.phase.kind === "over";
  const won = after.phase.kind === "over" && after.phase.won;
  // Metrics: a battle's are already in the run's (counted from the verified replay); a run that ends adds how it ended.
  if (over) {
    const outcome = runOutcome(after);
    const end = runEndMetrics({
      journey: after.journeyGroup ?? after.journey,
      won,
      tier: row.tier,
      gilEarned: outcome.gilEarned,
      builds: after.party.map((m) => m.build),
      startLevels: Object.fromEntries(Object.entries(profile.builds).map(([k, b]) => [k, b.level])),
      relics: after.relics ?? [],
    });
    // A won run extends the streak of runs won before it (most recent first).
    if (won) {
      const previous = await db.run.findMany({
        where: { profileId, id: { not: row.id }, status: { in: ["WON", "LOST", "ABANDONED"] } },
        orderBy: { endedAt: "desc" },
        take: 200,
        select: { status: true },
      });
      const streak = 1 + (previous.findIndex((r) => r.status !== "WON") === -1 ? previous.length : previous.findIndex((r) => r.status !== "WON"));
      record(end, "runs.win_streak", streak);
    }
    after = { ...after, metrics: mergeBags({ ...after.metrics }, end) };
  }
  // What this action added to the run's metrics joins the player's lifetime totals, in the same transaction.
  const newMetrics = bagDelta(after.metrics, before.metrics);

  return db.$transaction(async (tx) => {
    const updated = await tx.run.updateMany({
      where: { id: row.id, revision: row.revision },
      data: {
        state: after as object,
        revision: { increment: 1 },
        world: after.world,
        ...(over ? { status: won ? "WON" : "LOST", endedAt: new Date() } : {}),
      },
    });
    if (updated.count !== 1) throw new TRPCError({ code: "CONFLICT", message: "The run changed in another tab — reload" });
    await addMetrics(tx as never, profileId, newMetrics);

    if (opts.battleInputs && before.phase.kind === "battle") {
      const b = before.phase;
      const outcome = after.phase.kind === "over" && !after.phase.won ? "DEFEAT" : after.phase.kind === "map" ? "FLED" : "VICTORY";
      await tx.runBattle.create({
        data: {
          runId: row.id,
          nodeId: b.nodeId,
          world: before.world,
          enemies: b.enemies,
          seed: b.battle.seed,
          outcome,
          ticks: opts.battleInputs.at(-1)?.tick ?? 0,
          inputs: opts.battleInputs as object[],
        },
      });
    }

    let report = null;
    if (over) report = await finalize(tx as unknown as Database, userId, row.id, after, row.tier);
    return { state: after, report };
  });
}

async function finalize(tx: Database, userId: string, runId: string, run: RunState, tier: number) {
  const loaded = await loadProfile(tx, userId);
  const outcome = runOutcome(run);
  const report = applyRunOutcome(loaded.profile, outcome, tier);
  await saveProfile(tx as never, loaded.id, report.profile);
  await tx.run.update({ where: { id: runId }, data: { gilEarned: outcome.gilEarned } });
  return {
    newlyUnlocked: report.newlyUnlocked,
    tierUnlocked: report.tierUnlocked,
    gilEarned: outcome.gilEarned,
    foundGear: outcome.foundGear,
    won: outcome.won,
    points: report.points,
    achievements: report.achievements,
    gearUnlocked: report.gearUnlocked,
    journeysCleared: report.journeysCleared,
  };
}
