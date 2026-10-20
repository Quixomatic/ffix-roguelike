/**
 * Steiner's Magic Sword: not learned by Steiner; each sword is there when the party's Vivi knows its spell.
 */
import { describe, expect, test } from "bun:test";

import { actionByName, getAction } from "@ffix-roguelike/game-data";

import { newBuild, starterGear } from "../stats";
import { BattleEngine, createBattle } from "./engine";
import { magicSwordSpell } from "./magic-sword";
import { partyUnit } from "./units";

const member = (key: string, slot: number) => {
  const b = newBuild(key, 20);
  return partyUnit({ ...b, equipment: starterGear(b) }, slot);
};
const swords = (party: string[]) => {
  const st = createBattle({ seed: 1, party: party.map(member), enemies: [], inventory: [], noSurprise: true });
  const steiner = st.units.find((u) => u.key === "steiner")!;
  return steiner.commands.find((c) => c.name === "Swd Mag")!.actionIds.map((id) => getAction(id).name);
};

describe("Magic Sword", () => {
  test("each sword needs Vivi's spell", () => {
    expect(getAction(magicSwordSpell(actionByName("Fire Sword").id)!).name).toBe("Fire");
    expect(getAction(magicSwordSpell(actionByName("Doomsday Sword").id)!).name).toBe("Doomsday");
  });

  test("with Vivi, Steiner has the swords for the spells Vivi knows; without him, none", () => {
    const viviKnows = new Set(member("vivi", 1).commands.flatMap((c) => c.actionIds).map((id) => getAction(id).name));
    const withVivi = swords(["steiner", "vivi"]);
    expect(withVivi.length).toBeGreaterThan(0);
    for (const s of withVivi) expect(viviKnows.has(s.replace(/ Sword$/, ""))).toBe(true);
    expect(swords(["steiner", "zidane"])).toEqual([]);
  });

  test("a sword Vivi's spell allows is usable while Vivi can act", () => {
    const st = createBattle({ seed: 1, party: [member("steiner", 0), member("vivi", 1)], enemies: [], inventory: [], noSurprise: true });
    const e = new BattleEngine(st);
    const steiner = e.state.units.find((u) => u.key === "steiner")!;
    expect(e.magicSwordReady(steiner)).toBe(true);
  });
});
