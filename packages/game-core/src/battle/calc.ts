/**
 * FF9's battle calculator, ported from Memoria (Assembly-CSharp/Memoria/Battle/Calculator + Memoria.Scripts
 * Sources/Battle/*.cs). One `Calc` = one caster × one target × one command, exactly like `BattleCalculator`.
 *
 *   Damage    = Attack × max(1, AttackPower − DefencePower)
 *   Physical  Attack = Str + Rnd(0 .. (Lv + Str) / 8)   (enemies: / 4), AttackPower = weapon / command power
 *   Magic     Attack = Mag + Rnd(0 .. (Lv + Mag) / 8),   AttackPower = spell power, Defence = MDef
 *   Modifiers each multiply Attack by 1.5 (bonus) or 0.5 (penalty): Protect/Shell/Defend, back row, multi-target,
 *   elemental weakness/resistance, killers, MP Attack, Berserk/Trance, Mini, Sleep…
 *
 * Script ids are FF9's (Actions.csv `scriptId`). Ids ≥ 1000 are this project's enemy-only shorthands.
 */
import { findItem, getAction, type Element, type Status } from "@ffix-roguelike/game-data";

import { SCRIPT } from "../content/enemy-actions";
import type { BattleEngine } from "./engine";
import { sumPct } from "./modifiers";
import { ENEMY_CATEGORY, PLAYER_CATEGORY, type BattleAction, type BattleUnit } from "./types";

// ── flags ────────────────────────────────────────────────────────────────────
export const F = {
  miss: 1,
  dodge: 2,
  mpAttack: 4,
  absorb: 8,
  guard: 64,
  directHp: 128,
  addStat: 256,
} as const;

/** Per-unit result flags (Memoria CalcFlag). */
export const C = {
  hp: 1,
  hpRecover: 2,
  crit: 4,
  mp: 8,
  mpRecover: 16,
} as const;

/** Ability category bits (Actions.csv `category`). */
export const CAT = {
  reflectable: 1,
  silenceable: 2,
  physical: 8,
  magical: 16,
  noDamageMotion: 64,
  returnable: 128,
} as const;

/** Support ability ids (AbilityGems.csv). */
export const SA = {
  autoReflect: 0,
  autoFloat: 1,
  autoHaste: 2,
  autoRegen: 3,
  autoLife: 4,
  accuracy: 9,
  distract: 10,
  longReach: 11,
  mpAttack: 12,
  birdKiller: 13,
  bugKiller: 14,
  stoneKiller: 15,
  undeadKiller: 16,
  dragonKiller: 17,
  devilKiller: 18,
  beastKiller: 19,
  manEater: 20,
  highJump: 21,
  masterThief: 22,
  stealGil: 23,
  healer: 24,
  addStatus: 25,
  gambleDefence: 26,
  chemist: 27,
  powerThrow: 28,
  powerUp: 29,
  reflectNull: 30,
  reflectX2: 31,
  magElemNull: 32,
  concentrate: 33,
  halfMp: 34,
  highTide: 35,
  counter: 36,
  cover: 37,
  protectGirls: 38,
  eyeForEye: 39,
  bodyTemp: 40,
  alert: 41,
  initiative: 42,
  levelUp: 43,
  abilityUp: 44,
  millionaire: 45,
  fleeGil: 46,
  guardianMog: 47,
  insomniac: 48,
  antibody: 49,
  brightEyes: 50,
  loudmouth: 51,
  restoreHp: 52,
  jelly: 53,
  returnMagic: 54,
  absorbMp: 55,
  autoPotion: 56,
  locomotion: 57,
  clearHeaded: 58,
  boost: 59,
  odinsSword: 60,
  mug: 61,
  bandit: 62,
} as const;

const KILLERS: [number, number][] = [
  [SA.birdKiller, ENEMY_CATEGORY.flight],
  [SA.bugKiller, ENEMY_CATEGORY.soul],
  [SA.stoneKiller, ENEMY_CATEGORY.stone],
  [SA.undeadKiller, ENEMY_CATEGORY.undead],
  [SA.dragonKiller, ENEMY_CATEGORY.dragon],
  [SA.devilKiller, ENEMY_CATEGORY.devil],
  [SA.beastKiller, ENEMY_CATEGORY.beast],
  [SA.manEater, ENEMY_CATEGORY.humanoid],
];

/** Statuses an ability adds that count as "added this hit" (they aren't removed by the same hit). */
const REMOVE_ON_PHYSICAL: Status[] = ["confuse", "sleep"];
const REMOVE_ON_MAGICAL: Status[] = ["vanish"];

/** Weapons Soul Blade works with (FF9: the thief swords that carry a status). */
const SOUL_BLADE_WEAPONS = new Set(["Butterfly Sword", "The Ogre", "Exploda", "Rune Tooth", "Angel Bless", "Sargatanas", "Masamune", "The Tower", "Ultima Weapon"]);

/** Eidolon → the free attack Garnet's Trance keeps recasting. */
export const PHANTOMS: Record<number, number> = { 49: 153, 51: 154, 53: 155, 55: 156, 58: 157, 60: 158, 62: 159, 64: 160 };

/** Command being resolved: the action plus everything FF9 decides at cast time. */
export interface CalcCommand {
  action: BattleAction;
  /** "Attack", "Steal"… or the ability's own name. */
  kind: "attack" | "ability" | "item" | "throw" | "counter";
  itemId?: number;
  /** More than one target picked with a "many" cursor → damage/hit rate halved. */
  divided: boolean;
  shortRange: boolean;
  shortSummon: boolean;
  reflectNull: boolean;
  /** Reflect bounces landing on this target. */
  reflectHits: number;
  /** Elements after Mag Elem Null. */
  elements: Element[];
  /** Meteor's random miss (decided once per cast). */
  meteorMiss: boolean;
  /** Counter / Return Magic / Auto-Potion can't trigger more reactions. */
  counterable: boolean;
  /** Number of enemies at cast time (Mass Spear, Spare Change in Trance…). */
  enemyCount: number;
}

// ── the calculator ───────────────────────────────────────────────────────────
export class Calc {
  attack = 0;
  attackPower = 0;
  defencePower = 0;
  hitRate = 0;
  evade = 0;
  flags = 0;
  modifiers = 0;
  tranceIncrease: number;
  isDrain = false;
  added: Status[] = [];
  /** Per-unit results. */
  targetFlags = 0;
  casterFlags = 0;
  hpDamage = 0;
  mpDamage = 0;
  casterHp = 0;
  casterMp = 0;
  performResult = true;
  /** Disabled supports for the rest of this hit (DisableSA). */
  disabled = new Set<number>();

  constructor(
    readonly e: BattleEngine,
    readonly caster: BattleUnit,
    readonly target: BattleUnit,
    readonly cmd: CalcCommand,
  ) {
    this.tranceIncrease = e.rng.int(0, Math.max(1, target.spirit) - 1);
  }

  // ── helpers ──
  get power() {
    return this.cmd.action.power;
  }
  get rate() {
    return this.cmd.action.rate;
  }
  has(u: BattleUnit, s: Status) {
    return this.e.has(u, s);
  }
  hasSA(u: BattleUnit, id: number) {
    return u.supports.includes(id) && !this.disabled.has(id);
  }
  isPlayer(u: BattleUnit) {
    return u.side === "party";
  }
  isZombie(u: BattleUnit) {
    return (u.enemyCategory & ENEMY_CATEGORY.undead) !== 0 || this.has(u, "zombie");
  }
  rnd16() {
    return this.e.rng.int(0, 65535);
  }
  rnd8() {
    return this.e.rng.int(0, 255);
  }

