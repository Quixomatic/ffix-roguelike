#!/usr/bin/env bun
/**
 * dev-server — run the API with restarts on ANY workspace change.
 *
 * `bun --hot` only watches files inside apps/server, so edits to game-core / game-data / api / db would
 * silently keep serving stale code. This wrapper watches apps/server/src and every packages/<pkg>/src (plus
 * game-data's generated JSON and the Prisma client), and restarts the server process on change.
 *
 * Run from apps/server (its `dev` script does that) so varlock still loads apps/server/.env.
 */
import { spawn, type Subprocess } from "bun";
import { existsSync, readdirSync, watch } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const dirs = [
  join(ROOT, "apps/server/src"),
  ...readdirSync(join(ROOT, "packages")).map((p) => join(ROOT, "packages", p, "src")),
  join(ROOT, "packages/db/prisma/generated"),
].filter(existsSync);

let child: Subprocess | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function start() {
  child = spawn(["bun", "run", "src/index.ts"], { stdio: ["inherit", "inherit", "inherit"], cwd: process.cwd() });
}

async function restart(file: string) {
  console.log(`\x1b[2m[dev-server] ${file} changed — restarting\x1b[0m`);
  if (child) {
    child.kill();
    await child.exited;
  }
  start();
}

for (const dir of dirs) {
  watch(dir, { recursive: true }, (_event, file) => {
    if (!file || file.includes("node_modules")) return;
    clearTimeout(timer);
    timer = setTimeout(() => void restart(file), 150);
  });
}

process.on("SIGINT", () => {
  child?.kill();
  process.exit(0);
});

console.log(`[dev-server] watching ${dirs.length} source folders`);
start();
