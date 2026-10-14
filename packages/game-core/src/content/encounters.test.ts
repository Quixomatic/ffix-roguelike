/**
 * Every fight an area can throw at you must be a real fight under FF9's scripts: it can't stall (story set
 * pieces that wait for a cutscene cue) and it can't end itself without anyone dying (friendly encounters,
 * scripted escapes). Checked with a strong full party on the auto AI.
 */
import { describe, expect, test } from "bun:test";

import { autoBattle } from "../battle/autoplay";
import { BattleEngine, createBattle } from "../battle/engine";
import { partyUnit } from "../battle/units";
import { encounterUnits } from "../run/run";
import { newBuild, starterGear } from "../stats";
import { getScene, isSceneRef } from "./ff9-scenes";
import { WORLDS } from "./worlds";

const party = () =>
  ["zidane", "vivi", "steiner", "garnet"].map((k, i) => {
    const b = newBuild(k, 40);
    return partyUnit({ ...b, equipment: starterGear(b) }, i);
  });

describe("area encounters", () => {
  const tokens = new Set<string>();
  for (const w of WORLDS)
    for (const g of [...w.encounters, ...w.elites])
      for (const t of g.filter(isSceneRef)) getScene(t.slice(1)).patterns.forEach((_, i) => tokens.add(`${t}#${i}`));

  test.each([...tokens])("%s is a real fight", (token) => {
    const enc = encounterUnits([token], 0);
    if (!enc.units.some((u) => !u.untargetable)) return; // empty pattern (FF9 rate 0)
    const st = autoBattle(new BattleEngine(createBattle({ seed: 42, party: party(), enemies: enc.units, inventory: [], scene: enc.scene, noSurprise: true, canFlee: false }))).state;
    expect(st.outcome).not.toBeNull();
    // Stalled = hit the 15-minute cap; self-ended = "victory" with a monster still standing.
    expect(st.tick).toBeLessThan(15 * 600);
    if (st.outcome === "victory") expect(st.units.filter((u) => u.side === "enemy" && !u.untargetable && u.hp > 0).length).toBe(0);
  });
});
