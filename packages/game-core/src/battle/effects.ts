/**
 * Action resolution — FF9's battle formulas, keyed by Memoria script id.
 *
 *   Physical: Damage = (Atk − Def) × (Str + Rnd(0 .. (Lv + Str) / 8))
 *   Magic:    Damage = (Power − MDef) × (Mag + Rnd(0 .. (Lv + Mag) / 8))
 *   Heal:     Amount = Power × (Mag + Rnd(0 .. (Lv + Mag) / 8))
 *   Status:   Hit% = Rate + Mag / 4 + Lv − TargetLv  (minus magic evade for hostile statuses)
 *
 * Modifiers: critical ×2 (Spirit/4 %), back row ½ for melee, Defend/Protect/Shell ½, multi-target magic ½,
 * elemental weak ×1.5 / half ½ / immune 0 / absorb heals, Trance & Berserk ×1.5, killer supports ×1.5.
 */
import { findItem, type Element, type Status } from "@ffix-roguelike/game-data";

import { SCRIPT } from "../content/enemy-actions";
import type { BattleEngine } from "./engine";
import { getBattleAction, POSITIVE_STATUSES } from "./engine";
import type { BattleAction, BattleCommand, BattleUnit, EnemyFamily } from "./types";

const KILLERS: Record<number, EnemyFamily> = {
  13: "bird",
  14: "bug",
  15: "stone",
  16: "undead",
  17: "dragon",
  18: "devil",
  19: "beast",
  20: "human",
};

const STATUS_GUARDS: [number, Status[]][] = [
  [40, ["heat", "freeze"]], // Body Temp
  [48, ["sleep"]], // Insomniac
  [49, ["poison", "venom"]], // Antibody
  [50, ["blind"]], // Bright Eyes
  [51, ["silence"]], // Loudmouth
  [53, ["petrify", "gradualPetrify"]], // Jelly
  [57, ["stop"]], // Locomotion
  [58, ["confuse"]], // Clear Headed
];

/** Status immunities granted by support abilities. */
export function supportImmunities(supports: number[]): Status[] {
  return STATUS_GUARDS.filter(([id]) => supports.includes(id)).flatMap(([, s]) => s);
}

interface Ctx {
  e: BattleEngine;
  actor: BattleUnit;
  action: BattleAction;
  targets: BattleUnit[];
  multi: boolean;
  fromItem: boolean;
}

