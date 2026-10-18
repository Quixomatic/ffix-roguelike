#!/usr/bin/env bun
/**
 * The reward / gear-availability tables and their seed files (packages/db/seed/rewards):
 *
 *   pnpm -F @ffix-roguelike/db db:seed:rewards            insert rows the database doesn't have (never overwrites;
 *                                                          the server also does this on startup)
 *   pnpm -F @ffix-roguelike/db db:seed:rewards --export   write the database back into the seed files (commit the
 *                                                          tuning done on the admin page)
 *   pnpm -F @ffix-roguelike/db db:seed:rewards --reset <table>   reload one table from its seed file, discarding its
 *                                                          edits (rarities, roles, sources, boons, gear, starter)
 */
import "varlock/auto-load";

import { createPrismaClient } from "../src/index";
import { exportRewardSeeds, resetRewardTable, REWARD_TABLES, seedRewards } from "../src/seed-rewards";

const db = createPrismaClient({ DATABASE_URL: process.env.DATABASE_URL! });
const reset = process.argv[process.argv.indexOf("--reset") + 1];
if (process.argv.includes("--reset")) {
  if (!REWARD_TABLES.includes(reset as (typeof REWARD_TABLES)[number])) {
    console.error(`✗ --reset needs a table: ${REWARD_TABLES.join(", ")}`);
    process.exit(1);
  }
  const n = await resetRewardTable(db, reset as (typeof REWARD_TABLES)[number]);
  console.log(`✓ ${reset}: reloaded ${n} rows from the seed file (restart the server or save on the admin page so it re-reads them)`);
} else if (process.argv.includes("--export")) {
  await exportRewardSeeds(db);
  console.log("✓ reward tables exported to packages/db/seed/rewards");
} else {
  const added = await seedRewards(db);
  const [rarities, roles, sources, boons, gear, starter] = await Promise.all([
    db.rewardRarity.count(),
    db.rewardRole.count(),
    db.rewardSource.count(),
    db.rewardBoon.count(),
    db.gearAvailability.count(),
    db.starterUpgrade.count(),
  ]);
  console.log(
    `✓ reward tables: ${rarities} rarities, ${roles} roles, ${sources} sources, ${boons} boons, ${gear} gear pieces, ${starter} starter upgrade tiers` +
      ` (inserted: ${Object.entries(added).map(([k, n]) => `${n} ${k}`).join(", ")})`,
  );
}
await db.$disconnect();
