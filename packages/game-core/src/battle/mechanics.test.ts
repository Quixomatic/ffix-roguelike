/** FF9 battle mechanics, one by one (formulas and rules ported from Memoria). */
import { describe, expect, test } from "bun:test";

import { actionByName, itemByName } from "@ffix-roguelike/game-data";

import { newBuild } from "../stats";
import { SA } from "./calc";
import { BattleEngine, createBattle } from "./engine";
import { atbMaxFor, type BattleCommand, type BattleEvent, type BattleUnit } from "./types";
import { enemyGroup, partyUnit } from "./units";

const id = (name: string) => actionByName(name).id;

function hero(key: string, level = 20, tweak: Partial<BattleUnit> = {}, slot = 0): BattleUnit {
  return { ...partyUnit(newBuild(key, level), slot), ...tweak };
}

function enemy(tweak: Partial<BattleUnit> = {}, slot = 0): BattleUnit {
  const u = enemyGroup(["goblin"])[0]!;
  return { ...u, id: `e${slot}`, hp: 5000, maxHp: 5000, mp: 999, maxMp: 999, evade: 0, magicEvade: 0, ...tweak };
}

function battle(party: BattleUnit[], enemies: BattleUnit[], inventory: { itemId: number; count: number }[] = []) {
  const e = new BattleEngine(createBattle({ seed: 7, party, enemies, inventory, noSurprise: true, canFlee: true }));
  // Start everyone at 0 ATB so tests control who acts.
  for (const u of e.state.units) u.atb = 0;
  return e;
}

/** Queue a command as if `actor` had chosen it, and run until it (and any reactions) finished. */
function act(e: BattleEngine, cmd: BattleCommand, ticks = 200) {
  const actor = e.unit(cmd.actorId);
  actor.busyCommand = true;
  e.enqueue(cmd, "main");
  if (cmd.second) e.enqueue({ actorId: cmd.actorId, kind: "ability", actionId: cmd.second.actionId, targetIds: cmd.second.targetIds }, "second");
  const events: BattleEvent[] = [];
  for (let i = 0; i < ticks && !e.state.outcome; i++) {
    for (const u of e.state.units) if (u.id !== cmd.actorId && !u.busyCommand) u.atb = 0; // nobody else gets a turn
    events.push(...e.step());
    if (!e.state.queue.length && e.state.busy === 0) break;
  }
  return events;
}

const dmgTo = (events: ReturnType<BattleEngine["step"]>, unitId: string) =>
  events.filter((x) => x.type === "damage" && x.targetId === unitId && !x.mp).reduce((s, x) => s + (x.type === "damage" ? x.amount : 0), 0);

describe("damage formula", () => {
  test("physical: (weapon − Def) × (Str + Rnd(0..(Lv+Str)/8))", () => {
    const z = hero("zidane", 1, { spirit: 0 }); // no criticals
    const g = enemy({ defence: 6 });
    for (let seed = 0; seed < 30; seed++) {
      const e = battle([structuredClone(z)], [structuredClone(g)]);
      e.rng.state = seed + 1;
      const ev = act(e, { actorId: "p0", kind: "attack", targetIds: ["e0"] });
      const d = dmgTo(ev, "e0");
      if (d === 0) continue; // missed
      const base = z.weapon!.power - 6;
      expect(d).toBeGreaterThanOrEqual(base * z.strength);
      expect(d).toBeLessThanOrEqual(base * (z.strength + ((z.level + z.strength) >> 3)));
    }
  });

  test("Protect and back row each halve physical damage (modifiers stack on Attack)", () => {
    const z = hero("zidane", 30, { spirit: 0 });
    const run = (tweakTarget: Partial<BattleUnit>, backRow = false) => {
      const e = battle([{ ...structuredClone(z), backRow }], [enemy({ defence: 0, ...tweakTarget })]);
      return dmgTo(act(e, { actorId: "p0", kind: "attack", targetIds: ["e0"] }), "e0");
    };
    const plain = run({});
    const prot = run({ statuses: { protect: {} } });
    const back = run({}, true);
    expect(prot).toBeLessThan(plain * 0.6);
    expect(back).toBeLessThan(plain * 0.6);
  });

  test("damage caps at 9999", () => {
    const e = battle([hero("zidane", 99, { strength: 99, weapon: { ...hero("zidane").weapon!, power: 200 } })], [enemy({ defence: 0, hp: 60000, maxHp: 60000 })]);
    const ev = act(e, { actorId: "p0", kind: "attack", targetIds: ["e0"] });
    expect(dmgTo(ev, "e0")).toBeLessThanOrEqual(9999);
  });
});

