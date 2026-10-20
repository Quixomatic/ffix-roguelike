/**
 * Inspector: the checklist for every area (game-core WORLDS), so a new journey's areas can be checked in one command
 * (`.plans/journeys-full-story.md`, Phase 0 step 8). For each area:
 *   - its journeys, theme and progression tier
 *   - **music**: its own FF9 theme (web `AREA_MUSIC`, built into `music.gen.ts`), or the world map theme by default
 *   - **shops**: its FF9 equipment shops and item stores exist, with their stock
 *   - **gear pools**: how many gear pieces drop there (`gear_availability` in the database; a seed file with more is
 *     reported, since the server merges it on start)
 *   - **sprites**: every monster in its fights has FFRK art (web `enemy-sprites.gen.ts`), else a placeholder
 *   - **fights**: every spawn pattern of its battles, elites and boss is played on auto (as the encounter test does) and
 *     must end in a real win or loss: no 15-minute stall, no stall watchdog, no "victory" with a monster standing
 *     (except the scripted wins, SCRIPTED_WIN_SCENES)
 * Problems are marked ✗ and make it exit 1; a default-music area is only a note.
 *
 * READ-ONLY. Run from apps/server: bun scripts/probe-areas.ts [area|journey …] [--no-fights]
 *   (with ids, only those areas, or the areas of those journeys)
 */
import "varlock/auto-load";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  autoCommand,
  BattleEngine,
  createBattle,
  encounterUnits,
  getScene,
  isGear,
  isSceneRef,
  JOURNEYS,
  MAX_TICKS,
  newBuild,
  partyUnit,
  SCRIPTED_WIN_SCENES,
  starterGear,
  WORLDS,
  type WorldDef,
} from "@ffix-roguelike/game-core";
import { gearAvailability, items, shops, type GearAvailability } from "@ffix-roguelike/game-data";
import { REWARD_CACHE_DIR, REWARD_SEED_FILES } from "@ffix-roguelike/game-data/cache";

import { ensureFf9Content, ensureRewardContent } from "../../../packages/api/src/services/content";
import { AREA_MUSIC, MUSIC_TRACKS } from "../../web/src/features/audio/music.gen";
import { db } from "../src/services";

/**
 * The monster sprite sheets that exist (web `enemy-sprites.gen.ts`), read as data: importing it would pull the web
 * app's types (and its `@/` paths) into the server's type check. The generator writes the table as JSON.
 */
const genSprites = readFileSync(join(import.meta.dir, "../../web/src/features/sprites/enemy-sprites.gen.ts"), "utf8");
const ENEMY_SPRITES = JSON.parse(genSprites.slice(genSprites.indexOf("= {") + 2, genSprites.lastIndexOf("}") + 1)) as Record<string, unknown>;