  /** DamageModifierCount: each +1 multiplies Attack by 1.5, each −1 halves it. */
  modify(delta: number) {
    this.modifiers += delta;
    if (delta >= 0) for (let i = 0; i < delta; i++) this.attack = (this.attack * 3) >> 1;
    else for (let i = 0; i < -delta; i++) this.attack >>= 1;
  }

  // ── parameter setup (BattleCalculator / BattleCaster / BattleTarget) ──
  setMagicAttack() {
    const c = this.caster;
    this.attack = c.magic + (this.rnd16() % (1 + ((c.level + c.magic) >> 3)));
  }
  setPhysicalAttack() {
    const c = this.caster;
    this.attack = c.strength + (this.rnd16() % (1 + ((c.level + c.strength) >> 2)));
  }
  setLowPhysicalAttack() {
    const c = this.caster;
    this.attack = c.strength + (this.rnd16() % (1 + ((c.level + c.strength) >> 3)));
  }
  weaponPower() {
    return this.caster.side === "party" ? (this.caster.weapon?.power ?? 0) : this.caster.attack;
  }
  normalMagicParams() {
    this.attackPower = this.power;
    this.setMagicAttack();
    this.defencePower = this.target.magicDefence;
  }
  originalMagicParams() {
    this.attackPower = Math.floor((this.weaponPower() * this.power) / 10);
    this.setLowPhysicalAttack();
    this.defencePower = this.target.magicDefence;
  }
  normalPhysicalParams() {
    this.attackPower = this.power;
    this.setPhysicalAttack();
    this.defencePower = this.target.defence;
  }
  /** WeaponPhysicalParams() — skills that scale with the weapon (Zidane's skills, Lancer, Darkside). */
  weaponSkillParams() {
    this.attackPower = Math.floor((this.weaponPower() * this.power) / 10);
    this.setLowPhysicalAttack();
    this.defencePower = this.target.defence;
  }
  /** WeaponPhysicalParams(bonus) — the Attack command, by weapon formula. */
  weaponAttackParams(bonus: "simple" | "will" | "dex" | "magic" | "random" | "level") {
    const c = this.caster;
    const base = this.rnd16() % (1 + ((c.level + c.strength) >> 3));
    this.attackPower = this.weaponPower();
    this.defencePower = this.target.defence;
    switch (bonus) {
      case "simple":
        this.attack = c.strength + base;
        break;
      case "will":
        this.attack = ((c.strength + c.spirit) >> 1) + base;
        break;
      case "dex":
        this.attack = ((c.strength + c.speed) >> 1) + base;
        break;
      case "magic":
        this.attack = ((c.strength + c.magic) >> 1) + base;
        break;
      case "random":
        this.attack = (this.rnd16() % Math.max(1, c.strength)) + base;
        break;
      case "level":
        this.attackPower += c.level;
        this.attack = c.strength + base;
        break;
    }
  }

  magicAccuracy() {
    this.hitRate = Math.max(1, Math.min(100, this.rate + (this.caster.magic >> 2) + this.caster.level - this.target.level));
    this.evade = this.target.magicEvade;
  }
  physicalAccuracy() {
    this.hitRate = 100;
    this.evade = this.target.evade;
  }

  // caster modifiers
  casterPhysicalBonus() {
    const c = this.caster;
    if (this.has(c, "mini")) this.attack = 1;
    else if (this.has(c, "berserk") || (this.isPlayer(c) && this.has(c, "trance"))) this.modify(1);
  }
  enemyTranceBonus() {
    if (!this.isPlayer(this.caster) && this.has(this.caster, "trance")) this.modify(1);
  }
  penaltyMini() {
    if (this.has(this.caster, "mini")) this.modify(-1);
  }
  bonusWeaponElement() {
    if (this.caster.attackElements.some((x) => this.caster.bonusElements.includes(x))) this.modify(1);
  }
  // target modifiers
  targetPhysicalBonus() {
    const t = this.target;
    if (this.has(t, "defend") || this.has(t, "protect")) this.modify(-1);
    if (this.has(t, "sleep") || this.has(t, "mini")) this.modify(1);
  }
  penaltyShellAttack() {
    if (this.has(this.target, "shell")) this.modify(-1);
  }
  penaltyShellHitRate() {
    if (this.has(this.target, "shell")) this.hitRate >>= 1;
  }
  penaltyDividedAttack() {
    if (this.cmd.divided) this.modify(-1);
  }
  penaltyDividedHitRate() {
    if (this.cmd.divided) this.hitRate = Math.floor(this.hitRate / 2);
  }
  /** Back row / long range: melee from or into the back row is halved. */
  penaltyLongDistance() {
    const row = (u: BattleUnit) => (u.side === "enemy" ? 2 : u.backRow ? 0 : 1);
    const longWeapon = this.caster.side === "party" && (this.caster.weapon?.longRange ?? false);
    if (Math.abs(row(this.caster) - row(this.target)) > 1 && !longWeapon && this.cmd.shortRange) this.modify(-1);
  }
  bonusElement() {
    if (this.cmd.elements.some((x) => this.caster.bonusElements.includes(x))) this.modify(1);
  }

  /** CanAttackElement: guard → Guard, absorb → heals, weak/half adjust; fire thaws, ice/water cools. */
  canAttackElement(elements: Element[]): boolean {
    const t = this.target;
    if (!elements.length) return true;
    if (elements.some((x) => t.elements.immune.includes(x))) {
      this.flags |= F.guard;
      return false;
    }
    if (elements.some((x) => t.elements.half.includes(x))) this.modify(-1);
    if (elements.some((x) => t.elements.absorb.includes(x))) {
      this.flags |= F.absorb;
      this.defencePower = 0;
    }
    if (elements.some((x) => t.elements.weak.includes(x))) this.modify(1);
    if (elements.includes("ice") || elements.includes("water")) this.e.removeStatus(t, "heat");
    if (elements.includes("fire")) this.e.removeStatus(t, "freeze");
    return true;
  }
  canAttackMagic(): boolean {
    if (!this.canAttackElement(this.cmd.elements)) return false;
    if (this.has(this.target, "float") && this.cmd.elements.includes("earth")) {
      this.flags |= F.miss;
      return false;
    }
    return true;
  }
  canAttackWeaponElement(): boolean {
    return this.canAttackElement(this.caster.attackElements);
  }

  isCasterNotTarget() {
    if (this.caster !== this.target) return true;
    this.flags |= F.miss;
    return false;
  }
  canBeAttacked() {
    if (!this.has(this.target, "petrify") && !this.has(this.target, "death")) return true;
    this.flags |= F.miss;
    return false;
  }
  canBeRevived() {
    const t = this.target;
    if (this.has(t, "petrify") || (this.has(t, "death") && this.isZombie(t))) {
      this.flags |= F.miss;
      return false;
    }
    return true;
  }
  canBeHealed() {
    if (!this.has(this.target, "death")) return true;
    this.flags |= F.miss;
    return false;
  }
  /** Bosses ("Easy Kill" proof) shrug off instant-death style effects. */
  checkUnsafetyOrMiss() {
    if (!this.has(this.target, "easyKill")) return true;
    this.flags |= F.miss;
    return false;
  }
  checkUnsafetyOrGuard() {
    if (!this.has(this.target, "easyKill")) return true;
    this.flags |= F.guard;
    return false;
  }
  checkIsPlayer() {
    if (this.isPlayer(this.target)) return true;
    this.flags |= F.miss;
    return false;
  }
  isTargetLevelMultipleOfRate() {
    if (this.rate > 0 && this.target.level % this.rate === 0) return true;
    this.flags |= F.miss;
    return false;
  }
  /** Physical attacks shatter a frozen target outright. */
  tryKillFrozen(): boolean {
    const t = this.target;
    if (!this.has(t, "freeze") || this.has(t, "petrify") || this.has(t, "easyKill")) return false;
    this.e.emit({ type: "message", text: `${t.name} shattered!` });
    this.e.knockOut(t);
    this.performResult = false;
    return true;
  }

