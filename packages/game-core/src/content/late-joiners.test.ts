/**
 * The late joiners' kits (`import:memoria`): Kuja from the Playable Character Pack, Beatrix's abilities from Alternate
 * Fantasy, Marcus's Steal + Sword Art (ours). Innate abilities are usable without learning.
 */
import { describe, expect, test } from "bun:test";

import { actionByName, getCharacter, ROSTER } from "@ffix-roguelike/game-data";

import { partyUnit } from "../battle/units";
import { newBuild, starterGear } from "../stats";

const unit = (key: string, level = 30) => {
  const b = newBuild(key, level);
  return partyUnit({ ...b, equipment: starterGear(b) }, 0);
};
const usable = (key: string, name: string) => unit(key).commands.some((c) => c.actionIds.includes(actionByName(name).id));

describe("late joiners", () => {
  test("everyone on the roster is a character", () => {
    for (const key of ROSTER) expect(getCharacter(key).key).toBe(key);
  });

  test("Kuja: Sorcery and Summon; Flare Star innate; his Trance adds Ultima", () => {
    const kuja = getCharacter("kuja");
    expect(kuja.commands.map((c) => c.name)).toEqual(["Sorcery", "Summon"]);
    expect(usable("kuja", "Flare Star")).toBe(true);
    const ultima = actionByName("Ultima").id;
    expect(unit("kuja").tranceCommands.some((c) => c.actionIds.includes(ultima))).toBe(true);
    // Mod actions are renumbered below the monster-attack range (2000+).
    expect(ultima).toBeLessThan(2000);
  });

  test("Beatrix can use her Seiken from the start (it was empty before)", () => {
    expect(usable("beatrix", "Thunder Slash")).toBe(true);
    expect(usable("beatrix", "Climhazzard")).toBe(true);
  });

  test("Marcus: Steal plus Sword Arts learned from his swords, nothing free", () => {
    const marcus = getCharacter("marcus");
    expect(marcus.commands.map((c) => c.name)).toEqual(["Steal", "Swd Art"]);
    expect(marcus.innate ?? []).toEqual([]);
    expect(marcus.abilities.length).toBeGreaterThan(0);
  });
});
