/**
 * Inspector: FF9's battle data in Postgres (ff9_enemy, ff9_enemy_action, ff9_battle_scene, ff9_import) — is it
 * there, current, and consistent with what the game uses? A permanent tool; extend it whenever you need to see
 * more of the FF9 data.
 *
 * Always prints:
 *   - row counts, scenes with AI scripts, the recorded seed hash vs packages/db/seed/ff9 (stale → restart the
 *     server or run `pnpm -F @ffix-roguelike/db db:seed:ff9`)
 *   - integrity: every scene's enemy types / attack slots point at existing rows, every monster's attacks exist
 *   - coverage: every FF9 scene the game's areas use ("@EF_E009"…) exists, with a script, and every pattern
 *     resolves to real monsters
 * With arguments, details for each:
 *   - a scene id (EF_E009, CW_E0XX…): flags, monster types, attack table, spawn patterns, script size
 *   - a monster name ("Plant Brain", hades…): every version — stats, elements, statuses, steals, drops, attacks
 *
 * READ-ONLY. Run from apps/server: bun scripts/probe-ff9-data.ts [scene|monster ...]
 */
import "varlock/auto-load";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FF9_SEED_DIR } from "@ffix-roguelike/db/seed-ff9";
import { getScene, sceneGroup, WORLDS } from "@ffix-roguelike/game-core";
import { findItem, registerBestiary, type FF9Enemy, type FF9EnemyAction, type FF9Scene } from "@ffix-roguelike/game-data";

import { db } from "../src/services";

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  warn: (s: string) => `\x1b[33m!\x1b[0m ${s}`,
  h: (s: string) => `\n\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
let problems = 0;
const fail = (s: string) => {
  problems++;
  console.log(c.bad(s));
};

// ── load ─────────────────────────────────────────────────────────────────────
const [enemyRows, actionRows, sceneRows, imported] = await Promise.all([
  db.ff9Enemy.findMany({ orderBy: { id: "asc" } }),
  db.ff9EnemyAction.findMany({ orderBy: { id: "asc" } }),
  db.ff9BattleScene.findMany({ orderBy: { id: "asc" } }),
  db.ff9Import.findUnique({ where: { id: 1 } }),
]);
const enemies = enemyRows.map((r) => r.data as unknown as FF9Enemy);
const actions = actionRows.map((r) => r.data as unknown as FF9EnemyAction);
const scenes = sceneRows.map((r) => r.data as unknown as FF9Scene);
const scriptBytes = new Map(sceneRows.map((r) => [r.id, r.script?.length ?? 0]));

console.log(c.h("FF9 battle data"));
console.log(`  ${enemies.length} monsters · ${actions.length} attacks · ${scenes.length} scenes · ${[...scriptBytes.values()].filter((n) => n > 0).length} with AI scripts`);
if (!enemies.length) fail("tables are empty — start the server (it seeds on boot) or run db:seed:ff9");

const fileHash = createHash("sha256")
  .update(readFileSync(join(FF9_SEED_DIR, "bestiary.json")))
  .update(readFileSync(join(FF9_SEED_DIR, "battle-scripts.json")))
  .digest("hex");
if (!imported) fail("no ff9_import row — data was never seeded through seedFf9");
else if (imported.hash !== fileHash) fail(`seed files changed since the last import (${imported.importedAt.toISOString()}) — restart the server to re-seed`);
else console.log(c.ok(`matches the seed files (imported ${imported.importedAt.toISOString()})`));

// ── integrity ────────────────────────────────────────────────────────────────
console.log(c.h("Integrity"));
const before = problems;
for (const s of scenes) {
  for (const uid of s.types) if (uid >= 0 && !enemies[uid]) fail(`${s.id}: enemy type → missing monster #${uid}`);
  for (const uid of s.attacks) if (!actions[uid]) fail(`${s.id}: attack slot → missing attack #${uid}`);
  if (!s.patterns.length) fail(`${s.id}: no spawn patterns`);
}
for (const e of enemies) for (const uid of e.attacks) if (!actions[uid]) fail(`${e.name} (Lv${e.level}): missing attack #${uid}`);
const ids = (rows: { id: number }[]) => rows.every((r, i) => r.id === i);
if (!ids(enemyRows) || !ids(actionRows)) fail("monster/attack ids aren't contiguous (lookups index by id)");
if (problems === before) console.log(c.ok("scenes, monsters and attacks all reference existing rows"));

