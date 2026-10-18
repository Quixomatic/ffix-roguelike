import { buyStarterUpgrade, buySupplyRank, lockedCharacters, pickStarterTier, raiseStartLevel, setProfileSupports, setRunBattleMode, trainStat, TRAIN_STATS, unlockGear, unlockSlot, type Profile } from "@ffix-roguelike/game-core";
import type { Database } from "@ffix-roguelike/db";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { loadProfile, saveProfile } from "../services/profile";
import { act, getActiveRun, toTrpcError } from "../services/runs";

/**
 * Apply a game-core rule to the player's profile and persist it. Allowed during a run too: the run plays a snapshot
 * of the party taken when it started, and its end merges onto the profile as it is then (`applyRunOutcome`).
 */
async function mutateProfile(db: Database, userId: string, change: (p: Profile) => Profile) {
  const loaded = await loadProfile(db, userId);
  let next: Profile;
  try {
    next = change(loaded.profile);
  } catch (e) {
    toTrpcError(e);
  }
  await db.$transaction((tx) => saveProfile(tx, loaded.id, next));
}

export const profileRouter = router({
  /** The player's permanent progression (created on first call), plus unlock hints and any active run id. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const loaded = await loadProfile(ctx.db, ctx.session.user.id);
    const active = await getActiveRun(ctx.db, loaded.id);
    return {
      ...loaded.profile,
      battleMode: loaded.battleMode,
      activeRunId: active?.id ?? null,
      locked: lockedCharacters(loaded.profile),
    };
  }),

  setBattleMode: protectedProcedure.input(z.object({ mode: z.enum(["WAIT", "ACTIVE"]) })).mutation(async ({ ctx, input }) => {
    await ctx.db.playerProfile.update({ where: { userId: ctx.session.user.id }, data: { battleMode: input.mode } });
    // A run in progress switches from its next battle.
    const loaded = await loadProfile(ctx.db, ctx.session.user.id);
    if (await getActiveRun(ctx.db, loaded.id)) await act(ctx.db, ctx.session.user.id, (run) => setRunBattleMode(run, input.mode === "ACTIVE" ? "active" : "wait"));
  }),

  /** Spend Completion Points on +1 start level. */
  raiseStartLevel: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => raiseStartLevel(p, input.key))),

  /** Spend Completion Points on one training rank of a stat. */
  trainStat: protectedProcedure
    .input(z.object({ key: z.string(), stat: z.enum(TRAIN_STATS) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => trainStat(p, input.key, input.stat))),

  /** Spend Completion Points to unlock an equipment slot for a character. */
  unlockSlot: protectedProcedure
    .input(z.object({ key: z.string(), slot: z.enum(["head", "wrist", "armor", "accessory"]) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => unlockSlot(p, input.key, input.slot))),

  /** Buy a character's next starting-gear upgrade tier for a slot (banked gil + their CP). */
  buyStarterUpgrade: protectedProcedure
    .input(z.object({ key: z.string(), slot: z.enum(["weapon", "head", "wrist", "armor", "accessory"]) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => buyStarterUpgrade(p, input.key, input.slot))),

  /** Choose which owned starting-gear tier a slot starts runs with (0 = the FF9 piece). */
  pickStarterTier: protectedProcedure
    .input(z.object({ key: z.string(), slot: z.enum(["weapon", "head", "wrist", "armor", "accessory"]), tier: z.number().int().min(0).max(9) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => pickStarterTier(p, input.key, input.slot, input.tier))),

  setSupports: protectedProcedure
    .input(z.object({ key: z.string(), supports: z.array(z.number().int()).max(64) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => setProfileSupports(p, input.key, input.supports))),

  /** Gear catalog: unlock a piece of gear into run drop pools with banked gil. */
  unlockGear: protectedProcedure
    .input(z.object({ itemId: z.number().int() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => unlockGear(p, input.itemId))),

  /** Supplies: buy a consumable with banked gil, packed into the next run. */
  /** Buy the next rank of a camp supply: every run starts with one more of it (capped). */
  buySupplyRank: protectedProcedure
    .input(z.object({ itemId: z.number().int() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => buySupplyRank(p, input.itemId))),
});
