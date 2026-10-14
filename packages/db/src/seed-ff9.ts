/**
 * Seed FF9's battle data (packages/db/seed/ff9) into the ff9_* tables. Idempotent: compares the seed files'
 * hash with the one recorded in ff9_import and only rewrites the tables when they're missing or changed — the
 * server runs it on every startup (like ChannelGuide's boot seeds).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "./index";

export const FF9_SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "ff9");

interface SeedBestiary {
  enemies: { uid: number; name: string; level: number; boss: boolean }[];
  actions: { uid: number; name: string }[];
  scenes: { id: string }[];
}

/** Returns what happened: "seeded" (tables written) or "current" (already up to date). */
export async function seedFf9(db: Database, opts: { force?: boolean } = {}): Promise<"seeded" | "current"> {
  const bestiaryRaw = readFileSync(join(FF9_SEED_DIR, "bestiary.json"));
  const scriptsRaw = readFileSync(join(FF9_SEED_DIR, "battle-scripts.json"));
  const hash = createHash("sha256").update(bestiaryRaw).update(scriptsRaw).digest("hex");

  const current = await db.ff9Import.findUnique({ where: { id: 1 } });
  if (!opts.force && current?.hash === hash && (await db.ff9Enemy.count()) > 0) return "current";

  const bestiary = JSON.parse(bestiaryRaw.toString("utf8")) as SeedBestiary;
  const scripts = JSON.parse(scriptsRaw.toString("utf8")) as Record<string, string>;
  await db.$transaction(
    async (tx) => {
      await tx.ff9BattleScene.deleteMany();
      await tx.ff9EnemyAction.deleteMany();
      await tx.ff9Enemy.deleteMany();
      await tx.ff9Enemy.createMany({
        data: bestiary.enemies.map((e) => ({ id: e.uid, name: e.name, level: e.level, boss: e.boss, data: e as object })),
      });
      await tx.ff9EnemyAction.createMany({ data: bestiary.actions.map((a) => ({ id: a.uid, name: a.name, data: a as object })) });
      await tx.ff9BattleScene.createMany({
        data: bestiary.scenes.map((s) => ({
          id: s.id,
          data: s as object,
          script: scripts[s.id] ? Buffer.from(scripts[s.id]!, "base64") : null,
        })),
      });
      await tx.ff9Import.upsert({ where: { id: 1 }, create: { id: 1, hash }, update: { hash, importedAt: new Date() } });
    },
    { timeout: 120_000 },
  );
  return "seeded";
}
