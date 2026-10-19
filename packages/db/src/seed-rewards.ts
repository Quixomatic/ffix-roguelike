/**
 * Seed the reward and gear-availability tables (reward_rarity, reward_role, reward_source, reward_boon,
 * gear_availability, starter_upgrade, achievement, relic, synergy, character_tag) from packages/db/seed/rewards. **Inserts missing rows only**: rows already in the database
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
} as const;

/** First-pass badges for the seeded achievements (id → badge number); see `seedRewards`. */
const BADGES_FILE = "achievement-badges.json";

type Row = Record<string, unknown>;
const read = (f: string) => JSON.parse(readFileSync(join(REWARD_SEED_DIR, f), "utf8")) as Row[];
const data = (r: Row) => r as object;

/** Returns how many rows were inserted per table. */
export async function seedRewards(db: Database): Promise<Record<keyof typeof FILES, number>> {
  const [rarities, roles, sources, boons, gear, starter, achievements, relics, synergies, characterTags] = [
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
  ];
  const results = await db.$transaction([
    db.rewardRarity.createMany({ data: rarities.map((r) => ({ id: String(r.id), sort: Number(r.sort), data: data(r) })), skipDuplicates: true }),
    db.rewardRole.createMany({ data: roles.map((r) => ({ key: String(r.key), data: data(r) })), skipDuplicates: true }),
    db.rewardSource.createMany({ data: sources.map((r) => ({ id: String(r.id), data: data(r) })), skipDuplicates: true }),
    db.rewardBoon.createMany({ data: boons.map((r) => ({ id: String(r.id), name: String(r.name), enabled: r.enabled !== false, data: data(r) })), skipDuplicates: true }),
    db.gearAvailability.createMany({
      data: gear.map((r) => ({ itemId: Number(r.itemId), name: String(r.name), enabled: r.enabled !== false, data: data(r) })),
      skipDuplicates: true,
    }),
    db.starterUpgrade.createMany({
      data: starter.map((r) => ({ id: String(r.id), character: String(r.character), slot: String(r.slot), tier: Number(r.tier), enabled: r.enabled !== false, data: data(r) })),
      skipDuplicates: true,
    }),
    db.achievement.createMany({
      data: achievements.map((r) => ({ id: String(r.id), category: String(r.category), sort: Number(r.sort), enabled: r.enabled !== false, data: data(r) })),
      skipDuplicates: true,
    }),
    db.relic.createMany({ data: relics.map((r) => ({ id: String(r.id), sort: Number(r.sort), enabled: r.enabled !== false, data: data(r) })), skipDuplicates: true }),
    db.synergy.createMany({ data: synergies.map((r) => ({ id: String(r.id), enabled: r.enabled !== false, data: data(r) })), skipDuplicates: true }),
    db.characterTag.createMany({ data: characterTags.map((r) => ({ character: String(r.character), tags: (r.tags as string[]) ?? [] })), skipDuplicates: true }),
  ]);
  // Badges (achievement-badges.json: achievement id → badge number, and any `badge` in achievements.json) fill in
  // rows that have none, including rows that existed before badges did. A badge picked on the admin page stays.
  const badgeFile = join(REWARD_SEED_DIR, BADGES_FILE);
  const badgeMap: Record<string, number> = existsSync(badgeFile) ? JSON.parse(readFileSync(badgeFile, "utf8")) : {};
  for (const r of achievements) if (typeof r.badge === "number") badgeMap[String(r.id)] = r.badge;
  const badged = Object.entries(badgeMap);
  if (badged.length) {
    const ids = badged.map(([id]) => id);
    const badges = badged.map(([, n]) => n);
    await db.$executeRaw`UPDATE achievement a SET data = jsonb_set(a.data, '{badge}', to_jsonb(s.badge)) FROM unnest(${ids}::text[], ${badges}::int[]) AS s(id, badge) WHERE a.id = s.id AND a.data->'badge' IS NULL`;
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
  };
}

export const REWARD_TABLES = Object.keys(FILES) as (keyof typeof FILES)[];

/** Throw away one table's rows and seed it again from its file (discards the admin page's edits to it). */
export async function resetRewardTable(db: Database, table: keyof typeof FILES): Promise<number> {
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
  }[table];
  await del();
  return (await seedRewards(db))[table];
}

/** Write the database's reward tables back to the seed files (dev: commit tuning done on the admin page). */
export async function exportRewardSeeds(db: Database): Promise<void> {
  const [rarities, roles, sources, boons, gear, starter, achievements, relics, synergies, characterTags] = await Promise.all([
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
  writeFileSync(join(REWARD_SEED_DIR, FILES.characterTags), `${JSON.stringify(characterTags.map((r) => ({ character: r.character, tags: r.tags })), null, 2)}\n`);
}
