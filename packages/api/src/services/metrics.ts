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

export interface LeaderboardRow {
  rank: number;
  profileId: string;
  name: string;
  email: string;
  image: string | null;
  value: number;
  /** For "any character": whose number it is. */
  character?: string;
}

/**
 * The top players for one metric — the player's total (`character` ""), the best single character (`"any"`), or one
 * character — overall or for one subject. Records kept as the lowest (fastest win…) rank ascending. The base of every
 * leaderboard (admin today; endless challenge runs later rank on their own record metric).
 */
export async function metricLeaderboard(
  db: Pick<Database, "playerMetric" | "playerProfile">,
  key: string,
  o: { subject?: string; character?: string; limit?: number } = {},
): Promise<LeaderboardRow[]> {
  const asc = metricDef(key)?.agg === "min";
  const subject = o.subject ?? "";
  const limit = Math.min(100, o.limit ?? 20);
  let rows: { profileId: string; value: number; character?: string }[];
  if (o.character === "any") {
    // Each player's best character: all their per-character rows, best first, one per player.
    const all = await db.playerMetric.findMany({
      where: { key, subject, character: { not: "" } },
      orderBy: { value: asc ? "asc" : "desc" },
      select: { profileId: true, value: true, character: true },
      take: 5000,
    });
    const seen = new Set<string>();
    rows = all.filter((r) => !seen.has(r.profileId) && seen.add(r.profileId)).slice(0, limit);
  } else {
    rows = await db.playerMetric.findMany({
      where: { key, subject, character: o.character ?? "" },
      orderBy: { value: asc ? "asc" : "desc" },
      take: limit,
      select: { profileId: true, value: true },
    });
  }
  const profiles = await db.playerProfile.findMany({
    where: { id: { in: rows.map((r) => r.profileId) } },
    select: { id: true, user: { select: { name: true, email: true, image: true } } },
  });
  const byId = new Map(profiles.map((p) => [p.id, p.user]));
  return rows.map((r, i) => {
    const u = byId.get(r.profileId);
    return { rank: i + 1, profileId: r.profileId, name: u?.name ?? "?", email: u?.email ?? "", image: u?.image ?? null, value: r.value, character: r.character };
  });
}

/** A player's lifetime metrics as a bag (the Stats page, achievements). */
export async function loadMetrics(db: Pick<Database, "playerMetric">, profileId: string): Promise<MetricBag> {
  const rows = await db.playerMetric.findMany({ where: { profileId }, select: { character: true, key: true, subject: true, value: true } });
  return Object.fromEntries(rows.map((r) => [bagKey(r.key, r.subject, r.character), r.value]));
}