  // ── hit checks ──
  tryPhysicalHit(): boolean {
    const c = this.caster;
    const t = this.target;
    if (this.has(c, "blind") || this.has(c, "confuse")) this.hitRate = Math.floor(this.hitRate / 2);
    if (this.has(c, "trance") || this.has(c, "vanish")) this.evade = 0;
    if (["petrify", "venom", "virus", "blind", "confuse", "stop", "sleep", "freeze"].some((s) => this.has(t, s as Status))) this.evade = 0;
    if (this.has(t, "defend")) this.hitRate = Math.floor(this.hitRate / 2);
    if (this.has(t, "vanish")) this.hitRate = 0;
    this.saHitRateSetup();
    if (this.hitRate <= this.rnd16() % 100) {
      this.flags |= F.miss;
      return false;
    }
    if (t === c || this.evade <= this.rnd16() % 100) return true;
    this.flags |= F.miss | F.dodge;
    return false;
  }
  tryMagicHit(): boolean {
    this.saHitRateSetup();
    if (this.hitRate <= this.rnd16() % 100) {
      this.flags |= F.miss;
      return false;
    }
    if (this.evade > this.rnd16() % 100) {
      this.flags |= F.miss;
      return false;
    }
    return true;
  }
  /** Accuracy+ (caster) and Distract (target) — the "HitRateSetup" support features. */
  saHitRateSetup() {
    const s = this.cmd.action.scriptId;
    if (this.hasSA(this.caster, SA.accuracy) && this.cmd.kind === "attack") {
      this.hitRate = 100;
      this.evade = 0;
      this.disabled.add(SA.distract);
    }
    if (this.hasSA(this.target, SA.distract) && (s <= 8 || s === 101 || s === SCRIPT.enemyPhysical || s === SCRIPT.enemyPhysicalStatus)) this.hitRate = Math.floor(this.hitRate / 2);
  }

  // ── statuses ──
  tryAlterStatuses(statuses: Status[], changeContext: boolean): void {
    let best = 0; // 0 resist, 1 invalid, 2/3 success
    for (const s of statuses) {
      const r = this.e.alterStatus(this.target, s, this.caster);
      if (r >= 2) this.added.push(s);
      best = Math.max(best, r);
    }
    if (!changeContext || !statuses.length) return;
    if (best === 0) this.flags |= F.guard;
    else if (best === 1) this.flags |= F.miss;
  }
  /** Spell's secondary status: rolled at the command's raw rate (TryAlterMagicStatuses). */
  tryAlterMagicStatuses() {
    if (!this.cmd.action.statuses.length) return;
    this.saHitRateSetup();
    if (this.rate > this.rnd16() % 100) this.tryAlterStatuses(this.cmd.action.statuses, false);
  }
  tryAlterCommandStatuses() {
    this.tryAlterStatuses(this.cmd.action.statuses, true);
  }
  tryRemoveStatuses(statuses: Status[]) {
    let any = false;
    for (const s of statuses) any = this.e.removeStatus(this.target, s) || any;
    if (!any) this.flags |= F.miss;
  }

  tryDirectHpDamage() {
    const t = this.target;
    if (this.power === 0) {
      if (this.isZombie(t)) {
        if (this.canBeAttacked()) this.setHp(t, t.maxHp);
      } else if (this.has(t, "easyKill")) this.flags |= F.guard;
      else this.e.killUnit(t);
      return;
    }
    if (this.has(t, "death")) {
      this.flags |= F.miss;
      return;
    }
    this.flags |= F.directHp;
    this.setHp(t, this.power);
  }
  setHp(u: BattleUnit, hp: number) {
    const before = u.hp;
    u.hp = Math.max(0, Math.min(u.maxHp, Math.round(hp)));
    if (u.hp < before) this.e.emit({ type: "damage", targetId: u.id, amount: before - u.hp });
    else if (u.hp > before) this.e.emit({ type: "heal", targetId: u.id, amount: u.hp - before });
    if (u.hp === 0) this.e.killUnit(u);
  }
  setMp(u: BattleUnit, mp: number) {
    u.mp = Math.max(0, Math.min(u.maxMp, Math.round(mp)));
  }

  // ── damage ──
  prepareHpDraining() {
    this.targetFlags |= C.hp;
    this.casterFlags |= C.hp;
    if (this.isZombie(this.target)) this.targetFlags |= C.hpRecover;
    else this.casterFlags |= C.hpRecover;
    this.isDrain = true;
  }
  calcDamageCommon() {
    this.targetFlags |= C.hp;
    if (this.flags & F.absorb) this.targetFlags |= C.hpRecover;
    this.saCalcDamage();
  }
  ensureAttack() {
    if (this.attack < 1) this.attack = 1;
    return this.attack;
  }
  powerDifference() {
    return Math.max(1, this.attackPower - this.defencePower);
  }
  calcPhysicalHpDamage() {
    this.calcDamageCommon();
    this.hpDamage = this.ensureAttack() * this.powerDifference();
  }
  calcHpDamage() {
    this.calcDamageCommon();
    let dmg = this.ensureAttack() * this.powerDifference();
    if (this.cmd.shortSummon) dmg = Math.floor((dmg * 2) / 3);
    this.hpDamage = dmg;
  }
  calcMpDamage() {
    this.targetFlags |= C.mp;
    if (this.flags & F.absorb) {
      this.targetFlags |= C.mpRecover;
      this.defencePower = 0;
    }
    this.saCalcDamage();
    this.mpDamage = (Math.max(0, this.attackPower - this.defencePower) * this.ensureAttack()) >> 2;
  }
  calcProportionDamage() {
    this.calcDamageCommon();
    if (this.attack > 100) this.attack = 100;
    let dmg = Math.floor((this.target.maxHp * this.attack) / 100);
    if (this.cmd.shortSummon) dmg = Math.floor((dmg * 2) / 3);
    this.hpDamage = dmg;
  }
  calcCannonProportionDamage() {
    this.calcDamageCommon();
    if (this.attack > 100) this.attack = 100;
    this.hpDamage = Math.floor((this.target.hp * this.attack) / 100);
  }
  calcHpMagicRecovery() {
    if (!this.isZombie(this.target)) this.targetFlags |= C.hpRecover;
    this.calcDamageCommon();
    this.hpDamage = this.attackPower * this.attack;
  }
  calcMpMagicRecovery() {
    this.targetFlags |= C.mp;
    if (!this.isZombie(this.target)) this.targetFlags |= C.mpRecover;
    this.saCalcDamage();
    this.mpDamage = this.attackPower * this.attack;
  }
  /** PenaltyReverseAttack — Ipsen's Castle (`ReverseAtk`): weapons hit for 60 − their power, so weak ones hit hard. */
  penaltyReverseAttack() {
    if (this.e.sceneHas("ReverseAtk")) this.attackPower = Math.max(1, 60 - this.attackPower);
  }
  tryCriticalHit() {
    if (this.targetFlags & C.crit) return;
    const quarterWill = this.caster.spirit >> 2;
    if (quarterWill !== 0 && (this.rnd16() % quarterWill) > this.rnd16() % 100) {
      this.attack *= 2;
      this.hpDamage *= 2;
      this.mpDamage *= 2;
      this.targetFlags |= C.crit;
    }
  }
  raiseTrouble() {
    // handled when the damage is applied (needs the final number)
  }