describe("support abilities", () => {
  test("Protect Girls: Zidane takes a physical hit meant for Garnet under half HP", () => {
    const z = hero("zidane", 20, { supports: [SA.protectGirls] }, 0);
    const g = hero("garnet", 20, {}, 1);
    g.hp = Math.floor(g.maxHp / 3);
    const e = battle([z, g], [enemy({ attack: 30 })]);
    const garnetHp = e.unit("p1").hp;
    const ev = act(e, { actorId: "e0", kind: "attack", targetIds: ["p1"] });
    expect(ev.some((x) => x.type === "message" && x.text.includes("covers"))).toBe(true);
    expect(e.unit("p1").hp).toBe(garnetHp);
    expect(dmgTo(ev, "p0") + ev.filter((x) => x.type === "miss" && x.targetId === "p0").length).toBeGreaterThan(0);
  });

  test("Protect Girls ignores men and healthy women", () => {
    const z = hero("zidane", 20, { supports: [SA.protectGirls] }, 0);
    const v = hero("vivi", 20, {}, 1);
    v.hp = 10;
    const e = battle([z, v], [enemy({ attack: 30 })]);
    const ev = act(e, { actorId: "e0", kind: "attack", targetIds: ["p1"] });
    expect(ev.some((x) => x.type === "message" && x.text.includes("covers"))).toBe(false);
  });

  test("Cover: Steiner shields an ally in critical condition", () => {
    const s = hero("steiner", 20, { supports: [SA.cover] }, 0);
    const v = hero("vivi", 20, {}, 1);
    v.hp = Math.floor(v.maxHp / 8);
    const e = battle([s, v], [enemy({ attack: 30 })]);
    const viviHp = e.unit("p1").hp;
    act(e, { actorId: "e0", kind: "attack", targetIds: ["p1"] });
    expect(e.unit("p1").hp).toBe(viviHp);
  });

  test("Counter strikes back after a physical hit (Spirit% chance)", () => {
    const z = hero("zidane", 20, { supports: [SA.counter], spirit: 100 });
    const e = battle([z], [enemy({ attack: 10 })]);
    const ev = act(e, { actorId: "e0", kind: "attack", targetIds: ["p0"] });
    expect(ev.some((x) => x.type === "actionStart" && x.actorId === "p0" && x.name === "Counter")).toBe(true);
  });

  test("Auto-Potion drinks a Potion when hit", () => {
    const z = hero("zidane", 20, { supports: [SA.autoPotion] });
    const potion = itemByName("Potion").id;
    const e = battle([z], [enemy({ attack: 25 })], [{ itemId: potion, count: 3 }]);
    for (let i = 0; i < 5 && e.state.inventory[0]!.count === 3; i++) act(e, { actorId: "e0", kind: "attack", targetIds: ["p0"] });
    expect(e.state.inventory[0]!.count).toBe(2);
  });

  test("Return Magic sends a spell back to the caster", () => {
    const v = hero("vivi", 30, { supports: [SA.returnMagic] });
    const e = battle([v], [enemy({ ai: [{ actionId: id("Fire"), weight: 1 }] })]);
    const ev = act(e, { actorId: "e0", kind: "ability", actionId: id("Fire"), targetIds: ["p0"] });
    expect(ev.some((x) => x.type === "actionStart" && x.actorId === "p0" && x.name === "Fire")).toBe(true);
    expect(dmgTo(ev, "e0")).toBeGreaterThan(0);
  });

  test("Healer: the Attack command heals", () => {
    const z = hero("zidane", 20, { supports: [SA.healer] }, 0);
    const v = hero("vivi", 20, {}, 1);
    v.hp = 10;
    const e = battle([z, v], [enemy()]);
    act(e, { actorId: "p0", kind: "attack", targetIds: ["p1"] });
    expect(e.unit("p1").hp).toBeGreaterThan(10);
  });

  test("Half MP halves spell costs", () => {
    const v = hero("vivi", 30, { supports: [SA.halfMp] });
    const e = battle([v], [enemy()]);
    const mp = e.unit("p0").mp;
    act(e, { actorId: "p0", kind: "ability", actionId: id("Fira"), targetIds: ["e0"] });
    expect(mp - e.unit("p0").mp).toBe(Math.floor(actionByName("Fira").mp / 2));
  });

  test("Auto-Haste makes the gauge fill 1.5× as fast, and Haste can't be dispelled by Slow", () => {
    const z = hero("zidane", 20, { supports: [SA.autoHaste] });
    const e = battle([z], [enemy()]);
    const u = e.unit("p0");
    expect(u.statuses.haste).toBeDefined();
    u.atb = 0;
    e.step();
    expect(u.atb).toBe(15 * 4);
    expect(e.alterStatus(u, "slow")).toBe(0);
  });

  test("Body Temp / Insomniac etc. block their statuses", () => {
    const z = hero("zidane", 20, { supports: [SA.insomniac] });
    const e = battle([z], [enemy()]);
    expect(e.alterStatus(e.unit("p0"), "sleep")).toBe(0);
  });

  test("Restore HP heals half max HP when a hit leaves you critical", () => {
    const z = hero("zidane", 20, { supports: [SA.restoreHp], defence: 0 });
    const e = battle([z], [enemy({ attack: 200, strength: 99 })]);
    const u = e.unit("p0");
    u.hp = u.maxHp;
    // force a hit that leaves Zidane in critical condition
    for (let i = 0; i < 10 && u.hp > 0; i++) {
      const before = u.hp;
      act(e, { actorId: "e0", kind: "attack", targetIds: ["p0"] });
      if (u.hp > 0 && u.hp < before && u.hp > u.maxHp / 6) continue;
      break;
    }
    expect(u.hp === 0 || u.hp > u.maxHp / 6).toBe(true);
  });
});