// ── coverage: what the game uses ─────────────────────────────────────────────
console.log(c.h("Game coverage"));
registerBestiary({ enemies, actions, scenes });
const before2 = problems;
for (const w of WORLDS) {
  for (const t of [...w.encounters, ...w.elites, w.boss].flat().filter((x) => x.startsWith("@"))) {
    const id = t.slice(1).split("#")[0]!;
    if (!scriptBytes.has(id)) {
      fail(`${w.name}: scene ${id} missing`);
      continue;
    }
    if (!scriptBytes.get(id)) console.log(c.warn(`${w.name}: scene ${id} has no AI script (fallback AI)`));
    getScene(id).patterns.forEach((_, i) => {
      if (!sceneGroup(`@${id}#${i}`).enemies.length) console.log(c.dim(`    ${w.name}: ${id} pattern ${i} has no targetable monsters`));
    });
  }
}
if (problems === before2) console.log(c.ok("every FF9 scene used by an area exists"));

// ── details ──────────────────────────────────────────────────────────────────
const itemName = (id: number) => (id < 0 ? "—" : (findItem(id)?.name ?? `#${id}`));
const attackLine = (a: FF9EnemyAction) =>
  `${a.name.padEnd(18)} ${a.targets.padEnd(11)} script ${String(a.scriptId).padStart(3)}  power ${String(a.power).padStart(3)}  rate ${String(a.rate).padStart(3)}  mp ${String(a.mp).padStart(3)}${a.elements.length ? `  ${a.elements.join("/")}` : ""}${a.statuses.length ? `  [${a.statuses.join(", ")}]` : ""}`;

for (const arg of process.argv.slice(2)) {
  const scene = scenes.find((s) => s.id.toLowerCase() === arg.toLowerCase());
  if (scene) {
    console.log(c.h(`Scene ${scene.id}`) + c.dim(`  ${scene.flags.join(", ") || "no flags"} · script ${scriptBytes.get(scene.id) ?? 0} bytes`));
    scene.types.forEach((uid, i) => console.log(`  type ${i}: ${uid >= 0 ? `${enemies[uid]!.name} Lv${enemies[uid]!.level} (#${uid})` : "(dummy)"}`));
    scene.attacks.forEach((uid, i) => console.log(`  attack ${String(i).padStart(2)}: ${attackLine(actions[uid]!)}`));
    scene.patterns.forEach((p, i) => console.log(`  pattern ${i}: rate ${p.rate} · AP ${p.ap} · ${p.spawn.map((s) => `${enemies[scene.types[s.typeNo]!]?.name ?? "?"}${s.targetable ? "" : " (untargetable)"}`).join(", ")}`));
    continue;
  }
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const found = enemies.filter((e) => slug(e.name) === slug(arg));
  if (!found.length) {
    fail(`nothing named "${arg}" (scene id or monster name)`);
    continue;
  }
  for (const e of found) {
    console.log(c.h(`${e.name} — Lv${e.level}${e.boss ? " · BOSS (scripted death)" : ""}`) + c.dim(`  #${e.uid} · scenes ${e.scenes.join(", ")}`));
    console.log(`  HP ${e.hp}  MP ${e.mp}  Spd ${e.speed}  Str ${e.strength}  Mag ${e.magic}  Spr ${e.spirit}`);
    console.log(`  Def ${e.defence}  Eva ${e.evade}  MDef ${e.magicDefence}  MEva ${e.magicEvade}  · EXP ${e.exp}  gil ${e.gil}  AP ${e.ap}  · category ${e.category}`);
    const els = [["weak", e.weak], ["half", e.half], ["absorb", e.absorb], ["null", e.guard]].filter(([, v]) => (v as string[]).length);
    if (els.length) console.log(`  elements: ${els.map(([k, v]) => `${k} ${(v as string[]).join("/")}`).join(" · ")}`);
    if (e.resist.length) console.log(`  immune: ${e.resist.join(", ")}`);
    if (e.autoStatus.length || e.startStatus.length) console.log(`  statuses: auto ${e.autoStatus.join(", ") || "—"} · start ${e.startStatus.join(", ") || "—"}`);
    console.log(`  steal (256/64/16/1): ${e.steal.map(itemName).join(" · ")}`);
    console.log(`  drops (256/96/32/1): ${e.drops.map(itemName).join(" · ")}`);
    for (const uid of e.attacks) console.log(`    ${attackLine(actions[uid]!)}`);
  }
}

console.log(problems ? `\n${c.bad(`${problems} problem(s)`)}` : `\n${c.ok("all good")}`);
await db.$disconnect();
process.exit(problems ? 1 : 0);
