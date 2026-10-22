/**
 * The reward tables (`.plans/content-db.md` R1), the same way as the content tables (`content.ts`): reward_rarity,
 * reward_role, reward_source, reward_boon, gear_availability (+ gear_map_pool), starter_upgrade, achievement, relic,
 * synergy. Single values are columns, references to our own tables are foreign keys (a relic's rarity and unlocking
 * achievement, a starter tier's journey / achievement, a gear pool's area), lists of references are join tables
 * (gear_map_pool), and `data` keeps only nested config edited as a whole (effects, tiers, weight maps, an
 * achievement's condition and the rest of its reward).
 *
 * - The `write*` functions write one flat row (game-data's `RelicData`, `GearAvailability`…, the seed files' shape)
 *   into its columns and join rows. The admin page's saves use them.
 * - `normalizeRewards` converts rows whose fields are still in `data` (inserted by the seed or `sync-seeds`, or from
 *   before R1) through those same writers. It runs on every boot seed and touches only such rows.
 * - `loadRewards` reads the tables back as the flat rows game-data expects.
 *
 * Item ids are plain ints, checked on save (ff9_item is wiped and reloaded whenever FF9's seed changes). An
 * achievement's reward names items in the flat row (`reward.items`, `reward.supplies`) and stores their ids.
 */
import type { Database } from "./index";

type Row = Record<string, unknown>;
type Tx = Parameters<Parameters<Database["$transaction"]>[0]>[0];
type Db = Database | Tx;

const isObj = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const optNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const without = (d: Row, keys: string[]) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k))) as object;
const nested = (d: unknown): Row => (isObj(d) ? d : {});
/** An optional field in a flat row: present only when set. */
const when = <T>(key: string, v: T | null | undefined | false) => (v === null || v === undefined || v === false ? {} : { [key]: v });
const whenAny = (key: string, v: unknown[]) => (v.length ? { [key]: v } : {});

/** Each table's fields that are columns (or key / join rows): everything else in a flat row stays in `data`. */
const FIELDS = {
  rarities: ["id", "sort", "name", "color", "apSurge", "gil", "supplies", "nextBand", "bandSteps", "shopMarkup", "shopPrice"],
  roles: ["key", "abilityWeight", "preferredAbilities", "notes"],
  sources: ["id", "cards", "upgradeThreshold", "guarantee", "minRarity", "chance", "skipGil", "relicChance"],
  boons: ["id", "name", "enabled", "description", "scope", "stat", "weight", "minTier", "affinity"],
  gear: ["itemId", "name", "enabled", "mapPools", "catalog", "catalogPrice", "catalogFromTier", "legendary", "notes"],
  starter: ["id", "character", "slot", "tier", "enabled", "itemId", "name", "gil", "cp", "minStartLevel", "requires", "notes"],
  achievements: ["id", "category", "sort", "enabled", "name", "description", "secret", "badge", "notes"],
  relics: ["id", "sort", "enabled", "name", "description", "flavor", "rarity", "cursed", "starter", "free", "unlockedBy", "badge", "weight", "minTier", "notes"],
  synergies: ["id", "enabled", "name", "tag", "description", "badge", "color"],
} as const;
export type RewardTable = keyof typeof FIELDS;
export const REWARD_COLUMN_TABLES = Object.keys(FIELDS) as RewardTable[];

/** A field that only an unconverted row still has in `data` (normalizing moves it to a column). */
const MARKER: Record<RewardTable, string> = {
  rarities: "name",
  roles: "abilityWeight",
  sources: "cards",
  boons: "stat",
  gear: "catalog",
  starter: "itemId",
  achievements: "name",
  relics: "name",
  synergies: "name",
};

// ── writers: one flat row → columns + join rows ──

export async function writeRarity(tx: Tx, r: Row): Promise<void> {
  const id = str(r.id);
  const row = {
    sort: num(r.sort),
    name: str(r.name),
    color: str(r.color, "#ffffff"),
    apSurge: num(r.apSurge),
    gil: num(r.gil),
    supplies: num(r.supplies),
    nextBand: num(r.nextBand),
    bandSteps: optNum(r.bandSteps),
    shopMarkup: optNum(r.shopMarkup),
    shopPrice: optNum(r.shopPrice),
    data: without(r, [...FIELDS.rarities]),
  };
  await tx.rewardRarity.upsert({ where: { id }, create: { id, ...row }, update: row });
}

