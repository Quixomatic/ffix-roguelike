/**
 * Inspector: how every gear piece can show up in runs (the Megabonk-style unlock model — see .plans/rewards.md §3.4),
 * from the `gear_availability` table (edited on the admin page; seeded from packages/db/seed/rewards). A permanent
 * tool.
 *
 * Always prints:
 *   - every gear piece by how it can appear: starter (a character's FF9 starting gear), map pool (drops in an area
 *     without unlocking), catalog (buy at camp, then it joins drop pools), legendary (achievements only), disabled,
 *     and **nowhere** (a problem: an enabled piece that can never appear), and gear missing from the table
 *   - each area's map pool: its size and price band
 *   - the catalog-only and legendary pieces by name
 * With arguments, details for each:
 *   - an item name (or a prefix: "Silk", "mythril") — kind, price, who can equip it, whose starter it is, every area
 *     whose map pool has it, catalog price, legendary, the recipe that makes it
 *   - an email (or a prefix of one) — that player's unlocked gear, and the catalog they see right now
 *
 * READ-ONLY. Run from apps/server: bun scripts/probe-gear.ts [item|email ...]
 */
import "varlock/auto-load";

import { effectivePrice, gearCatalog, isGear, WORLDS } from "@ffix-roguelike/game-core";
import { characters, gearAvailability, items, synthesis, type ItemData } from "@ffix-roguelike/game-data";