describe("statuses", () => {
  test("Reflect bounces a single-target spell to the other side", () => {
    const v = hero("vivi", 30, { statuses: { reflect: { conti: 99999 } } });
    const e = battle([v], [enemy()]);
    const ev = act(e, { actorId: "e0", kind: "ability", actionId: id("Fire"), targetIds: ["p0"] });
    expect(ev.some((x) => x.type === "message" && x.text === "Reflected!")).toBe(true);
    expect(dmgTo(ev, "e0")).toBeGreaterThan(0);
    expect(dmgTo(ev, "p0")).toBe(0);
  });

  test("the reflect trick: Firaga bounced off your own reflecting party lands on enemies", () => {
    const v = hero("vivi", 40, {}, 0);
    const z = hero("zidane", 40, { statuses: { reflect: { conti: 99999 } } }, 1);
    const e = battle([v, z], [enemy()]);
    const ev = act(e, { actorId: "p0", kind: "ability", actionId: id("Firaga"), targetIds: ["p1"] });
    expect(dmgTo(ev, "e0")).toBeGreaterThan(0);
    expect(dmgTo(ev, "p1")).toBe(0);
  });

  test("poison ticks 1/16 max HP on FF9's interval", () => {
    const z = hero("zidane", 20);
    const e = battle([z], [enemy()]);
    const u = e.unit("p0");
    e.alterStatus(u, "poison");
    const before = u.hp;
    for (let i = 0; i < 15 * 30; i++) {
      u.atb = 0;
      e.state.units[1]!.atb = 0;
      e.step();
    }
    expect(before - u.hp).toBeGreaterThanOrEqual(u.maxHp >> 4);
  });

  test("a physical hit shatters a frozen enemy", () => {
    const e = battle([hero("zidane", 20)], [enemy({ statuses: { freeze: { conti: 9999 } } })]);
    act(e, { actorId: "p0", kind: "attack", targetIds: ["e0"] });
    expect(e.unit("e0").hp).toBe(0);
  });

  test("sleep breaks on a physical hit", () => {
    const e = battle([hero("zidane", 20)], [enemy({ statuses: { sleep: { conti: 9999 } } })]);
    act(e, { actorId: "p0", kind: "attack", targetIds: ["e0"] });
    expect(e.unit("e0").statuses.sleep).toBeUndefined();
  });

  test("bosses (Easy Kill proof) shrug off Death and Demi", () => {
    const e = battle([hero("vivi", 40)], [enemy({ boss: true })]);
    const ev = act(e, { actorId: "p0", kind: "ability", actionId: id("Demi"), targetIds: ["e0"] });
    expect(dmgTo(ev, "e0")).toBe(0);
  });
});

