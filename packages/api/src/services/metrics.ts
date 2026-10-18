/**
 * Lifetime metrics in Postgres (`player_metric`; game-core metrics/registry.ts). `addMetrics` folds a bag of new values
 * into a player's totals — sums add up, records keep the higher (max) or lower (min) — in one bulk upsert per kind,
 * inside the caller's transaction (the run save, a camp action), so a metric never counts something that didn't happen.
 */
import { bagEntries, bagKey, metricDef, type MetricAgg, type MetricBag } from "@ffix-roguelike/game-core";
import type { Database } from "@ffix-roguelike/db";

type Tx = Pick<Database, "$executeRaw">;

export async function addMetrics(tx: Tx, profileId: string, bag: MetricBag): Promise<void> {
  const entries = bagEntries(bag).filter((e) => Number.isFinite(e.value));
  for (const agg of ["sum", "max", "min"] as MetricAgg[]) {
    const rows = entries.filter((e) => (metricDef(e.key)?.agg ?? "sum") === agg);
    if (!rows.length) continue;
    const c = rows.map((r) => r.character);
    const k = rows.map((r) => r.key);
    const s = rows.map((r) => r.subject);
    const v = rows.map((r) => r.value);
    if (agg === "sum")
      await tx.$executeRaw`
        INSERT INTO player_metric ("profileId", "character", "key", "subject", "value", "updatedAt")
        SELECT ${profileId}, t.c, t.k, t.s, t.v, now() FROM unnest(${c}::text[], ${k}::text[], ${s}::text[], ${v}::float8[]) AS t(c, k, s, v)
        ON CONFLICT ("profileId", "character", "key", "subject") DO UPDATE SET "value" = player_metric."value" + EXCLUDED."value", "updatedAt" = now()`;
    else if (agg === "max")
      await tx.$executeRaw`
        INSERT INTO player_metric ("profileId", "character", "key", "subject", "value", "updatedAt")
        SELECT ${profileId}, t.c, t.k, t.s, t.v, now() FROM unnest(${c}::text[], ${k}::text[], ${s}::text[], ${v}::float8[]) AS t(c, k, s, v)
        ON CONFLICT ("profileId", "character", "key", "subject") DO UPDATE SET "value" = GREATEST(player_metric."value", EXCLUDED."value"), "updatedAt" = now()`;
    else
      await tx.$executeRaw`
        INSERT INTO player_metric ("profileId", "character", "key", "subject", "value", "updatedAt")
        SELECT ${profileId}, t.c, t.k, t.s, t.v, now() FROM unnest(${c}::text[], ${k}::text[], ${s}::text[], ${v}::float8[]) AS t(c, k, s, v)
        ON CONFLICT ("profileId", "character", "key", "subject") DO UPDATE SET "value" = LEAST(player_metric."value", EXCLUDED."value"), "updatedAt" = now()`;
  }
}

/** A player's lifetime metrics as a bag (the Stats page, achievements). */
export async function loadMetrics(db: Pick<Database, "playerMetric">, profileId: string): Promise<MetricBag> {
  const rows = await db.playerMetric.findMany({ where: { profileId }, select: { character: true, key: true, subject: true, value: true } });
  return Object.fromEntries(rows.map((r) => [bagKey(r.key, r.subject, r.character), r.value]));
}
