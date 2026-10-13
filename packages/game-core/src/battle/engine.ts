/**
 * The ATB battle engine. Fully deterministic: all randomness comes from the seeded RNG in the state, and
 * time advances in fixed ticks (20/s). Player commands are recorded with the tick they were given at, so a
 * battle can be replayed from (initial state, inputs) — the server does exactly that to verify results.
 *
 * Wait mode freezes gauges and status timers while a party member is waiting for a command (queued actions
 * still play out), like FF9's Wait setting. Active mode never freezes.
 */
import { findItem, getAction, statuses as statusTable, type Status, type TargetType } from "@ffix-roguelike/game-data";

import { enemyAction } from "../content/enemy-actions";
import { Rng } from "../rng";
import { executeAction } from "./effects";
import {
  ATB_MAX,
  TICKS_PER_SECOND,
  TRANCE_MAX,
  type BattleAction,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
  type BattleUnit,
  type ConsumableStock,
} from "./types";

/** Animation time per executed command, in ticks. */
export const ACTION_TICKS = 24;
/** Hard cap so a stalemate can't run forever (10 minutes). */
export const MAX_TICKS = TICKS_PER_SECOND * 600;

export const POSITIVE_STATUSES: Status[] = ["regen", "haste", "float", "shell", "protect", "vanish", "reflect", "autoLife", "defend", "trance"];
/** Statuses that stop the gauge and prevent acting. */
const DISABLING: Status[] = ["death", "petrify", "stop", "sleep", "freeze", "venom", "jump"];

export function getBattleAction(id: number): BattleAction {
  return enemyAction(id) ?? getAction(id);
}

export interface CreateBattleOptions {
  seed: number;
  party: BattleUnit[];
  enemies: BattleUnit[];
  inventory: ConsumableStock[];
  mode?: "wait" | "active";
  canFlee?: boolean;
}

export function createBattle(opts: CreateBattleOptions): BattleState {
  const rng = new Rng(opts.seed);
  const units = [...opts.party, ...opts.enemies].map((u) => structuredClone(u));
  for (const u of units) {
    // Start gauges partly filled (FF9 randomises the opening ATB); Initiative/Alert start full.
    const head = u.supports.includes(42) || u.supports.includes(41);
    u.atb = u.hp > 0 ? (head ? ATB_MAX : rng.int(0, Math.floor(ATB_MAX * 0.6))) : 0;
    if (u.hp <= 0) u.statuses.death = { remaining: null, nextTick: 0 };
    // Auto-statuses from support abilities.
    const auto: [number, Status][] = [
      [0, "reflect"],
      [1, "float"],
      [2, "haste"],
      [3, "regen"],
      [4, "autoLife"],
    ];
    for (const [sa, status] of auto) if (u.supports.includes(sa) && u.hp > 0) u.statuses[status] = { remaining: null, nextTick: 0 };
  }
  return {
    seed: opts.seed,
    rng: rng.state,
    tick: 0,
    mode: opts.mode ?? "wait",
    units,
    ready: [],
    queue: [],
    busy: 0,
    inventory: opts.inventory.map((s) => ({ ...s })),
    inputs: [],
    outcome: null,
    canFlee: opts.canFlee ?? true,
    stolen: [],
    learned: [],
    gilBonus: 0,
  };
}

export class BattleEngine {
  readonly rng: Rng;
  private events: BattleEvent[] = [];

  constructor(public state: BattleState) {
    this.rng = new Rng(state.rng);
  }

  // ── queries ────────────────────────────────────────────────────────────────
  unit(id: string): BattleUnit {
    const u = this.state.units.find((x) => x.id === id);
    if (!u) throw new Error(`No unit ${id}`);
    return u;
  }

  has(u: BattleUnit, s: Status): boolean {
    return u.statuses[s] !== undefined;
  }

  isAlive(u: BattleUnit): boolean {
    return u.hp > 0 && !this.has(u, "death");
  }

  /** In the fight: alive and not stone. */
  isActive(u: BattleUnit): boolean {
    return this.isAlive(u) && !this.has(u, "petrify");
  }

