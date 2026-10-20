/**
 * Admin tools (admins only — better-auth's admin plugin): the reward and gear-availability tables
 * (`.plans/rewards.md` §4). Every save validates the row, writes it, and reloads the tables so the next reward offer,
 * drop pool and catalog use it. `preview` rolls sample offers; `exportSeeds` writes the tables back to the seed
 * files (development servers only) so tuning can be committed.
 */
import { exportRewardSeeds } from "@ffix-roguelike/db/seed-rewards";
import { JOURNEYS, metricDef, newBuild, Rng, rollOffer, startRun, WORLDS, type CharacterBuild, type RunState } from "@ffix-roguelike/game-core";
import {
  ACHIEVEMENT_CATEGORIES,
  BADGE_COUNT,
  ACHIEVEMENT_STATS,
  BOON_STATS,
  CARD_TYPES,
  characters,
  items,
  MODIFIER_STATS,
  RARITIES,
  rewardTables,
  REWARD_SOURCES,
  ROLE_STATS,
  STATUSES,
} from "@ffix-roguelike/game-data";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../index";
import { ensureRewardContent, reloadRewardContent } from "../services/content";
import { loadMetrics, metricLeaderboard } from "../services/metrics";

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
  shopMarkup: z.number().min(0).max(10).optional(),
  shopPrice: z.number().int().min(0).max(1_000_000).optional(),
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
  relicChance: z.number().min(0).max(100).optional(),
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

export const starterInput = z.object({
  character: z.string().min(1).max(20),
  slot: z.enum(["weapon", "head", "wrist", "armor", "accessory"]),
  tier: z.number().int().min(1).max(9),
  itemId: z.number().int(),
  gil: z.number().int().min(0).max(10_000_000),
  cp: z.number().int().min(0).max(9999),
  minStartLevel: z.number().int().min(1).max(99),
  requires: z.object({ journey: z.string().max(40).optional(), achievement: z.string().max(60).optional() }).nullable().optional(),
  enabled: z.boolean(),
  notes: z.string().max(500).optional(),
});

const bad = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

// ── relics, synergies, character tags (`.plans/relics-and-synergies.md` phase 5) ──
const scope = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("party") }),
    z.object({ kind: z.literal("tag"), tag: z.string().min(1).max(30) }),
    z.object({ kind: z.literal("character"), character: z.string().min(1).max(20) }),
  ])
  .optional();
const pct = z.number().min(-100).max(500);
/** One relic / synergy effect: the primitives the engine knows (game-data `ModifierEffect`). */
export const effectInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stat"), stat: z.enum(MODIFIER_STATS), pct, scope }),
  z.object({ kind: z.literal("startStatus"), status: z.enum(STATUSES), scope }),
  z.object({ kind: z.literal("trance"), startPct: z.number().min(0).max(100), scope }),
  z.object({ kind: z.literal("steal"), ratePct: z.number().min(0).max(1000), scope }),
  z.object({ kind: z.literal("mpDiscount"), pct: z.number().min(0).max(90), scope }),
  z.object({ kind: z.literal("onKill"), hpPct: z.number().min(0).max(100).optional(), mpPct: z.number().min(0).max(100).optional(), scope }),
]);

export const relicInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().min(1).max(60),
  description: z.string().max(300),
  flavor: z.string().max(300).optional(),
  rarity,
  cursed: z.boolean().optional(),
  starter: z.boolean().optional(),
  free: z.boolean().optional(),
  unlockedBy: z.string().max(60).optional(),
  badge: z.number().int().min(1).max(BADGE_COUNT).optional(),
  effects: z.array(effectInput).max(8),
  weight: z.number().min(0).max(1000),
  minTier: z.number().int().min(0).max(9),
  sort: z.number().int().min(0).max(9999),
  enabled: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const synergyInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(40),
  tag: z.string().regex(/^[a-z0-9-]{1,30}$/),
  description: z.string().max(300).optional(),
  badge: z.number().int().min(1).max(BADGE_COUNT).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  tiers: z.array(z.object({ count: z.number().int().min(1).max(4), text: z.string().max(200), effects: z.array(effectInput).max(8) })).min(1).max(4),
  enabled: z.boolean(),
});

/** Check what an effect names exists: a synergy tag in use, a character. */
function checkScopes(effects: z.infer<typeof effectInput>[], tags: Set<string>) {
  for (const e of effects) {
    const s = e.scope;
    if (s?.kind === "tag" && !tags.has(s.tag)) throw bad(`Unknown synergy tag ${s.tag}`);
    if (s?.kind === "character" && !characters.some((c) => c.key === s.character)) throw bad(`Unknown character ${s.character}`);
  }
}
const knownTags = () => new Set((rewardTables().synergies ?? []).map((s) => s.tag));