export function executeAction(e: BattleEngine, actor: BattleUnit, cmd: BattleCommand) {
  switch (cmd.kind) {
    case "defend":
      e.emit({ type: "actionStart", actorId: actor.id, name: "Defend", kind: "defend", targetIds: [actor.id] });
      actor.statuses.defend = { remaining: null, nextTick: 0 };
      e.emit({ type: "statusOn", targetId: actor.id, status: "defend" });
      return;
    case "change":
      actor.backRow = !actor.backRow;
      e.emit({ type: "actionStart", actorId: actor.id, name: "Change", kind: "change", targetIds: [actor.id] });
      return;
    case "flee": {
      e.emit({ type: "actionStart", actorId: actor.id, name: "Flee", kind: "flee", targetIds: [] });
      const party = e.allies(actor).filter((u) => e.isActive(u));
      const foes = e.opponents(actor).filter((u) => e.isActive(u));
      const avg = (us: BattleUnit[]) => us.reduce((s, u) => s + u.level, 0) / Math.max(1, us.length);
      const chance = Math.max(10, Math.min(90, 50 + (avg(party) - avg(foes)) * 4));
      if (e.rng.chance(chance)) e.finish("fled");
      else e.emit({ type: "message", text: "Couldn't escape!" });
      return;
    }
    case "attack": {
      const action = actor.side === "enemy" ? getBattleAction(1000) : getBattleAction(176);
      const targets = liveTargets(e, actor, cmd.targetIds, false);
      e.emit({ type: "actionStart", actorId: actor.id, name: "Attack", kind: "attack", targetIds: targets.map((t) => t.id) });
      for (const t of targets) weaponAttack({ e, actor, action, targets, multi: false, fromItem: false }, t, 1);
      return;
    }
    case "item": {
      const item = findItem(cmd.itemId!);
      if (!item?.effect || !e.consume(item.id)) return;
      const fx = item.effect;
      const targets = liveTargets(e, actor, cmd.targetIds, fx.forDead);
      e.emit({ type: "actionStart", actorId: actor.id, name: item.name, kind: "item", targetIds: targets.map((t) => t.id) });
      const action: BattleAction = {
        id: -item.id,
        name: item.name,
        targets: fx.targets,
        defaultAlly: true,
        forDead: fx.forDead,
        scriptId: fx.scriptId,
        power: fx.power,
        elements: fx.elements,
        rate: fx.rate || 255,
        category: 0,
        statuses: fx.statuses,
        mp: 0,
      };
      for (const t of targets) resolve({ e, actor, action, targets, multi: targets.length > 1, fromItem: true }, t);
      return;
    }
    case "ability": {
      const action = getBattleAction(cmd.actionId!);
      const cost = e.mpCost(actor, action);
      if (actor.mp < cost) {
        e.emit({ type: "message", text: "Not enough MP" });
        return;
      }
      actor.mp -= cost;
      let targets = resolveTargets(e, actor, action, cmd.targetIds);
      e.emit({ type: "actionStart", actorId: actor.id, name: action.name, kind: "ability", targetIds: targets.map((t) => t.id) });
      const multi = targets.length > 1 && (action.targets.startsWith("many") || action.targets === "singleAny");
      // Reflect bounces single-target reflectable spells back at the caster's side.
      if ((action.category & 1) !== 0 && targets.length === 1 && e.has(targets[0]!, "reflect") && actor.side !== targets[0]!.side) {
        const bounce = e.allies(actor).filter((u) => e.isActive(u));
        if (bounce.length) {
          e.emit({ type: "message", text: "Reflected!" });
          targets = [e.rng.pick(bounce)];
        }
      }
      if (action.scriptId === 0 || action.id === 176) {
        // Script-less physical commands (Attack / Jump).
        const mult = action.id === 178 || action.id === 172 ? (actor.supports.includes(21) ? 3 : 2) : 1;
        for (const t of targets) weaponAttack({ e, actor, action, targets, multi, fromItem: false }, t, mult);
        return;
      }
      const ctx: Ctx = { e, actor, action, targets, multi, fromItem: false };
      for (const t of targets) resolve(ctx, t);
      return;
    }
  }
}

function liveTargets(e: BattleEngine, actor: BattleUnit, ids: string[], forDead: boolean): BattleUnit[] {
  const units = ids.map((id) => e.unit(id)).filter((u) => (forDead ? true : e.isActive(u)));
  if (units.length || forDead) return units;
  // Original target fell before the action landed: retarget a random foe, as FF9 does.
  const pool = e.opponents(actor).filter((u) => e.isActive(u));
  return pool.length ? [e.rng.pick(pool)] : [];
}

function resolveTargets(e: BattleEngine, actor: BattleUnit, action: BattleAction, ids: string[]): BattleUnit[] {
  const t = action.targets;
  if (t === "self") return [actor];
  if (t.startsWith("all") || t === "everyone") return e.targetPool(actor, t, action.forDead);
  if (t.startsWith("random")) {
    const pool = e.targetPool(actor, t, false);
    return pool.length ? [e.rng.pick(pool)] : [];
  }
  return liveTargets(e, actor, ids, action.forDead);
}

// ── shared math ──────────────────────────────────────────────────────────────
function bonus(e: BattleEngine, level: number, stat: number): number {
  return stat + e.rng.int(0, Math.floor((level + stat) / 8));
}

/** Combined elemental multiplier; negative = absorbed. */
function elementMod(e: BattleEngine, target: BattleUnit, elements: Element[]): number {
  if (!elements.length) return 1;
  const el = target.elements;
  if (elements.some((x) => el.absorb.includes(x))) return -1;
  if (elements.every((x) => el.immune.includes(x) || (x === "earth" && e.has(target, "float")))) return 0;
  if (elements.some((x) => el.weak.includes(x))) return 1.5;
  if (elements.some((x) => el.half.includes(x))) return 0.5;
  return 1;
}

