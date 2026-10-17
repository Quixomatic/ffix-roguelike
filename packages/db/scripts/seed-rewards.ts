#!/usr/bin/env bun
/**
 * The reward / gear-availability tables and their seed files (packages/db/seed/rewards):
 *
 *   pnpm -F @ffix-roguelike/db db:seed:rewards            insert rows the database doesn't have (never overwrites;
 *                                                          the server also does this on startup)
 *   pnpm -F @ffix-roguelike/db db:seed:rewards --export   write the database back into the seed files (commit the
 *                                                          tuning done on the admin page)
 */
import "varlock/auto-load";

import { createPrismaClient } from "../src/index";
import { exportRewardSeeds, seedRewards } from "../src/seed-rewards";

const db = createPrismaClient({ DATABASE_URL: process.env.DATABASE_URL! });
if (process.argv.includes("--export")) {
  await exportRewardSeeds(db);
  console.log("✓ reward tables exported to packages/db/seed/rewards");
} else {
  const added = await seedRewards(db);
  const [rarities, roles, sources, boons, gear] = await Promise.all([
    db.rewardRarity.count(),
    db.rewardRole.count(),
    db.rewardSource.count(),
    db.rewardBoon.count(),
    db.gearAvailability.count(),
  ]);
  console.log(
    `✓ reward tables: ${rarities} rarities, ${roles} roles, ${sources} sources, ${boons} boons, ${gear} gear pieces` +
      ` (inserted: ${Object.entries(added).map(([k, n]) => `${n} ${k}`).join(", ")})`,
  );
}
await db.$disconnect();