  canAct(u: BattleUnit): boolean {
    return this.isActive(u) && !DISABLING.some((s) => this.has(u, s));
  }

  allies(u: BattleUnit): BattleUnit[] {
    return this.state.units.filter((x) => x.side === u.side);
  }

  opponents(u: BattleUnit): BattleUnit[] {
    return this.state.units.filter((x) => x.side !== u.side);
  }

  inTrance(u: BattleUnit): boolean {
    return this.has(u, "trance");
  }

  /** Commands the unit can currently use (trance swaps in the trance set). */
  commandsOf(u: BattleUnit) {
    return this.inTrance(u) && u.tranceCommands.length ? u.tranceCommands : u.commands;
  }

  mpCost(u: BattleUnit, action: BattleAction): number {
    return u.supports.includes(34) ? Math.floor(action.mp / 2) : action.mp;
  }

  isMagical(action: BattleAction): boolean {
    return (action.category & 2) !== 0;
  }

  /** Default legal targets for an action from `actor`'s point of view. */
  targetPool(actor: BattleUnit, targets: TargetType, forDead: boolean): BattleUnit[] {
    const ok = (u: BattleUnit) => (forDead ? true : this.isActive(u));
    switch (targets) {
      case "self":
        return [actor];
      case "singleAlly":
      case "manyAlly":
      case "allAlly":
      case "randomAlly":
        return this.allies(actor).filter(ok);
      case "singleEnemy":
      case "manyEnemy":
      case "allEnemy":
      case "randomEnemy":
        return this.opponents(actor).filter(ok);
      default:
        return this.state.units.filter(ok);
    }
  }

  // ── input ──────────────────────────────────────────────────────────────────
  /**
   * Wait mode with someone choosing a command and nothing left to animate: time is fully stopped and the
   * tick counter doesn't advance (so thinking time costs nothing and replays stay short).
   */
  isIdle(): boolean {
    const s = this.state;
    return s.mode === "wait" && s.ready.length > 0 && s.busy === 0 && s.queue.length === 0;
  }

  /** Party members waiting for a command, in the order their gauges filled. */
  readyUnits(): BattleUnit[] {
    return this.state.ready.map((id) => this.unit(id));
  }

  /** Validate and queue a player command. Recorded for replay. */
  submit(command: BattleCommand): { ok: true } | { ok: false; error: string } {
    const err = this.validate(command);
    if (err) return { ok: false, error: err };
    this.state.ready = this.state.ready.filter((id) => id !== command.actorId);
    this.state.inputs.push({ tick: this.state.tick, command: structuredClone(command) });
    this.state.queue.push(structuredClone(command));
    return { ok: true };
  }

  validate(c: BattleCommand): string | null {
    if (this.state.outcome) return "Battle is over";
    if (!this.state.ready.includes(c.actorId)) return "That character is not ready";
    const actor = this.unit(c.actorId);
    if (!this.canAct(actor)) return "That character can't act";
    const targets = c.targetIds.map((id) => this.state.units.find((u) => u.id === id));
    if (targets.some((t) => !t)) return "Unknown target";
    switch (c.kind) {
      case "attack":
        if (c.targetIds.length !== 1) return "Attack needs one target";
        if (!this.isActive(targets[0]!)) return "Target is down";
        return null;
      case "defend":
      case "change":
        return null;
      case "flee":
        return this.state.canFlee ? null : "Can't escape!";
      case "ability": {
        if (c.actionId == null) return "No ability";
        const available = this.commandsOf(actor).some((cmd) => cmd.actionIds.includes(c.actionId!));
        if (!available) return "Ability not available";
        const action = getBattleAction(c.actionId);
        if (actor.mp < this.mpCost(actor, action)) return "Not enough MP";
        if (this.isMagical(action) && this.has(actor, "silence")) return "Silenced";
        return this.validateTargets(actor, action.targets, action.forDead, c.targetIds);
      }
      case "item": {
        const stock = this.state.inventory.find((s) => s.itemId === c.itemId);
        if (!stock || stock.count <= 0) return "No item";
        const effect = findItem(c.itemId!)?.effect;
        if (!effect) return "Item can't be used";
        return this.validateTargets(actor, effect.targets, effect.forDead, c.targetIds);
      }
    }
  }

