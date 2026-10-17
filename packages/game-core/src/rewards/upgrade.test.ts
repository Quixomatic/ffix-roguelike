import { describe, expect, test } from "bun:test";
import { getCharacter, items, roleOf, type ItemData } from "@ffix-roguelike/game-data";

import { gearChange, newBuild, type CharacterBuild } from "../stats";
import { upgradeScore, upgradesFor } from "./upgrade";

const build = (key: string, level = 10, slots: CharacterBuild["unlockedSlots"] = ["head", "wrist", "armor", "accessory"]): CharacterBuild => ({
  ...newBuild(key, level),
  unlockedSlots: slots,
});
const learnable = (key: string, i: ItemData) => i.abilities.filter((r) => getCharacter(key).abilities.some((a) => a.ref === r));

describe("upgrade scoring", () => {
  test("the stat value is the real stat changes weighted by the character's role", () => {
    const vivi = build("vivi");
    const role = roleOf("vivi")!;
    for (const item of items.filter((i) => i.kind === "head" && i.equippableBy.includes("vivi")).slice(0, 8)) {
      const e = upgradeScore(vivi, item.id)!;
      const change = gearChange(vivi, item.id)!;
      const expected = Object.entries(change.deltas).reduce((s, [k, d]) => s + (role.weights[k as keyof typeof role.weights] ?? 0) * d!, 0);
      expect(e.statScore).toBeCloseTo(expected, 6);
    }
  });

  test("a mage values Magic more than a fighter does", () => {
    const fighters = ["steiner", "zidane", "freya", "amarant"];
    const piece = items.find((i) => (i.bonus?.magic ?? 0) > 0 && i.equippableBy.includes("vivi") && fighters.some((k) => i.equippableBy.includes(k)))!;
    expect(piece).toBeDefined();
    const fighter = fighters.find((k) => piece.equippableBy.includes(k))!;
    // Score the Magic it gives on its own: the stat changes' Magic delta, weighted by each role.
    const magicValue = (key: string) => {
      const e = upgradeScore(build(key), piece.id)!;
      return (roleOf(key)!.weights.magic ?? 0) * (e.change.deltas.magic ?? 0);
    };
    expect(magicValue("vivi")).toBeGreaterThan(magicValue(fighter));
  });

  test("an unmastered ability it would teach adds value; a mastered one doesn't", () => {
    const vivi = build("vivi");
    const teacher = items.find((i) => i.kind === "weapon" && i.equippableBy.includes("vivi") && learnable("vivi", i).length && i.id !== vivi.equipment.weapon)!;
    const e = upgradeScore(vivi, teacher.id)!;
    expect(e.teaches.length).toBeGreaterThan(0);
    expect(e.abilityScore).toBeGreaterThan(0);
    const mastered: CharacterBuild = { ...vivi, ap: Object.fromEntries(learnable("vivi", teacher).map((r) => [r, 9999])) };
    expect(upgradeScore(mastered, teacher.id)!.teaches).toEqual([]);
  });

  test("replacing a piece that's still teaching something warns, with the progress", () => {
    const vivi = build("vivi");
    const weapons = items.filter((i) => i.kind === "weapon" && i.equippableBy.includes("vivi") && learnable("vivi", i).length);
    const [a, b] = [weapons[0]!, weapons.find((w) => learnable("vivi", w).some((r) => !learnable("vivi", weapons[0]!).includes(r)) && w.id !== weapons[0]!.id)!];
    const ref = learnable("vivi", a)[0]!;
    const wearing: CharacterBuild = { ...vivi, equipment: { ...vivi.equipment, weapon: a.id }, ap: { [ref]: 3 } };
    const e = upgradeScore(wearing, b.id)!;
    if (learnable("vivi", b).includes(ref)) return; // b teaches it too: nothing lost
    expect(e.stopsLearning.map((l) => l.ref)).toContain(ref);
    expect(e.stopsLearning.find((l) => l.ref === ref)!.ap).toBe(3);
    expect(e.lossScore).toBeGreaterThan(0);
  });

  test("nothing for gear they can't wear, a locked slot, or what they already wear", () => {
    const vivi = build("vivi", 10, []);
    const hat = items.find((i) => i.kind === "head" && i.equippableBy.includes("vivi"))!;
    expect(upgradeScore(vivi, hat.id)).toBeNull(); // head slot locked
    const sword = items.find((i) => i.kind === "weapon" && !i.equippableBy.includes("vivi"))!;
    expect(upgradeScore(build("vivi"), sword.id)).toBeNull();
    expect(upgradeScore(vivi, vivi.equipment.weapon!)).toBeNull();
  });

  test("upgradesFor lists the best first, only above the threshold", () => {
    const vivi = build("vivi");
    const list = upgradesFor(vivi, items.map((i) => i.id), 2);
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.score).toBeGreaterThanOrEqual(list[i]!.score);
    expect(list.every((e) => e.score >= 2)).toBe(true);
  });
});
