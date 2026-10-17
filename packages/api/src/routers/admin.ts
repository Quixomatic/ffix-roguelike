/**
 * Admin tools (admins only — better-auth's admin plugin): the reward and gear-availability tables
 * (`.plans/rewards.md` §4). Every save validates the row, writes it, and reloads the tables so the next reward offer,
 * drop pool and catalog use it. `preview` rolls sample offers; `exportSeeds` writes the tables back to the seed
 * files (development servers only) so tuning can be committed.
 */
import { exportRewardSeeds } from "@ffix-roguelike/db/seed-rewards";
import { newBuild, Rng, rollOffer, startRun, WORLDS, type CharacterBuild, type RunState } from "@ffix-roguelike/game-core";
import { BOON_STATS, CARD_TYPES, RARITIES, REWARD_SOURCES, ROLE_STATS } from "@ffix-roguelike/game-data";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../index";
import { ensureRewardContent, reloadRewardContent } from "../services/content";

const rarity = z.enum(RARITIES);
const perRarity = <T extends z.ZodType>(v: T) => z.object(Object.fromEntries(RARITIES.map((r) => [r, v])) as Record<(typeof RARITIES)[number], T>);
const partialRarity = z.partialRecord(rarity, z.number().min(0));

export const rarityInput = z.object({
  id: rarity,
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sort: z.number().int(),
  apSurge: z.number().int().min(0).max(999),
  gil: z.number().int().min(0).max(1_000_000),
  supplies: z.number().int().min(0).max(99),
  nextBand: z.number().min(0).max(100),
  bandSteps: z.number().int().min(0).max(10).optional(),
});

export const roleInput = z.object({
  key: z.string().min(1).max(20),
  weights: z.partialRecord(z.enum(ROLE_STATS), z.number().min(0).max(100)),
  abilityWeight: z.number().min(0).max(1000),
  preferredAbilities: z.array(z.string().max(40)).max(100),
  notes: z.string().max(500).optional(),
});

export const sourceInput = z.object({
  id: z.enum(REWARD_SOURCES),
  cards: z.number().int().min(1).max(6),
  rarityWeights: perRarity(z.number().min(0)),
  typeWeights: z.object(Object.fromEntries(CARD_TYPES.map((t) => [t, z.number().min(0)])) as Record<(typeof CARD_TYPES)[number], z.ZodNumber>),
  upgradeThreshold: z.number().min(0).max(1000),
  guarantee: z.enum(["none", "oneGear", "allGear"]),
  minRarity: rarity,
  chance: z.number().min(0).max(100).optional(),
  skipGil: z.number().int().min(0).max(100_000),
});

export const boonInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(40),
  description: z.string().max(200),
  enabled: z.boolean(),
  scope: z.enum(["member", "party"]),
  stat: z.enum(BOON_STATS),
  amounts: partialRarity,
  weight: z.number().min(0).max(100),
  affinity: z.array(z.string().max(20)).max(20).optional(),
  minTier: z.number().int().min(0).max(9),
});

export const gearInput = z.object({
  itemId: z.number().int(),
  name: z.string().min(1).max(60),
  mapPools: z.array(z.object({ area: z.string().max(40), bossOnly: z.boolean().optional() })).max(50),
  catalog: z.boolean(),
  catalogPrice: z.number().int().min(0).max(10_000_000).nullable(),
  catalogFromTier: z.number().int().min(0).max(99),
  legendary: z.boolean(),
  enabled: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const adminRouter = router({
  /** All the reward tables as they are in the database. */
  rewardTables: adminProcedure.query(({ ctx }) => ensureRewardContent(ctx.db)),

  saveRarity: adminProcedure.input(rarityInput).mutation(async ({ ctx, input }) => {
    await ctx.db.rewardRarity.upsert({ where: { id: input.id }, create: { id: input.id, sort: input.sort, data: input }, update: { sort: input.sort, data: input } });
    return reloadRewardContent(ctx.db);
  }),
  saveRole: adminProcedure.input(roleInput).mutation(async ({ ctx, input }) => {
    await ctx.db.rewardRole.upsert({ where: { key: input.key }, create: { key: input.key, data: input }, update: { data: input } });
    return reloadRewardContent(ctx.db);
  }),
  saveSource: adminProcedure.input(sourceInput).mutation(async ({ ctx, input }) => {
    await ctx.db.rewardSource.upsert({ where: { id: input.id }, create: { id: input.id, data: input }, update: { data: input } });
    return reloadRewardContent(ctx.db);
  }),
  saveBoon: adminProcedure.input(boonInput).mutation(async ({ ctx, input }) => {
    await ctx.db.rewardBoon.upsert({
      where: { id: input.id },
      create: { id: input.id, name: input.name, enabled: input.enabled, data: input },
      update: { name: input.name, enabled: input.enabled, data: input },
    });
    return reloadRewardContent(ctx.db);
  }),
  deleteBoon: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.rewardBoon.delete({ where: { id: input.id } });
    return reloadRewardContent(ctx.db);
  }),
  saveGear: adminProcedure.input(gearInput).mutation(async ({ ctx, input }) => {
    const known = new Set(WORLDS.map((w) => w.id));
    const bad = input.mapPools.find((p) => !known.has(p.area));
    if (bad) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown area ${bad.area}` });
    await ctx.db.gearAvailability.upsert({
      where: { itemId: input.itemId },
      create: { itemId: input.itemId, name: input.name, enabled: input.enabled, data: input },
      update: { name: input.name, enabled: input.enabled, data: input },
    });
    return reloadRewardContent(ctx.db);
  }),

  /** Roll sample offers: a party (character keys at a level, all gear slots open), an area and a source. */
  preview: adminProcedure
    .input(
      z.object({
        source: z.enum(REWARD_SOURCES),
        world: z.number().int().min(0),
        party: z.array(z.string()).min(1).max(4),
        level: z.number().int().min(1).max(99),
        count: z.number().int().min(1).max(20).default(8),
        seed: z.string().max(40).default("preview"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureRewardContent(ctx.db);
      if (!WORLDS[input.world]) throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown area" });
      const builds: CharacterBuild[] = input.party.map((k) => ({ ...newBuild(k, input.level), unlockedSlots: ["head", "wrist", "armor", "accessory"] }));
      const run: RunState = { ...startRun({ seed: input.seed, tier: 0, party: builds }), world: input.world, phase: { kind: "map" } };
      return Array.from({ length: input.count }, (_, i) => rollOffer(run, input.source, Rng.fromSeed(`${input.seed}:${i}`)));
    }),

  /** Write the tables back into packages/db/seed/rewards (development servers only). */
  exportSeeds: adminProcedure.mutation(async ({ ctx }) => {
    if (process.env.NODE_ENV === "production") throw new TRPCError({ code: "FORBIDDEN", message: "Export writes the repo's seed files: development only" });
    await exportRewardSeeds(ctx.db);
    return { ok: true };
  }),
});