  private validateTargets(actor: BattleUnit, type: TargetType, forDead: boolean, ids: string[]): string | null {
    if (!ids.length && type !== "automatic" && type !== "everyone" && !type.startsWith("all") && !type.startsWith("random") && type !== "self")
      return "Pick a target";
    const pool = new Set(this.targetPool(actor, type, forDead).map((u) => u.id));
    // "single"/"many" targeting may point at either side (e.g. Cure on an enemy), so allow any unit for *Any types.
    const anySide = type === "singleAny" || type === "manyAny";
    for (const id of ids) {
      const u = this.unit(id);
      if (!anySide && !pool.has(id)) return "Invalid target";
      if (!forDead && !this.isActive(u)) return "Target is down";
    }
    if ((type.startsWith("single") || type === "self") && ids.length > 1) return "Only one target";
    if (ids.length > 1 && type.startsWith("many")) {
      const sides = new Set(ids.map((id) => this.unit(id).side));
      if (sides.size > 1) return "Pick one side";
    }
    return null;
  }

  // ── simulation ─────────────────────────────────────────────────────────────
  emit(e: BattleEvent) {
    this.events.push(e);
  }

  /** Advance one tick. Returns what happened (for the client to animate). */
  step(): BattleEvent[] {
    this.events = [];
    const s = this.state;
    if (s.outcome || this.isIdle()) return [];
    s.tick++;

    const frozen = s.mode === "wait" && s.ready.length > 0;
    if (!frozen) {
      for (const u of s.units) this.tickStatuses(u);
      for (const u of s.units) this.fillGauge(u);
    }

    if (s.busy > 0) s.busy--;
    else this.runQueue();

    this.checkEnd();
    if (!s.outcome && s.tick >= MAX_TICKS) this.finish("defeat");
    s.rng = this.rng.state;
    return this.events;
  }

  private fillGauge(u: BattleUnit) {
    if (!this.canAct(u)) return;
    if (u.atb >= ATB_MAX) return;
    let rate = (u.speed + 20) * 4;
    if (this.has(u, "haste")) rate *= 1.5;
    if (this.has(u, "slow")) rate *= 0.5;
    u.atb = Math.min(ATB_MAX, u.atb + Math.round(rate));
    if (u.atb >= ATB_MAX) this.onGaugeFull(u);
  }

  private onGaugeFull(u: BattleUnit) {
    const auto = this.has(u, "berserk") || this.has(u, "confuse");
    if (u.side === "party" && !auto) {
      if (!this.state.ready.includes(u.id)) {
        this.state.ready.push(u.id);
        this.emit({ type: "turnReady", unitId: u.id });
      }
      return;
    }
    const cmd = u.side === "enemy" && !auto ? this.chooseEnemyCommand(u) : this.autoCommand(u);
    if (cmd) this.state.queue.push(cmd);
    else u.atb = 0;
  }

  /** Berserk: attack a random foe. Confuse: attack anyone. */
  private autoCommand(u: BattleUnit): BattleCommand | null {
    const pool = (this.has(u, "confuse") ? this.state.units : this.opponents(u)).filter((x) => this.isActive(x) && x !== u);
    if (!pool.length) return null;
    return { actorId: u.id, kind: "attack", targetIds: [this.rng.pick(pool).id] };
  }

