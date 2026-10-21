import {
  abandonRun,
  buy,
  buyOffer,
  buyWare,
  chooseEvent,
  chooseRelic,
  claimReward,
  dig,
  equip,
  finishBattle,
  leave,
  moveTo,
  nextWorld,
  optimizeParty,
  sell,
  setSupports,
  synthesize,
  upgradeRunState,
  useConsumable,
  type InputRecord,
  type RunState,
} from "@ffix-roguelike/game-core";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { loadProfile } from "../services/profile";
import { act, getActiveRun, startRun } from "../services/runs";

const command = z.object({
  actorId: z.string().max(8),
  kind: z.enum(["attack", "ability", "item", "throw", "defend", "flee", "change"]),
  actionId: z.number().int().optional(),
  itemId: z.number().int().optional(),
  targetIds: z.array(z.string().max(8)).max(8),
  second: z.object({ actionId: z.number().int(), targetIds: z.array(z.string().max(8)).max(8) }).optional(),
});
const inputLog = z.array(z.object({ tick: z.number().int().min(0), command })).max(5000);
const slot = z.enum(["weapon", "head", "wrist", "armor", "accessory"]);

export const runRouter = router({
  /** The active run's full state, or null. */
  active: protectedProcedure.query(async ({ ctx }) => {
    const { id } = await loadProfile(ctx.db, ctx.session.user.id);
    const row = await getActiveRun(ctx.db, id);
    return row ? { id: row.id, tier: row.tier, state: upgradeRunState(row.state as unknown as RunState) } : null;
  }),

  /** Recent finished runs. */
  history: protectedProcedure.query(async ({ ctx }) => {
    const { id } = await loadProfile(ctx.db, ctx.session.user.id);
    return ctx.db.run.findMany({
      where: { profileId: id, status: { not: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, journey: true, tier: true, status: true, world: true, party: true, gilEarned: true, createdAt: true, endedAt: true },
    });
  }),

  start: protectedProcedure
    .input(
      z.object({
        party: z.array(z.string()).min(1).max(4),
        // Only a sane bound here: the tiers open on the route (up to the `tiers.max` setting) are checked in startRun.
        tier: z.number().int().min(0).max(99),
        journey: z.string().default("evil-forest"),
        /** Wipe the run in progress (if any) and start this one. */
        replace: z.boolean().default(false),
        /** The starting relic (an unlocked starter relic). */
        relic: z.string().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await startRun(ctx.db, ctx.session.user.id, input.party, input.tier, input.journey, input.replace, input.relic);
      return { id: row.id };
    }),

  move: protectedProcedure.input(z.object({ nodeId: z.string() })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => moveTo(r, input.nodeId))),

  /** Submit a finished battle's input log; the server replays it to verify the outcome. */
  finishBattle: protectedProcedure.input(z.object({ inputs: inputLog })).mutation(({ ctx, input }) =>
    act(ctx.db, ctx.session.user.id, (r) => finishBattle(r, input.inputs as InputRecord[]), { battleInputs: input.inputs as InputRecord[] }),
  ),

  /** Take a reward card (or null to skip); `replace`: the relic a relic card takes the place of when the rack is full. */
  claim: protectedProcedure
    .input(z.object({ choice: z.number().int().min(0).nullable(), replace: z.string().max(60).optional() }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => claimReward(r, input.choice, input.replace))),
  /** The relic pick after a fight: take one (`replace`: the held relic it takes the place of when the rack is full) or skip (null). */
  chooseRelic: protectedProcedure
    .input(z.object({ choice: z.number().int().min(0).nullable(), replace: z.string().max(60).optional() }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => chooseRelic(r, input.choice, input.replace))),
  buy: protectedProcedure.input(z.object({ index: z.number().int().min(0) })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => buy(r, input.index))),
  /** Buy one of the shop's wares (a reward card); `replace`: the relic a relic ware takes the place of when the rack is full. */
  buyWare: protectedProcedure
    .input(z.object({ index: z.number().int().min(0), replace: z.string().max(60).optional() }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => buyWare(r, input.index, input.replace))),
  synthesize: protectedProcedure
    .input(z.object({ recipeId: z.number().int().min(0) }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => synthesize(r, input.recipeId))),
  sell: protectedProcedure.input(z.object({ uid: z.number().int() })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => sell(r, input.uid))),
  buyOffer: protectedProcedure.input(z.object({ index: z.number().int().min(0) })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => buyOffer(r, input.index))),
  dig: protectedProcedure.input(z.object({ index: z.number().int().min(0) })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => dig(r, input.index))),
  leave: protectedProcedure.mutation(({ ctx }) => act(ctx.db, ctx.session.user.id, leave)),
  choose: protectedProcedure.input(z.object({ index: z.number().int().min(0) })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => chooseEvent(r, input.index))),
  nextWorld: protectedProcedure.mutation(({ ctx }) => act(ctx.db, ctx.session.user.id, nextWorld)),

  equip: protectedProcedure
    .input(z.object({ key: z.string(), slot, uid: z.number().int().nullable() }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => equip(r, input.key, input.slot, input.uid))),
  optimize: protectedProcedure.mutation(({ ctx }) => act(ctx.db, ctx.session.user.id, optimizeParty)),
  setSupports: protectedProcedure
    .input(z.object({ key: z.string(), supports: z.array(z.number().int()).max(64) }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => setSupports(r, input.key, input.supports))),
  useItem: protectedProcedure
    .input(z.object({ itemId: z.number().int(), key: z.string() }))
    .mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => useConsumable(r, input.itemId, input.key))),

  abandon: protectedProcedure.mutation(({ ctx }) => act(ctx.db, ctx.session.user.id, abandonRun)),
});
