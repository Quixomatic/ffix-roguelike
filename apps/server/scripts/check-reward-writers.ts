/**
 * Check the reward tables' writers and loader agree (`packages/db/src/rewards.ts`, `.plans/content-db.md` R1): every
 * row is loaded as its flat row, written back through its table's writer (what the admin page's saves use), loaded
 * again and compared. Also checks the foreign keys refuse references to rows that don't exist. Everything runs in a
 * transaction that is rolled back, so the database is never changed. Exits 1 on a problem.
 *
 * Read-only. Run from apps/server:
 *   bun scripts/check-reward-writers.ts
 */
import "varlock/auto-load";

import { itemIdsByName, loadRewards, REWARD_COLUMN_TABLES, writeGear, writeRelic, writeRewardRow, writeStarter } from "@ffix-roguelike/db/rewards";

import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
};
/** JSON with object keys sorted (Postgres reorders jsonb keys). */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const ROLLBACK = "rollback";
let problems = 0;

/** Run `fn` in a transaction that is always rolled back; resolves to its error, or null if it went through. */
async function attempt(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<unknown>): Promise<Error | null> {
  try {
    await db.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Error(ROLLBACK);
      },
      { timeout: 120_000 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === ROLLBACK) return null;
    return err instanceof Error ? err : new Error(String(err));
  }
  return null;
}

const before = await loadRewards(db);
const items = await itemIdsByName(db);

// Every row back through its writer: the table must read back exactly the same.
const err = await attempt(async (tx) => {
  for (const t of REWARD_COLUMN_TABLES) for (const r of before[t]) await writeRewardRow(tx, t, r as Record<string, unknown>, items);
  const after = await loadRewards(tx);
  for (const t of REWARD_COLUMN_TABLES) {
    const differ = (before[t] as unknown[]).filter((r, i) => stable(r) !== stable((after[t] as unknown[])[i]));
    if (differ.length || before[t].length !== after[t].length) {
      problems++;
      console.log(c.bad(`${t}: ${differ.length} of ${before[t].length} rows read back differently`));
    } else console.log(c.ok(`${t}: ${before[t].length} rows write and read back the same`));
  }
});
if (err) {
  problems++;
  console.log(c.bad(`writing the rows back failed: ${err.message}`));
}

// The foreign keys refuse what doesn't exist, and keep rows in use from being deleted.
const refused: [string, Parameters<typeof attempt>[0]][] = [
  ["a gear pool in an unknown area", (tx) => writeGear(tx, { ...before.gear[0]!, mapPools: [{ area: "no-such-area" }] })],
  ["a relic with an unknown rarity", (tx) => writeRelic(tx, { ...before.relics[0]!, rarity: "no-such-rarity" })],
  ["a relic unlocked by an unknown achievement", (tx) => writeRelic(tx, { ...before.relics[0]!, unlockedBy: "no-such-achievement" })],
  ["a starter tier needing an unknown journey", (tx) => writeStarter(tx, { ...before.starter[0]!, requires: { journey: "no-such-journey" } })],
  ["deleting a rarity relics use", (tx) => tx.rewardRarity.delete({ where: { id: before.relics[0]!.rarity } })],
];
for (const [label, fn] of refused) {
  if (await attempt(fn)) console.log(c.ok(`refused: ${label}`));
  else {
    problems++;
    console.log(c.bad(`accepted: ${label}`));
  }
}

await db.$disconnect();
console.log(problems ? c.bad(`${problems} problem(s)`) : c.ok("no problems"));
process.exit(problems ? 1 : 0);