const c = {
  ok: (s: string) => `\x1b[32m✓\x1b[0m ${s}`,
  bad: (s: string) => `\x1b[31m✗\x1b[0m ${s}`,
  note: (s: string) => `\x1b[33m·\x1b[0m ${s}`,
  h: (s: string) => `\n\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};
let problems = 0;
const bad = (s: string) => {
  problems++;
  return c.bad(s);
};

const args = process.argv.slice(2);
const fights = !args.includes("--no-fights");
const ids = args.filter((a) => !a.startsWith("--"));
for (const id of ids)
  if (!WORLDS.some((w) => w.id === id) && !JOURNEYS.some((j) => j.id === id)) {
    console.error(`Unknown area or journey: ${id}`);
    process.exit(1);
  }
const areas = ids.length ? WORLDS.filter((w) => ids.includes(w.id) || JOURNEYS.some((j) => ids.includes(j.id) && j.areas.includes(w.id))) : WORLDS;

// ── load ─────────────────────────────────────────────────────────────────────
await ensureFf9Content(db);
await ensureRewardContent(db);
const gear = items.filter(isGear);
const seededGear = JSON.parse(readFileSync(join(REWARD_CACHE_DIR, REWARD_SEED_FILES.gear), "utf8")) as GearAvailability[];

/** Every fight token in an area: each spawn pattern of its scenes (`@ID#n`), or a plain enemy-id group as is. */
function fightsOf(w: WorldDef): { kind: string; group: string[] }[] {
  const out: { kind: string; group: string[] }[] = [];
  const add = (kind: string, g: string[]) => {
    if (g.some(isSceneRef)) for (const t of g.filter(isSceneRef)) getScene(t.slice(1)).patterns.forEach((_, i) => out.push({ kind, group: [`${t}#${i}`] }));
    else out.push({ kind, group: g });
  };
  for (const g of w.encounters) add("battle", g);
  for (const g of w.elites) add("elite", g);
  if (w.semiBoss) add("semi-boss", w.semiBoss);
  add("boss", w.boss);
  return out;
}

/** Play a fight on auto, the encounter test's way: why it isn't a real win or loss, or null. */
function playFight(group: string[]): string | null {
  const enc = encounterUnits(group, 0);
  if (!enc.units.some((u) => !u.untargetable)) return null; // an empty pattern (FF9 rate 0)
  const level = Math.min(99, Math.max(40, Math.max(...enc.units.map((u) => u.level)) + 10));
  const party = ["zidane", "vivi", "steiner", "garnet"].map((k, i) => {
    const b = newBuild(k, level);
    return partyUnit({ ...b, equipment: starterGear(b) }, i);
  });
  const e = new BattleEngine(createBattle({ seed: 42, party, enemies: enc.units, inventory: [], scene: enc.scene, noSurprise: true, canFlee: false }));
  let watchdog = false;
  for (let i = 0; i < 200_000 && !e.state.outcome; i++) {
    for (const u of e.readyUnits()) if (!e.submit(autoCommand(e, u)).ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
    if (e.step().some((x) => x.type === "message" && x.text === "The enemy withdrew")) watchdog = true;
  }
  const st = e.state;
  if (!st.outcome || st.tick >= MAX_TICKS) return "stalls (15-minute cap)";
  if (watchdog) return "ended by the stall watchdog";
  if (st.outcome === "victory" && !SCRIPTED_WIN_SCENES.has(st.scene ?? "") && st.units.some((u) => u.side === "enemy" && e.isTargetable(u)))
    return "ends itself with a monster standing";
  return null;
}

// ── areas ────────────────────────────────────────────────────────────────────
const origWarn = console.warn;
console.warn = () => {}; // the VM's notes about unsupported story opcodes
for (const w of areas) {
  const journeys = JOURNEYS.filter((j) => j.areas.includes(w.id)).map((j) => j.name);
  console.log(c.h(`${w.name} (${w.id})`) + c.dim(`  tier ${w.tier} · ${w.theme} · ${journeys.join(", ") || "no journey"}`));

  // Music
  const track = AREA_MUSIC[w.id];
  if (!track) console.log(c.note("music: none of its own (plays the world map theme)"));
  else if (!MUSIC_TRACKS[track]) console.log(bad(`music: ${track} is mapped but not built (pnpm -F web audio:music, then pack + upload)`));
  else console.log(c.ok(`music: ${MUSIC_TRACKS[track]!.name}`));

  // Shops
  const shopRows = w.shops.map((id) => ({ id, shop: shops.find((s) => s.id === id) }));
  const storeRows = w.itemStores.map((id) => ({ id, shop: shops.find((s) => s.id === id) }));
  const missing = [...shopRows, ...storeRows].filter((s) => !s.shop).map((s) => s.id);
  if (!w.shops.length) console.log(bad("shops: no FF9 equipment shops"));
  else if (missing.length) console.log(bad(`shops: unknown FF9 shop ids ${missing.join(", ")}`));
  else console.log(c.ok(`shops: ${shopRows.map((s) => `${s.shop!.name} (${s.shop!.items.length})`).join(", ")}; stores ${storeRows.map((s) => s.shop!.name).join(", ") || "none"}`));

  // Gear pools
  const inDb = gear.filter((i) => gearAvailability(i.id)?.mapPools.some((p) => p.area === w.id)).length;
  const inSeed = seededGear.filter((g) => g.mapPools.some((p) => p.area === w.id)).length;
  if (!inDb && !inSeed) console.log(bad("gear pools: nothing drops here (bun packages/game-core/scripts/gen-reward-seeds.ts --add-pools)"));
  else if (inSeed > inDb) console.log(bad(`gear pools: ${inDb} in the database, ${inSeed} in the seed (restart pnpm dev to merge)`));
  else console.log(c.ok(`gear pools: ${inDb} pieces`));

  // Sprites and fights
  const list = fightsOf(w);
  const monsters = new Map<string, string>();
  for (const f of list) for (const u of encounterUnits(f.group, 0).units) if (!u.untargetable) monsters.set(u.name, u.sprite);
  const placeholders = [...monsters].filter(([, sprite]) => !ENEMY_SPRITES[sprite.split("/")[1] ?? ""]).map(([name]) => name);
  if (placeholders.length) console.log(bad(`sprites: ${monsters.size - placeholders.length}/${monsters.size}; placeholders: ${placeholders.join(", ")}`));
  else console.log(c.ok(`sprites: all ${monsters.size} monsters`));

  if (fights) {
    const failed = list.flatMap((f) => {
      const why = playFight(f.group);
      return why ? [`${f.kind} ${f.group.join(" ")}: ${why}`] : [];
    });
    if (failed.length) for (const f of failed) console.log(bad(`fight ${f}`));
    else console.log(c.ok(`fights: all ${list.length} play out`));
  }
}
console.warn = origWarn;

console.log(problems ? `\n${c.bad(`${problems} problem${problems === 1 ? "" : "s"}`)}` : `\n${c.ok("no problems")}`);
process.exit(problems ? 1 : 0);