function undeadLike(e: BattleEngine, u: BattleUnit): boolean {
  return u.family === "undead" || e.has(u, "zombie");
}

/** Apply an elemental/absorb-aware damage number. */
function hit(ctx: Ctx, target: BattleUnit, amount: number, elements: Element[], crit = false) {
  const mod = elementMod(ctx.e, target, elements);
  if (mod === 0) {
    ctx.e.emit({ type: "damage", targetId: target.id, amount: 0 });
    return;
  }
  if (mod < 0) {
    ctx.e.heal(target, amount);
    return;
  }
  ctx.e.damage(target, Math.max(1, Math.floor(amount * mod)), { crit });
}

function healOrHurt(ctx: Ctx, target: BattleUnit, amount: number) {
  if (undeadLike(ctx.e, target)) ctx.e.damage(target, amount);
  else ctx.e.heal(target, amount);
}

function physicalHits(e: BattleEngine, actor: BattleUnit, target: BattleUnit, accuracyBonus = 0): boolean {
  if (e.has(target, "vanish")) return false;
  if (e.has(target, "sleep") || e.has(target, "stop") || e.has(target, "freeze") || e.has(target, "petrify")) return true;
  let evade = target.evade;
  if (e.has(actor, "blind") && !actor.supports.includes(9)) evade = Math.max(evade * 2, 50);
  if (target.supports.includes(26) && e.rng.chance(25)) return false; // Gamble Defence
  return e.rng.int(0, 99) >= evade - accuracyBonus;
}

interface PhysOpts {
  attack: number;
  stat: number;
  elements: Element[];
  ignoreRow?: boolean;
  mult?: number;
  canCrit?: boolean;
}

function physicalDamage(ctx: Ctx, target: BattleUnit, o: PhysOpts): number | null {
  const { e, actor } = ctx;
  if (!physicalHits(e, actor, target)) {
    e.emit({ type: "miss", targetId: target.id });
    return null;
  }
  if (e.has(target, "freeze")) {
    e.emit({ type: "message", text: `${target.name} shattered!` });
    e.knockOut(target);
    return null;
  }
  if (e.has(actor, "mini")) return 1;
  const base = Math.max(1, o.attack - target.defence);
  let dmg = base * bonus(e, actor.level, o.stat);
  let crit = false;
  if (o.canCrit !== false && e.rng.int(0, 99) < Math.floor(actor.spirit / 4)) {
    dmg *= 2;
    crit = true;
  }
  const longRange = o.ignoreRow || actor.weapon?.longRange || actor.supports.includes(11);
  if (!longRange && (actor.backRow || target.backRow)) dmg = Math.floor(dmg / 2);
  if (e.has(target, "defend")) dmg = Math.floor(dmg / 2);
  if (e.has(target, "protect")) dmg = Math.floor(dmg / 2);
  if (e.has(actor, "berserk") || e.inTrance(actor)) dmg = Math.floor(dmg * 1.5);
  if (target.family && Object.entries(KILLERS).some(([sa, fam]) => fam === target.family && actor.supports.includes(Number(sa))))
    dmg = Math.floor(dmg * 1.5);
  if (actor.supports.includes(12) && actor.mp >= Math.floor(actor.maxMp / 16)) {
    // MP Attack
    actor.mp -= Math.floor(actor.maxMp / 16);
    dmg = Math.floor(dmg * 1.5);
  }
  if (e.has(target, "mini")) dmg *= 2;
  dmg = Math.floor(dmg * (o.mult ?? 1));
  hit(ctx, target, dmg, o.elements, crit);
  return dmg;
}

