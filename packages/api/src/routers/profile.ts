import { equipFromStash, setProfileSupports, synthesizeAtCamp, UNLOCKS } from "@ffix-roguelike/game-core";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { loadProfile, saveProfile } from "../services/profile";
import { getActiveRun, toTrpcError } from "../services/runs";

const slot = z.enum(["weapon", "head", "wrist", "armor", "accessory"]);

export const profileRouter = router({
  /** The player's permanent progression (created on first call), plus unlock hints and any active run id. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const loaded = await loadProfile(ctx.db, ctx.session.user.id);
    const active = await getActiveRun(ctx.db, loaded.id);
    return {
      ...loaded.profile,
      battleMode: loaded.battleMode,
      activeRunId: active?.id ?? null,
      locked: UNLOCKS.filter((u) => !loaded.profile.unlocked.includes(u.key)).map((u) => ({ key: u.key, hint: u.hint })),
    };
  }),

  setBattleMode: protectedProcedure.input(z.object({ mode: z.enum(["WAIT", "ACTIVE"]) })).mutation(async ({ ctx, input }) => {
    await ctx.db.playerProfile.update({ where: { userId: ctx.session.user.id }, data: { battleMode: input.mode } });
  }),

  /** Between runs: equip from the stash (itemId null = unequip). Not allowed while a run is active. */
  equip: protectedProcedure
    .input(z.object({ key: z.string(), slot, itemId: z.number().int().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const loaded = await loadProfile(ctx.db, ctx.session.user.id);
      if (await getActiveRun(ctx.db, loaded.id)) return toTrpcError(new Error("Change gear inside the run while one is active"));
      let next;
      try {
        next = equipFromStash(loaded.profile, input.key, input.slot, input.itemId);
      } catch (e) {
        toTrpcError(e);
      }
      await ctx.db.$transaction((tx) => saveProfile(tx, loaded.id, next));
    }),

  /** Camp workshop: synthesize from stash gear with banked gil. */
  synthesize: protectedProcedure.input(z.object({ recipeId: z.number().int().min(0) })).mutation(async ({ ctx, input }) => {
    const loaded = await loadProfile(ctx.db, ctx.session.user.id);
    let next;
    try {
      next = synthesizeAtCamp(loaded.profile, input.recipeId);
    } catch (e) {
      toTrpcError(e);
    }
    await ctx.db.$transaction((tx) => saveProfile(tx, loaded.id, next));
  }),

  setSupports: protectedProcedure
    .input(z.object({ key: z.string(), supports: z.array(z.number().int()).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const loaded = await loadProfile(ctx.db, ctx.session.user.id);
      let next;
      try {
        next = setProfileSupports(loaded.profile, input.key, input.supports);
      } catch (e) {
        toTrpcError(e);
      }
      await ctx.db.$transaction((tx) => saveProfile(tx, loaded.id, next));
    }),
});
