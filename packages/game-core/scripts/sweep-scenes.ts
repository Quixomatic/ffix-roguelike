#!/usr/bin/env bun
/**
 * sweep-scenes — play every FF9 battle scene with a strong auto party (Lv = the scene's top level + 10, starter
 * gear) and report fights that stall: no outcome, the stall watchdog ending it, long stretches where nobody acts,
 * time spent paused by the script, or bosses held at 0 HP waiting for a scripted ending. Defeats only mean the
 * auto party was too weak.
 *
 *   pnpm -F @ffix-roguelike/game-core sweep [SCENE…] [--level N] [--all-patterns] [--json out.json]
 */
import { bestiary } from "@ffix-roguelike/game-data";
import { loadBattleScriptCache, loadFf9Cache } from "@ffix-roguelike/game-data/cache";

import { autoCommand, BattleEngine, createBattle, encounterUnits, newBuild, partyUnit, registerBattleScripts, SCRIPTED_WIN_SCENES, starterGear, TICKS_PER_SECOND } from "../src/index";

loadFf9Cache();
registerBattleScripts(loadBattleScriptCache());

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const fixedLevel = opt("--level") ? Number(opt("--level")) : undefined;
const allPatterns = args.includes("--all-patterns");
const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--level" && args[i - 1] !== "--json");

const origWarn = console.warn;
let warnings: string[] = [];
console.warn = (...a: unknown[]) => warnings.push(a.join(" "));

interface Row {
  token: string;
  names: string;
  level: number;
  outcome: string;
  secs: number;
  /** Longest stretch with no command starting, seconds. */
  idle: number;
  /** Seconds outside the script's normal phase. */
  paused: number;
  /** Seconds a boss was held "dying". */
  dying: number;
  standing: number;
  /** Ended by the stall watchdog. */
  watchdog: boolean;
  warnings: string[];
}

const rows: Row[] = [];
const scenes = bestiary.scenes.filter((s) => only.length === 0 || only.includes(s.id));
for (const sc of scenes) {
  const pats = allPatterns ? sc.patterns.map((_, i) => i) : [0];
  for (const p of pats) {
    const token = `@${sc.id}#${p}`;
    warnings = [];
    let enc;
    try {
      enc = encounterUnits([token], 0);
    } catch (e) {
      rows.push({ token, names: String(e), level: 0, outcome: "error", secs: 0, idle: 0, paused: 0, dying: 0, standing: 0, watchdog: false, warnings: [] });
      continue;
    }
    if (!enc.units.some((u) => !u.untargetable)) continue;
    const maxLv = Math.max(...enc.units.map((u) => u.level));
    const level = fixedLevel ?? Math.min(99, Math.max(10, maxLv + 10));
    const party = ["zidane", "vivi", "steiner", "garnet"].map((k, i) => {
      const b = newBuild(k, level);
      return partyUnit({ ...b, equipment: starterGear(b) }, i);
    });
    const e = new BattleEngine(createBattle({ seed: 42, party, enemies: enc.units, inventory: [{ itemId: 236, count: 20 }], scene: enc.scene, noSurprise: true, canFlee: false }));
    let last = 0;
    let idle = 0;
    let paused = 0;
    let dying = 0;
    let watchdog = false;
    for (let i = 0; i < 400_000 && !e.state.outcome; i++) {
      for (const u of e.readyUnits()) {
        const r = e.submit(autoCommand(e, u));
        if (!r.ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
      }
      const evs = e.step();
      if (evs.some((x) => x.type === "actionStart")) last = e.state.tick;
      if (evs.some((x) => x.type === "message" && x.text === "The enemy withdrew")) watchdog = true;
      idle = Math.max(idle, e.state.tick - last);
      const ai = e.state.ai;
      if (ai && ai.phase !== 4) paused++;
      if (e.state.units.some((u) => u.ff9Dying)) dying++;
    }
    const st = e.state;
    rows.push({
      token,
      names: [...new Set(enc.units.map((u) => u.name + (u.untargetable ? "*" : "")))].join(", "),
      level,
      outcome: st.outcome ?? "none",
      secs: Math.round(st.tick / TICKS_PER_SECOND),
      idle: Math.round(idle / TICKS_PER_SECOND),
      paused: Math.round(paused / TICKS_PER_SECOND),
      dying: Math.round(dying / TICKS_PER_SECOND),
      standing: st.units.filter((u) => u.side === "enemy" && e.isTargetable(u)).length,
      watchdog,
      warnings: [...warnings],
    });
  }
}
console.warn = origWarn;

/** A boss FF9's script sends away (Beatrix): standing at the end is how it wins. */
const scripted = (r: Row) => SCRIPTED_WIN_SCENES.has(r.token.replace(/^@/, "").split(/[#!]/)[0]!);
const bad = (r: Row) =>
  r.outcome === "none" || r.outcome === "error" || r.secs >= 899 || r.watchdog || r.idle >= 15 || r.paused >= 6 || r.dying >= 6 || (r.outcome === "victory" && r.standing > 0 && !scripted(r)) || r.outcome === "fled";
for (const r of rows.filter(bad))
  console.log(`${r.token.padEnd(16)} ${r.outcome.padEnd(8)} ${String(r.secs).padStart(4)}s idle ${String(r.idle).padStart(3)} paused ${String(r.paused).padStart(3)} dying ${String(r.dying).padStart(2)} standing ${r.standing}${r.watchdog ? " WATCHDOG" : ""} Lv${r.level}  ${r.names}${r.warnings.length ? "  ⚠ " + r.warnings.join(" | ") : ""}`);
console.log(`\n${rows.length} fights, ${rows.filter(bad).length} flagged`);
const out = opt("--json");
if (out) await Bun.write(out, JSON.stringify(rows, null, 1));
