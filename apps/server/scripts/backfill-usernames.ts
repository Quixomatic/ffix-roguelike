/**
 * Give every account without a username one (better-auth's username plugin; usernames are what other players see).
 * Each gets its name as a username when that's valid and free ("James" → "james": letters, numbers, "_" and ".",
 * 3–20 characters), else a generated placeholder ("user482915730") to change on the Profile page.
 *
 * Dry run by default; --apply writes. Run from apps/server: bun scripts/backfill-usernames.ts [--apply]
 */
import "varlock/auto-load";

import { generatedUsername } from "@ffix-roguelike/auth";

import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
const apply = process.argv.includes("--apply");

/** A name as a username, if it's one as it stands (lowercased, spaces dropped). */
const fromName = (name: string) => {
  const u = name.toLowerCase().replace(/\s+/g, "");
  return /^[a-z0-9_.]{3,20}$/.test(u) ? u : null;
};

async function main(): Promise<number> {
  const users = await db.user.findMany({ where: { username: null }, select: { id: true, email: true, name: true }, orderBy: { createdAt: "asc" } });
  if (!users.length) {
    console.log(c.ok("every account has a username"));
    return 0;
  }
  const taken = new Set((await db.user.findMany({ where: { username: { not: null } }, select: { username: true } })).map((u) => u.username!));
  for (const u of users) {
    const wanted = fromName(u.name);
    const username = wanted && !taken.has(wanted) ? wanted : await generatedUsername(db);
    taken.add(username);
    console.log(`  ${u.email.padEnd(36)} ${u.name.padEnd(20)} → ${username}`);
    if (apply) await db.user.update({ where: { id: u.id }, data: { username, displayUsername: username } });
  }
  console.log(apply ? c.ok(`${users.length} usernames set`) : c.dim(`\ndry run: ${users.length} accounts; add --apply to write`));
  return 0;
}

const code = await main();
await db.$disconnect();
process.exit(code);