export async function writeRole(tx: Tx, r: Row): Promise<void> {
  const key = str(r.key);
  const row = { abilityWeight: num(r.abilityWeight), preferredAbilities: strs(r.preferredAbilities), notes: opt(r.notes), data: without(r, [...FIELDS.roles]) };
  await tx.rewardRole.upsert({ where: { key }, create: { key, ...row }, update: row });
}

export async function writeSource(tx: Tx, r: Row): Promise<void> {
  const id = str(r.id);
  const row = {
    cards: num(r.cards, 1),
    upgradeThreshold: num(r.upgradeThreshold),
    guarantee: str(r.guarantee, "none"),
    minRarity: str(r.minRarity, "common"),
    chance: optNum(r.chance),
    skipGil: num(r.skipGil),
    relicChance: optNum(r.relicChance),
    data: without(r, [...FIELDS.sources]),
  };
  await tx.rewardSource.upsert({ where: { id }, create: { id, ...row }, update: row });
}

export async function writeBoon(tx: Tx, r: Row): Promise<void> {
  const id = str(r.id);
  const row = {
    name: str(r.name),
    enabled: r.enabled !== false,
    description: str(r.description),
    scope: str(r.scope, "member"),
    stat: str(r.stat, "strength"),
    weight: num(r.weight, 1),
    minTier: num(r.minTier),
    affinity: strs(r.affinity),
    data: without(r, [...FIELDS.boons]),
  };
  await tx.rewardBoon.upsert({ where: { id }, create: { id, ...row }, update: row });
}

/** A gear piece and its map pools (replacing its pools). An area that doesn't exist fails the write. */
export async function writeGear(tx: Tx, r: Row): Promise<void> {
  const itemId = num(r.itemId);
  const row = {
    name: str(r.name),
    enabled: r.enabled !== false,
    catalog: r.catalog === true,
    catalogPrice: optNum(r.catalogPrice),
    catalogFromTier: num(r.catalogFromTier),
    legendary: r.legendary === true,
    notes: opt(r.notes),
    data: without(r, [...FIELDS.gear]),
  };
  await tx.gearAvailability.upsert({ where: { itemId }, create: { itemId, ...row }, update: row });
  const pools = (Array.isArray(r.mapPools) ? r.mapPools : []).filter(isObj);
  await tx.gearMapPool.deleteMany({ where: { itemId } });
  await tx.gearMapPool.createMany({ data: pools.map((p, position) => ({ itemId, areaId: str(p.area), bossOnly: p.bossOnly === true, position })) });
}

export async function writeStarter(tx: Tx, r: Row): Promise<void> {
  const id = str(r.id);
  const requires = nested(r.requires);
  const row = {
    character: str(r.character),
    slot: str(r.slot),
    tier: num(r.tier, 1),
    enabled: r.enabled !== false,
    itemId: num(r.itemId),
    name: str(r.name),
    gil: num(r.gil),
    cp: num(r.cp),
    minStartLevel: num(r.minStartLevel, 1),
    requiresJourneyId: opt(requires.journey),
    requiresAchievementId: opt(requires.achievement),
    notes: opt(r.notes),
    data: without(r, [...FIELDS.starter]),
  };
  await tx.starterUpgrade.upsert({ where: { id }, create: { id, ...row }, update: row });
}

/** FF9 item name → id (an achievement reward names items; the table stores ids). */
export async function itemIdsByName(db: Db): Promise<Map<string, number>> {
  const items = await db.ff9Item.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } });
  const byName = new Map<string, number>();
  for (const i of items) if (!byName.has(i.name)) byName.set(i.name, i.id);
  return byName;
}

/** An achievement. Its reward's item and supply names must be FF9 items (`itemIds`: `itemIdsByName`). */
export async function writeAchievement(tx: Tx, r: Row, itemIds: Map<string, number>): Promise<void> {
  const id = str(r.id);
  const { items, supplies, ...reward } = nested(r.reward);
  const ids = (names: unknown) =>
    strs(names).map((name) => {
      const itemId = itemIds.get(name);
      if (itemId === undefined) throw new Error(`unknown item ${name}`);
      return itemId;
    });
  const row = {
    category: str(r.category),
    sort: num(r.sort),
    enabled: r.enabled !== false,
    name: str(r.name),
    description: str(r.description),
    secret: r.secret === true,
    badge: optNum(r.badge),
    rewardItemIds: ids(items),
    rewardSupplyIds: ids(supplies),
    notes: opt(r.notes),
    data: { ...without(r, [...FIELDS.achievements, "reward"]), reward } as object,
  };
  await tx.achievement.upsert({ where: { id }, create: { id, ...row }, update: row });
}