  /** "CalcDamage" support features: killers, MP Attack, Healer, Gamble Defence, Chemist, Power Throw, Concentrate. */
  saCalcDamage() {
    const c = this.caster;
    const t = this.target;
    const s = this.cmd.action.scriptId;
    const isAttack = this.cmd.kind === "attack" || this.cmd.kind === "counter";
    const hostile = c.side !== t.side;
    // Healing Rod / Healer: the Attack command heals living targets.
    const healingRod = c.side === "party" && c.weaponId != null && findItem(c.weaponId)?.name === "Healing Rod";
    if ((healingRod || this.hasSA(c, SA.healer)) && isAttack && !this.isZombie(t)) this.targetFlags |= C.hpRecover;
    if (this.hasSA(c, SA.mpAttack) && isAttack && c.mp > 0 && hostile) {
      this.modify(1);
      this.flags |= F.mpAttack;
    }
    if (isAttack && hostile) {
      for (const [sa, cat] of KILLERS) {
        if (this.hasSA(c, sa) && (t.enemyCategory & cat) !== 0) {
          this.modify(1);
          break;
        }
      }
    }
    if (this.hasSA(c, SA.addStatus) && isAttack && hostile && this.rnd16() % 100 < (c.weapon?.statusRate ?? 0)) this.flags |= F.addStat;
    if (this.hasSA(t, SA.gambleDefence) && (s <= 8 || s === 39 || s === 100 || s === 102 || s === 107 || s === SCRIPT.enemyPhysical || s === SCRIPT.enemyPhysicalStatus))
      this.defencePower = this.rnd16() % Math.max(1, 2 * this.defencePower);
    if (this.hasSA(c, SA.chemist) && (s === 69 || s === 70)) this.attack *= 2;
    if (this.hasSA(c, SA.powerThrow) && s === 42) this.modify(1);
    if (this.hasSA(c, SA.concentrate) && (s === 10 || s === 13)) this.modify(1);
  }

  // ── steal ──
  steal() {
    const c = this.caster;
    const t = this.target;
    const slots = t.steal ?? [];
    if (!slots.some((x) => x.itemId >= 0)) {
      this.e.emit({ type: "steal", actorId: c.id, targetId: t.id, itemId: null });
      this.e.emit({ type: "message", text: "Doesn't have anything!" });
      return;
    }
    if (!this.hasSA(c, SA.bandit)) {
      const hit = c.level + c.spirit;
      const ev = Math.max(1, t.level);
      if (this.rnd16() % hit < this.rnd16() % ev) {
        this.e.emit({ type: "steal", actorId: c.id, targetId: t.id, itemId: null });
        this.e.emit({ type: "message", text: "Couldn't steal anything" });
        return;
      }
    }
    const master = this.hasSA(c, SA.masterThief);
    // Relics / synergies: steal chances up by a percentage (capped at certain).
    const bonus = sumPct(this.e.state.modifiers, c.id, "steal", "ratePct");
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i]!;
      if (slot.itemId < 0) continue;
      const base = master ? Math.max(32, slot.chance) : slot.chance;
      const rate = bonus ? Math.min(256, Math.round((base * (100 + bonus)) / 100)) : base;
      if (this.rnd8() < rate) return this.stealItem(i);
    }
    this.e.emit({ type: "steal", actorId: c.id, targetId: t.id, itemId: null });
    this.e.emit({ type: "message", text: "Couldn't steal anything" });
  }
  stealItem(i: number) {
    const c = this.caster;
    const t = this.target;
    const slot = t.steal![i]!;
    const itemId = slot.itemId;
    t.steal![i] = { itemId: -1, chance: 0 };
    this.e.state.stolen.push(itemId);
    // Steal Gil / Mug ride on a successful steal.
    if (this.hasSA(c, SA.stealGil)) this.e.state.gilBonus += this.e.rng.int(0, Math.floor((c.level * t.level) / 4));
    if (this.hasSA(c, SA.mug) && this.cmd.action.id === 177) {
      this.targetFlags |= C.hp;
      this.hpDamage = this.e.rng.int(0, Math.max(0, Math.floor((c.level * t.level) / 2) - 1));
    }
    this.e.emit({ type: "steal", actorId: c.id, targetId: t.id, itemId });
  }

  eat() {
    const t = this.target;
    const c = this.caster;
    if (!this.checkUnsafetyOrMiss() || !this.canBeAttacked() || (t.enemyCategory & ENEMY_CATEGORY.humanoid) !== 0 || t.side === c.side) {
      this.e.emit({ type: "message", text: "Can't eat that!" });
      return;
    }
    if (t.hp > Math.floor(t.maxHp / Math.max(1, this.power))) {
      this.e.emit({ type: "message", text: "Can't eat it, it's too strong!" });
      return;
    }
    this.e.emit({ type: "message", text: `${c.name} ate ${t.name}!` });
    this.e.killUnit(t);
    const blue = t.eatTeaches;
    if (blue == null || this.e.state.learned.some((l) => l.unitId === c.id && l.actionId === blue) || c.commands.some((cm) => cm.actionIds.includes(blue))) {
      this.e.emit({ type: "message", text: "Tastes bad!" });
      return;
    }
    this.e.state.learned.push({ unitId: c.id, actionId: blue });
    this.e.emit({ type: "learn", unitId: c.id, actionId: blue });
  }
}