import { ensureFf9Content, ensureRewardContent } from "../../../packages/api/src/services/content";
import { loadProfile } from "../../../packages/api/src/services/profile";
import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  h: (s: string) => `\n\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
let problems = 0;

// ── load ─────────────────────────────────────────────────────────────────────
await ensureFf9Content(db);
await ensureRewardContent(db);
const gear = items.filter(isGear);
const pools = WORLDS.map((w) => ({
  w,
  ids: new Set(gear.filter((i) => gearAvailability(i.id)?.mapPools.some((p) => p.area === w.id)).map((i) => i.id)),
  bossOnly: gear.filter((i) => gearAvailability(i.id)?.mapPools.some((p) => p.area === w.id && p.bossOnly)).length,
}));
const starterOf = new Map<number, string[]>();
for (const ch of characters) {
  for (const id of Object.values(ch.defaultEquipment ?? {})) if (id != null) starterOf.set(id as number, [...(starterOf.get(id as number) ?? []), ch.name]);
}
const made = new Map(synthesis.map((r) => [r.result, r]));

type Status = "map pool" | "catalog" | "legendary" | "disabled" | "not in table" | "nowhere";
const statusOf = (i: ItemData): Status => {
  const a = gearAvailability(i.id);
  if (!a) return "not in table";
  if (!a.enabled) return "disabled";
  if (a.legendary) return "legendary";
  if (a.mapPools.length) return "map pool";
  if (a.catalog && a.catalogPrice != null) return "catalog";
  return "nowhere";
};

// ── summary ──────────────────────────────────────────────────────────────────
console.log(c.h(`Gear: ${gear.length} pieces`));
const by = new Map<Status, ItemData[]>();
for (const i of gear) by.set(statusOf(i), [...(by.get(statusOf(i)) ?? []), i]);
const starters = gear.filter((i) => starterOf.has(i.id));
console.log(`  starter gear         ${String(starters.length).padStart(4)}  ${c.dim("(always worn at the start; also counted below)")}`);
for (const s of ["map pool", "catalog", "legendary", "disabled", "not in table", "nowhere"] as Status[]) console.log(`  ${s.padEnd(20)} ${String(by.get(s)?.length ?? 0).padStart(4)}`);
const nowhere = by.get("nowhere") ?? [];
const missing = by.get("not in table") ?? [];
if (nowhere.length) {
  problems++;
  console.log(c.bad(`enabled but can never appear: ${nowhere.map((i) => i.name).join(", ")}`));
}
if (missing.length) {
  problems++;
  console.log(c.bad(`missing from gear_availability (restart the server to seed, or add them on the admin page): ${missing.map((i) => i.name).join(", ")}`));
}
if (!nowhere.length && !missing.length) console.log(c.ok("every enabled gear piece can appear somehow"));

console.log(c.h("Map pools (per area — drops without unlocking)"));
for (const { w, ids, bossOnly } of pools) {
  console.log(`  ${w.name.padEnd(24)} ${String(ids.size).padStart(3)} pieces${bossOnly ? ` (${bossOnly} boss-only)` : ""}  ${c.dim(`band ${w.gearPrice[0]}–${w.gearPrice[1]} gil · tier ${w.tier}`)}`);
}

console.log(c.h(`Catalog only (${by.get("catalog")?.length ?? 0}: buy at camp)`));
console.log(`  ${(by.get("catalog") ?? []).map((i) => i.name).join(", ")}`);
console.log(c.h(`Legendary (${by.get("legendary")?.length ?? 0}: achievements only)`));
console.log(`  ${(by.get("legendary") ?? []).map((i) => i.name).join(", ")}`);

// ── details ──────────────────────────────────────────────────────────────────
for (const arg of process.argv.slice(2)) {
  const q = arg.toLowerCase();
  const matches = gear.filter((i) => i.name.toLowerCase().startsWith(q));
  if (matches.length) {
    for (const i of matches) {
      console.log(c.h(`${i.name} (#${i.id}, ${i.kind})`));
      console.log(`  price ${i.price} gil${i.price < 10 ? ` (never sold in FF9 → priced ${effectivePrice(i)})` : ""} · equips: ${i.equippableBy.join(", ") || "nobody"}`);
      console.log(`  status: ${statusOf(i)}${starterOf.has(i.id) ? ` · starter for ${starterOf.get(i.id)!.join(", ")}` : ""}`);
      const a = gearAvailability(i.id);
      const areas = (a?.mapPools ?? []).map((p) => `${WORLDS.find((w) => w.id === p.area)?.name ?? p.area}${p.bossOnly ? " (boss only)" : ""}`);
      console.log(`  map pools: ${areas.join(", ") || "none"}`);
      if (a?.catalog) console.log(`  catalog: ${a.catalogPrice} gil, from tier ${a.catalogFromTier}`);
      if (a?.notes) console.log(`  notes: ${a.notes}`);
      const r = made.get(i.id);
      if (r) console.log(`  synthesized from: ${r.ingredients.map((id) => items.find((x) => x.id === id)?.name ?? id).join(" + ")} (${r.price} gil)`);
    }
    continue;
  }
  const users = await db.user.findMany({ where: { email: { startsWith: q, mode: "insensitive" } }, select: { id: true, email: true } });
  if (!users.length) {
    console.log(c.bad(`no gear or player matching "${arg}"`));
    problems++;
    continue;
  }
  for (const u of users) {
    console.log(c.h(`${u.email}`));
    // loadProfile creates a profile on first visit — only read players who have one (this probe is read-only).
    if (!(await db.playerProfile.findUnique({ where: { userId: u.id }, select: { id: true } }))) {
      console.log(c.dim("  no profile yet"));
      continue;
    }
    const { profile } = await loadProfile(db, u.id);
    const unlocked = (profile.gearUnlocked ?? []).map((id) => items.find((x) => x.id === id)?.name ?? `#${id}`);
    console.log(`  unlocked (${unlocked.length}): ${unlocked.join(", ") || c.dim("none")}`);
    const cat = gearCatalog(profile);
    console.log(`  catalog now (${cat.length}): ${cat.map((e) => `${items.find((x) => x.id === e.itemId)?.name} ${e.price}`).join(", ") || c.dim("empty")}`);
  }
}

console.log(`\n${problems ? c.bad(`${problems} problem(s)`) : c.ok("no problems")}`);
await db.$disconnect();
process.exit(problems ? 1 : 0);