function magicDamage(ctx: Ctx, target: BattleUnit, power: number, elements: Element[], stat?: number): number {
  const { e, actor } = ctx;
  const base = Math.max(1, power - target.magicDefence);
  let dmg = base * bonus(e, actor.level, stat ?? actor.magic);
  if (ctx.multi) dmg = Math.floor(dmg / 2);
  if (e.has(target, "shell")) dmg = Math.floor(dmg / 2);
  if (actor.supports.includes(33)) dmg = Math.floor(dmg * 1.5); // Concentrate
  if (e.has(target, "mini") && actor.side !== target.side) dmg = Math.floor(dmg * 1.25);
  hit(ctx, target, dmg, elements);
  return dmg;
}

function statusChance(_e: BattleEngine, actor: BattleUnit, target: BattleUnit, rate: number, hostile: boolean): number {
  if (rate >= 255) return 100;
  let pct = rate + Math.floor(actor.magic / 4) + actor.level - target.level;
  if (hostile) pct -= Math.floor(target.magicEvade / 2);
  if (target.boss) pct = Math.floor(pct / 2);
  return Math.max(0, Math.min(100, pct));
}

function inflict(ctx: Ctx, target: BattleUnit, statuses: Status[], rate: number): boolean {
  const { e, actor } = ctx;
  const hostile = statuses.some((s) => !POSITIVE_STATUSES.includes(s));
  if (!e.rng.chance(statusChance(e, actor, target, rate, hostile && actor.side !== target.side))) {
    e.emit({ type: "miss", targetId: target.id });
    return false;
  }
  let any = false;
  for (const s of statuses) any = e.addStatus(target, s) || any;
  if (!any) e.emit({ type: "miss", targetId: target.id });
  return any;
}

function cure(ctx: Ctx, target: BattleUnit, statuses: Status[]) {
  for (const s of statuses) {
    if (s === "death") continue;
    ctx.e.removeStatus(target, s);
  }
}

// ── the attack command ───────────────────────────────────────────────────────
function weaponAttack(ctx: Ctx, target: BattleUnit, mult: number) {
  const { e, actor } = ctx;
  if (!e.isActive(target)) return;
  if (actor.side === "enemy") {
    physicalDamage(ctx, target, { attack: actor.attack, stat: actor.strength, elements: actor.attackElements, mult });
    return;
  }
  const w = actor.weapon;
  const script = w?.scriptId ?? 1;
  let stat = actor.strength;
  if (script === 2) stat = Math.floor((actor.strength + actor.speed) / 2); // thief swords
  if (script === 3) stat = Math.floor((actor.strength + actor.magic) / 2); // rackets
  if (script === 5) stat = e.rng.int(1, actor.strength * 2); // hammers/forks: wild swings
  const dealt = physicalDamage(ctx, target, {
    attack: actor.attack,
    stat,
    elements: actor.attackElements,
    ignoreRow: script === 0,
    mult,
  });
  if (dealt == null) return;
  if (script === 6) e.heal(actor, Math.floor(dealt / 2)); // Blood Sword
  // Weapon status (Mage Masher → Silence, …): always rolled with Add Status, else at the weapon's rate.
  if (w?.statuses.length && e.isActive(target)) {
    const rate = actor.supports.includes(25) ? Math.max(w.statusRate, 40) : w.statusRate;
    if (rate > 0 && e.rng.chance(rate)) for (const s of w.statuses) e.addStatus(target, s);
  }
}