/** Run the FF9 battle script for one caster × target. Returns the calculator for result handling. */
export function performScript(v: Calc): void {
  const { e, caster, target } = v;
  const action = v.cmd.action;
  const s = action.scriptId;

  // "BattleScriptStart" support features: Long Reach, High Tide.
  if (v.hasSA(caster, SA.longReach)) v.cmd.shortRange = false;
  if (v.hasSA(target, SA.highTide)) v.tranceIncrease = target.spirit;

  // The Attack command (and counters) use the weapon's script.
  if (v.cmd.kind === "attack" || v.cmd.kind === "counter") {
    if (caster.side === "enemy") return enemyPhysical(v, false);
    return weaponAttack(v);
  }
  if (v.cmd.kind === "throw") return throwScript(v);

  switch (s) {
    case 8:
    case SCRIPT.enemyPhysical:
    case SCRIPT.enemyPhysicalStatus:
      return enemyPhysical(v, s === 8 || s === SCRIPT.enemyPhysicalStatus);
    case 100:
      return enemyPhysical(v, true, true);
    case 9: // Magic attack (Fire, Holy, Phantoms…)
      v.normalMagicParams();
      v.enemyTranceBonus();
      v.penaltyMini();
      v.penaltyShellAttack();
      v.penaltyDividedAttack();
      v.bonusElement();
      if (v.canAttackMagic()) {
        v.calcHpDamage();
        v.tryAlterMagicStatuses();
      }
      return;
    case 10: // Cure
      v.normalMagicParams();
      v.enemyTranceBonus();
      v.penaltyMini();
      v.penaltyDividedAttack();
      v.calcHpMagicRecovery();
      return;
    case 11: // Negative status
    case 1006:
      v.magicAccuracy();
      v.penaltyShellHitRate();
      v.penaltyDividedHitRate();
      if (v.tryMagicHit()) v.tryAlterCommandStatuses();
      return;
    case 12: // Esuna, Panacea, Stona, Dispel
      return v.tryRemoveStatuses(action.statuses);
    case 13: {
      // Life / Full-Life / Revive
      if (!v.canBeRevived()) return;
      if (v.isZombie(target)) {
        v.magicAccuracy();
        if (!v.tryMagicHit()) return;
        return e.killUnit(target);
      }
      if (!v.checkIsPlayer()) return;
      if (!e.has(target, "death")) {
        v.flags |= F.miss;
        return;
      }
      e.revive(target, 1);
      v.targetFlags |= C.hp | C.hpRecover;
      v.hpDamage = Math.floor((target.maxHp * (target.spirit + v.power)) / 100);
      // Concentrate boosts Life's restore too ("CalcDamage" isn't called by this script in FF9, so it doesn't).
      return;
    }
    case 14: // Death
      if (!v.checkUnsafetyOrGuard()) return;
      if (v.isZombie(target)) {
        if (v.canBeAttacked()) v.setHp(target, target.maxHp);
        return;
      }
      v.magicAccuracy();
      if (v.tryMagicHit()) v.tryAlterCommandStatuses();
      return;
    case 15: {
      // Osmose
      if (!v.isCasterNotTarget() || !v.canBeAttacked()) return;
      v.normalMagicParams();
      v.enemyTranceBonus();
      v.penaltyMini();
      v.penaltyShellAttack();
      v.targetFlags |= C.mp;
      v.casterFlags |= C.mp;
      v.isDrain = true;
      v.calcMpDamage();
      let dmg = v.mpDamage;
      if (v.isZombie(target)) {
        v.targetFlags |= C.mpRecover;
        dmg = Math.min(dmg, caster.mp);
      } else {
        v.casterFlags |= C.mpRecover;
        dmg = Math.min(dmg, target.mp);
      }
      v.mpDamage = dmg;
      v.casterMp = dmg;
      return;
    }
    case 16: // Drain
      if (!v.isCasterNotTarget() || !v.canBeAttacked()) return;
      v.normalMagicParams();
      v.enemyTranceBonus();
      v.penaltyMini();
      v.penaltyShellAttack();
      v.prepareHpDraining();
      if (v.attackPower - v.defencePower < 1) return;
      v.calcHpDamage();
      v.casterHp = v.hpDamage;
      return;
    case 17: // Demi / Gravity
    case SCRIPT.gravity:
      if (!v.checkUnsafetyOrMiss()) return;
      v.magicAccuracy();
      v.penaltyShellHitRate();
      v.penaltyDividedHitRate();
      if (!v.tryMagicHit()) return;
      v.attack = v.power;
      v.bonusElement();
      if (v.canAttackMagic()) v.calcProportionDamage();
      return;
    case 18: {
      // Comet / Meteor
      const cometMiss = action.vfx === 56 && v.rnd8() > 170;
      if ((action.name === "Meteor" && v.cmd.meteorMiss) || cometMiss) {
        v.flags |= F.miss;
        return;
      }
      v.attack = v.rnd16() % Math.max(1, caster.magic + caster.level);
      v.attackPower = v.power;
      v.defencePower = 0;
      v.enemyTranceBonus();
      v.penaltyMini();
      v.penaltyShellAttack();
      v.penaltyDividedAttack();
      v.bonusElement();
      if (v.canAttackMagic()) {
        v.calcHpDamage();
        v.tryAlterMagicStatuses();
      }
      return;
    }
    case 19: // Physical skill scaled by weapon (Free Energy, Stock Break, Shock…)
      v.weaponSkillParams();
      v.enemyTranceBonus();
      v.casterPhysicalBonus();
      v.targetPhysicalBonus();
      v.bonusElement();
      if (v.canAttackElement(caster.attackElements)) {
        v.calcHpDamage();
        v.tryAlterMagicStatuses();
      }
      return;
    case 20: // Weapon power vs magic defence (Cherry Blossom, Thunder Slash, Climhazzard)
      v.originalMagicParams();
      v.enemyTranceBonus();
      v.penaltyMini();
      v.penaltyShellAttack();
      v.bonusElement();
      if (v.canAttackMagic()) {
        v.calcHpDamage();
        v.tryAlterMagicStatuses();
      }
      return;
    case 21: // Goblin Punch
      v.normalMagicParams();
      if (target.level === caster.level) {
        v.attack += caster.level;
        v.defencePower = 0;
      }
      v.penaltyMini();
      v.penaltyShellAttack();
      v.calcHpDamage();
      return;
    case 22: // LV5 Death
      if (v.isTargetLevelMultipleOfRate() && v.canBeAttacked()) v.tryDirectHpDamage();
      return;
    case 23: // LV4 Holy
      if (v.isTargetLevelMultipleOfRate() && v.canBeAttacked()) {
        v.normalMagicParams();
        v.enemyTranceBonus();
        v.penaltyMini();
        v.penaltyShellAttack();
        v.bonusElement();
        if (v.canAttackElement(v.cmd.elements)) v.calcHpDamage();
      }
      return;
    case 24: // LV3 Def-less
      if (v.isTargetLevelMultipleOfRate() && v.canBeAttacked()) {
        if (target.defence !== 0) target.defence = v.rnd16() % target.defence;
        if (target.magicDefence !== 0) target.magicDefence = v.rnd16() % target.magicDefence;
        e.emit({ type: "message", text: `${target.name}'s defence fell!` });
      }
      return;
    case 25: // Roulette (precise direct HP: power 0 = death)
      if (v.checkUnsafetyOrMiss() && v.canBeAttacked()) v.tryDirectHpDamage();
      return;
    case 26: // 1,000 Needles, Pyro…
      v.targetFlags |= C.hp;
      v.hpDamage = v.power * 100 + v.rate;
      return;
    case SCRIPT.fixed:
      v.targetFlags |= C.hp;
      v.hpDamage = v.power * 10;
      return;
    case 27: // Matra Magic
      if (v.checkUnsafetyOrMiss() && v.canBeAttacked()) {
        v.magicAccuracy();
        v.penaltyShellHitRate();
        if (v.tryMagicHit()) v.tryDirectHpDamage();
      }
      return;
    case 28: // Limit Glove
      if (caster.hp !== 1) {
        v.flags |= F.miss;
        return;
      }
      v.targetFlags |= C.hp;
      v.hpDamage = v.power * 100 + v.rate;
      return;
    case 29: // Pumpkin Head / Minus Strike
      v.targetFlags |= C.hp;
      v.hpDamage = caster.maxHp - caster.hp;
      return;
    case 30: // White Wind
      v.targetFlags |= C.hp;
      if (!v.isZombie(target)) v.targetFlags |= C.hpRecover;
      v.hpDamage = v.power === 0 ? Math.floor(caster.maxHp / 3) : Math.floor((caster.maxHp * v.power) / 100);
      return;
    case 31: // Magic Hammer
      v.targetFlags |= C.mp;
      if (target.mp === 0) return;
      v.mpDamage = v.rnd16() % target.mp;
      return;
    case 32: // Darkside
      v.weaponSkillParams();
      v.enemyTranceBonus();
      v.bonusElement();
      if (!v.canAttackElement(v.cmd.elements)) return;
      v.calcHpDamage();
      v.casterFlags |= C.hp;
      v.casterHp = caster.maxHp >> 3;
      return;
    case 33: // Armour Break
    case 34: // Power Break
    case 35: // Mental Break
    case 36: // Magic Break
      v.magicAccuracy();
      v.penaltyShellHitRate();
      if (!v.tryMagicHit()) return;
      if (s === 33) target.defence = Math.floor(target.defence / 2);
      if (s === 34) target.strength = Math.floor((target.strength * 3) / 4);
      if (s === 35) target.magicDefence = Math.floor(target.magicDefence / 2);
      if (s === 36) target.magic = Math.floor((target.magic * 3) / 4);
      e.emit({ type: "message", text: `${target.name}: ${action.name}!` });
      return;
    case 37: // Chakra (Power Up doubles it)
      v.targetFlags |= C.hp | C.hpRecover | C.mp | C.mpRecover;
      v.hpDamage = Math.floor((target.maxHp * v.power) / 100);
      v.mpDamage = Math.floor((target.maxMp * v.power) / 100);
      if (v.hasSA(caster, SA.powerUp)) {
        v.hpDamage *= 2;
        v.mpDamage *= 2;
      }
      return;
    case 38: {
      // Spare Change: damage = power² / 10 × Spirit / gil, gil cost = Power × Lv (paid at cast)
      v.targetFlags |= C.hp;
      const power = v.power * caster.level;
      const gil = Math.max(1, e.gil() + power);
      let dmg = Math.floor((Math.floor((power * power) / 10) * caster.spirit) / gil);
      if (action.targets.startsWith("all")) dmg = Math.floor(dmg / Math.max(1, v.cmd.enemyCount));
      v.hpDamage = dmg;
      return;
    }
    case 39: // Lancer
      v.weaponSkillParams();
      v.enemyTranceBonus();
      v.casterPhysicalBonus();
      v.targetPhysicalBonus();
      v.calcHpDamage();
      v.targetFlags |= C.mp;
      if (v.targetFlags & C.hpRecover) v.targetFlags |= C.mpRecover;
      v.mpDamage = v.hpDamage >> 4;
      return;
    case 40: // Dragon Breath — hits every enemy for the caster's missing HP
      v.targetFlags |= C.hp;
      v.hpDamage = caster.maxHp - caster.hp;
      return;
    case 41: // White Draw — MP to every ally
      if (!v.canBeHealed()) return;
      v.performResult = false;
      {
        const amount = v.rnd16() % Math.max(1, target.level * 2);
        for (const ally of e.allies(caster)) if (e.isActive(ally)) e.healMp(ally, amount);
      }
      return;
    case 43: // Might
      target.strength = Math.min(99, target.strength + Math.floor(target.strength / Math.max(1, v.power)));
      e.emit({ type: "message", text: `${target.name}'s strength rose!` });
      return;
    case 44: // Focus
      target.magic = Math.min(99, target.magic + Math.floor(target.magic / Math.max(1, v.power)));
      e.emit({ type: "message", text: `${target.name}'s magic rose!` });
      return;
    case 45: // Sacrifice
      if (e.has(target, "death") || e.has(caster, "petrify") || e.has(caster, "death")) {
        v.flags |= F.miss;
        return;
      }
      e.heal(target, target.maxHp);
      e.healMp(target, target.maxMp);
      caster.mp = 0;
      e.killUnit(caster);
      return;
    case 46: {
      // Soul Blade: inflicts the weapon's status
      const name = caster.weaponId != null ? findItem(caster.weaponId)?.name : undefined;
      if (!name || !SOUL_BLADE_WEAPONS.has(name)) {
        v.flags |= F.miss;
        return;
      }
      v.tryAlterStatuses(caster.weapon?.statuses ?? [], true);
      return;
    }
    case 48: // Spear (landing from Jump)
      v.weaponAttackParams("simple");
      v.modify(1);
      v.penaltyMini();
      v.targetPhysicalBonus();
      if (v.hasSA(caster, SA.highJump)) v.attack += Math.floor(v.attack / 3);
      v.calcPhysicalHpDamage();
      return;
    case 49: {
      // Phoenix: revives the party, burns enemies
      v.performResult = false;
      const rebirth = { ...getAction(73) };
      const sub: CalcCommand = { ...v.cmd, action: target.side === caster.side ? { ...rebirth, scriptId: 13 } : { ...action, scriptId: 9 } };
      const inner = new Calc(e, caster, target, sub);
      performScript(inner);
      e.applyResult(inner);
      return;
    }
    case 50: {
      // Six Dragons
      if (!v.canBeAttacked()) return;
      const pct = v.rnd16() % 100;
      if (pct < 10) {
        v.setHp(target, target.maxHp);
        v.setMp(target, target.maxMp);
      } else if (pct < 30) v.setHp(target, target.maxHp);
      else if (pct < 50) v.setMp(target, target.maxMp);
      else if (pct < 65) v.setHp(target, 1);
      else if (pct < 80) v.setMp(target, 1);
      else {
        v.setHp(target, 1);
        v.setMp(target, 1);
      }
      return;
    }
    case 51: {
      // Curse: makes the target weak to a random element
      const el = (["fire", "ice", "thunder", "earth", "water", "wind", "holy", "shadow"] as const)[v.rnd16() % 8]!;
      target.elements = {
        weak: [...new Set([...target.elements.weak, el])],
        half: target.elements.half.filter((x) => x !== el),
        immune: target.elements.immune.filter((x) => x !== el),
        absorb: target.elements.absorb.filter((x) => x !== el),
      };
      e.emit({ type: "message", text: `${target.name} became weak against ${el}!` });
      return;
    }
    case 52: {
      // Angel's Snack: uses a Remedy on each target
      v.performResult = false;
      const remedy = 247;
      if (!e.consume(remedy)) {
        e.emit({ type: "message", text: "Not enough items" });
        return;
      }
      const fx = findItem(remedy)!.effect!;
      const inner = new Calc(e, caster, target, { ...v.cmd, kind: "item", itemId: remedy, action: itemAction(remedy) });
      inner.tryRemoveStatuses(fx.statuses);
      e.applyResult(inner);
      return;
    }
    case 53: // Lucky Seven
      v.targetFlags |= C.hp;
      if (caster.hp % 10 !== 7) {
        v.hpDamage = 1;
        return;
      }
      v.hpDamage = [7, 77, 777, 7777][v.rnd8() % 4]!;
      return;
    case 54: // What's That!? — enemies turn around (back attack: their next physical hit is weaker for us… here: lose their turn)
      if (target.side !== caster.side) {
        target.atb = 0;
        e.emit({ type: "message", text: `${target.name} turned around!` });
      }
      return;
    case 55: // Change row
      target.backRow = !target.backRow;
      return;
    case 56: // Flee (luck)
    case 57: // Flee (Zidane's skill — always works)
      return e.tryFlee(s === 57);
    case 58: // Steal / Mug
      if (action.id === 181) {
        // Mug: attack + steal
        weaponAttack(v);
        if (v.flags & F.miss) return;
      }
      return v.steal();
    case 59: // Scan
      if (v.checkUnsafetyOrMiss() || true) {
        const weak = target.elements.weak.length ? ` · weak: ${target.elements.weak.join("/")}` : "";
        e.emit({ type: "message", text: `${target.name} Lv${target.level} · HP ${target.hp}/${target.maxHp} · MP ${target.mp}/${target.maxMp}${weak}` });
      }
      return;
    case 60: {
      // Detect
      const names = (target.steal ?? []).filter((x) => x.itemId >= 0).map((x) => findItem(x.itemId)?.name).filter(Boolean);
      e.emit({ type: "message", text: names.length ? `Steal: ${names.join(", ")}` : "Nothing to steal" });
      return;
    }
    case 61: {
      // Charge!: every ally in critical condition attacks
      v.performResult = false;
      let any = false;
      for (const ally of e.allies(caster)) {
        if (!e.isActive(ally) || !e.has(ally, "lowHp") || !e.canAct(ally)) continue;
        const foes = e.opponents(ally).filter((x) => e.isTargetable(x));
        if (!foes.length) break;
        any = true;
        e.enqueue({ actorId: ally.id, kind: "attack", targetIds: [e.rng.pick(foes).id] }, "counter", true);
      }
      if (!any) e.emit({ type: "message", text: "Charge failed" });
      return;
    }
    case 62: // Soft: stone monsters crumble
      if ((target.enemyCategory & ENEMY_CATEGORY.stone) === 0) return v.tryRemoveStatuses(v.cmd.itemId != null ? (findItem(v.cmd.itemId)?.effect?.statuses ?? []) : action.statuses);
      if (v.canBeAttacked()) {
        e.killUnit(target);
        e.emit({ type: "message", text: `${target.name} became too soft to live!` });
      }
      return;
    case 63: // Magic Sword (Steiner + Vivi)
      v.setLowPhysicalAttack();
      v.attackPower = v.weaponPower() + v.power;
      v.enemyTranceBonus();
      v.defencePower = target.defence;
      v.bonusElement();
      if (v.canAttackMagic()) v.calcHpDamage();
      return;
    case 65: // Eat / Cook
      return v.eat();
    case 66: // Frog Drop: frogs caught × level (no frog pond here — Quina's level stands in)
      v.targetFlags |= C.hp;
      v.hpDamage = Math.max(1, caster.level * Math.max(1, Math.floor(caster.level / 4)));
      return;
    case 67: // Thievery: successful steals × Speed / 2
      v.targetFlags |= C.hp;
      v.hpDamage = Math.floor((e.thefts() * caster.speed) / 2);
      return;
    case 68: // Dragon's Crest: dragons killed²
      v.targetFlags |= C.hp;
      v.hpDamage = e.dragonKills() * e.dragonKills();
      return;
    case 69: {
      // Potion / Hi-Potion
      const fx = v.cmd.itemId != null ? findItem(v.cmd.itemId)?.effect : undefined;
      v.attack = 15;
      v.attackPower = fx ? fx.power : v.power;
      v.defencePower = 0;
      if (v.attackPower > 0) v.calcHpMagicRecovery();
      return;
    }
    case 70: // Ether
      v.attack = 15;
      v.attackPower = v.cmd.itemId != null ? (findItem(v.cmd.itemId)?.effect?.power ?? 0) : v.power;
      v.defencePower = 0;
      v.calcMpMagicRecovery();
      return;
    case 71: // Elixir
      if (!v.canBeAttacked()) return;
      if (v.isZombie(target)) {
        target.mp = 0;
        e.killUnit(target);
      } else {
        e.heal(target, target.maxHp);
        e.healMp(target, target.maxMp);
      }
      return;
    case 72: // Phoenix Down
      if (!v.canBeRevived()) return;
      if (v.isZombie(target)) {
        if (v.checkUnsafetyOrGuard()) v.setHp(target, v.rnd8() % 10);
        return;
      }
      if (!v.checkIsPlayer()) return;
      if (e.has(target, "death")) e.revive(target, 1 + (v.rnd8() % 10));
      else v.flags |= F.miss;
      return;
    case 73: // Remedy, Antidote…
      return v.tryRemoveStatuses(findItem(v.cmd.itemId ?? -1)?.effect?.statuses ?? action.statuses);
    case 74: // Gems: power × (count + 1)
      v.targetFlags |= C.hp | C.hpRecover;
      v.hpDamage = v.power * (e.itemCount(v.cmd.itemId ?? -1) + 1);
      return;
    case 75: // Dead Pepper
      v.targetFlags |= C.hp;
      v.hpDamage = v.power * (e.itemCount(v.cmd.itemId ?? -1) + 1);
      return;
    case 76: {
      // Tent
      v.targetFlags |= C.hp | C.hpRecover | C.mp | C.mpRecover;
      v.hpDamage = target.maxHp >> 1;
      v.mpDamage = target.maxMp >> 1;
      if (v.rate < v.rnd16() % 100) {
        e.emit({ type: "message", text: "Bitten!" });
        v.tryAlterStatuses(action.statuses, false);
      }
      return;
    }
    case 77: // Dark Matter
      if (v.canBeAttacked()) {
        v.targetFlags |= C.hp;
        v.hpDamage = 9999;
      }
      return;
    case 83: {
      // Spear in Trance: random strength, split across all enemies
      v.targetFlags |= C.hp;
      v.weaponAttackParams("random");
      v.modify(1);
      v.penaltyMini();
      v.targetPhysicalBonus();
      if (v.attack < 4) v.attack = 4;
      if (v.hasSA(caster, SA.highJump)) v.attack += Math.floor(v.attack / 3);
      v.calcHpDamage();
      v.hpDamage = Math.floor(v.hpDamage / Math.max(1, v.cmd.enemyCount));
      return;
    }
    case 84: // Jewel: makes an Ore
      v.magicAccuracy();
      v.penaltyShellHitRate();
      if (v.tryMagicHit()) e.addItem(254);
      return;
    case 85: {
      // Summons (power + gems carried)
      v.normalMagicParams();
      v.penaltyMini();
      v.penaltyShellAttack();
      v.bonusElement();
      if (!v.canAttackMagic()) return;
      const gem: Record<string, number> = { Shiva: 233, Ifrit: 234, Ramuh: 231, Leviathan: 226, Bahamut: 224, Ark: 235, Fenrir: 232 };
      if (gem[action.name] != null) v.attackPower += e.itemCount(gem[action.name]!);
      if (action.name === "Madeen") v.attackPower += caster.level;
      v.calcHpDamage();
      v.tryAlterMagicStatuses();
      return;
    }
    case 86: // Atomos: % of max HP, +Amethysts
      if (!v.checkUnsafetyOrMiss()) return;
      v.attack = v.power;
      v.bonusElement();
      if (!v.canAttackMagic()) return;
      v.attack += e.itemCount(225);
      v.calcProportionDamage();
      return;
    case 87: {
      // Odin: Death (+ Ore count), Odin's Sword deals damage when it fails
      if (v.checkUnsafetyOrGuard()) {
        v.magicAccuracy();
        v.hitRate += e.itemCount(254) >> 1;
        if (v.tryMagicHit()) v.tryAlterCommandStatuses();
      }
      if (v.flags & (F.miss | F.guard) && v.hasSA(caster, SA.odinsSword)) {
        v.flags &= ~(F.miss | F.guard);
        const atk = e.rng.int(caster.magic, caster.magic + ((caster.level + caster.magic) >> 3));
        v.targetFlags |= C.hp;
        v.hpDamage = Math.floor((v.cmd.shortSummon ? 2 / 3 : 1) * atk * Math.max(1, 100 + v.power - e.itemCount(254) - target.magicDefence));
      }
      return;
    }
    case 88: // Melt / Self-Destruct
    case SCRIPT.selfDestruct:
      v.targetFlags |= C.hp;
      v.hpDamage = caster.hp;
      e.afterCommand(() => e.killUnit(caster));
      return;
    case 89: {
      // HP Switching
      if (!v.checkUnsafetyOrMiss() || !v.canBeAttacked()) return;
      const hp = caster.hp;
      caster.hp = Math.min(caster.maxHp, target.hp);
      target.hp = Math.min(target.maxHp, hp);
      e.emit({ type: "message", text: "HP switched!" });
      return;
    }
    case 90: // Half defence
      target.defence = Math.floor(target.defence / 2);
      target.magicDefence = Math.floor(target.magicDefence / 2);
      return;
    case 91: // Cannon: % of current HP
      if (!v.checkUnsafetyOrMiss()) return;
      v.magicAccuracy();
      v.penaltyShellHitRate();
      v.penaltyDividedHitRate();
      if (!v.tryMagicHit()) return;
      v.attack = v.power;
      v.bonusElement();
      if (!v.canAttackMagic()) return;
      v.calcCannonProportionDamage();
      return;
    case 93: // Maelstrom: HP to 1–9 + status
      if (v.checkUnsafetyOrMiss() && v.canBeAttacked()) {
        v.flags |= F.directHp;
        v.setHp(target, 1 + (v.rnd8() % 9));
        v.tryAlterStatuses(action.statuses, false);
      }
      return;
    case 94: // Absorb Magic
      target.magic = Math.floor(target.magic / 2);
      caster.magic = Math.min(255, caster.magic * 2);
      return;
    case 95: // Absorb Strength
      target.strength = Math.floor(target.strength / 2);
      caster.strength = Math.min(255, caster.strength * 2);
      return;
    case 96: // Trance full
      if (!target.tranceCommands.length) {
        v.flags |= F.miss;
        return;
      }
      target.trance = 255;
      e.alterStatus(target, "trance", caster);
      return;
    case 97: // Entice: only charms men
      if ((target.playerCategory & PLAYER_CATEGORY.female) === 0) v.tryAlterCommandStatuses();
      else v.flags |= F.miss;
      return;
    case 98: // Attack that can't touch Terrans
      if ((target.playerCategory & PLAYER_CATEGORY.terra) === 0) {
        v.normalPhysicalParams();
        v.enemyTranceBonus();
        v.calcHpDamage();
      } else v.flags |= F.miss;
      return;
    case 99: // Flare Star: target level × power
      v.magicAccuracy();
      v.penaltyShellHitRate();
      v.penaltyDividedHitRate();
      if (v.tryMagicHit()) {
        v.targetFlags |= C.hp;
        v.hpDamage = target.level * v.power;
      }
      return;
    case 101: // Enemy steal (takes an item)
      v.physicalAccuracy();
      if (v.tryPhysicalHit()) e.loseItem(v.rate);
      else e.emit({ type: "message", text: "Couldn't steal anything" });
      return;
    case 102: // Enemy mug
      v.normalPhysicalParams();
      v.enemyTranceBonus();
      v.casterPhysicalBonus();
      v.targetPhysicalBonus();
      v.penaltyLongDistance();
      v.calcHpDamage();
      e.loseItem(v.rate);
      return;
    case 103: // Positive status (Protect, Haste, Regen, Defend…)
    case 109 + 1000: // (unused)
      return v.tryAlterCommandStatuses();
    case 104: // Tonberry Karma
      v.targetFlags |= C.hp;
      v.hpDamage = 1 << Math.min(20, Math.max(0, e.tonberryKills() - 1));
      return;
    case 105: {
      // Grand Cross: each status has a 1/8 chance
      if (!v.canBeAttacked()) return;
      const list: Status[] = ["petrify", "silence", "blind", "trouble", "zombie", "death", "confuse", "berserk", "stop", "poison", "sleep", "heat", "freeze", "doom", "mini", "lowHp"];
      for (const st of list) {
        if (v.rnd8() >> 5 !== 0) continue;
        if (st === "lowHp") {
          if (!e.has(target, "death")) v.setHp(target, 1 + (v.rnd8() % 9));
        } else e.alterStatus(target, st, caster);
      }
      return;
    }
    case 106: // Swallow
      e.removeUnit(target);
      return;
    case 107: // Physical + knocks the target to the back row
      v.normalPhysicalParams();
      v.casterPhysicalBonus();
      v.targetPhysicalBonus();
      v.penaltyLongDistance();
      v.bonusElement();
      if (!v.canAttackElement(v.cmd.elements)) return;
      v.calcHpDamage();
      if (!target.backRow) target.backRow = true;
      v.tryAlterMagicStatuses();
      return;
    case 108: // Iai Strike
      if (!v.checkUnsafetyOrGuard()) return;
      v.magicAccuracy();
      v.penaltyShellHitRate();
      v.penaltyDividedHitRate();
      if (v.tryMagicHit()) v.tryAlterCommandStatuses();
      return;
    case 109: // Mini (toggles)
      if (e.has(target, "mini")) return v.tryAlterCommandStatuses();
      v.magicAccuracy();
      v.penaltyShellHitRate();
      v.penaltyDividedHitRate();
      if (v.tryMagicHit()) v.tryAlterCommandStatuses();
      return;
    case 0:
    case 64:
    case 80:
      return;
    default:
      // Unknown script: treat as plain magic damage / status so content can't silently do nothing.
      if (v.power > 0) {
        v.normalMagicParams();
        v.penaltyShellAttack();
        if (v.canAttackMagic()) v.calcHpDamage();
      } else if (action.statuses.length) {
        v.magicAccuracy();
        if (v.tryMagicHit()) v.tryAlterCommandStatuses();
      }
  }
}

