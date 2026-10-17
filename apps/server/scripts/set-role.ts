/**
 * Set a player's role (better-auth's admin plugin): "admin" opens the admin pages (reward tables, gear availability)
 * and the dev tools; "user" is everyone else. With no role, lists every account and its role.
 *
 * The email can be a prefix, but it must match exactly one account. The change takes effect on the player's next
 * request (sign out and back in if the web app cached the session).
 *
 * WRITES the user table. Run from apps/server: bun scripts/set-role.ts [email] [admin|user]
 */
import "varlock/auto-load";

import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
const ROLES = ["admin", "user"] as const;

const [email, role] = process.argv.slice(2);

async function main(): Promise<number> {
  if (!email) {
    const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, select: { email: true, role: true } });
    for (const u of users) console.log(`  ${u.email.padEnd(36)} ${u.role ?? c.dim("user (default)")}`);
    console.log(c.dim("\nbun scripts/set-role.ts <email> admin|user"));
    return 0;
  }
  if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
    console.log(c.bad(`role must be one of: ${ROLES.join(", ")}`));
    return 1;
  }
  const users = await db.user.findMany({ where: { email: { startsWith: email, mode: "insensitive" } }, select: { id: true, email: true, role: true } });
  if (users.length !== 1) {
    console.log(c.bad(users.length ? `"${email}" matches ${users.length} accounts: ${users.map((u) => u.email).join(", ")}` : `no account matching "${email}"`));
    return 1;
  }
  const u = users[0]!;
  await db.user.update({ where: { id: u.id }, data: { role } });
  console.log(c.ok(`${u.email}: ${u.role ?? "user"} → ${role}`));
  return 0;
}

const code = await main();
await db.$disconnect();
process.exit(code);
