#!/usr/bin/env bun
/**
 * Force-reload FF9's battle data into Postgres (the server also does this automatically on startup whenever
 * packages/db/seed/ff9 changes).
 *
 *   pnpm -F @ffix-roguelike/db db:seed:ff9
 */
import "varlock/auto-load";

import { createPrismaClient } from "../src/index";
import { seedFf9 } from "../src/seed-ff9";

const db = createPrismaClient({ DATABASE_URL: process.env.DATABASE_URL! });
const result = await seedFf9(db, { force: true });
const [enemies, actions, scenes, withScript] = await Promise.all([
  db.ff9Enemy.count(),
  db.ff9EnemyAction.count(),
  db.ff9BattleScene.count(),
  db.ff9BattleScene.count({ where: { script: { not: null } } }),
]);
console.log(`✓ ff9 data ${result}: ${enemies} monsters, ${actions} attacks, ${scenes} battle scenes (${withScript} with AI scripts)`);
await db.$disconnect();