/** The Attack command: weapon script 1–7 (BaseWeaponScript / BloodSword). */
function weaponAttack(v: Calc) {
  const { caster } = v;
  const script = caster.weapon?.scriptId ?? 1;
  if (v.tryKillFrozen()) return;
  v.physicalAccuracy();
  if (!v.tryPhysicalHit()) return;
  const bonus = ({ 1: "simple", 2: "will", 3: "dex", 4: "magic", 5: "random", 6: "simple", 7: "level" } as const)[script] ?? "simple";
  v.weaponAttackParams(bonus);
  v.casterPhysicalBonus();
  v.targetPhysicalBonus();
  if (script === 6) {
    // Blood Sword drains
    if (!v.isCasterNotTarget() || !v.canBeAttacked()) return;
    v.penaltyLongDistance();
    v.tryCriticalHit();
    v.penaltyReverseAttack();
    v.prepareHpDraining();
    v.calcPhysicalHpDamage();
    v.casterHp = v.hpDamage;
    return;
  }
  if (v.has(caster, "trance") && caster.key === "steiner") v.attack *= 2;
  v.penaltyLongDistance();
  v.bonusWeaponElement();
  if (v.canAttackWeaponElement()) {
    v.tryCriticalHit();
    v.penaltyReverseAttack();
    v.calcPhysicalHpDamage();
  }
}