// ── script dispatch ──────────────────────────────────────────────────────────
function resolve(ctx: Ctx, target: BattleUnit) {
  const { e, actor, action } = ctx;
  const p = action.power;
  const s = action.scriptId;
  if (!action.forDead && !e.isActive(target) && s !== 13 && s !== 72) return;

  switch (s) {
    // Magic damage (Fire, Holy, summons, enemy spells)
    case 9:
    case 85:
    case 23:
      if (s === 23 && action.rate && target.level % action.rate !== 0) return void e.emit({ type: "miss", targetId: target.id });
      magicDamage(ctx, target, p, action.elements);
      if (action.statuses.length && e.isActive(target)) inflict(ctx, target, action.statuses, 20);
      return;
    case 10: // Cure
      return healOrHurt(ctx, target, Math.floor((p * bonus(e, actor.level, actor.magic)) / (ctx.multi ? 2 : 1)));
    case 11: // Add status (hostile)
    case 103: // Add status (buff)
    case 109:
    case 1006:
      return void inflict(ctx, target, action.statuses, action.rate);
    case 12: // Esuna/Panacea/Stona
    case 73:
      return cure(ctx, target, action.statuses);
    case 13: // Life
    case 72: // Phoenix Down
      if (e.isAlive(target)) return;
      if (undeadLike(e, target)) return void e.knockOut(target);
      e.revive(target, s === 72 ? target.maxHp / 10 : Math.max(target.maxHp / 10, (target.maxHp * (p + target.spirit)) / 100));
      return;
    case 14: // Death
    case 108: // Iai Strike
      if (undeadLike(e, target) && s === 14) return healOrHurt(ctx, target, target.maxHp);
      return void inflict(ctx, target, ["death"], action.rate);
    case 15: {
      // Osmose
      const amt = Math.floor((magicDamageNoApply(ctx, target, p) || 1) / 4);
      e.damageMp(target, amt);
      e.healMp(actor, amt);
      return;
    }
    case 16: {
      // Drain
      const dmg = magicDamageNoApply(ctx, target, p);
      if (undeadLike(e, target)) {
        e.heal(target, dmg);
        e.damage(actor, dmg, { noTrance: true });
      } else {
        e.damage(target, dmg);
        e.heal(actor, dmg);
      }
      return;
    }
    case 17: // Demi
    case 86: // Atomos
    case SCRIPT.gravity:
      if (target.boss || !e.rng.chance(statusChance(e, actor, target, action.rate || 100, true))) return void e.emit({ type: "miss", targetId: target.id });
      return e.damage(target, Math.max(1, Math.floor((target.hp * Math.min(p, 50)) / 100)));
    case 18: // Comet / Meteor — high variance
      return void magicDamage(ctx, target, Math.floor(p * (0.5 + e.rng.next())), action.elements);
    case 19: // Zidane/Amarant skill attacks
    case 20: // Steiner sword arts
    case 63: // Magic Sword
    case 21: // Goblin Punch
    case 32: // Darkside
    case 39: // Lancer
    case 1000:
    case 1001: {
      if (s === 32) e.damage(actor, Math.floor(actor.maxHp / 8), { noTrance: true });
      const attack = s === 1000 || s === 1001 ? actor.attack + p : actor.attack + p;
      const mult = s === 21 && target.level === actor.level ? 8 : 1;
      const elements = action.elements.length ? action.elements : actor.attackElements;
      const dealt = physicalDamage(ctx, target, { attack, stat: actor.strength, elements, mult, ignoreRow: s !== 1000 && s !== 1001 });
      if (dealt == null || !e.isActive(target)) return;
      if (s === 39) e.damageMp(target, Math.floor(dealt / 16));
      if ((s === 1001 || action.statuses.length) && action.statuses.length) inflict(ctx, target, action.statuses, action.rate || 30);
      return;
    }
    case 22: // LV5 Death
      if (target.level % 5 !== 0) return void e.emit({ type: "miss", targetId: target.id });
      return void inflict(ctx, target, ["death"], 255);
    case 24: // LV3 Def-less
      if (target.level % 3 !== 0) return void e.emit({ type: "miss", targetId: target.id });
      e.removeStatus(target, "protect");
      e.removeStatus(target, "shell");
      target.defence = Math.floor(target.defence / 2);
      target.magicDefence = Math.floor(target.magicDefence / 2);
      return e.emit({ type: "message", text: `${target.name}'s defence fell!` });
    case 25: {
      // Roulette
      const pool = e.state.units.filter((u) => e.isActive(u) && !u.boss);
      if (pool.length) e.knockOut(e.rng.pick(pool));
      return;
    }
    case 26: // 1,000 Needles
    case SCRIPT.fixed:
      return e.damage(target, s === 26 ? 1000 : p * 10);
    case 27: // Matra Magic
      if (!e.rng.chance(statusChance(e, actor, target, action.rate, true))) return void e.emit({ type: "miss", targetId: target.id });
      return e.damage(target, target.hp - 1);
    case 28: // Limit Glove
      return actor.hp === 1 ? e.damage(target, 9999) : void e.emit({ type: "miss", targetId: target.id });
    case 29: // Pumpkin Head / Minus Strike
      return e.damage(target, Math.max(1, actor.maxHp - actor.hp));
    case 30: // White Wind
      return healOrHurt(ctx, target, Math.floor(actor.hp / 3));
    case 31: // Magic Hammer
      return e.damageMp(target, e.rng.int(1, Math.max(1, target.mp)));
    case 33: // Armour Break
    case 34: // Power Break
    case 35: // Mental Break
    case 36: // Magic Break
      if (!e.rng.chance(statusChance(e, actor, target, action.rate, true))) return void e.emit({ type: "miss", targetId: target.id });
      if (s === 33) target.defence = Math.floor(target.defence * 0.5);
      if (s === 34) target.attack = Math.floor(target.attack * 0.75);
      if (s === 35) target.magicDefence = Math.floor(target.magicDefence * 0.5);
      if (s === 36) target.magic = Math.floor(target.magic * 0.75);
      return e.emit({ type: "message", text: `${target.name}: ${action.name}!` });
    case 37: // Chakra
      e.heal(target, Math.floor((target.maxHp * p) / 100));
      return e.healMp(target, Math.floor((target.maxMp * p) / 200));
    case 38: // Spare Change
      return e.damage(target, Math.floor(actor.level * p * 0.6));
    case 41: // White Draw
      return e.healMp(target, Math.floor(bonus(e, actor.level, actor.magic) * 2));
    case 43: // Might
      target.strength = Math.min(99, Math.floor(target.strength * 1.25));
      return e.emit({ type: "message", text: `${target.name}'s strength rose!` });
    case 44: // Focus
      actor.magic = Math.min(99, Math.floor(actor.magic * 1.25));
      return e.emit({ type: "message", text: `${actor.name}'s magic rose!` });
    case 45: // Sacrifice
      for (const ally of e.allies(actor)) if (ally !== actor && e.isActive(ally)) e.heal(ally, ally.maxHp);
      return e.knockOut(actor);
    case 46: // Soul Blade
      if (actor.weapon?.statuses.length) inflict(ctx, target, actor.weapon.statuses, 255);
      else e.emit({ type: "miss", targetId: target.id });
      return;
    case 48: // Spear (Dragon Knight Jump)
    case 83:
      return void physicalDamage(ctx, target, { attack: actor.attack, stat: actor.strength, elements: actor.attackElements, mult: 2, ignoreRow: true });
    case 49: // Phoenix
      if (target.side === actor.side) e.revive(target, target.maxHp / 4);
      else magicDamage(ctx, target, p, action.elements);
      return;
    case 52: // Angel's Snack (Remedy for the party)
      return cure(ctx, target, ["poison", "venom", "blind", "silence", "confuse", "berserk", "slow", "mini", "sleep"]);
    case 53: // Lucky Seven
      return e.damage(target, e.rng.pick([7, 77, 777, 7777, 1]));
    case 54: // What's That!?
      for (const u of e.opponents(actor)) u.atb = 0;
      return e.emit({ type: "message", text: "Huh? What's that!?" });
    case 58: // Steal / Mug
      return steal(ctx, target);
    case 59: // Scan
      return e.emit({ type: "message", text: `${target.name}: Lv${target.level} HP ${target.hp}/${target.maxHp}` });
    case 60: {
      // Detect
      const names = (target.steal ?? []).map((sl) => findItem(sl.itemId)?.name).filter(Boolean);
      return e.emit({ type: "message", text: names.length ? `Steal: ${names.join(", ")}` : "Nothing to steal" });
    }
    case 65: // Eat / Cook
      return eat(ctx, target);
    case 66: // Frog Drop
      return e.damage(target, actor.level * 12);
    case 67: // Thievery
      return e.damage(target, actor.speed * 14 + e.state.stolen.length * 50);
    case 68: // Dragon's Crest
      return e.damage(target, actor.level * actor.level);
    case 87: // Odin
      if (!target.boss && !target.statusImmune.includes("death") && e.rng.chance(50)) return void e.addStatus(target, "death");
      return void magicDamage(ctx, target, p, action.elements);
    case 69: // Potion / Hi-Potion
      return healOrHurt(ctx, target, p * 10 * (actor.supports.includes(27) ? 2 : 1));
    case 70: // Ether
      return e.healMp(target, p * 10 * (actor.supports.includes(27) ? 2 : 1));
    case 71: // Elixir
      healOrHurt(ctx, target, target.maxHp);
      return e.healMp(target, target.maxMp);
    case 75: // Dead Pepper
      return e.damage(target, p * actor.level);
    case 76: // Tent
      healOrHurt(ctx, target, target.maxHp / 2);
      e.healMp(target, target.maxMp / 2);
      return cure(ctx, target, ["poison", "blind", "silence"]);
    case 77: // Dark Matter
      return e.damage(target, 9999);
    case SCRIPT.selfDestruct:
      e.damage(target, actor.hp);
      if (target === ctx.targets[ctx.targets.length - 1]) e.knockOut(actor);
      return;
    default:
      if (p > 0) magicDamage(ctx, target, p, action.elements);
      else if (action.statuses.length) inflict(ctx, target, action.statuses, action.rate || 50);
      else e.emit({ type: "message", text: `${action.name}!` });
  }
}

