/**
 * Seed FF9's data (packages/db/seed/ff9) into the ff9_* tables: the game tables (characters, abilities, items,
 * support abilities, synthesis, shops, statuses, levels) and the battle data (monsters, their attacks, battle
 * scenes with AI scripts). Idempotent: compares the seed files' hash with the one recorded in ff9_import and only
 * rewrites the tables when they're missing or changed — the server runs it on every startup (like
 * ChannelGuide's boot seeds).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "./index";

export const FF9_SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "ff9");

type Row = Record<string, unknown> & { id?: number; name?: string };

function readSeed() {
  const files = readdirSync(FF9_SEED_DIR).filter((f) => f.endsWith(".json")).sort();
  const raw = new Map(files.map((f) => [f, readFileSync(join(FF9_SEED_DIR, f))]));
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update(raw.get(f)!);
  return { raw, digest: hash.digest("hex") };
}

/** Hash of the seed files — what ff9_import.hash records after a seed. */
export const ff9SeedHash = () => readSeed().digest;

/** Returns what happened: "seeded" (tables written) or "current" (already up to date). */
export async function seedFf9(db: Database, opts: { force?: boolean } = {}): Promise<"seeded" | "current"> {
  const { raw, digest } = readSeed();

  const current = await db.ff9Import.findUnique({ where: { id: 1 } });
  if (!opts.force && current?.hash === digest && (await db.ff9Item.count()) > 0 && (await db.ff9Enemy.count()) > 0) return "current";

  const json = <T>(f: string) => JSON.parse(raw.get(f)!.toString("utf8")) as T;
  const bestiary = json<{ enemies: (Row & { uid: number; level: number; boss: boolean })[]; actions: (Row & { uid: number })[]; scenes: (Row & { id: string })[] }>("bestiary.json");
  const scripts = json<Record<string, string>>("battle-scripts.json");
  const characters = json<(Row & { key: string })[]>("characters.json");
  const items = json<(Row & { id: number; kind: string })[]>("items.json");
  const statuses = json<(Row & { id: number; key: string })[]>("statuses.json");
  const leveling = json<(Row & { level: number })[]>("leveling.json");
  const data = (r: Row) => r as object;

  await db.$transaction(
    async (tx) => {
      // Battle data
      await tx.ff9BattleScene.deleteMany();
      await tx.ff9EnemyAction.deleteMany();
      await tx.ff9Enemy.deleteMany();
      await tx.ff9Enemy.createMany({ data: bestiary.enemies.map((e) => ({ id: e.uid, name: e.name!, level: e.level, boss: e.boss, data: data(e) })) });
      await tx.ff9EnemyAction.createMany({ data: bestiary.actions.map((a) => ({ id: a.uid, name: a.name!, data: data(a) })) });
      await tx.ff9BattleScene.createMany({
        data: bestiary.scenes.map((s) => ({ id: s.id, data: data(s), script: scripts[s.id] ? Buffer.from(scripts[s.id]!, "base64") : null })),
      });
      // Game tables
      await tx.ff9Character.deleteMany();
      await tx.ff9Character.createMany({ data: characters.map((c) => ({ key: c.key, name: c.name!, data: data(c) })) });
      await tx.ff9Action.deleteMany();
      await tx.ff9Action.createMany({ data: json<Row[]>("actions.json").map((a) => ({ id: a.id!, name: a.name!, data: data(a) })) });
      await tx.ff9Item.deleteMany();
      await tx.ff9Item.createMany({ data: items.map((i) => ({ id: i.id, name: i.name!, kind: i.kind, data: data(i) })) });
      await tx.ff9SupportAbility.deleteMany();
      await tx.ff9SupportAbility.createMany({ data: json<Row[]>("support-abilities.json").map((s) => ({ id: s.id!, name: s.name!, data: data(s) })) });
      await tx.ff9Synthesis.deleteMany();
      await tx.ff9Synthesis.createMany({ data: json<Row[]>("synthesis.json").map((s) => ({ id: s.id!, data: data(s) })) });
      await tx.ff9Shop.deleteMany();
      await tx.ff9Shop.createMany({ data: json<Row[]>("shops.json").map((s) => ({ id: s.id!, name: s.name!, data: data(s) })) });
      await tx.ff9Status.deleteMany();
      await tx.ff9Status.createMany({ data: statuses.map((s) => ({ id: s.id, key: s.key, data: data(s) })) });
      await tx.ff9Level.deleteMany();
      await tx.ff9Level.createMany({ data: leveling.map((l) => ({ level: l.level, data: data(l) })) });
      await tx.ff9Import.upsert({ where: { id: 1 }, create: { id: 1, hash: digest }, update: { hash: digest, importedAt: new Date() } });
    },
    { timeout: 120_000 },
  );
  return "seeded";
}