  private chooseEnemyCommand(u: BattleUnit): BattleCommand | null {
    const hpPct = (u.hp / u.maxHp) * 100;
    const turn = u.turns;
    const rules = (u.ai ?? [{ actionId: 1000, weight: 1 }]).filter((r) => {
      if (r.hpBelow != null && hpPct > r.hpBelow) return false;
      if (r.every && (turn - (r.offset ?? 0)) % r.every !== 0) return false;
      if (r.once && u.usedOnce?.includes(r.actionId)) return false;
      const a = getBattleAction(r.actionId);
      if (u.mp < a.mp) return false;
      if (this.isMagical(a) && this.has(u, "silence")) return false;
      return true;
    });
    const rule = rules.length ? this.rng.weighted(rules.map((r) => ({ weight: r.weight, value: r }))) : { actionId: 1000, weight: 1, aim: undefined, once: false };
    if (rule.once) (u.usedOnce ??= []).push(rule.actionId);
    const action = getBattleAction(rule.actionId);
    const pool = this.targetPool(u, action.targets, false);
    if (!pool.length) return null;
    let targetIds: string[];
    const t = action.targets;
    if (t === "self") targetIds = [u.id];
    else if (t.startsWith("all") || t === "everyone") targetIds = pool.map((x) => x.id);
    else {
      let target: BattleUnit;
      // Hostile moves aim at the party; support moves (e.g. Barrier) at self/allies.
      const hostile = !action.defaultAlly && t !== "singleAlly";
      const candidates = hostile ? this.opponents(u).filter((x) => this.isActive(x) && !this.has(x, "jump")) : pool;
      if (!candidates.length) return null;
      switch (rule.aim) {
        case "lowestHp":
          target = candidates.reduce((a, b) => (b.hp < a.hp ? b : a));
          break;
        case "highestHp":
          target = candidates.reduce((a, b) => (b.hp > a.hp ? b : a));
          break;
        case "self":
          target = u;
          break;
        case "backRow":
          target = this.rng.pick(candidates.filter((x) => x.backRow).length ? candidates.filter((x) => x.backRow) : candidates);
          break;
        default:
          target = this.rng.pick(candidates);
      }
      targetIds = [target.id];
    }
    const kind = rule.actionId === 1000 ? "attack" : "ability";
    return { actorId: u.id, kind, actionId: rule.actionId, targetIds };
  }

  private runQueue() {
    const s = this.state;
    while (s.queue.length) {
      const cmd = s.queue.shift()!;
      const actor = this.state.units.find((u) => u.id === cmd.actorId);
      if (!actor || !this.canAct(actor)) {
        if (actor) actor.atb = 0;
        continue;
      }
      this.execute(actor, cmd);
      actor.atb = 0;
      actor.turns++;
      s.busy = ACTION_TICKS;
      return;
    }
  }

  private execute(actor: BattleUnit, cmd: BattleCommand) {
    // Heat: acting while heated knocks you out.
    if (this.has(actor, "heat")) {
      this.emit({ type: "message", text: `${actor.name} is overheated!` });
      this.knockOut(actor);
      return;
    }
    if (this.has(actor, "defend")) this.removeStatus(actor, "defend");

    executeAction(this, actor, cmd);

    if (this.inTrance(actor) && this.isAlive(actor)) {
      actor.trance = Math.max(0, actor.trance - Math.max(25, 75 - actor.spirit));
      if (actor.trance <= 0) {
        this.removeStatus(actor, "trance");
        this.emit({ type: "tranceEnd", unitId: actor.id });
      }
    }
  }

  // ── statuses ───────────────────────────────────────────────────────────────
  statusDuration(target: BattleUnit, status: Status): number | null {
    const info = statusTable.find((x) => x.key === status);
    if (!info || !info.duration) return null;
    const positive = POSITIVE_STATUSES.includes(status);
    const seconds = positive ? info.duration * 0.75 : (info.duration * Math.max(10, 50 - target.spirit)) / 40;
    return Math.round(seconds * TICKS_PER_SECOND);
  }

