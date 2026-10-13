import {
  abandonRun,
  buy,
  chooseEvent,
  claimReward,
  equip,
  finishBattle,
  leave,
  moveTo,
  nextWorld,
  optimizeParty,
  setSupports,
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
  kind: z.enum(["attack", "ability", "item", "defend", "flee", "change"]),
  actionId: z.number().int().optional(),
  itemId: z.number().int().optional(),
  targetIds: z.array(z.string().max(8)).max(8),
});
const inputLog = z.array(z.object({ tick: z.number().int().min(0), command })).max(5000);
const slot = z.enum(["weapon", "head", "wrist", "armor", "accessory"]);

export const runRouter = router({
  /** The active run's full state, or null. */
  active: protectedProcedure.query(async ({ ctx }) => {
    const { id } = await loadProfile(ctx.db, ctx.session.user.id);
    const row = await getActiveRun(ctx.db, id);
    return row ? { id: row.id, tier: row.tier, state: row.state as unknown as RunState } : null;
  }),

  /** Recent finished runs. */
  history: protectedProcedure.query(async ({ ctx }) => {
    const { id } = await loadProfile(ctx.db, ctx.session.user.id);
    return ctx.db.run.findMany({
      where: { profileId: id, status: { not: "ACTIVE" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, tier: true, status: true, world: true, party: true, gilEarned: true, createdAt: true, endedAt: true },
    });
  }),

  start: protectedProcedure
    .input(z.object({ party: z.array(z.string()).min(1).max(4), tier: z.number().int().min(0).max(5) }))
    .mutation(async ({ ctx, input }) => {
      const row = await startRun(ctx.db, ctx.session.user.id, input.party, input.tier);
      return { id: row.id };
    }),

  move: protectedProcedure.input(z.object({ nodeId: z.string() })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => moveTo(r, input.nodeId))),

  /** Submit a finished battle's input log; the server replays it to verify the outcome. */
  finishBattle: protectedProcedure.input(z.object({ inputs: inputLog })).mutation(({ ctx, input }) =>
    act(ctx.db, ctx.session.user.id, (r) => finishBattle(r, input.inputs as InputRecord[]), { battleInputs: input.inputs as InputRecord[] }),
  ),

  claim: protectedProcedure.input(z.object({ choice: z.number().int().min(0).nullable() })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => claimReward(r, input.choice))),
  buy: protectedProcedure.input(z.object({ index: z.number().int().min(0) })).mutation(({ ctx, input }) => act(ctx.db, ctx.session.user.id, (r) => buy(r, input.index))),
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
