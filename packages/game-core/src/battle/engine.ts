/**
 * The ATB battle engine — FF9's battle loop (Memoria: HonoluluBattleMain.ProcessActiveTime, btl_cmd, btl_stat,
 * btl_para) as a deterministic simulation. All randomness comes from the seeded RNG in the state and time
 * advances in fixed ticks (15/s, as FF9), so a battle replays exactly from (initial state, inputs) — the server
 * does that to verify results.
 *
 * Wait mode freezes gauges and status timers while a party member is waiting for a command (queued actions
 * still play out). Active mode never freezes.
 */
import { ELEMENTS, findItem, getAction, gameDataVersion, statuses as statusTable, type Status, type StatusInfo, type TargetType } from "@ffix-roguelike/game-data";

import { enemyAction } from "../content/enemy-actions";
import { getScene } from "../content/ff9-scenes";
import { Rng } from "../rng";
import { C, Calc, CAT, F, itemAction, PHANTOMS, performScript, REMOVE_ON_MAGICAL, REMOVE_ON_PHYSICAL, SA, type CalcCommand } from "./calc";
import { supportImmunities } from "./units";
import { BattleAi, commandIds } from "./ai/vm";
import {
  ATB_COEF,
  ATB_SPEED_FACTOR,
  DAMAGE_LIMIT,
  MP_DAMAGE_LIMIT,
  PLAYER_CATEGORY,
  TRANCE_MAX,
  type BattleAction,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
  type BattleUnit,
  type CommandSource,
  type ConsumableStock,
  type QueuedCommand,
} from "./types";

/** Hard cap so a stalemate can't run forever (15 minutes). */
export const MAX_TICKS = 15 * 900;
/**
 * Battle rules version, stored in every battle. A fight saved under older rules can't be replayed exactly, so
 * the run restarts it (upgradeRunState). 2: FF9 targeting ignores "disappear", script pauses play out instantly,
 * the stall watchdog.
 */
export const BATTLE_RULES = 2;
/** No command for this long (and no one waiting for the player) = the fight is stuck on something that can't happen. */
export const STALL_TICKS = 15 * 45;
/** VM frames a script pause may run within one tick when nothing is animating. */
const PAUSE_FRAMES_PER_TICK = 2400;

export const POSITIVE_STATUSES: Status[] = ["autoLife", "trance", "defend", "regen", "haste", "float", "shell", "protect", "vanish", "reflect"];
const NEGATIVE_STATUSES: Status[] = ["petrify", "venom", "virus", "silence", "blind", "trouble", "zombie", "death", "confuse", "stop", "poison", "sleep", "slow", "heat", "freeze", "doom", "mini", "gradualPetrify"];
/** Statuses with a duration (ContiCount). */
const TIMED: Status[] = ["poison", "sleep", "regen", "haste", "slow", "float", "shell", "protect", "heat", "freeze", "vanish", "reflect"];
/** Statuses with a periodic effect (OprCount). */
const PERIODIC: Status[] = ["venom", "poison", "regen", "gradualPetrify", "doom"];
/** Applying these cancels the unit's pending commands. */
const CMD_CANCEL: Status[] = ["petrify", "venom", "death", "confuse", "berserk", "sleep"];
/** Can't take a turn. */
const NO_INPUT: Status[] = [...CMD_CANCEL, "stop", "freeze", "jump"];
/** Frozen in place: no counters, no support reactions. */
const IMMOBILIZED: Status[] = ["petrify", "venom", "stop", "freeze", "death", "jump"];
const PREVENT_COUNTER: Status[] = ["petrify", "venom", "stop", "freeze", "death", "sleep"];
/** The gauge doesn't move. */
const STOP_ATB: Status[] = ["petrify", "death", "stop", "jump"];
/** The gauge fills but the turn doesn't come. */
const PREVENT_ATB_CONFIRM: Status[] = ["venom", "sleep", "freeze"];
/** Statuses that never stack/refresh while present. */
const NO_RESET: Status[] = ["petrify", "venom", "virus", "silence", "blind", "trouble", "zombie", "death", "lowHp", "confuse", "berserk", "stop", "autoLife", "trance", "defend", "doom", "gradualPetrify"];
const CANNOT_TRANCE: Status[] = ["petrify", "venom", "zombie", "death", "stop", "trance", "freeze"];
/** Every party member in one of these = game over. */
const PARTY_OUT: Status[] = ["petrify", "venom", "stop", "death"];

// FF9 status rules (StatusData), indexed lazily: the table is registered at runtime (DB / API / seed files).
let statusIndex = new Map<Status, StatusInfo>();
let statusIndexed = -1;
function statusInfoOf(s: Status): StatusInfo | undefined {
  if (statusIndexed !== gameDataVersion) {
    statusIndex = new Map(statusTable.map((x) => [x.key, x]));
    statusIndexed = gameDataVersion;
  }
  return statusIndex.get(s);
}

/** Drawn on the battlefield: script props that are both hidden and untargetable (Masked Man's masks) aren't. */
export function isShownUnit(u: BattleUnit): boolean {
  return !u.removed && !(u.hidden && u.untargetable);
}

export function getBattleAction(id: number): BattleAction {
  return enemyAction(id) ?? getAction(id);
}

export interface BattleMeta {
  /** Party gil (Spare Change spends it). */
  gil: number;
  /** Successful steals so far (Thievery). */
  thefts: number;
  dragonKills: number;
  tonberryKills: number;
}

export interface CreateBattleOptions {
  seed: number;
  party: BattleUnit[];
  enemies: BattleUnit[];
  inventory: ConsumableStock[];
  mode?: "wait" | "active";
  canFlee?: boolean;
  meta?: Partial<BattleMeta>;
  /** No preemptive strikes / back attacks (boss fights, scripted battles). */
  noSurprise?: boolean;
  /** FF9 battle scene ("EF_E009" or "@EF_E009#0"): its registered AI script drives the FF9 monsters. */
  scene?: string;
  /** The scene's spawn pattern (FF9 GetBattleGroupId); defaults to the "#n" in `scene`, else 0. */
  pattern?: number;
}

export function createBattle(opts: CreateBattleOptions): BattleState {
  const rng = new Rng(opts.seed);
  const units = [...opts.party, ...opts.enemies].map((u) => structuredClone(u));
  // Battle start (FF9: preemptive 16/256, Initiative 85/256; back attack 24/256, Alert prevents it).
  let start: "normal" | "preemptive" | "back" = "normal";
  if (!opts.noSurprise) {
    const initiative = opts.party.some((u) => u.supports.includes(SA.initiative));
    const alert = opts.party.some((u) => u.supports.includes(SA.alert));
    if (rng.int(0, 255) < (initiative ? 85 : 16)) start = "preemptive";
    else if (!alert && rng.int(0, 255) < 24) start = "back";
  }
  const state: BattleState = {
    rules: BATTLE_RULES,
    seed: opts.seed,
    rng: 0,
    tick: 0,
    lastAction: 0,
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
    gil: opts.meta?.gil ?? 0,
    gilSpent: 0,
    meta: { thefts: opts.meta?.thefts ?? 0, dragonKills: opts.meta?.dragonKills ?? 0, tonberryKills: opts.meta?.tonberryKills ?? 0 },
    start,
  };
  const engine = new BattleEngine(state, rng);
  for (const u of units) engine.initUnit(u, start);
  if (opts.scene) {
    const [scene, pat] = opts.scene.replace(/^@/, "").split("#");
    state.scene = scene!;
    BattleAi.start(engine, scene!, opts.pattern ?? Number(pat ?? 0));
  }
  if (start === "preemptive") engine.emit({ type: "message", text: "Preemptive strike!" });
  if (start === "back") engine.emit({ type: "message", text: "Back attack!" });
  state.rng = engine.rng.state;
  return state;
}

export class BattleEngine {
  readonly rng: Rng;
  private events: BattleEvent[] = [];
  private after: (() => void)[] = [];
  private _ai: BattleAi | null | undefined;
  /** The queued command being executed (for battle-script reactions). */
  private current: QueuedCommand | null = null;