describe("trance & character specials", () => {
  test("getting hit fills the Trance gauge; Trance drains with each action", () => {
    const z = hero("zidane", 20);
    const e = battle([z], [enemy({ attack: 15 })]);
    const u = e.unit("p0");
    let guard = 0;
    while (!u.statuses.trance && guard++ < 200) {
      u.hp = u.maxHp;
      act(e, { actorId: "e0", kind: "attack", targetIds: ["p0"] });
    }
    expect(u.statuses.trance).toBeDefined();
    expect(e.commandsOf(u).some((c) => c.name === "Dyne")).toBe(true);
    act(e, { actorId: "p0", kind: "attack", targetIds: ["e0"] });
    expect(u.trance).toBeLessThan(255);
  });

  test("Double Black casts two spells in one turn", () => {
    const v = hero("vivi", 40);
    v.trance = 255;
    const e = battle([v], [enemy()]);
    const u = e.unit("p0");
    e.alterStatus(u, "trance");
    const dbl = e.commandsOf(u).find((c) => c.id === 23)!;
    expect(dbl).toBeDefined();
    const fire = dbl.actionIds[0]!;
    const mp = u.mp;
    const ev = act(e, { actorId: "p0", kind: "ability", actionId: fire, targetIds: ["e0"], second: { actionId: fire, targetIds: ["e0"] } });
    expect(ev.filter((x) => x.type === "actionStart" && x.actorId === "p0").length).toBe(2);
    expect(mp - u.mp).toBe(2 * actionByName("Fire").mp);
  });

  test("Jump: Freya leaves the field (untargetable), then lands with Spear", () => {
    const f = hero("freya", 20);
    const e = battle([f], [enemy()]);
    const u = e.unit("p0");
    u.busyCommand = true;
    e.enqueue({ actorId: "p0", kind: "ability", actionId: 178, targetIds: ["e0"] }, "main");
    e.step();
    expect(u.statuses.jump).toBeDefined();
    expect(e.isTargetable(u)).toBe(false);
    const events: BattleEvent[] = [];
    for (let i = 0; i < 15 * 60 && u.statuses.jump; i++) {
      e.state.units[1]!.atb = 0;
      events.push(...e.step());
    }
    expect(events.some((x) => x.type === "actionStart" && x.name === "Spear")).toBe(true);
    expect(dmgTo(events, "e0")).toBeGreaterThan(0);
    expect(u.statuses.jump).toBeUndefined();
  });

  test("Garnet's Eidolon recasts on its own during Trance", () => {
    const g = hero("garnet", 40);
    g.tranceCommands = g.tranceCommands.map((c) => (c.id === 18 ? { ...c, actionIds: [id("Shiva")] } : c));
    const e = battle([g], [enemy({ hp: 60000, maxHp: 60000 })]);
    const u = e.unit("p0");
    u.trance = 255;
    e.alterStatus(u, "trance");
    act(e, { actorId: "p0", kind: "ability", actionId: id("Shiva"), targetIds: [] });
    expect(u.phantom?.actionId).toBe(id("Diamond Dust"));
    const events: BattleEvent[] = [];
    for (let i = 0; i < 15 * 60 && !events.some((x) => x.type === "actionStart" && x.name === "Diamond Dust"); i++) {
      u.atb = 0;
      e.state.units[1]!.atb = 0;
      u.trance = 255;
      events.push(...e.step());
    }
    expect(events.some((x) => x.type === "actionStart" && x.name === "Diamond Dust")).toBe(true);
  });

  test("Steiner's Magic Sword needs Vivi", () => {
    const s = hero("steiner", 30);
    s.commands = s.commands.map((c) => (c.id === 31 ? { ...c, actionIds: [id("Fire Sword")] } : c));
    const e = battle([s], [enemy()]);
    e.state.ready = ["p0"];
    expect(e.validate({ actorId: "p0", kind: "ability", actionId: id("Fire Sword"), targetIds: ["e0"] })).toContain("Vivi");
  });

  test("ATB: full gauge = (60 − Speed) × 160", () => {
    const z = hero("zidane", 1);
    expect(z.atbMax).toBe(atbMaxFor(z.speed));
    expect(z.atbMax).toBe((60 - z.speed) * 160);
  });
});