  addStatus(target: BattleUnit, status: Status): boolean {
    if (target.statusImmune.includes(status)) return false;
    if (status === "death") {
      this.knockOut(target);
      return true;
    }
    if (!this.isActive(target)) return false;
    if (status === "petrify") {
      target.statuses = { petrify: { remaining: null, nextTick: 0 } };
      target.atb = 0;
      this.dropFromQueues(target);
      this.emit({ type: "statusOn", targetId: target.id, status });
      return true;
    }
    if (status === "haste") this.removeStatus(target, "slow");
    if (status === "slow") this.removeStatus(target, "haste");
    const remaining = this.statusDuration(target, status);
    const timer = { remaining, nextTick: 0, counter: undefined as number | undefined };
    const info = statusTable.find((x) => x.key === status);
    if (status === "doom" || status === "gradualPetrify") {
      timer.counter = 10;
      timer.nextTick = Math.max(1, Math.round((remaining ?? 200) / 10));
      timer.remaining = null;
    } else if (info?.tick) {
      timer.nextTick = Math.round((info.tick / 4) * TICKS_PER_SECOND);
    }
    target.statuses[status] = timer;
    if (status === "stop" || status === "sleep" || status === "freeze" || status === "venom") this.dropFromQueues(target);
    this.emit({ type: "statusOn", targetId: target.id, status });
    return true;
  }

  removeStatus(target: BattleUnit, status: Status) {
    if (target.statuses[status] === undefined) return;
    delete target.statuses[status];
    this.emit({ type: "statusOff", targetId: target.id, status });
  }

  private dropFromQueues(u: BattleUnit) {
    this.state.ready = this.state.ready.filter((id) => id !== u.id);
    this.state.queue = this.state.queue.filter((c) => c.actorId !== u.id);
  }

  private tickStatuses(u: BattleUnit) {
    if (!this.isActive(u)) return;
    for (const key of Object.keys(u.statuses) as Status[]) {
      const t = u.statuses[key];
      if (!t) continue;
      if (t.nextTick > 0 && --t.nextTick === 0) {
        const info = statusTable.find((x) => x.key === key);
        const interval = Math.round(((info?.tick ?? 10) / 4) * TICKS_PER_SECOND);
        switch (key) {
          case "poison":
            this.damage(u, Math.max(1, Math.floor(u.maxHp / 16)), { noTrance: true });
            t.nextTick = interval;
            break;
          case "venom":
            this.damage(u, Math.max(1, Math.floor(u.maxHp / 8)), { noTrance: true });
            t.nextTick = interval;
            break;
          case "regen":
            this.heal(u, Math.max(1, Math.floor(u.maxHp / 16)));
            t.nextTick = interval;
            break;
          case "doom":
          case "gradualPetrify":
            t.counter = (t.counter ?? 10) - 1;
            if (t.counter <= 0) {
              this.removeStatus(u, key);
              this.addStatus(u, key === "doom" ? "death" : "petrify");
              continue;
            }
            t.nextTick = Math.max(1, Math.round((this.statusDuration(u, key) ?? 200) / 10));
            break;
        }
        if (!this.isActive(u)) return;
      }
      if (t.remaining != null && --t.remaining <= 0) this.removeStatus(u, key);
    }
  }

  // ── HP ─────────────────────────────────────────────────────────────────────
  damage(target: BattleUnit, amount: number, opts: { crit?: boolean; noTrance?: boolean } = {}) {
    if (!this.isActive(target)) return;
    const dmg = Math.max(0, Math.min(9999, Math.round(amount)));
    target.hp = Math.max(0, target.hp - dmg);
    this.emit({ type: "damage", targetId: target.id, amount: dmg, crit: opts.crit });
    if (target.hp <= 0) {
      this.knockOut(target);
      return;
    }
    if (dmg > 0) {
      if (this.has(target, "sleep")) this.removeStatus(target, "sleep");
      if (this.has(target, "confuse") && this.rng.chance(50)) this.removeStatus(target, "confuse");
      if (!opts.noTrance) this.gainTrance(target);
    }
  }

  heal(target: BattleUnit, amount: number) {
    if (!this.isActive(target)) return;
    const h = Math.max(0, Math.min(9999, Math.round(amount)));
    target.hp = Math.min(target.maxHp, target.hp + h);
    this.emit({ type: "heal", targetId: target.id, amount: h });
  }

  damageMp(target: BattleUnit, amount: number) {
    const d = Math.max(0, Math.min(target.mp, Math.round(amount)));
    target.mp -= d;
    this.emit({ type: "damage", targetId: target.id, amount: d, mp: true });
  }