  constructor(
    public state: BattleState,
    rng?: Rng,
  ) {
    this.rng = rng ?? new Rng(state.rng);
  }

  /** The FF9 battle-script VM, when the battle's scene has a registered script. */
  get ai(): BattleAi | null {
    if (this._ai === undefined || (this._ai && this._ai.s !== this.state.ai) || (this._ai === null && this.state.ai)) this._ai = BattleAi.attach(this);
    return this._ai;
  }

  // ── setup ──────────────────────────────────────────────────────────────────
  initUnit(u: BattleUnit, start: "normal" | "preemptive" | "back") {
    u.atbMax = u.atbMax || 1;
    u.busyCommand = false;
    u.permanent ??= [];
    u.statuses ??= {};
    for (const s of supportImmunities(u.supports)) if (!u.statusImmune.includes(s)) u.statusImmune.push(s);
    if (u.hp <= 0) {
      u.hp = 0;
      u.statuses = { death: {} };
      u.atb = 0;
      return;
    }
    // Support statuses (StatusInit features).
    const auto: [number, Status][] = [
      [SA.autoReflect, "reflect"],
      [SA.autoFloat, "float"],
      [SA.autoHaste, "haste"],
      [SA.autoRegen, "regen"],
    ];
    for (const [sa, s] of auto) if (u.supports.includes(sa)) this.makePermanent(u, s);
    if (u.supports.includes(SA.autoLife)) this.alterStatus(u, "autoLife");
    if (u.boss) this.makePermanent(u, "easyKill");
    for (const s of u.permanent) if (!u.statuses[s]) this.makePermanent(u, s);
    if (u.side === "party") {
      u.atb = start === "preemptive" ? u.atbMax - 1 : start === "back" ? 0 : this.rng.int(0, u.atbMax - 1);
      if (start === "back") u.backRow = !u.backRow;
    } else {
      u.atb = start === "preemptive" ? 0 : start === "back" ? u.atbMax - 1 : this.rng.int(0, u.atbMax - 1);
    }
    this.checkPoint(u);
  }

  /** Auto-statuses (supports, monster traits): always on, never wear off. */
  makePermanent(u: BattleUnit, s: Status) {
    if (!u.permanent.includes(s)) u.permanent.push(s);
    u.statuses[s] = PERIODIC.includes(s) ? { opr: this.oprCount(u, s) } : {};
    if (s === "haste" && !u.statusImmune.includes("slow")) u.statusImmune.push("slow");
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

  hasAny(u: BattleUnit, list: Status[]): boolean {
    return list.some((s) => u.statuses[s] !== undefined);
  }

  isAlive(u: BattleUnit): boolean {
    return u.hp > 0 && !this.has(u, "death");
  }

  /** In the fight: alive and not stone. */
  isActive(u: BattleUnit): boolean {
    return this.isAlive(u) && !this.has(u, "petrify") && !u.removed;
  }

  /**
   * Can be picked as a target (Jumping units are out of reach). FF9 only checks the "targetable" flag: a script's
   * "disappear" is a rendering switch (e.g. Sealion before Black Waltz No.1 calls it in), not a targeting one.
   */
  isTargetable(u: BattleUnit): boolean {
    return this.isActive(u) && !this.has(u, "jump") && !u.untargetable && !u.ff9Dying;
  }

  isShown(u: BattleUnit): boolean {
    return isShownUnit(u);
  }

  canAct(u: BattleUnit): boolean {
    return this.isActive(u) && !this.hasAny(u, NO_INPUT) && !u.ff9Dying;
  }

  allies(u: BattleUnit): BattleUnit[] {
    return this.state.units.filter((x) => x.side === u.side && !x.removed);
  }

  opponents(u: BattleUnit): BattleUnit[] {
    return this.state.units.filter((x) => x.side !== u.side && !x.removed);
  }

  inTrance(u: BattleUnit): boolean {
    return this.has(u, "trance");
  }

  /** Commands the unit can currently use (trance swaps in the trance set). */
  commandsOf(u: BattleUnit) {
    return this.inTrance(u) && u.tranceCommands.length ? u.tranceCommands : u.commands;
  }

  /** The command an ability belongs to, from this unit's current command set. */
  commandOf(u: BattleUnit, actionId: number) {
    return this.commandsOf(u).find((c) => c.actionIds.includes(actionId));
  }

  mpCost(u: BattleUnit, action: BattleAction): number {
    let mp = action.mp;
    if (u.side === "party" && u.supports.includes(SA.halfMp)) mp = Math.floor(mp / 2);
    return mp;
  }

  isMagical(action: BattleAction): boolean {
    return (action.category & CAT.silenceable) !== 0;
  }

  gil() {
    return Math.max(0, this.state.gil - this.state.gilSpent);
  }
  thefts() {
    return this.state.meta.thefts + this.state.stolen.length;
  }
  dragonKills() {
    return this.state.meta.dragonKills;
  }
  tonberryKills() {
    return this.state.meta.tonberryKills;
  }
  itemCount(itemId: number) {
    return this.state.inventory.find((s) => s.itemId === itemId)?.count ?? 0;
  }
  addItem(itemId: number) {
    const s = this.state.inventory.find((x) => x.itemId === itemId);
    if (s) s.count++;
    else this.state.inventory.push({ itemId, count: 1 });
  }
  /** An enemy stole an item from the party. */
  loseItem(itemId: number) {
    if (!this.consume(itemId)) {
      this.emit({ type: "message", text: "Couldn't steal anything" });
      return;
    }
    this.emit({ type: "message", text: `${findItem(itemId)?.name ?? "An item"} was stolen!` });
  }

  /** Default legal targets for an action from `actor`'s point of view. */
  targetPool(actor: BattleUnit, targets: TargetType, forDead: boolean): BattleUnit[] {
    const ok = (u: BattleUnit) => (forDead ? !u.removed && !this.has(u, "jump") : this.isTargetable(u));
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
        return this.state.units.filter((u) => !u.removed).filter(ok);
    }
  }

  // ── input ──────────────────────────────────────────────────────────────────
  /**
   * Wait mode with someone choosing a command and nothing left to animate: time is fully stopped and the
   * tick counter doesn't advance (so thinking time costs nothing and replays stay short).
   */
  isIdle(): boolean {
    const s = this.state;
    return s.mode === "wait" && s.ready.length > 0 && s.busy === 0 && s.queue.length === 0 && (this.ai?.isNormal() ?? true);
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
    const actor = this.unit(command.actorId);
    actor.busyCommand = true;
    // Choosing a new command drops Defend (RemoveOnMainCommand).
    this.removeStatus(actor, "defend");
    this.enqueue(structuredClone(command), "main");
    if (command.second) this.enqueue({ actorId: command.actorId, kind: "ability", actionId: command.second.actionId, targetIds: command.second.targetIds }, "second");
    return { ok: true };
  }

  validate(c: BattleCommand): string | null {
    if (this.state.outcome) return "Battle is over";
    if (this.ai && !this.ai.isNormal()) return "Wait";
    if (!this.state.ready.includes(c.actorId)) return "That character is not ready";
    const actor = this.unit(c.actorId);
    if (!this.canAct(actor)) return "That character can't act";
    const targets = c.targetIds.map((id) => this.state.units.find((u) => u.id === id));
    if (targets.some((t) => !t)) return "Unknown target";
    switch (c.kind) {
      case "attack":
        if (c.targetIds.length !== 1) return "Attack needs one target";
        if (!this.isTargetable(targets[0]!)) return "Target is down";
        return null;
      case "defend":
      case "change":
        return null;
      case "flee":
        return this.state.canFlee ? null : "Can't escape!";
      case "ability": {
        const err = this.validateAbility(actor, c.actionId, c.targetIds);
        if (err) return err;
        if (c.second) {
          const cmd = this.commandOf(actor, c.actionId!);
          if (!cmd || !DOUBLE_CAST.has(cmd.id)) return "Only Double Black / Double White cast twice";
          const err2 = this.validateAbility(actor, c.second.actionId, c.second.targetIds);
          if (err2) return err2;
          const total = this.mpCost(actor, getBattleAction(c.actionId!)) + this.mpCost(actor, getBattleAction(c.second.actionId));
          if (actor.mp < total) return "Not enough MP";
        }
        return null;
      }
      case "item": {
        const stock = this.state.inventory.find((s) => s.itemId === c.itemId);
        if (!stock || stock.count <= 0) return "No item";
        const effect = findItem(c.itemId!)?.effect;
        if (!effect) return "Item can't be used";
        return this.validateTargets(actor, effect.targets, effect.forDead, c.targetIds);
      }
      case "throw": {
        if (!this.commandsOf(actor).some((cmd) => cmd.id === 15)) return "Can't throw";
        const stock = this.state.inventory.find((s) => s.itemId === c.itemId);
        if (!stock || stock.count <= 0) return "Nothing to throw";
        if (!isThrowable(c.itemId!)) return "Can't throw that";
        return this.validateTargets(actor, "singleEnemy", false, c.targetIds);
      }
    }
  }

