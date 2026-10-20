/**
 * Seed the reward and gear-availability tables (reward_rarity, reward_role, reward_source, reward_boon,
 * gear_availability, starter_upgrade, achievement, relic, synergy, character_tag, journey_group) from packages/db/seed/rewards. **Inserts missing rows only**: rows already in the database
 * — possibly edited on the admin page — are never overwritten, so the server can run this on every startup. New
 * rows in the seed files (a new boon, a new gear piece) appear on the next start.
 *
 * `exportRewardSeeds` goes the other way: the database back into the seed files, so tuning done on the admin page
 * can be committed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "./index";

export const REWARD_SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "rewards");
const FILES = {
  rarities: "rarities.json",
  roles: "roles.json",
  sources: "sources.json",
  boons: "boons.json",
  gear: "gear-availability.json",
  starter: "starter-upgrades.json",
  achievements: "achievements.json",
  relics: "relics.json",
  synergies: "synergies.json",
  characterTags: "character-tags.json",
  journeyGroups: "journey-groups.json",
} as const;

/** First-pass badges for the seeded achievements (id → badge number); see `seedRewards`. */
const BADGES_FILE = "achievement-badges.json";

type Row = Record<string, unknown>;
type Table = keyof typeof FILES;
const read = (f: string) => JSON.parse(readFileSync(join(REWARD_SEED_DIR, f), "utf8")) as Row[];
const data = (r: Row) => r as object;

/**
 * Each table's primary key column and how a seed row becomes a database row. Shared by `seedRewards` (insert
 * missing) and `syncRewardRows` (insert or overwrite chosen rows).
 */
const SPECS: Record<Table, { key: string; record: (r: Row) => Row }> = {
  rarities: { key: "id", record: (r) => ({ id: String(r.id), sort: Number(r.sort), data: data(r) }) },
  roles: { key: "key", record: (r) => ({ key: String(r.key), data: data(r) }) },
  sources: { key: "id", record: (r) => ({ id: String(r.id), data: data(r) }) },
  boons: { key: "id", record: (r) => ({ id: String(r.id), name: String(r.name), enabled: r.enabled !== false, data: data(r) }) },
  gear: { key: "itemId", record: (r) => ({ itemId: Number(r.itemId), name: String(r.name), enabled: r.enabled !== false, data: data(r) }) },
  starter: {
    key: "id",
    record: (r) => ({ id: String(r.id), character: String(r.character), slot: String(r.slot), tier: Number(r.tier), enabled: r.enabled !== false, data: data(r) }),
  },
  achievements: { key: "id", record: (r) => ({ id: String(r.id), category: String(r.category), sort: Number(r.sort), enabled: r.enabled !== false, data: data(r) }) },
  relics: { key: "id", record: (r) => ({ id: String(r.id), sort: Number(r.sort), enabled: r.enabled !== false, data: data(r) }) },
  synergies: { key: "id", record: (r) => ({ id: String(r.id), enabled: r.enabled !== false, data: data(r) }) },
  characterTags: { key: "character", record: (r) => ({ character: String(r.character), tags: (r.tags as string[]) ?? [] }) },
  journeyGroups: { key: "id", record: (r) => ({ id: String(r.id), sort: Number(r.sort), enabled: r.enabled !== false, data: data(r) }) },
};

/** The Prisma model behind each table, loosely typed so the sync can treat them alike. */
type Model = {
  findMany(args: object): Promise<Row[]>;
  upsert(args: object): Promise<unknown>;
};
const model = (db: Database, table: Table): Model =>
  ({
    rarities: db.rewardRarity,
    roles: db.rewardRole,
    sources: db.rewardSource,
    boons: db.rewardBoon,
    gear: db.gearAvailability,
    starter: db.starterUpgrade,
    achievements: db.achievement,
    relics: db.relic,
    synergies: db.synergy,
    characterTags: db.characterTag,
    journeyGroups: db.journeyGroup,
  })[table] as unknown as Model;

/** Achievement id → badge number: achievement-badges.json, then any `badge` in achievements.json. */
function achievementBadges(achievements: Row[]): Record<string, number> {
  const badgeFile = join(REWARD_SEED_DIR, BADGES_FILE);
  const badgeMap: Record<string, number> = existsSync(badgeFile) ? JSON.parse(readFileSync(badgeFile, "utf8")) : {};
  for (const r of achievements) if (typeof r.badge === "number") badgeMap[String(r.id)] = r.badge;
  return badgeMap;
}