const key = z.string().min(1).max(40);
export const achievementInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().min(1).max(60),
  description: z.string().max(300),
  category: z.enum(ACHIEVEMENT_CATEGORIES),
  sort: z.number().int().min(0).max(9999),
  enabled: z.boolean(),
  secret: z.boolean().optional(),
  badge: z.number().int().min(1).max(BADGE_COUNT).optional(),
  condition: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("stat"), stat: z.enum(ACHIEVEMENT_STATS), min: z.number().int().min(1).max(10_000_000) }),
    z.object({ kind: z.literal("journey"), journey: key }),
    z.object({ kind: z.literal("bosses"), bosses: z.array(key).min(1).max(30) }),
    z.object({ kind: z.literal("roster"), min: z.number().int().min(1).max(20) }),
    z.object({ kind: z.literal("heroes"), heroes: z.array(key).min(1).max(20) }),
    z.object({ kind: z.literal("mastered"), min: z.number().int().min(1).max(10_000) }),
    z.object({ kind: z.literal("solo"), hero: key }),
    z.object({ kind: z.literal("legendClear"), hero: key }),
    z.object({ kind: z.literal("metric"), metric: key, subject: z.string().max(60).optional(), character: key.optional(), min: z.number().min(1).max(1e12) }),
  ]),
  reward: z.object({
    gil: z.number().int().min(0).max(10_000_000).optional(),
    cp: z.number().int().min(0).max(9999).optional(),
    cpFor: key.optional(),
    items: z.array(z.string().max(60)).max(20).optional(),
    bestInSlotFor: key.optional(),
    supplies: z.array(z.string().max(60)).max(20).optional(),
    relicSlots: z.number().int().min(1).max(5).optional(),
  }),
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

  /**
   * Save one starting-gear upgrade tier (`.plans/starter-upgrades.md`). The item must be that slot's kind and wearable
   * by the character; tiers stay 1..n with no gaps (a new tier is the next number).
   */
  saveStarterUpgrade: adminProcedure.input(starterInput).mutation(async ({ ctx, input }) => {
    const ch = characters.find((c) => c.key === input.character);
    if (!ch) throw bad(`Unknown character ${input.character}`);
    const item = items.find((i) => i.id === input.itemId);
    if (!item) throw bad("Unknown item");
    if (item.kind !== input.slot || !item.equippableBy.includes(ch.key)) throw bad(`${ch.name} can't wear ${item.name} as their ${input.slot}`);
    const chain = (rewardTables().starter ?? []).filter((u) => u.character === input.character && u.slot === input.slot);
    if (input.tier > chain.length + 1 && !chain.some((u) => u.tier === input.tier)) throw bad(`Tier ${input.tier} would leave a gap (the chain has ${chain.length})`);
    if (input.requires?.journey && !JOURNEYS.some((j) => j.id === input.requires!.journey)) throw bad("Unknown journey");
    if (input.requires?.achievement && !(rewardTables().achievements ?? []).some((a) => a.id === input.requires!.achievement)) throw bad("Unknown achievement");
    const id = `${input.character}:${input.slot}:${input.tier}`;
    const requires = input.requires?.journey || input.requires?.achievement ? input.requires : null;
    const data = { ...input, id, name: item.name, requires };
    await ctx.db.starterUpgrade.upsert({
      where: { id },
      create: { id, character: input.character, slot: input.slot, tier: input.tier, enabled: input.enabled, data },
      update: { enabled: input.enabled, data },
    });
    return reloadRewardContent(ctx.db);
  }),
  /** Remove a chain's last tier (only the last, so tiers stay 1..n; players who owned it keep their tier count, capped by the chain). */
  deleteStarterUpgrade: adminProcedure.input(z.object({ id: z.string().max(60) })).mutation(async ({ ctx, input }) => {
    const row = (rewardTables().starter ?? []).find((u) => u.id === input.id);
    if (!row) throw bad("No such tier");
    const last = Math.max(...rewardTables().starter.filter((u) => u.character === row.character && u.slot === row.slot).map((u) => u.tier));
    if (row.tier !== last) throw bad("Only the last tier of a chain can be removed");
    await ctx.db.starterUpgrade.delete({ where: { id: input.id } });
    return reloadRewardContent(ctx.db);
  }),

  /**
   * Save an achievement (new or edited). Checks that what it names exists: a journey, characters, reward items and
   * supplies. Boss ids are free text (the bestiary ids recorded as boss kills, e.g. "garland").
   */
  saveAchievement: adminProcedure.input(achievementInput).mutation(async ({ ctx, input }) => {
    const c = input.condition;
    const hero = (k: string) => characters.some((ch) => ch.key === k);
    if (c.kind === "journey" && !JOURNEYS.some((j) => j.id === c.journey)) throw bad(`Unknown journey ${c.journey}`);
    if (c.kind === "heroes" && !c.heroes.every(hero)) throw bad("Unknown character in the condition");
    if ((c.kind === "solo" || c.kind === "legendClear") && !hero(c.hero)) throw bad(`Unknown character ${c.hero}`);
    if (c.kind === "metric") {
      const def = metricDef(c.metric);
      if (!def) throw bad(`Unknown metric ${c.metric}`);
      if (c.subject && !def.subject) throw bad(`${def.label} isn't kept per subject`);
      if (c.character && (!def.perCharacter || (c.character !== "any" && !hero(c.character)))) throw bad(`${def.label} can't be counted for that character`);
    }
    const r = input.reward;
    if ((r.cpFor && !hero(r.cpFor)) || (r.bestInSlotFor && !hero(r.bestInSlotFor))) throw bad("Unknown character in the reward");
    const missing = [...(r.items ?? []), ...(r.supplies ?? [])].find((name) => !items.some((i) => i.name === name));
    if (missing) throw bad(`Unknown item ${missing}`);
    // Drop empty reward fields, so the record stays tidy.
    const reward = Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined && v !== 0 && !(Array.isArray(v) && !v.length) && v !== ""));
    const data = { ...input, reward };
    await ctx.db.achievement.upsert({
      where: { id: input.id },
      create: { id: input.id, category: input.category, sort: input.sort, enabled: input.enabled, data },
      update: { category: input.category, sort: input.sort, enabled: input.enabled, data },
    });
    return reloadRewardContent(ctx.db);
  }),
  /** Delete an achievement. Players who earned it keep the id in their profile (it simply isn't listed any more). */
  deleteAchievement: adminProcedure.input(z.object({ id: z.string().max(60) })).mutation(async ({ ctx, input }) => {
    await ctx.db.achievement.delete({ where: { id: input.id } });
    return reloadRewardContent(ctx.db);
  }),

  /**
   * Save a relic (new or edited). Its unlocking achievement must exist, and its effects' tags / characters too. Edits
   * reach new battles at once; battles already started keep the effects they began with (`BattleState.modifiers`).
   */
  saveRelic: adminProcedure.input(relicInput).mutation(async ({ ctx, input }) => {
    if (input.unlockedBy && !(rewardTables().achievements ?? []).some((a) => a.id === input.unlockedBy)) throw bad(`Unknown achievement ${input.unlockedBy}`);
    checkScopes(input.effects, knownTags());
    // Drop empty optional fields, so the record stays tidy.
    const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ""));
    await ctx.db.relic.upsert({
      where: { id: input.id },
      create: { id: input.id, sort: input.sort, enabled: input.enabled, data },
      update: { sort: input.sort, enabled: input.enabled, data },
    });
    return reloadRewardContent(ctx.db);
  }),
  /** Delete a relic. Runs holding it simply lose its effects; players' collections keep the id (unlisted). */
  deleteRelic: adminProcedure.input(z.object({ id: z.string().max(60) })).mutation(async ({ ctx, input }) => {
    await ctx.db.relic.delete({ where: { id: input.id } });
    return reloadRewardContent(ctx.db);
  }),
  /** Save a synergy (new or edited): its tiers rise in member count; the tiers' effects' scopes must exist. */
  saveSynergy: adminProcedure.input(synergyInput).mutation(async ({ ctx, input }) => {
    const counts = input.tiers.map((t) => t.count);
    if (counts.some((c, i) => i > 0 && c <= counts[i - 1]!)) throw bad("Tiers must need more members as they go up");
    const tags = knownTags().add(input.tag);
    for (const t of input.tiers) checkScopes(t.effects, tags);
    const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ""));
    await ctx.db.synergy.upsert({ where: { id: input.id }, create: { id: input.id, enabled: input.enabled, data }, update: { enabled: input.enabled, data } });
    return reloadRewardContent(ctx.db);
  }),
  /** Set a character's synergy tags (each must be a synergy's tag). */
  saveCharacterTags: adminProcedure
    .input(z.object({ character: z.string().max(20), tags: z.array(z.string().max(30)).max(6) }))
    .mutation(async ({ ctx, input }) => {
      if (!characters.some((c) => c.key === input.character)) throw bad(`Unknown character ${input.character}`);
      const tags = knownTags();
      const unknown = input.tags.find((t) => !tags.has(t));
      if (unknown) throw bad(`Unknown synergy tag ${unknown}`);
      const unique = [...new Set(input.tags)];
      await ctx.db.characterTag.upsert({ where: { character: input.character }, create: { character: input.character, tags: unique }, update: { tags: unique } });
      return reloadRewardContent(ctx.db);
    }),

  // ── metrics ──
  /** Every player with a profile (for the metrics browser). */
  players: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.playerProfile.findMany({
      select: { id: true, runs: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ profileId: r.id, name: r.user.name, email: r.user.email, runs: r.runs }));
  }),
  /** One player's lifetime metrics and recruited characters. */
  playerMetrics: adminProcedure.input(z.object({ profileId: z.string().max(40) })).query(async ({ ctx, input }) => {
    const [metrics, characters] = await Promise.all([
      loadMetrics(ctx.db, input.profileId),
      ctx.db.playerCharacter.findMany({ where: { profileId: input.profileId, unlocked: true }, select: { key: true } }),
    ]);
    return { metrics, unlocked: characters.map((c) => c.key) };
  }),
  /** The top players for a metric (player total / any character / one character; overall or one subject). */
  metricLeaderboard: adminProcedure
    .input(z.object({ key: z.string().max(60), subject: z.string().max(60).optional(), character: z.string().max(20).optional(), limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      if (!metricDef(input.key)) throw bad(`Unknown metric ${input.key}`);
      return metricLeaderboard(ctx.db, input.key, input);
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