/** Enemy physical attack (script 8 / 100). */
function enemyPhysical(v: Calc, withStatus: boolean, precise = false) {
  if (v.tryKillFrozen()) return;
  if (!precise) {
    v.physicalAccuracy();
    if (!v.tryPhysicalHit()) return;
  }
  v.normalPhysicalParams();
  // Our enemy shorthand moves add their power to the monster's own attack power.
  if (v.cmd.kind === "attack" || v.cmd.kind === "counter" || v.cmd.action.enemyOnly) v.attackPower = v.caster.attack + v.power;
  v.enemyTranceBonus();
  v.casterPhysicalBonus();
  v.targetPhysicalBonus();
  v.penaltyLongDistance();
  v.bonusElement();
  if (!v.canAttackElement(v.cmd.elements)) return;
  if (!precise) v.tryCriticalHit();
  v.calcPhysicalHpDamage();
  if (withStatus) v.tryAlterMagicStatuses();
}

/** Amarant's Throw: weapon power × 2, extra damage to flying enemies. */
function throwScript(v: Calc) {
  if (v.tryKillFrozen()) return;
  v.setLowPhysicalAttack();
  v.defencePower = v.target.defence;
  v.attackPower = (findItem(v.cmd.itemId ?? -1)?.weapon?.power ?? 0) << 1;
  v.casterPhysicalBonus();
  v.targetPhysicalBonus();
  if (v.target.enemyCategory & ENEMY_CATEGORY.flight) v.modify(1);
  v.calcPhysicalHpDamage();
}

/** A consumable as a BattleAction (scripts read power/rate/statuses from it). */
export function itemAction(itemId: number): BattleAction {
  const item = findItem(itemId)!;
  const fx = item.effect!;
  return {
    id: -itemId,
    name: item.name,
    targets: fx.targets,
    defaultAlly: true,
    forDead: fx.forDead,
    scriptId: fx.scriptId,
    power: fx.power,
    elements: fx.elements,
    rate: fx.rate,
    category: 0,
    statuses: fx.statuses,
    mp: 0,
    type: 0,
    vfx: 0,
  };
}

export { REMOVE_ON_MAGICAL, REMOVE_ON_PHYSICAL };