export async function writeRelic(tx: Tx, r: Row): Promise<void> {
  const id = str(r.id);
  const row = {
    sort: num(r.sort),
    enabled: r.enabled !== false,
    name: str(r.name),
    description: str(r.description),
    flavor: opt(r.flavor),
    rarityId: str(r.rarity, "common"),
    cursed: r.cursed === true,
    starter: r.starter === true,
    free: r.free === true,
    unlockedById: opt(r.unlockedBy),
    badge: optNum(r.badge),
    weight: num(r.weight),
    minTier: num(r.minTier),
    notes: opt(r.notes),
    data: without(r, [...FIELDS.relics]),
  };
  await tx.relic.upsert({ where: { id }, create: { id, ...row }, update: row });
}

export async function writeSynergy(tx: Tx, r: Row): Promise<void> {
  const id = str(r.id);
  const row = {
    enabled: r.enabled !== false,
    name: str(r.name),
    tag: str(r.tag),
    description: opt(r.description),
    badge: optNum(r.badge),
    color: opt(r.color),
    data: without(r, [...FIELDS.synergies]),
  };
  await tx.synergy.upsert({ where: { id }, create: { id, ...row }, update: row });
}

/** Write one flat row of a reward table (seed shape) into its columns and join rows. */
export async function writeRewardRow(tx: Tx, table: RewardTable, r: Row, itemIds?: Map<string, number>): Promise<void> {
  switch (table) {
    case "rarities":
      return writeRarity(tx, r);
    case "roles":
      return writeRole(tx, r);
    case "sources":
      return writeSource(tx, r);
    case "boons":
      return writeBoon(tx, r);
    case "gear":
      return writeGear(tx, r);
    case "starter":
      return writeStarter(tx, r);
    case "achievements":
      return writeAchievement(tx, r, itemIds ?? (await itemIdsByName(tx)));
    case "relics":
      return writeRelic(tx, r);
    case "synergies":
      return writeSynergy(tx, r);
  }
}

// ── normalizing: rows whose fields are still in `data` ──

/** How many rows of each table were converted. */
export type NormalizeRewardCounts = Record<RewardTable, number>;

/**
 * Move fields still in `data` into columns and join rows, through the writers. Referenced tables go first (rarities and
 * achievements before relics and starter tiers; areas and journeys are converted by `normalizeContent` before this).
 * A row naming something that doesn't exist fails its own conversion (the foreign keys refuse it) and is logged; the
 * rest go on.
 */
export async function normalizeRewards(db: Database): Promise<NormalizeRewardCounts> {
  const counts = Object.fromEntries(REWARD_COLUMN_TABLES.map((t) => [t, 0])) as NormalizeRewardCounts;
  const pending = <T extends { data: unknown }>(rows: T[], table: RewardTable) => rows.filter((r) => MARKER[table] in nested(r.data));
  const itemIds = await itemIdsByName(db);
  const convert = async (table: RewardTable, key: string, flat: Row) => {
    try {
      await db.$transaction((tx) => writeRewardRow(tx, table, flat, itemIds));
      counts[table]++;
    } catch (err) {
      console.error(`Rewards: couldn't convert ${table} ${key}:`, err instanceof Error ? err.message : err);
    }
  };

  for (const r of pending(await db.rewardRarity.findMany({ select: { id: true, sort: true, data: true } }), "rarities")) await convert("rarities", r.id, { ...nested(r.data), id: r.id, sort: r.sort });
  for (const r of pending(await db.rewardRole.findMany({ select: { key: true, data: true } }), "roles")) await convert("roles", r.key, { ...nested(r.data), key: r.key });
  for (const r of pending(await db.rewardSource.findMany({ select: { id: true, data: true } }), "sources")) await convert("sources", r.id, { ...nested(r.data), id: r.id });
  for (const r of pending(await db.rewardBoon.findMany({ select: { id: true, name: true, enabled: true, data: true } }), "boons"))
    await convert("boons", r.id, { name: r.name, enabled: r.enabled, ...nested(r.data), id: r.id });
  for (const r of pending(await db.achievement.findMany({ select: { id: true, category: true, sort: true, enabled: true, data: true } }), "achievements"))
    await convert("achievements", r.id, { category: r.category, sort: r.sort, enabled: r.enabled, ...nested(r.data), id: r.id });
  for (const r of pending(await db.synergy.findMany({ select: { id: true, enabled: true, data: true } }), "synergies")) await convert("synergies", r.id, { enabled: r.enabled, ...nested(r.data), id: r.id });
  for (const r of pending(await db.relic.findMany({ select: { id: true, sort: true, enabled: true, data: true } }), "relics"))
    await convert("relics", r.id, { sort: r.sort, enabled: r.enabled, ...nested(r.data), id: r.id });
  for (const r of pending(await db.starterUpgrade.findMany({ select: { id: true, character: true, slot: true, tier: true, enabled: true, data: true } }), "starter"))
    await convert("starter", r.id, { character: r.character, slot: r.slot, tier: r.tier, enabled: r.enabled, ...nested(r.data), id: r.id });
  for (const r of pending(await db.gearAvailability.findMany({ select: { itemId: true, name: true, enabled: true, data: true } }), "gear"))
    await convert("gear", String(r.itemId), { name: r.name, enabled: r.enabled, ...nested(r.data), itemId: r.itemId });
  return counts;
}

