/**
 * Force reward-table seed rows into the database. The server's boot seed only inserts rows the database lacks, so
 * a seed row that changed after it was first inserted (or was edited on the admin page) never reaches it. This
 * inserts or **overwrites** the chosen rows with the seed's version; every other row is left alone.
 *
 * Tables: rarities, roles, sources, boons, gear, starter, achievements, relics, synergies, characterTags.
 * A match picks rows by key, character or name, or by the start of the key up to a ":" or "-"
 * (`marcus` → every `marcus:<slot>:<tier>` starter row; `story` → every `story-*` achievement). Case doesn't matter.
 *
 * Dry run by default: lists each row as insert / overwrite (with the fields that differ) / unchanged.
 * With no table, shows how far each table's database rows are from its seed file.
 * --apply writes. Syncing a whole table (no matches) needs --all as well.
 * The running server caches the tables: restart `pnpm dev` (or save anything on the admin page) afterwards.
 *
 * WRITES the reward tables with --apply. Run from apps/server:
 *   bun scripts/sync-seeds.ts [table] [match…] [--all] [--apply]
 *   bun scripts/sync-seeds.ts starter marcus kuja --apply
 */
import "varlock/auto-load";

import { REWARD_TABLES, type SyncRow, syncRewardRows } from "@ffix-roguelike/db/seed-rewards";

import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  add: (s: string) => `\x1b[32m${s}\x1b[0m`,
  mod: (s: string) => `\x1b[33m${s}\x1b[0m`,
};
type Table = (typeof REWARD_TABLES)[number];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const all = args.includes("--all");
const [table, ...tokens] = args.filter((a) => !a.startsWith("--"));

const count = (rows: SyncRow[], a: SyncRow["action"]) => rows.filter((r) => r.action === a).length;

async function overview(): Promise<number> {
  console.log(`${"table".padEnd(14)} ${"seed".padStart(5)} ${"new".padStart(5)} ${"differ".padStart(7)}`);
  for (const t of REWARD_TABLES) {
    const rows = await syncRewardRows(db, t, []);
    const n = count(rows, "insert");
    const d = count(rows, "overwrite");
    console.log(`${t.padEnd(14)} ${String(rows.length).padStart(5)} ${(n ? c.add(String(n).padStart(5)) : c.dim("0".padStart(5)))} ${d ? c.mod(String(d).padStart(7)) : c.dim("0".padStart(7))}`);
  }
  console.log(c.dim("\n\"differ\" includes tuning done on the admin page. bun scripts/sync-seeds.ts <table> [match…] to see rows."));
  return 0;
}

async function main(): Promise<number> {
  if (!table) return overview();
  if (!REWARD_TABLES.includes(table as Table)) {
    console.log(c.bad(`unknown table "${table}": ${REWARD_TABLES.join(", ")}`));
    return 1;
  }
  if (apply && !tokens.length && !all) {
    console.log(c.bad(`no match given: this would overwrite every row of ${table}. Add --all if that's what you want.`));
    return 1;
  }
  const rows = await syncRewardRows(db, table as Table, tokens, { apply });
  if (!rows.length) {
    console.log(c.bad(`no ${table} seed rows match ${tokens.map((t) => `"${t}"`).join(", ")}`));
    return 1;
  }
  for (const r of rows) {
    if (r.action === "insert") console.log(`  ${c.add("+ insert   ")} ${r.key.padEnd(28)} ${r.label}`);
    else if (r.action === "overwrite") console.log(`  ${c.mod("~ overwrite")} ${r.key.padEnd(28)} ${r.label} ${c.dim(`(${r.changed.join(", ")})`)}`);
  }
  const ins = count(rows, "insert");
  const ovr = count(rows, "overwrite");
  const same = count(rows, "same");
  const summary = `${table}: ${ins} to insert, ${ovr} to overwrite, ${same} unchanged`;
  if (!apply) {
    console.log(`\n${summary}`);
    if (ins + ovr) console.log(c.dim("dry run: add --apply to write"));
    return 0;
  }
  console.log(`\n${c.ok(`${table}: ${ins} inserted, ${ovr} overwritten, ${same} unchanged`)}`);
  if (ins + ovr) console.log(c.dim("restart pnpm dev (or save anything on the admin page) so the server reloads the tables"));
  return 0;
}

const code = await main();
await db.$disconnect();
process.exit(code);
