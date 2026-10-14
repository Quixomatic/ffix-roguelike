/**
 * Server-authoritative runs. The client never writes game state: every action loads the stored RunState,
 * applies a game-core transition (which validates it — battles are verified by replay), and saves it back
 * with an optimistic `revision` check so two tabs can't double-apply.
 */
import {
  applyRunOutcome,
  availableJourneys,
  upgradeRunState,
  campSupplies,
  ProfileError,
  RunError,
  runOutcome,
  startRun as coreStartRun,
  type InputRecord,
  type RunState,
} from "@ffix-roguelike/game-core";
import type { Database } from "@ffix-roguelike/db";
import { TRPCError } from "@trpc/server";

import { loadProfile, saveProfile } from "./profile";

export async function getActiveRun(db: Database, profileId: string) {
  return db.run.findFirst({ where: { profileId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
}

export function toTrpcError(e: unknown): never {
  if (e instanceof RunError || e instanceof ProfileError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  throw e;
}

export async function startRun(db: Database, userId: string, partyKeys: string[], tier: number, journey: string) {
  const { id: profileId, profile } = await loadProfile(db, userId);
  if (await getActiveRun(db, profileId)) throw new TRPCError({ code: "CONFLICT", message: "Finish or abandon your current run first" });
  if (new Set(partyKeys).size !== partyKeys.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Duplicate party member" });
  for (const k of partyKeys) if (!profile.unlocked.includes(k)) throw new TRPCError({ code: "BAD_REQUEST", message: `${k} isn't unlocked yet` });
  if (tier > profile.maxTier) throw new TRPCError({ code: "BAD_REQUEST", message: "That difficulty isn't unlocked yet" });
  if (!availableJourneys(profile).includes(journey)) throw new TRPCError({ code: "BAD_REQUEST", message: "That journey isn't unlocked yet" });

  const seed = crypto.randomUUID();
  // Consumables bought at camp are packed into this run and leave the stash.
  const supplies = campSupplies(profile);
  let state: RunState;
  try {
    state = coreStartRun({ seed, tier, party: partyKeys.map((k) => profile.builds[k]!), supplies, unlockedGear: profile.gearUnlocked ?? [], journey });
  } catch (e) {
    toTrpcError(e);
  }
  const stash = Object.fromEntries(Object.entries(profile.stash).filter(([id]) => !(id in supplies)));
  return db.$transaction(async (tx) => {
    if (Object.keys(supplies).length) await saveProfile(tx, profileId, { ...profile, stash });
    return tx.run.create({
      data: { profileId, seed, journey, tier, party: partyKeys, world: state.world, state: state as object },
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
  const { id: profileId } = await loadProfile(db, userId);
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
    journeyCleared: report.journeyCleared,
  };
}