// ── loading: columns + join rows → flat rows ──

/**
 * The reward tables as flat rows (game-data `RewardRarity`, `GearAvailability`, `RelicData`…), in the order the game
 * and the seed files use. Leftover `data` fields come last, so a row whose conversion failed still reads as it was.
 */
export async function loadRewards(db: Db) {
  const [rarities, roles, sources, boons, gear, starter, achievements, relics, synergies, items] = await Promise.all([
    db.rewardRarity.findMany({ orderBy: { sort: "asc" } }),
    db.rewardRole.findMany({ orderBy: { key: "asc" } }),
    db.rewardSource.findMany({ orderBy: { id: "asc" } }),
    db.rewardBoon.findMany({ orderBy: { id: "asc" } }),
    db.gearAvailability.findMany({ orderBy: { itemId: "asc" }, include: { mapPools: { orderBy: { position: "asc" } } } }),
    db.starterUpgrade.findMany({ orderBy: [{ character: "asc" }, { slot: "asc" }, { tier: "asc" }] }),
    db.achievement.findMany({ orderBy: [{ category: "asc" }, { sort: "asc" }] }),
    db.relic.findMany({ orderBy: { sort: "asc" } }),
    db.synergy.findMany({ orderBy: { id: "asc" } }),
    db.ff9Item.findMany({ select: { id: true, name: true } }),
  ]);
  const itemName = new Map(items.map((i) => [i.id, i.name]));
  // An id FF9's table no longer has keeps its number, so the row still says what it held.
  const names = (ids: number[]) => ids.map((id) => itemName.get(id) ?? String(id));
  return {
    rarities: rarities.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      sort: r.sort,
      apSurge: r.apSurge,
      gil: r.gil,
      supplies: r.supplies,
      nextBand: r.nextBand,
      ...when("bandSteps", r.bandSteps),
      ...when("shopMarkup", r.shopMarkup),
      ...when("shopPrice", r.shopPrice),
      ...nested(r.data),
    })),
    roles: roles.map((r) => {
      const { weights, ...rest } = nested(r.data);
      return { key: r.key, weights: weights ?? {}, abilityWeight: r.abilityWeight, preferredAbilities: r.preferredAbilities, ...when("notes", r.notes), ...rest };
    }),
    sources: sources.map((s) => {
      const { rarityWeights, typeWeights, ...rest } = nested(s.data);
      return {
        id: s.id,
        cards: s.cards,
        ...when("chance", s.chance),
        rarityWeights: rarityWeights ?? {},
        typeWeights: typeWeights ?? {},
        upgradeThreshold: s.upgradeThreshold,
        guarantee: s.guarantee,
        minRarity: s.minRarity,
        skipGil: s.skipGil,
        ...when("relicChance", s.relicChance),
        ...rest,
      };
    }),
    boons: boons.map((b) => {
      const { amounts, ...rest } = nested(b.data);
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        enabled: b.enabled,
        scope: b.scope,
        stat: b.stat,
        amounts: amounts ?? {},
        weight: b.weight,
        minTier: b.minTier,
        ...whenAny("affinity", b.affinity),
        ...rest,
      };
    }),
    gear: gear.map((g) => ({
      itemId: g.itemId,
      name: g.name,
      mapPools: g.mapPools.map((p) => ({ area: p.areaId, ...when("bossOnly", p.bossOnly) })),
      catalog: g.catalog,
      catalogPrice: g.catalogPrice,
      catalogFromTier: g.catalogFromTier,
      legendary: g.legendary,
      enabled: g.enabled,
      ...when("notes", g.notes),
      ...nested(g.data),
    })),
    starter: starter.map((u) => ({
      id: u.id,
      character: u.character,
      slot: u.slot,
      tier: u.tier,
      itemId: u.itemId,
      name: u.name,
      gil: u.gil,
      cp: u.cp,
      minStartLevel: u.minStartLevel,
      requires: u.requiresJourneyId || u.requiresAchievementId ? { ...when("journey", u.requiresJourneyId), ...when("achievement", u.requiresAchievementId) } : null,
      enabled: u.enabled,
      ...when("notes", u.notes),
      ...nested(u.data),
    })),
    achievements: achievements.map((a) => {
      const { condition, reward, ...rest } = nested(a.data);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        category: a.category,
        condition,
        reward: { ...nested(reward), ...whenAny("items", names(a.rewardItemIds)), ...whenAny("supplies", names(a.rewardSupplyIds)) },
        sort: a.sort,
        enabled: a.enabled,
        ...when("badge", a.badge),
        ...when("secret", a.secret),
        ...when("notes", a.notes),
        ...rest,
      };
    }),
    relics: relics.map((r) => {
      const { effects, ...rest } = nested(r.data);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        ...when("flavor", r.flavor),
        rarity: r.rarityId,
        ...when("cursed", r.cursed),
        ...when("starter", r.starter),
        ...when("free", r.free),
        ...when("unlockedBy", r.unlockedById),
        ...when("badge", r.badge),
        effects: effects ?? [],
        weight: r.weight,
        minTier: r.minTier,
        sort: r.sort,
        enabled: r.enabled,
        ...when("notes", r.notes),
        ...rest,
      };
    }),
    synergies: synergies.map((s) => {
      const { tiers, ...rest } = nested(s.data);
      return {
        id: s.id,
        name: s.name,
        tag: s.tag,
        ...when("description", s.description),
        ...when("badge", s.badge),
        ...when("color", s.color),
        tiers: tiers ?? [],
        enabled: s.enabled,
        ...rest,
      };
    }),
  };
}

