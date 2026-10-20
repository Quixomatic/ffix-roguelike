/**
 * Every fight an area can throw at you must be a real fight under FF9's scripts: it can't stall (story set
 * pieces that wait for a cutscene cue), it can't end itself without anyone dying (friendly encounters, scripted
 * escapes), and it never needs the engine's stall watchdog. Checked with a strong full party on the auto AI.
 */
import { describe, expect, test } from "bun:test";

import { autoCommand } from "../battle/autoplay";
import { BattleEngine, createBattle, MAX_TICKS } from "../battle/engine";
import { partyUnit } from "../battle/units";
import { encounterUnits } from "../run/run";
import { newBuild, starterGear } from "../stats";
import { getScene, isSceneRef, SCRIPTED_WIN_SCENES } from "./ff9-scenes";
import { WORLDS } from "./worlds";

const party = (level: number) =>
  ["zidane", "vivi", "steiner", "garnet"].map((k, i) => {
    const b = newBuild(k, level);
    return partyUnit({ ...b, equipment: starterGear(b) }, i);
  });

/**
 * The party's level for a fight: ten above its strongest monster (as the sweep script plays it), at least 40, so a
 * late-game boss is fought at a fair level rather than by a party it can only outlast.
 */
const testLevel = (units: { level: number }[]) => Math.min(99, Math.max(40, Math.max(...units.map((u) => u.level)) + 10));

describe("area encounters", () => {
  const tokens = new Set<string>();
  for (const w of WORLDS)
    for (const g of [...w.encounters, ...w.elites, w.boss])
      for (const t of g.filter(isSceneRef)) getScene(t.slice(1)).patterns.forEach((_, i) => tokens.add(`${t}#${i}`));

  test.each([...tokens])("%s is a real fight", (token) => {
    const enc = encounterUnits([token], 0);
    if (!enc.units.some((u) => !u.untargetable)) return; // empty pattern (FF9 rate 0)
    const e = new BattleEngine(createBattle({ seed: 42, party: party(testLevel(enc.units)), enemies: enc.units, inventory: [], scene: enc.scene, noSurprise: true, canFlee: false }));
    let watchdog = false;
    for (let i = 0; i < 200_000 && !e.state.outcome; i++) {
      for (const u of e.readyUnits()) if (!e.submit(autoCommand(e, u)).ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
      if (e.step().some((ev) => ev.type === "message" && ev.text === "The enemy withdrew")) watchdog = true;
    }
    const st = e.state;
    expect(st.outcome).not.toBeNull();
    expect(watchdog).toBe(false);
    // Stalled = hit the 15-minute cap; self-ended = "victory" with a monster still standing (allowed only for the
    // scripted wins: bosses FF9's script sends away, like Beatrix).
    expect(st.tick).toBeLessThan(MAX_TICKS);
    if (st.outcome === "victory" && !SCRIPTED_WIN_SCENES.has(st.scene ?? ""))
      expect(st.units.filter((u) => u.side === "enemy" && e.isTargetable(u)).length).toBe(0);
  });
});

describe("scripted wins", () => {
  test.each([...SCRIPTED_WIN_SCENES])("%s ends in a victory, the boss withdrawing", (scene) => {
    const enc = encounterUnits([`@${scene}`], 0);
    const e = new BattleEngine(createBattle({ seed: 7, party: party(30), enemies: enc.units, inventory: [], scene: enc.scene, noSurprise: true, canFlee: false }));
    const messages: string[] = [];
    for (let i = 0; i < 200_000 && !e.state.outcome; i++) {
      for (const u of e.readyUnits()) if (!e.submit(autoCommand(e, u)).ok) e.submit({ actorId: u.id, kind: "defend", targetIds: [] });
      for (const ev of e.step()) if (ev.type === "message") messages.push(ev.text);
    }
    expect(e.state.outcome).toBe("victory");
    expect(messages.some((m) => m.endsWith("withdraws"))).toBe(true);
  });
});