/** Returns how many rows were inserted per table. */
export async function seedRewards(db: Database): Promise<Record<Table, number>> {
  const [rarities, roles, sources, boons, gear, starter, achievements, relics, synergies, characterTags, journeyGroups] = [
    read(FILES.rarities),
    read(FILES.roles),
    read(FILES.sources),
    read(FILES.boons),
    read(FILES.gear),
    read(FILES.starter),
    read(FILES.achievements),
    read(FILES.relics),
    read(FILES.synergies),
    read(FILES.characterTags),
    read(FILES.journeyGroups),
  ];
  const rec = (t: Table, rows: Row[]) => rows.map(SPECS[t].record) as never;
  const results = await db.$transaction([
    db.rewardRarity.createMany({ data: rec("rarities", rarities), skipDuplicates: true }),
    db.rewardRole.createMany({ data: rec("roles", roles), skipDuplicates: true }),
    db.rewardSource.createMany({ data: rec("sources", sources), skipDuplicates: true }),
    db.rewardBoon.createMany({ data: rec("boons", boons), skipDuplicates: true }),
    db.gearAvailability.createMany({ data: rec("gear", gear), skipDuplicates: true }),
    db.starterUpgrade.createMany({ data: rec("starter", starter), skipDuplicates: true }),
    db.achievement.createMany({ data: rec("achievements", achievements), skipDuplicates: true }),
    db.relic.createMany({ data: rec("relics", relics), skipDuplicates: true }),
    db.synergy.createMany({ data: rec("synergies", synergies), skipDuplicates: true }),
    db.characterTag.createMany({ data: rec("characterTags", characterTags), skipDuplicates: true }),
    db.journeyGroup.createMany({ data: rec("journeyGroups", journeyGroups), skipDuplicates: true }),
  ]);
  // Badges (achievement-badges.json: achievement id → badge number, and any `badge` in achievements.json) fill in
  // rows that have none, including rows that existed before badges did. A badge picked on the admin page stays.
  const badgeMap = achievementBadges(achievements);
  const badged = Object.entries(badgeMap);
  if (badged.length) {
    const ids = badged.map(([id]) => id);
    const badges = badged.map(([, n]) => n);
    await db.$executeRaw`UPDATE achievement a SET data = jsonb_set(a.data, '{badge}', to_jsonb(s.badge)) FROM unnest(${ids}::text[], ${badges}::int[]) AS s(id, badge) WHERE a.id = s.id AND a.data->'badge' IS NULL`;
  }
  // Synergy colours added to the seed after the rows existed: fill in rows that have none (an edited colour stays).
  const coloured = synergies.filter((r) => typeof r.color === "string");
  if (coloured.length) {
    const ids = coloured.map((r) => String(r.id));
    const colors = coloured.map((r) => String(r.color));
    await db.$executeRaw`UPDATE synergy s SET data = jsonb_set(s.data, '{color}', to_jsonb(c.color)) FROM unnest(${ids}::text[], ${colors}::text[]) AS c(id, color) WHERE s.id = c.id AND s.data->'color' IS NULL`;
  }
  // Gear map pools added to the seed after the rows existed (new areas, `gen-reward-seeds --add-pools`): each piece
  // gains the seeded areas it doesn't list yet. Pools removed on the admin page come back unless exported (as tags).
  const seededPools = new Map(gear.map((r) => [Number(r.itemId), ((r.mapPools as { area: string; bossOnly?: boolean }[]) ?? [])]));
  const rows = await db.gearAvailability.findMany({ select: { itemId: true, data: true } });
  for (const row of rows) {
    const d = row.data as { mapPools?: { area: string; bossOnly?: boolean }[] };
    const have = d.mapPools ?? [];
    const missing = (seededPools.get(row.itemId) ?? []).filter((p) => !have.some((h) => h.area === p.area));
    if (missing.length) await db.gearAvailability.update({ where: { itemId: row.itemId }, data: { data: { ...d, mapPools: [...have, ...missing] } } });
  }
  // Characters' synergy tags added to the seed after their rows existed (a new synergy): each character gains the
  // seeded tags it's missing, after the ones it has. Removing a seeded tag for good means exporting from the admin
  // page (so the seed drops it too), or it comes back on the next start.
  for (const r of characterTags) {
    const seeded = ((r.tags as string[]) ?? []).map(String);
    if (!seeded.length) continue;
    await db.$executeRaw`UPDATE character_tag SET tags = tags || ARRAY(SELECT t FROM unnest(${seeded}::text[]) AS t WHERE t <> ALL(tags)) WHERE "character" = ${String(r.character)} AND NOT (tags @> ${seeded}::text[])`;
  }
  return {
    rarities: results[0].count,
    roles: results[1].count,
    sources: results[2].count,
    boons: results[3].count,
    gear: results[4].count,
    starter: results[5].count,
    achievements: results[6].count,
    relics: results[7].count,
    synergies: results[8].count,
    characterTags: results[9].count,
    journeyGroups: results[10].count,
  };
}

export const REWARD_TABLES = Object.keys(FILES) as Table[];

export type SyncAction = "insert" | "overwrite" | "same";
export interface SyncRow {
  key: string;
  /** The row's name when it has one, else its key. */
  label: string;
  action: SyncAction;
  /** Fields whose value in the database differs from the seed (overwrite only). */
  changed: string[];
}

/** JSON with object keys sorted, so Postgres's jsonb key order doesn't count as a change. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/**
 * Whether a seed row is picked by one of the tokens (case-insensitive): its key, its character, or its name exactly,
 * or the start of its key up to a `:` or `-` (`marcus` → `marcus:weapon:1`, `story` → `story-burmecia`). No tokens
 * picks every row.
 */