/**
 * Seeded gear pools the database lacks (new areas, `gen-reward-seeds --add-pools`): each piece gains the seeded areas
 * it doesn't list yet, after the ones it has. Pools removed on the admin page come back unless exported. Areas that
 * don't exist are skipped (logged). Returns how many pool rows were added.
 */
export async function addSeededGearPools(db: Database, seeded: { itemId: number; mapPools?: { area: string; bossOnly?: boolean }[] }[]): Promise<number> {
  const [pools, gear, areas] = await Promise.all([
    db.gearMapPool.findMany({ select: { itemId: true, areaId: true, position: true } }),
    db.gearAvailability.findMany({ select: { itemId: true } }),
    db.area.findMany({ select: { id: true } }),
  ]);
  const haveGear = new Set(gear.map((g) => g.itemId));
  const haveArea = new Set(areas.map((a) => a.id));
  const byItem = new Map<number, { areas: Set<string>; next: number }>();
  for (const p of pools) {
    const e = byItem.get(p.itemId) ?? { areas: new Set<string>(), next: 0 };
    e.areas.add(p.areaId);
    e.next = Math.max(e.next, p.position + 1);
    byItem.set(p.itemId, e);
  }
  const add: { itemId: number; areaId: string; bossOnly: boolean; position: number }[] = [];
  const unknown = new Set<string>();
  for (const s of seeded) {
    if (!haveGear.has(s.itemId)) continue;
    const e = byItem.get(s.itemId) ?? { areas: new Set<string>(), next: 0 };
    for (const p of s.mapPools ?? []) {
      if (e.areas.has(p.area)) continue;
      if (!haveArea.has(p.area)) {
        unknown.add(p.area);
        continue;
      }
      add.push({ itemId: s.itemId, areaId: p.area, bossOnly: p.bossOnly === true, position: e.next++ });
      e.areas.add(p.area);
    }
    byItem.set(s.itemId, e);
  }
  if (unknown.size) console.error(`Rewards: gear pools name areas that don't exist: ${[...unknown].join(", ")}`);
  if (add.length) await db.gearMapPool.createMany({ data: add, skipDuplicates: true });
  return add.length;
}