function magicDamageNoApply(ctx: Ctx, target: BattleUnit, power: number): number {
  const base = Math.max(1, power - target.magicDefence);
  return base * bonus(ctx.e, ctx.actor.level, ctx.actor.magic);
}

function steal(ctx: Ctx, target: BattleUnit) {
  const { e, actor, action } = ctx;
  if (action.id === 181 || actor.supports.includes(61)) {
    physicalDamage(ctx, target, { attack: actor.attack, stat: actor.strength, elements: actor.attackElements });
  }
  if (!e.isActive(target) && action.id !== 181) return;
  const slots = target.steal ?? [];
  if (!slots.length) {
    e.emit({ type: "steal", actorId: actor.id, targetId: target.id, itemId: null });
    return e.emit({ type: "message", text: "Nothing to steal" });
  }
  // FF9: base success depends on level gap + speed; Bandit raises it. Master Thief always tries the best slot.
  const odds = Math.min(95, 40 + (actor.level - target.level) * 2 + Math.floor(actor.speed / 2) + (actor.supports.includes(62) ? 25 : 0));
  if (!e.rng.chance(odds)) {
    e.emit({ type: "steal", actorId: actor.id, targetId: target.id, itemId: null });
    return e.emit({ type: "message", text: "Couldn't steal" });
  }
  const order = actor.supports.includes(22) ? [...slots].reverse() : slots;
  for (const slot of order) {
    if (e.rng.int(0, 255) < slot.chance) {
      target.steal = slots.filter((x) => x !== slot);
      e.state.stolen.push(slot.itemId);
      if (actor.supports.includes(23)) e.state.gilBonus += target.level * 20;
      e.emit({ type: "steal", actorId: actor.id, targetId: target.id, itemId: slot.itemId });
      return;
    }
  }
  e.emit({ type: "steal", actorId: actor.id, targetId: target.id, itemId: null });
  e.emit({ type: "message", text: "Couldn't steal" });
}

function eat(ctx: Ctx, target: BattleUnit) {
  const { e, actor, action } = ctx;
  const threshold = action.power === 2 ? 2 : 4; // Cook works at ½ HP, Eat at ¼
  if (target.side === actor.side || target.boss || target.hp > target.maxHp / threshold) {
    return e.emit({ type: "message", text: "Can't eat it!" });
  }
  e.emit({ type: "message", text: `${actor.name} ate ${target.name}!` });
  e.knockOut(target);
  if (target.eatTeaches != null && !e.state.learned.some((l) => l.unitId === actor.id && l.actionId === target.eatTeaches)) {
    e.state.learned.push({ unitId: actor.id, actionId: target.eatTeaches });
    e.emit({ type: "learn", unitId: actor.id, actionId: target.eatTeaches });
  }
}