  healMp(target: BattleUnit, amount: number) {
    const h = Math.max(0, Math.round(amount));
    target.mp = Math.min(target.maxMp, target.mp + h);
    this.emit({ type: "heal", targetId: target.id, amount: h, mp: true });
  }

  private gainTrance(u: BattleUnit) {
    if (u.side !== "party" || this.inTrance(u) || !u.tranceCommands.length) return;
    let gain = 4 + Math.floor(this.rng.int(0, u.spirit) / 2);
    if (u.supports.includes(35)) gain *= 2; // High Tide
    u.trance = Math.min(TRANCE_MAX, u.trance + gain);
    if (u.trance >= TRANCE_MAX) {
      u.statuses.trance = { remaining: null, nextTick: 0 };
      this.emit({ type: "tranceStart", unitId: u.id });
    }
  }

  knockOut(u: BattleUnit) {
    if (this.has(u, "autoLife") && !this.has(u, "zombie")) {
      this.removeStatus(u, "autoLife");
      u.hp = Math.max(1, Math.floor(u.maxHp / 10));
      this.emit({ type: "revive", targetId: u.id });
      return;
    }
    u.hp = 0;
    const keep = this.has(u, "zombie") ? { zombie: u.statuses.zombie } : {};
    u.statuses = { ...keep, death: { remaining: null, nextTick: 0 } } as BattleUnit["statuses"];
    u.atb = 0;
    if (u.side === "party") u.trance = 0;
    this.dropFromQueues(u);
    this.emit({ type: "ko", targetId: u.id });
  }

  revive(u: BattleUnit, hp: number) {
    if (this.isAlive(u) || this.has(u, "zombie")) return false;
    delete u.statuses.death;
    u.hp = Math.max(1, Math.min(u.maxHp, Math.round(hp)));
    u.atb = 0;
    this.emit({ type: "revive", targetId: u.id });
    return true;
  }

  // ── end ────────────────────────────────────────────────────────────────────
  finish(outcome: BattleState["outcome"] & string) {
    if (this.state.outcome) return;
    this.state.outcome = outcome;
    this.state.ready = [];
    this.state.queue = [];
    this.emit({ type: "end", outcome });
  }

  private checkEnd() {
    if (this.state.outcome) return;
    const partyUp = this.state.units.some((u) => u.side === "party" && this.isActive(u));
    const enemiesUp = this.state.units.some((u) => u.side === "enemy" && this.isActive(u));
    if (!enemiesUp) this.finish("victory");
    else if (!partyUp) this.finish("defeat");
  }

  /** Consume one of an item from the shared battle inventory. */
  consume(itemId: number): boolean {
    const stock = this.state.inventory.find((s) => s.itemId === itemId);
    if (!stock || stock.count <= 0) return false;
    stock.count--;
    return true;
  }
}

/**
 * Re-run a battle from its initial state and recorded inputs. Returns the final state, or throws if an input
 * is rejected (i.e. the log was tampered with or produced by different rules).
 */
export function replayBattle(initial: BattleState, inputs: BattleState["inputs"], maxTicks = MAX_TICKS): BattleState {
  const engine = new BattleEngine(structuredClone({ ...initial, inputs: [] }));
  const pending = [...inputs].sort((a, b) => a.tick - b.tick);
  let i = 0;
  while (!engine.state.outcome && engine.state.tick < maxTicks) {
    while (i < pending.length && pending[i]!.tick === engine.state.tick) {
      const res = engine.submit(pending[i]!.command);
      if (!res.ok) throw new Error(`Replay rejected input at tick ${pending[i]!.tick}: ${res.error}`);
      i++;
    }
    if (i < pending.length && pending[i]!.tick < engine.state.tick) throw new Error("Replay inputs out of order");
    if (engine.isIdle()) {
      // Time can't move until someone acts; if the log has nothing for this tick, the battle is unfinished.
      if (i < pending.length) throw new Error(`Replay stalled at tick ${engine.state.tick} waiting for input`);
      break;
    }
    engine.step();
  }
  return engine.state;
}
