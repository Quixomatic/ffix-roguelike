#!/usr/bin/env bun
/**
 * The full encounter test: every spawn pattern of every fight in every area (`pnpm test` plays each scene's first
 * pattern only). Run it after changing fights, areas or the battle engine. Takes a couple of minutes.
 *
 *   pnpm -F @ffix-roguelike/game-core test:encounters
 */
const proc = Bun.spawn(["bun", "test", "src/content/encounters.test.ts"], {
  cwd: `${import.meta.dir}/..`,
  env: { ...process.env, ENCOUNTERS: "all" },
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await proc.exited);