function picked(r: Row, key: string, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const k = key.toLowerCase();
  const names = [r.character, r.name].filter((x) => x != null).map((x) => String(x).toLowerCase());
  return tokens.some((t) => k === t || k.startsWith(`${t}:`) || k.startsWith(`${t}-`) || names.includes(t));
}

/**
 * Force chosen seed rows into the database: rows the database lacks are inserted, and rows it has are **overwritten**
 * with the seed's version, discarding edits made on the admin page. The rest of the table is left alone (unlike
 * `resetRewardTable`, which reseeds all of it). Returns what happened, or would happen without `apply`, per row.
 */
export async function syncRewardRows(db: Database, table: Table, tokens: string[], { apply = false } = {}): Promise<SyncRow[]> {
  const spec = SPECS[table];
  const seed = read(FILES[table]);
  const badges = table === "achievements" ? achievementBadges(seed) : {};
  const wanted = seed
    .filter((r) => picked(r, String(r[spec.key]), tokens.map((t) => t.toLowerCase())))
    // An achievement's seeded badge may live in achievement-badges.json; keep it when overwriting.
    .map((r) => (table === "achievements" && r.badge == null && badges[String(r.id)] != null ? { ...r, badge: badges[String(r.id)] } : r))
    .map(spec.record);
  if (!wanted.length) return [];
  const m = model(db, table);
  const existing = await m.findMany({ where: { [spec.key]: { in: wanted.map((w) => w[spec.key]) } } });
  const byKey = new Map(existing.map((e) => [String(e[spec.key]), e]));
  const out: SyncRow[] = [];
  for (const w of wanted) {
    const key = String(w[spec.key]);
    const have = byKey.get(key);
    const label = String((w.data as Row | undefined)?.name ?? key);
    let changed: string[] = [];
    if (have) {
      if (table === "characterTags") changed = stable(have.tags) === stable(w.tags) ? [] : ["tags"];
      else {
        const a = (have.data ?? {}) as Row;
        const b = w.data as Row;
        changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((f) => stable(a[f]) !== stable(b[f])).sort();
      }
    }
    const action: SyncAction = !have ? "insert" : changed.length ? "overwrite" : "same";
    out.push({ key, label, action, changed });
    if (apply && action !== "same") await m.upsert({ where: { [spec.key]: w[spec.key] }, create: w, update: w });
  }
  return out;
}

/** Throw away one table's rows and seed it again from its file (discards the admin page's edits to it). */
export async function resetRewardTable(db: Database, table: Table): Promise<number> {
  const del = {
    rarities: () => db.rewardRarity.deleteMany(),
    roles: () => db.rewardRole.deleteMany(),
    sources: () => db.rewardSource.deleteMany(),
    boons: () => db.rewardBoon.deleteMany(),
    gear: () => db.gearAvailability.deleteMany(),
    starter: () => db.starterUpgrade.deleteMany(),
    achievements: () => db.achievement.deleteMany(),
    relics: () => db.relic.deleteMany(),
    synergies: () => db.synergy.deleteMany(),
    characterTags: () => db.characterTag.deleteMany(),
    journeyGroups: () => db.journeyGroup.deleteMany(),
  }[table];
  await del();
  return (await seedRewards(db))[table];
}

/** Write the database's reward tables back to the seed files (dev: commit tuning done on the admin page). */
export async function exportRewardSeeds(db: Database): Promise<void> {
  const [rarities, roles, sources, boons, gear, starter, achievements, relics, synergies, characterTags, journeyGroups] = await Promise.all([
    db.rewardRarity.findMany({ orderBy: { sort: "asc" } }),
    db.rewardRole.findMany({ orderBy: { key: "asc" } }),
    db.rewardSource.findMany({ orderBy: { id: "asc" } }),
    db.rewardBoon.findMany({ orderBy: { id: "asc" } }),
    db.gearAvailability.findMany({ orderBy: { itemId: "asc" } }),
    db.starterUpgrade.findMany({ orderBy: [{ character: "asc" }, { slot: "asc" }, { tier: "asc" }] }),
    db.achievement.findMany({ orderBy: [{ category: "asc" }, { sort: "asc" }] }),
    db.relic.findMany({ orderBy: { sort: "asc" } }),
    db.synergy.findMany({ orderBy: { id: "asc" } }),
    db.characterTag.findMany({ orderBy: { character: "asc" } }),
    db.journeyGroup.findMany({ orderBy: { sort: "asc" } }),
  ]);
  const write = (f: string, rows: { data: unknown }[]) => writeFileSync(join(REWARD_SEED_DIR, f), `${JSON.stringify(rows.map((r) => r.data), null, 2)}\n`);
  write(FILES.rarities, rarities);
  write(FILES.roles, roles);
  write(FILES.sources, sources);
  write(FILES.boons, boons);
  write(FILES.gear, gear);
  write(FILES.starter, starter);
  write(FILES.achievements, achievements);
  write(FILES.relics, relics);
  write(FILES.synergies, synergies);
  write(FILES.journeyGroups, journeyGroups);
  writeFileSync(join(REWARD_SEED_DIR, FILES.characterTags), `${JSON.stringify(characterTags.map((r) => ({ character: r.character, tags: r.tags })), null, 2)}\n`);
}
