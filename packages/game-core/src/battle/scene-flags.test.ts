/**
 * FF9 battle-scene flags (Memoria's BTL_SCENE_INFO): `NoMagical` (Oeilvert: the party can't cast magic) and
 * `ReverseAtk` (Ipsen's Castle: weapons hit for 60 − their power, so weak ones hit hard).
 */
import { describe, expect, test } from "bun:test";

import { actionByName } from "@ffix-roguelike/game-data";

import { encounterUnits } from "../run/run";
import { newBuild } from "../stats";
import { Calc, type CalcCommand } from "./calc";
import { BattleEngine, createBattle, getBattleAction } from "./engine";
import { partyUnit } from "./units";

/** A battle in a scene (the scene's own monsters) with Vivi and Zidane at Lv40. */
function inScene(scene: string) {
  const enc = encounterUnits([`@${scene}#0`], 0);
  const party = ["vivi", "zidane"].map((k, i) => partyUnit(newBuild(k, 40), i));
  return new BattleEngine(createBattle({ seed: 3, party, enemies: enc.units, inventory: [], scene: enc.scene, noSurprise: true, canFlee: false }));
}

describe("NoMagical (Oeilvert)", () => {
  test("the party can't cast magic; elsewhere it can", () => {
    const fire = actionByName("Fire").id;
    const vivi = (e: BattleEngine) => e.state.units.find((u) => u.key === "vivi")!;
    const foe = (e: BattleEngine) => e.state.units.find((u) => u.side === "enemy" && e.isTargetable(u))!;

    const oeilvert = inScene("UV_R001");
    expect(oeilvert.sceneHas("NoMagical")).toBe(true);
    expect(oeilvert.magicBlocked(vivi(oeilvert))).toBe("Magic can't be used here");
    expect(oeilvert.magicBlocked(foe(oeilvert))).toBeNull(); // monsters still can
    expect(oeilvert.isMagical(getBattleAction(fire))).toBe(true);

    const elsewhere = inScene("EF_R004");
    expect(elsewhere.sceneHas("NoMagical")).toBe(false);
    expect(elsewhere.magicBlocked(vivi(elsewhere))).toBeNull();
  });
});

describe("ReverseAtk (Ipsen's Castle)", () => {
  test("a weapon's power becomes 60 − its power (at least 1); elsewhere it's unchanged", () => {
    const run = (scene: string, power: number) => {
      const e = inScene(scene);
      const caster = e.state.units.find((u) => u.key === "zidane")!;
      const target = e.state.units.find((u) => u.side === "enemy")!;
      const cmd = { action: getBattleAction(1), kind: "attack", divided: false, shortRange: true, shortSummon: false } as unknown as CalcCommand;
      const v = new Calc(e, caster, target, cmd);
      v.attackPower = power;
      v.penaltyReverseAttack();
      return v.attackPower;
    };
    expect(run("IP_R006", 12)).toBe(48);
    expect(run("IP_R006", 75)).toBe(1);
    expect(run("EF_R004", 12)).toBe(12);
  });
});
