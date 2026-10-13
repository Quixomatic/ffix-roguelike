import {
  buyAtCamp,
  buyLoadoutSlot,
  equipFromStash,
  raiseStartLevel,
  setProfileSupports,
  synthesizeAtCamp,
  UNLOCKS,
  type Profile,
} from "@ffix-roguelike/game-core";
import type { Database } from "@ffix-roguelike/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { loadProfile, saveProfile } from "../services/profile";
import { getActiveRun, toTrpcError } from "../services/runs";

const slot = z.enum(["weapon", "head", "wrist", "armor", "accessory"]);

/**
 * Apply a game-core rule to the player's profile and persist it. Loadout/points/shop changes are only allowed
 * between runs.
 */
async function mutateProfile(db: Database, userId: string, change: (p: Profile) => Profile) {
  const loaded = await loadProfile(db, userId);
  if (await getActiveRun(db, loaded.id)) throw new TRPCError({ code: "CONFLICT", message: "Finish your current run first" });
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
      locked: UNLOCKS.filter((u) => !loaded.profile.unlocked.includes(u.key)).map((u) => ({ key: u.key, hint: u.hint })),
    };
  }),

  setBattleMode: protectedProcedure.input(z.object({ mode: z.enum(["WAIT", "ACTIVE"]) })).mutation(async ({ ctx, input }) => {
    await ctx.db.playerProfile.update({ where: { userId: ctx.session.user.id }, data: { battleMode: input.mode } });
  }),

  /** Spend Completion Points on +1 start level. */
  raiseStartLevel: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => raiseStartLevel(p, input.key))),

  /** Spend Completion Points on the next loadout gear slot. */
  buySlot: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => buyLoadoutSlot(p, input.key))),

  /** Put stash gear into a bought slot (itemId null = unequip). */
  equip: protectedProcedure
    .input(z.object({ key: z.string(), slot, itemId: z.number().int().nullable() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => equipFromStash(p, input.key, input.slot, input.itemId))),

  setSupports: protectedProcedure
    .input(z.object({ key: z.string(), supports: z.array(z.number().int()).max(64) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => setProfileSupports(p, input.key, input.supports))),

  /** Camp shop: buy gear with banked gil (goes to the stash). */
  buyGear: protectedProcedure
    .input(z.object({ itemId: z.number().int() }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => buyAtCamp(p, input.itemId))),

  /** Camp workshop: synthesize from stash gear with banked gil. */
  synthesize: protectedProcedure
    .input(z.object({ recipeId: z.number().int().min(0) }))
    .mutation(({ ctx, input }) => mutateProfile(ctx.db, ctx.session.user.id, (p) => synthesizeAtCamp(p, input.recipeId))),
});