  private validateAbility(actor: BattleUnit, actionId: number | undefined, targetIds: string[]): string | null {
    if (actionId == null) return "No ability";
    if (!this.commandOf(actor, actionId)) return "Ability not available";
    const action = getBattleAction(actionId);
    if (actor.mp < this.mpCost(actor, action)) return "Not enough MP";
    if (this.isMagical(action) && this.has(actor, "silence")) return "Silenced";
    if (action.scriptId === 63 && !this.magicSwordReady(actor)) return "Vivi can't help right now";
    return this.validateTargets(actor, action.targets, action.forDead, targetIds);
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
      if (!forDead && !this.isTargetable(u)) return "Target is down";
      if (u.removed || this.has(u, "jump")) return "Invalid target";
    }
    if ((type.startsWith("single") || type === "self") && ids.length > 1) return "Only one target";
    if (ids.length > 1 && type.startsWith("many")) {
      const sides = new Set(ids.map((id) => this.unit(id).side));
      if (sides.size > 1) return "Pick one side";
    }
    return null;
  }

  /** Steiner's Magic Sword needs Vivi in the party and able to act. */
  magicSwordReady(steiner: BattleUnit): boolean {
    const vivi = this.allies(steiner).find((u) => u.key === "vivi");
    return !!vivi && this.isActive(vivi) && !this.hasAny(vivi, [...IMMOBILIZED, "silence", "confuse", "berserk", "sleep", "heat", "mini"]);
  }

  /** Queue a command (counters jump the queue, like FF9's priority commands). */
  enqueue(command: BattleCommand, source: CommandSource, priority = source !== "main" && source !== "second" && source !== "auto") {
    const q: QueuedCommand = { command, source };
    if (priority) {
      // after other priority commands already waiting, before ordinary ones
      const idx = this.state.queue.findIndex((x) => !isPriority(x.source));
      if (idx < 0) this.state.queue.push(q);
      else this.state.queue.splice(idx, 0, q);
    } else this.state.queue.push(q);
  }

  // ── simulation ─────────────────────────────────────────────────────────────
  emit(e: BattleEvent) {
    this.events.push(e);
    // Progress for the stall watchdog: a monster acting, or a party member doing more than Defend/Change.
    if (e.type === "actionStart" && (e.kind !== "defend" && e.kind !== "change" || this.unit(e.actorId).side === "enemy")) this.state.lastAction = this.state.tick;
  }

  afterCommand(fn: () => void) {
    this.after.push(fn);
  }

  /** Advance one tick. Returns what happened (for the client to animate). */
  step(): BattleEvent[] {
    this.events = [];
    const s = this.state;
    if (s.outcome || this.isIdle()) return [];
    s.tick++;

    // FF9 battle scripts can pause the battle (intro, cutscenes): no ATB and no new commands meanwhile.
    const ai = this.ai;
    const normal = ai?.isNormal() ?? true;
    const frozen = !normal || (s.mode === "wait" && s.ready.length > 0);
    if (!frozen) for (const u of s.units) this.atbTick(u);

    if (s.busy > 0) s.busy--;
    else if (normal) this.runQueue();

    for (const u of s.units) this.checkPoint(u);
    if (ai && !s.outcome) {
      ai.frame();
      // Script pauses (intros, battle dialogue, staged deaths) play out at once while nothing is animating: we
      // don't show FF9's battle text or camera work, so sitting through them would look like a frozen fight.
      for (let n = 0; n < PAUSE_FRAMES_PER_TICK && !s.outcome && !ai.isNormal() && s.busy === 0 && s.queue.length === 0; n++) ai.frame();
      for (const u of s.units) this.checkPoint(u);
    }
    this.checkEnd();
    if (!s.outcome && s.tick >= MAX_TICKS) this.finish("defeat");
    // Watchdog: nothing has happened for a long time and no one is waiting for the player — the script is waiting
    // on a story event that can't happen here. End the fight rather than freeze it.
    if (!s.outcome && s.ready.length === 0 && s.tick - (s.lastAction ?? 0) >= STALL_TICKS) {
      this.emit({ type: "message", text: "The enemy withdrew" });
      this.finish("victory");
    }
    s.rng = this.rng.state;
    return this.events;
  }

  private coef(u: BattleUnit) {
    return this.has(u, "haste") ? (ATB_COEF * 3) >> 1 : this.has(u, "slow") ? Math.floor((ATB_COEF * 2) / 3) : ATB_COEF;
  }

  /** One ATB tick for a unit: statuses, Jump/Eidolon countdowns, gauge. */
  private atbTick(u: BattleUnit) {
    if (u.removed || !this.isAlive(u) || u.ff9Dying) return;
    const coef = this.coef(u);
    if (!this.hasAny(u, STOP_ATB)) this.tickStatuses(u, coef);
    if (!this.isAlive(u)) return;

    // Freya in the air.
    if (u.jump && this.has(u, "jump") && !this.queued(u, "spear")) {
      u.jump.countdown -= coef;
      if (u.jump.countdown < 0) {
        const spear = u.jump.trance ? 186 : 185;
        this.enqueue({ actorId: u.id, kind: "ability", actionId: spear, targetIds: u.jump.targetIds }, "spear", true);
      }
    }
    // Garnet's Eidolon recasting during Trance.
    if (u.phantom && this.inTrance(u) && !this.queued(u, "phantom")) {
      u.phantom.countdown -= coef;
      if (u.phantom.countdown <= 0) this.enqueue({ actorId: u.id, kind: "ability", actionId: u.phantom.actionId, targetIds: [] }, "phantom", true);
    }

    if (this.hasAny(u, STOP_ATB) || u.busyCommand || u.noAtb) return;
    if (u.atb < u.atbMax) u.atb = Math.min(u.atbMax, u.atb + coef * ATB_SPEED_FACTOR);
    if (u.atb < u.atbMax || this.hasAny(u, PREVENT_ATB_CONFIRM)) return;
    this.onGaugeFull(u);
  }

  private queued(u: BattleUnit, source: CommandSource) {
    return this.state.queue.some((q) => q.source === source && q.command.actorId === u.id);
  }

  private onGaugeFull(u: BattleUnit) {
    if (this.has(u, "berserk") || this.has(u, "confuse")) {
      const cmd = this.autoAttack(u);
      if (cmd) {
        u.busyCommand = true;
        this.enqueue(cmd, "auto");
      }
      return;
    }
    if (u.side === "party") {
      if (!this.state.ready.includes(u.id)) {
        this.state.ready.push(u.id);
        this.emit({ type: "turnReady", unitId: u.id });
      }
      return;
    }
    // FF9 battle script: the ATB function picks the move (a frame later); null = not a scripted unit.
    const scripted = this.ai?.requestAtb(u);
    if (scripted != null) {
      if (scripted) u.busyCommand = true;
      return;
    }
    const cmd = this.chooseEnemyCommand(u);
    if (cmd) {
      u.busyCommand = true;
      this.enqueue(cmd, "main");
    } else u.atb = 0;
  }

  /** Berserk: attack a random foe. Confuse: attack a random side. */
  private autoAttack(u: BattleUnit): BattleCommand | null {
    const pool = this.has(u, "confuse")
      ? this.rng.chance(50)
        ? this.allies(u).filter((x) => this.isTargetable(x) && x !== u)
        : this.opponents(u).filter((x) => this.isTargetable(x))
      : this.opponents(u).filter((x) => this.isTargetable(x));
    const targets = pool.length ? pool : this.opponents(u).filter((x) => this.isTargetable(x));
    if (!targets.length) return null;
    return { actorId: u.id, kind: "attack", targetIds: [this.rng.pick(targets).id] };
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
    return this.aimAt(u, rule.actionId, rule.aim);
  }

  private aimAt(u: BattleUnit, actionId: number, aim?: string, forceTarget?: BattleUnit): BattleCommand | null {
    const action = getBattleAction(actionId);
    const pool = this.targetPool(u, action.targets, false);
    if (!pool.length) return null;
    let targetIds: string[];
    const t = action.targets;
    if (t === "self") targetIds = [u.id];
    else if (t.startsWith("all") || t === "everyone") targetIds = pool.map((x) => x.id);
    else {
      // Hostile moves aim at the party; support moves (e.g. Barrier) at self/allies.
      const hostile = !action.defaultAlly && t !== "singleAlly";
      const candidates = hostile ? this.opponents(u).filter((x) => this.isTargetable(x)) : pool;
      if (!candidates.length) return null;
      let target: BattleUnit;
      if (forceTarget && candidates.includes(forceTarget)) target = forceTarget;
      else
        switch (aim) {
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
    const kind = actionId === 1000 ? "attack" : "ability";
    return { actorId: u.id, kind, actionId, targetIds };
  }

  private runQueue() {
    const s = this.state;
    while (s.queue.length && !s.outcome) {
      const q = s.queue.shift()!;
      const actor = s.units.find((u) => u.id === q.command.actorId);
      if (!actor) continue;
      this.current = q;
      const ran = this.execute(actor, q);
      this.current = null;
      if (ran > 0) {
        s.busy = ran;
        return;
      }
    }
  }

  // ── command execution (btl_cmd) ────────────────────────────────────────────
  /** Run a queued command. Returns its animation time in ticks (0 = didn't happen). */
  private execute(actor: BattleUnit, q: QueuedCommand): number {
    const { command: cmd, source } = q;
    const reaction = isPriority(source) && source !== "spear" && source !== "phantom";
    const declarable = source === "main" || source === "second" || source === "auto";

    // Can the actor still do it? (An enemy's death move plays as it falls.)
    if (source === "dying") {
      if (actor.removed) return 0;
    } else if (!this.isActive(actor)) return this.cancel(actor, q);
    else if (reaction) {
      if (this.hasAny(actor, PREVENT_COUNTER)) return 0;
    } else if (source === "spear") {
      if (!this.has(actor, "jump")) return 0;
    } else if (source === "phantom") {
      if (!this.inTrance(actor)) return 0;
    } else if (this.hasAny(actor, ["stop", "freeze", "petrify", "venom", "sleep"]) || (this.has(actor, "jump") && source !== "main")) {
      return this.cancel(actor, q);
    }

    // Heat: taking an action while heated is fatal (bosses just lose the turn).
    if (!reaction && source !== "phantom" && this.has(actor, "heat")) {
      this.emit({ type: "message", text: `${actor.name} is overheated!` });
      if (this.has(actor, "easyKill")) this.finishCommand(actor, q, null);
      else {
        this.killUnit(actor);
        this.finishCommand(actor, q, null);
      }
      return 6;
    }

    // Simple commands.
    if (cmd.kind === "defend") {
      this.emit({ type: "actionStart", actorId: actor.id, name: "Defend", kind: "defend", targetIds: [actor.id] });
      this.alterStatus(actor, "defend");
      this.finishCommand(actor, q, null);
      return 8;
    }
    if (cmd.kind === "change") {
      this.emit({ type: "actionStart", actorId: actor.id, name: "Change", kind: "change", targetIds: [actor.id] });
      actor.backRow = !actor.backRow;
      this.finishCommand(actor, q, null);
      return 10;
    }
    if (cmd.kind === "flee") {
      this.emit({ type: "actionStart", actorId: actor.id, name: "Flee", kind: "flee", targetIds: [] });
      this.tryFlee(false);
      this.finishCommand(actor, q, null);
      return 15;
    }

    // Resolve the action.
    let action: BattleAction;
    let kind: CalcCommand["kind"];
    if (cmd.kind === "attack") {
      action = actor.side === "enemy" ? getBattleAction(1000) : getBattleAction(176);
      kind = source === "counter" ? "counter" : "attack";
    } else if (cmd.kind === "item") {
      if (this.itemCount(cmd.itemId!) <= 0) {
        this.emit({ type: "message", text: "No items left" });
        return this.cancel(actor, q);
      }
      action = itemAction(cmd.itemId!);
      kind = "item";
    } else if (cmd.kind === "throw") {
      if (this.itemCount(cmd.itemId!) <= 0) {
        this.emit({ type: "message", text: "Nothing left to throw" });
        return this.cancel(actor, q);
      }
      action = { ...getBattleAction(190), name: findItem(cmd.itemId!)?.name ?? "Throw" };
      kind = "throw";
    } else {
      action = getBattleAction(cmd.actionId!);
      kind = "ability";
    }

    // Silence (CheckMagicCondition).
    if (this.isMagical(action) && this.has(actor, "silence") && source !== "magicCounter" && source !== "phantom") {
      this.emit({ type: "message", text: `${actor.name} is silenced!` });
      return this.cancel(actor, q, 8);
    }
    if (action.scriptId === 63 && !this.magicSwordReady(actor)) {
      this.emit({ type: "message", text: "Magic Sword failed" });
      return this.cancel(actor, q, 8);
    }

    // Targets (CheckTargetCondition).
    let targets = this.resolveTargets(actor, action, cmd);
    if (!targets.length) return this.cancel(actor, q);

    // MP (CheckMpCondition). Return Magic and Eidolon recasts are free.
    const cost = source === "magicCounter" || source === "phantom" || source === "spear" ? 0 : this.mpCost(actor, action);
    if (actor.mp < cost) {
      this.emit({ type: "message", text: "Not enough MP" });
      return this.cancel(actor, q, 8);
    }
    actor.mp -= cost;
    // Spare Change costs gil.
    if (action.scriptId === 38) {
      const gilCost = action.power * actor.level;
      if (this.gil() < gilCost) {
        this.emit({ type: "message", text: "Not enough gil" });
        return this.cancel(actor, q, 8);
      }
      this.state.gilSpent += gilCost;
    }

    // Jump: Freya leaves the battlefield; Spear lands later.
    if (kind === "ability" && (action.id === 178 || action.id === 172)) {
      const inTrance = action.id === 172;
      this.emit({ type: "actionStart", actorId: actor.id, name: "Jump", kind: "ability", targetIds: targets.map((t) => t.id) });
      const countdown = statusInfoOf("jump")!.duration * 4 * (60 - actor.spirit);
      this.alterStatus(actor, "jump", actor);
      actor.jump = { countdown, targetIds: inTrance ? [] : targets.map((t) => t.id), trance: inTrance };
      this.dropFromReady(actor);
      this.finishCommand(actor, q, action);
      return 12;
    }

    const isSummon = (action.type & 4) !== 0 || action.scriptId === 85 || action.scriptId === 86 || action.scriptId === 87 || (action.id >= 66 && action.id <= 74);
    let shortSummon = false;
    if (isSummon && source !== "phantom" && !actor.supports.includes(SA.boost)) {
      shortSummon = this.rng.int(0, 255) < (actor.mp > action.mp * 2 ? 230 : 170);
    }
    const meteorMiss = action.name === "Meteor" && !(Math.floor(actor.level / 2) + actor.spirit >= this.rng.int(0, 99));

    // Cover / Protect Girls (only enemy physical single-target attacks on the party).
    if (actor.side === "enemy" && declarable && (action.category & CAT.physical) !== 0 && targets.length === 1 && targets[0]!.side === "party") {
      const coverer = this.findCover(targets[0]!);
      if (coverer) {
        this.emit({ type: "message", text: `${coverer.name} covers ${targets[0]!.name}!` });
        targets = [coverer];
      }
    }

    // Reflect (CheckReflec): reflecting targets bounce single hits to a random unit on the other side.
    const reflectNull = actor.supports.includes(SA.reflectNull) && actor.side === "party";
    const hits: { target: BattleUnit; reflected: number }[] = [];
    const reflectable = (action.category & CAT.reflectable) !== 0 && kind === "ability" && !reflectNull;
    if (reflectable && targets.some((t) => this.has(t, "reflect") && !this.has(t, "petrify"))) {
      const bounced = new Map<BattleUnit, number>();
      for (const t of targets) {
        if (this.has(t, "reflect") && !this.has(t, "petrify")) {
          const other = this.state.units.filter((u) => u.side !== t.side && this.isTargetable(u));
          if (other.length) {
            const to = other[this.rng.int(0, 255) % other.length]!;
            bounced.set(to, (bounced.get(to) ?? 0) + 1);
          }
        } else hits.push({ target: t, reflected: 0 });
      }
      for (const [t, n] of bounced) hits.push({ target: t, reflected: n });
      this.emit({ type: "message", text: "Reflected!" });
    } else for (const t of targets) hits.push({ target: t, reflected: 0 });

    const name = cmd.kind === "attack" ? (kind === "counter" ? "Counter" : "Attack") : action.name;
    this.emit({ type: "actionStart", actorId: actor.id, name, kind: cmd.kind, targetIds: hits.map((h) => h.target.id) });
    const ai = this.ai;
    if (ai) {
      const [cmdNo, sub] = this.ff9CommandIds(actor, cmd, source);
      let targetBits = 0;
      for (const h of hits) targetBits |= ai.bit(h.target);
      ai.commandStart({ cmd: cmdNo, sub, caster: ai.bit(actor), targets: targetBits, element: elementBits(action.elements), weaponElement: elementBits(actor.attackElements) });
      if (cmd.ff9Slot != null) ai.sequencePlayed(actor, cmd.ff9Slot);
    }

    // Items are used up as the action starts (Throw too).
    if (cmd.kind === "item" || cmd.kind === "throw") this.consume(cmd.itemId!);

    const divided = cmd.targetIds.length > 1 && action.targets.startsWith("many");
    const enemyCount = this.opponents(actor).filter((u) => this.isTargetable(u)).length;
    const base: Omit<CalcCommand, "reflectHits"> = {
      action,
      kind,
      itemId: cmd.itemId,
      divided,
      shortRange: kind === "attack" || kind === "counter" ? (actor.side === "enemy" || !(actor.weapon?.longRange ?? false)) : actor.side === "enemy",
      shortSummon,
      reflectNull,
      elements: actor.side === "party" && actor.supports.includes(SA.magElemNull) && kind !== "attack" ? [] : action.elements,
      meteorMiss,
      counterable: declarable,
      enemyCount,
    };
    for (const h of hits) {
      if (h.target.removed) continue;
      const calc = new Calc(this, actor, h.target, { ...base, reflectHits: Math.max(1, h.reflected) });
      performScript(calc);
      if (calc.performResult) this.applyResult(calc, h.reflected > 0);
      if (this.state.outcome) break;
    }

    for (const fn of this.after.splice(0)) fn();
    this.finishCommand(actor, q, action);
    return commandTicks(action, kind, shortSummon, source);
  }

  /** Drop a command that couldn't run; its owner gets a fresh turn later. */
  private cancel(actor: BattleUnit, q: QueuedCommand, ticks = 0): number {
    if (q.source === "main" || q.source === "auto" || q.source === "second") {
      actor.busyCommand = this.state.queue.some((x) => x.command.actorId === actor.id && (x.source === "second" || x.source === "main"));
      if (!actor.busyCommand) actor.atb = 0;
    }
    return ticks;
  }

  /** FinishCommand: reset the gauge, drain Trance, land from Jump, arm Garnet's Eidolon. */
  private finishCommand(actor: BattleUnit, q: QueuedCommand, action: BattleAction | null) {
    const { source } = q;
    const declarable = source === "main" || source === "second" || source === "auto";
    const isJump = action != null && (action.id === 178 || action.id === 172);
    if (declarable) {
      actor.turns++;
      const more = this.state.queue.some((x) => x.command.actorId === actor.id && x.source === "second");
      if (!isJump && !more) {
        actor.atb = 0;
        actor.busyCommand = false;
      }
      // Trance drains with every action (half for each half of a Double cast).
      if (this.inTrance(actor) && !actor.permanent.includes("trance") && !isJump) {
        let delta = Math.floor((300 - actor.level) / Math.max(1, actor.spirit)) * 10;
        if (q.command.second || source === "second") delta = Math.floor(delta / 2);
        if (actor.trance > delta) actor.trance -= delta;
        else this.removeStatus(actor, "trance");
      }
      // Garnet: summoning in Trance arms the Eidolon's free recast.
      if (action && actor.key === "garnet" && this.inTrance(actor) && PHANTOMS[action.id] != null && this.commandOf(actor, action.id)?.id === 18) {
        actor.phantom = { actionId: PHANTOMS[action.id]!, countdown: (60 - actor.spirit) * 200 };
      }
    }
    if (source === "spear" && actor.jump) {
      if (actor.jump.trance && this.inTrance(actor)) actor.jump.countdown = statusInfoOf("jump")!.duration * 4 * (60 - actor.spirit);
      else this.removeStatus(actor, "jump");
    }
    if (source === "phantom" && actor.phantom) actor.phantom.countdown = (60 - actor.spirit) * 200;
  }

  private resolveTargets(actor: BattleUnit, action: BattleAction, cmd: BattleCommand): BattleUnit[] {
    const t = action.targets;
    const forDead = action.forDead || (cmd.kind === "item" && (findItem(cmd.itemId!)?.effect?.forDead ?? false));
    // FF9 battle scripts pick their targets themselves (SV_Target); only dead/removed ones are dropped.
    if (cmd.scripted && cmd.targetIds.length) {
      const picked = cmd.targetIds.map((id) => this.unit(id)).filter((u) => !u.removed && !this.has(u, "jump") && (forDead || this.isAlive(u)));
      if (picked.length) return picked;
    }
    if (t === "self") return [actor];
    if (t.startsWith("all") || t === "everyone" || (cmd.targetIds.length === 0 && t !== "automatic" && !t.startsWith("random"))) {
      const pool = this.targetPool(actor, t === "everyone" || t === "all" ? "everyone" : t, forDead);
      if (t.startsWith("all") || t === "everyone") return pool.filter((u) => forDead || this.isTargetable(u));
    }
    if (t.startsWith("random")) {
      const pool = this.targetPool(actor, t, false);
      return pool.length ? [this.rng.pick(pool)] : [];
    }
    if (t === "automatic") return this.targetPool(actor, "everyone", false).filter((u) => u.side !== actor.side);
    const valid = cmd.targetIds
      .map((id) => this.unit(id))
      .filter((u) => !u.removed && !this.has(u, "jump") && ((forDead && u.side === "party") || this.isAlive(u)));
    if (valid.length) return valid;
    if (cmd.targetIds.length > 1) return [];
    // The target fell before the action landed: FF9 picks a random living unit on the same side.
    const original = cmd.targetIds.length ? this.unit(cmd.targetIds[0]!) : null;
    const side = original?.side ?? (actor.side === "party" ? "enemy" : "party");
    const pool = this.state.units.filter((u) => u.side === side && this.isTargetable(u));
    return pool.length ? [this.rng.pick(pool)] : [];
  }

  /** Cover (Steiner: allies in critical condition) and Protect Girls (Zidane: women under half HP). */
  private findCover(target: BattleUnit): BattleUnit | null {
    let best: BattleUnit | null = null;
    for (const u of this.allies(target)) {
      if (u === target || !this.isTargetable(u) || this.hasAny(u, IMMOBILIZED) || this.has(u, "heat") || this.hasAny(u, ["sleep", "confuse", "berserk"])) continue;
      const cover = u.supports.includes(SA.cover) && this.has(target, "lowHp");
      const girls = u.supports.includes(SA.protectGirls) && (target.playerCategory & PLAYER_CATEGORY.female) !== 0 && target.hp < Math.floor(target.maxHp / 2);
      if (!cover && !girls) continue;
      if (!best || u.hp > best.hp) best = u;
    }
    return best;
  }

  /** CalcResult: apply one hit's numbers, statuses, Trance and support reactions. */
  applyResult(v: Calc, reflected = false) {
    const { caster, target } = v;
    const action = v.cmd.action;
    // "BattleScriptEnd": Reflect×2 doubles bounced spells.
    if (reflected && caster.supports.includes(SA.reflectX2)) v.hpDamage *= 2;
    if (v.flags & F.mpAttack) caster.mp = Math.max(0, caster.mp - (caster.maxMp >> 3));

    if (v.flags & F.guard) {
      this.emit({ type: "guard", targetId: target.id });
    } else if (v.flags & F.miss) {
      this.emit({ type: "miss", targetId: target.id });
    } else {
      if (v.flags & F.addStat && this.isAlive(target) && caster.weapon?.statuses.length) v.tryAlterStatuses(caster.weapon.statuses, false);
      if (action.category & CAT.physical || v.cmd.kind === "attack" || v.cmd.kind === "counter")
        for (const s of REMOVE_ON_PHYSICAL) if (!v.added.includes(s)) this.removeStatus(target, s);
      if (action.category & CAT.magical) for (const s of REMOVE_ON_MAGICAL) if (!v.added.includes(s)) this.removeStatus(target, s);
      if (v.added.includes("death")) v.targetFlags &= ~(C.hp | C.hpRecover);
      v.hpDamage *= v.cmd.reflectHits;
      v.mpDamage *= v.cmd.reflectHits;

      if (v.targetFlags & C.hp) {
        const amount = Math.min(DAMAGE_LIMIT, Math.max(0, Math.floor(v.hpDamage)));
        if (v.targetFlags & C.hpRecover) {
          this.heal(target, amount);
          if (v.isDrain) this.damage(caster, amount, { noTrance: true });
        } else {
          const trouble = this.has(target, "trouble") && !v.added.includes("trouble") && (action.category & CAT.physical) !== 0;
          this.damage(target, amount, { crit: (v.targetFlags & C.crit) !== 0 });
          if (amount > 0) this.tranceReaction(v);
          if (trouble && amount > 1) for (const ally of this.allies(target)) if (ally !== target && this.isTargetable(ally)) this.damage(ally, amount >> 1, { noTrance: true });
          if (v.isDrain) this.heal(caster, amount);
        }
      }
      if (v.targetFlags & C.mp) {
        const amount = Math.min(MP_DAMAGE_LIMIT, Math.max(0, Math.floor(v.mpDamage)));
        if (v.targetFlags & C.mpRecover) {
          this.healMp(target, amount);
          if (v.isDrain) this.damageMp(caster, amount);
        } else {
          this.damageMp(target, amount);
          if (v.isDrain) this.healMp(caster, Math.min(amount, v.casterMp || amount));
        }
      }
      if (v.casterFlags & C.hp && !v.isDrain) {
        if (v.casterFlags & C.hpRecover) this.heal(caster, v.casterHp);
        else this.damage(caster, v.casterHp, { noTrance: true });
      }
      if (v.casterFlags & C.mp && !v.isDrain && !(v.targetFlags & C.mp)) {
        if (v.casterFlags & C.mpRecover) this.healMp(caster, v.casterMp);
        else this.damageMp(caster, v.casterMp);
      }
    }
    this.reactions(v);
    // End of FF9's CalcResult: the battle script's Death / Counter / CounterEx requests.
    const ai = this.ai;
    if (ai && target.side === "enemy") {
      const q = this.current ?? { command: { actorId: caster.id, kind: "ability" as const, actionId: action.id, targetIds: [] }, source: "main" as const };
      const [cmdNo, sub] = this.ff9CommandIds(caster, q.command, q.source);
      ai.onHit(caster, target, cmdNo, sub, v.cmd.counterable);
    }
  }

  /** FF9 BattleCommandId / sub id of a command (what battle scripts compare against). */
  private ff9CommandIds(actor: BattleUnit, cmd: BattleCommand, source: CommandSource): [number, number] {
    let attacks: number[] | undefined;
    if (actor.side === "enemy" && this.state.scene) {
      try {
        attacks = getScene(this.state.scene).attacks;
      } catch {
        attacks = undefined;
      }
    }
    return commandIds(this, actor, cmd, source, attacks);
  }

  /** Taking a hit from the other side fills the Trance gauge. */
  private tranceReaction(v: Calc) {
    const t = v.target;
    if (t.side === v.caster.side || !t.tranceCommands.length || !this.isAlive(t) || this.hasAny(t, CANNOT_TRANCE)) return;
    const next = t.trance + v.tranceIncrease;
    if (next < TRANCE_MAX) t.trance = Math.max(0, next);
    else {
      t.trance = TRANCE_MAX;
      this.alterStatus(t, "trance");
    }
  }

  /** "EffectDone" support features and enemy counters. */
  private reactions(v: Calc) {
    const { caster, target } = v;
    const action = v.cmd.action;
    const hostile = caster.side !== target.side;
    const damaged = (v.hpDamage !== 0 && (v.targetFlags & C.hp) !== 0 && !(v.targetFlags & C.hpRecover)) || (v.flags & F.directHp) !== 0;
    const hit = !(v.flags & (F.miss | F.guard));
    if (!hostile) return;

    if (target.side === "party" && this.isAlive(target) && !this.hasAny(target, IMMOBILIZED)) {
      // Restore HP / Absorb MP
      if (target.supports.includes(SA.restoreHp) && damaged && target.hp * 6 <= target.maxHp) this.heal(target, target.maxHp >> 1);
      if (target.supports.includes(SA.absorbMp) && damaged && action.mp > 0) this.healMp(target, action.mp);
      // Counter / Return Magic / Auto-Potion — at most one per hit.
      if (v.cmd.counterable && !this.hasAny(target, PREVENT_COUNTER)) {
        let reacted = false;
        if (!reacted && target.supports.includes(SA.counter) && (action.category & CAT.physical) !== 0) {
          const chance = target.supports.includes(SA.eyeForEye) ? target.spirit * 2 : target.spirit;
          if (chance > this.rng.int(0, 99) && this.isTargetable(caster)) {
            this.enqueue({ actorId: target.id, kind: "attack", targetIds: [caster.id] }, "counter", true);
            reacted = true;
          }
        }
        // Enemy versions of spells carry FF9's "returnable" bit; enemies casting party spells count too.
        const returnable = (action.category & CAT.returnable) !== 0 || (caster.side === "enemy" && (action.category & CAT.magical) !== 0);
        if (!reacted && target.supports.includes(SA.returnMagic) && returnable && action.id > 0) {
          const ids = action.targets.startsWith("all") || action.targets === "everyone" ? [] : this.isTargetable(caster) ? [caster.id] : [];
          this.enqueue({ actorId: target.id, kind: "ability", actionId: action.id, targetIds: ids }, "magicCounter", true);
          reacted = true;
        }
        if (!reacted && target.supports.includes(SA.autoPotion) && damaged && hit) {
          const potion = this.itemCount(236) > 0 ? 236 : this.itemCount(237) > 0 ? 237 : null;
          if (potion != null) this.enqueue({ actorId: target.id, kind: "item", itemId: potion, targetIds: [target.id] }, "autoPotion", true);
        }
      }
    }
    // Enemy counters (hand-written AI; FF9 battle scripts counter through ai.onHit).
    if (target.side === "enemy" && caster.side === "party" && v.cmd.counterable && this.isAlive(target) && !this.hasAny(target, PREVENT_COUNTER) && target.counters?.length && !this.ai?.drives(target)) {
      for (const r of target.counters) {
        if (r.hpBelow != null && (target.hp / target.maxHp) * 100 > r.hpBelow) continue;
        if (!this.rng.chance(r.weight)) continue;
        const cmd = this.aimAt(target, r.actionId, r.aim, caster);
        if (cmd) this.enqueue(cmd, "counter", true);
        break;
      }
    }
  }

  // ── statuses (btl_stat) ───────────────────────────────────────────────────
  /**
   * Try to inflict a status. Returns 0 = resisted ("Guard"), 1 = no effect ("Miss"), 2 = had an effect without
   * sticking (e.g. Haste cancelling Slow), 3 = applied.
   */
  alterStatus(target: BattleUnit, status: Status, inflicter?: BattleUnit): 0 | 1 | 2 | 3 {
    const bypass = status === "death" && target.hp === 0;
    if (!bypass && target.statusImmune.includes(status)) return 0;
    if (target.permanent.includes(status) || (this.has(target, status) && NO_RESET.includes(status))) return 1;
    if (status === "trance" && !target.tranceCommands.length) return 1;
    if (!bypass)
      for (const s of Object.keys(target.statuses) as Status[]) if (statusInfoOf(s)?.immunityProvided.includes(status)) return 1;
    if (target.removed) return 1;
    void inflicter;

    // Status scripts.
    switch (status) {
      case "haste":
        if (this.has(target, "slow")) return this.removeStatus(target, "slow") ? 2 : 0;
        break;
      case "slow":
        if (this.has(target, "haste")) return this.removeStatus(target, "haste") ? 2 : 0;
        break;
      case "mini":
        if (this.has(target, "mini")) return this.removeStatus(target, "mini") ? 2 : 1;
        break;
      case "death":
        if (target.hp > 0) {
          this.killUnit(target);
          return 3;
        }
        break;
      case "petrify":
        this.removeStatus(target, "gradualPetrify");
        target.atb = 0;
        break;
      case "zombie":
        if (target.side === "party" && !this.has(target, "trance")) target.trance = 0;
        break;
    }

    const info = statusInfoOf(status);
    const timer: { conti?: number | null; opr?: number; counter?: number } = {};
    const spr = target.spirit;
    if (TIMED.includes(status) && info?.duration) {
      const factor = NEGATIVE_STATUSES.includes(status) ? (60 - spr) << 3 : POSITIVE_STATUSES.includes(status) ? spr << 3 : (60 - spr) << 2;
      timer.conti = info.duration * factor;
    }
    if (PERIODIC.includes(status)) {
      timer.opr = this.oprCount(target, status);
      if (status === "doom" || status === "gradualPetrify") timer.counter = 10;
    }
    target.statuses[status] = timer;
    this.emit({ type: "statusOn", targetId: target.id, status });

    if (CMD_CANCEL.includes(status)) this.commandCancel(target);
    else if (NO_INPUT.includes(status)) this.dropFromReady(target);
    for (const s of info?.clearOnApply ?? []) this.removeStatus(target, s);
    if (this.hasAny(target, STOP_ATB)) target.atb = status === "jump" ? target.atb : 0;
    if (status === "trance") {
      this.emit({ type: "tranceStart", unitId: target.id });
      if (this.state.ready.includes(target.id)) this.emit({ type: "turnReady", unitId: target.id });
    }
    if (status === "death") this.onDeath(target);
    return 3;
  }

  private oprCount(u: BattleUnit, s: Status): number {
    const info = statusInfoOf(s)!;
    if (s === "doom" || s === "gradualPetrify") return Math.floor((info.duration * ((60 - u.spirit) << 3)) / 10);
    const factor = s === "venom" || s === "poison" ? u.spirit << 2 : (60 - u.spirit) << 2;
    return info.tick * factor;
  }

  /** Returns true if the status was removed. */
  removeStatus(target: BattleUnit, status: Status): boolean {
    if (target.statuses[status] === undefined || target.permanent.includes(status)) return false;
    delete target.statuses[status];
    this.emit({ type: "statusOff", targetId: target.id, status });
    switch (status) {
      case "trance":
        target.trance = 0;
        target.phantom = undefined;
        if (this.has(target, "jump")) this.removeStatus(target, "jump");
        this.emit({ type: "tranceEnd", unitId: target.id });
        if (this.state.ready.includes(target.id)) this.emit({ type: "turnReady", unitId: target.id });
        break;
      case "jump":
        target.jump = undefined;
        target.atb = 0;
        target.busyCommand = false;
        this.state.queue = this.state.queue.filter((q) => !(q.command.actorId === target.id && q.source === "spear"));
        break;
      case "berserk":
      case "confuse":
        this.commandCancel(target);
        break;
    }
    return true;
  }

  /** StatusCommandCancel: drop the unit's pending turn. */
  private commandCancel(u: BattleUnit) {
    this.dropFromReady(u);
    const before = this.state.queue.length;
    this.state.queue = this.state.queue.filter((q) => !(q.command.actorId === u.id && (q.source === "main" || q.source === "second" || q.source === "auto")));
    if (before !== this.state.queue.length || u.busyCommand) {
      u.atb = 0;
      u.busyCommand = false;
    }
  }

  private dropFromReady(u: BattleUnit) {
    this.state.ready = this.state.ready.filter((id) => id !== u.id);
  }

  private tickStatuses(u: BattleUnit, coef: number) {
    for (const key of Object.keys(u.statuses) as Status[]) {
      const t = u.statuses[key];
      if (!t) continue;
      if (t.opr !== undefined && PERIODIC.includes(key)) {
        if (t.opr <= 0) {
          t.opr = this.oprCount(u, key);
          this.onOpr(u, key, t);
          if (!this.isAlive(u)) return;
        } else t.opr -= coef;
      }
      if (t.conti != null && TIMED.includes(key) && !u.permanent.includes(key)) {
        t.conti -= coef;
        if (t.conti < 0) this.removeStatus(u, key);
      }
    }
  }

  private onOpr(u: BattleUnit, s: Status, t: { counter?: number }) {
    if (this.has(u, "petrify")) return;
    const easy = this.has(u, "easyKill");
    switch (s) {
      case "poison":
      case "venom": {
        let dmg = u.maxHp >> 4;
        if (easy) dmg >>= 2;
        if (s === "venom") {
          let mp = u.maxMp >> 4;
          if (easy) mp >>= 2;
          u.mp = Math.max(0, u.mp - mp);
        }
        this.damage(u, Math.max(1, dmg), { noTrance: true });
        return;
      }
      case "regen": {
        let heal = u.maxHp >> 4;
        if (easy) heal >>= 2;
        if (this.isZombieUnit(u)) this.damage(u, heal, { noTrance: true });
        else this.heal(u, heal);
        return;
      }
      case "doom":
      case "gradualPetrify":
        t.counter = (t.counter ?? 10) - 1;
        if (t.counter > 0) return;
        this.removeStatus(u, s);
        if (s === "doom") this.alterStatus(u, "death");
        else this.alterStatus(u, "petrify");
        return;
    }
  }

  isZombieUnit(u: BattleUnit) {
    return (u.enemyCategory & 16) !== 0 || this.has(u, "zombie");
  }

  /** CheckPointData: Low HP for the party, KO at 0 HP. */
  private checkPoint(u: BattleUnit) {
    if (u.removed) return;
    u.hp = Math.min(u.hp, u.maxHp);
    u.mp = Math.min(u.mp, u.maxMp);
    if (u.hp <= 0) {
      if (!this.has(u, "death")) this.killUnit(u);
      return;
    }
    if (u.side !== "party") return;
    const low = u.hp * 6 <= u.maxHp;
    if (low && !this.has(u, "lowHp")) u.statuses.lowHp = {};
    else if (!low && this.has(u, "lowHp")) delete u.statuses.lowHp;
  }

  // ── HP ─────────────────────────────────────────────────────────────────────
  damage(target: BattleUnit, amount: number, opts: { crit?: boolean; noTrance?: boolean } = {}) {
    if (!this.isAlive(target)) {
      this.emit({ type: "miss", targetId: target.id });
      return;
    }
    if (this.has(target, "petrify")) {
      this.emit({ type: "damage", targetId: target.id, amount: 0 });
      return;
    }
    const dmg = Math.max(0, Math.min(DAMAGE_LIMIT, Math.round(amount)));
    target.hp = Math.max(0, target.hp - dmg);
    this.emit({ type: "damage", targetId: target.id, amount: dmg, crit: opts.crit });
    if (target.hp <= 0) this.killUnit(target);
  }

  heal(target: BattleUnit, amount: number) {
    if (!this.isAlive(target) || this.has(target, "petrify")) return;
    const h = Math.max(0, Math.min(DAMAGE_LIMIT, Math.round(amount)));
    target.hp = Math.min(target.maxHp, target.hp + h);
    this.emit({ type: "heal", targetId: target.id, amount: h });
  }

  damageMp(target: BattleUnit, amount: number) {
    if (!this.isAlive(target)) return;
    const d = Math.max(0, Math.min(target.mp, Math.round(amount)));
    target.mp -= d;
    this.emit({ type: "damage", targetId: target.id, amount: d, mp: true });
  }

  healMp(target: BattleUnit, amount: number) {
    if (!this.isAlive(target)) return;
    const h = Math.max(0, Math.round(amount));
    target.mp = Math.min(target.maxMp, target.mp + h);
    this.emit({ type: "heal", targetId: target.id, amount: h, mp: true });
  }

  /** KO (Death status). Auto-Life brings the unit straight back with 1 HP. */
  killUnit(u: BattleUnit) {
    if (u.removed) return;
    if (this.has(u, "death") && u.hp === 0) return;
    // FF9 non-dying bosses: their script stages the end.
    if (this.ai?.holdDeath(u)) return;
    if (this.has(u, "autoLife") && !this.isZombieUnit(u)) {
      delete u.statuses.autoLife;
      this.emit({ type: "statusOff", targetId: u.id, status: "autoLife" });
      u.hp = 1;
      this.emit({ type: "revive", targetId: u.id });
      return;
    }
    u.hp = 0;
    if (!this.has(u, "death")) {
      u.statuses.death = {};
      for (const s of statusInfoOf("death")!.clearOnApply) if (!u.permanent.includes(s)) delete u.statuses[s];
    }
    this.onDeath(u);
  }

  /** Alias kept for older callers. */
  knockOut(u: BattleUnit) {
    this.killUnit(u);
  }

  private onDeath(u: BattleUnit) {
    u.atb = 0;
    u.busyCommand = false;
    if (this.has(u, "trance")) {
      delete u.statuses.trance;
      u.trance = Math.min(254, u.trance);
    }
    if (u.side === "party") u.trance = Math.min(u.trance, 254);
    u.jump = undefined;
    u.phantom = undefined;
    this.dropFromReady(u);
    this.state.queue = this.state.queue.filter((q) => q.command.actorId !== u.id);
    this.emit({ type: "ko", targetId: u.id });
  }

  revive(u: BattleUnit, hp: number) {
    if (this.isAlive(u) || this.isZombieUnit(u) || u.removed) return false;
    delete u.statuses.death;
    u.hp = Math.max(1, Math.min(u.maxHp, Math.round(hp)));
    u.atb = 0;
    u.busyCommand = false;
    this.emit({ type: "revive", targetId: u.id });
    return true;
  }

  /** Swallowed / removed from battle entirely. */
  removeUnit(u: BattleUnit) {
    u.removed = true;
    u.hp = 0;
    this.onDeath(u);
  }

  /** btl_cmd.KillStandardCommands: drop a unit's pending turn (its gauge restarts). */
  killStandardCommands(u: BattleUnit) {
    const before = this.state.queue.length;
    this.state.queue = this.state.queue.filter((q) => !(q.command.actorId === u.id && (q.source === "main" || q.source === "second" || q.source === "auto")));
    this.dropFromReady(u);
    if (before !== this.state.queue.length) u.atb = 0;
    u.busyCommand = false;
  }

  /** btl_cmd.KillAllCommand (a battle script pausing the battle): every pending command is dropped. */
  killAllCommands() {
    this.state.queue = [];
    for (const u of this.state.units) u.busyCommand = false;
  }

  /** A battle script plays a move at once, outside the queue (FF9 AttackSpecial). Returns its duration. */
  executeScripted(actor: BattleUnit, command: BattleCommand): number {
    return this.execute(actor, { command, source: "script" });
  }

  // ── escape ─────────────────────────────────────────────────────────────────
  /** FF9: rate = 200 / avg enemy level × avg party level / 16 per attempt; Zidane's Flee always works. */
  tryFlee(sure: boolean) {
    if (!this.state.canFlee) {
      this.emit({ type: "message", text: "Can't escape!" });
      return;
    }
    if (!this.state.units.some((u) => u.side === "party" && this.isActive(u) && !this.hasAny(u, ["venom", "zombie", "stop", "sleep", "freeze", "jump"]))) {
      this.emit({ type: "message", text: "Can't escape!" });
      return;
    }
    if (!sure) {
      const avg = (side: "party" | "enemy") => {
        const us = this.state.units.filter((u) => u.side === side && !u.removed);
        const lv = us.reduce((s, u) => s + u.level, 0) || 1;
        return Math.max(1, Math.floor(lv / Math.max(1, us.length)));
      };
      const rate = Math.floor((Math.floor(200 / avg("enemy")) * avg("party")) / 16);
      // Holding Flee for about a second gives FF9 that many escape rolls.
      let escaped = false;
      for (let i = 0; i < 15 && !escaped; i++) escaped = rate > this.rng.int(0, 99);
      if (!escaped) {
        this.emit({ type: "message", text: "Couldn't escape!" });
        return;
      }
      this.state.fledByLuck = true;
    }
    this.finish("fled");
  }

  // ── end ────────────────────────────────────────────────────────────────────
  finish(outcome: NonNullable<BattleState["outcome"]>) {
    if (this.state.outcome) return;
    this.state.outcome = outcome;
    this.state.ready = [];
    this.state.queue = [];
    this.emit({ type: "end", outcome });
  }

  private checkEnd() {
    if (this.state.outcome) return;
    const enemiesUp = this.state.units.some((u) => u.side === "enemy" && this.isActive(u));
    const partyUp = this.state.units.some((u) => u.side === "party" && !u.removed && this.isAlive(u) && !this.hasAny(u, PARTY_OUT));
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

/** FF9 element bit set (fire 1 … shadow 128). */
function elementBits(list: readonly string[]): number {
  let bits = 0;
  for (const e of list) bits |= 1 << ELEMENTS.indexOf(e as (typeof ELEMENTS)[number]);
  return bits;
}

/** Commands 21 (Double White) and 23 (Double Black) cast two spells per turn. */
const DOUBLE_CAST = new Set([21, 23]);

function isPriority(source: CommandSource) {
  return source !== "main" && source !== "second" && source !== "auto";
}

/** Weapons Amarant can throw (FF9 weapon category "throw"). */
export function isThrowable(itemId: number): boolean {
  const w = findItem(itemId)?.weapon;
  return !!w && (w.category & 4) !== 0;
}

/** How long a command takes on screen, in ticks (FF9 animations run ~1.5–5 s). */
function commandTicks(action: BattleAction, kind: CalcCommand["kind"], shortSummon: boolean, source: CommandSource): number {
  if (source === "phantom") return 30;
  if (kind === "attack" || kind === "counter" || kind === "throw") return 22;
  if (kind === "item") return 18;
  if ((action.type & 4) !== 0 || action.scriptId === 85 || action.scriptId === 86 || action.scriptId === 87) return shortSummon ? 45 : 90;
  return 28;
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
