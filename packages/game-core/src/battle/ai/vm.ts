/**
 * FF9 battle AI — a TypeScript port of the battle subset of Memoria's event engine (EBin + EventEngine), so every
 * FF9 monster fights with its real script.
 *
 * Architecture
 * - Scripts (.eb, one per battle scene) come from the registry (registry.ts); the server registers them from the
 *   database, tests/sim from the local cache. disasm.ts parses them (entries → functions by tag) and prints them.
 * - `BattleState.ai` (AiState) holds everything the VM needs between ticks, JSON-serializable: event phase and load
 *   status, global/map/instance variable bytes, system lists (SV_Target…), the object list (per object: entry, ip,
 *   priority level, wait counter, call stack, ATB-request flag) and the btl index → object table. The calc stack
 *   is transient (FF9 never keeps a value on it across a yield).
 * - One VM frame runs per engine tick (FF9's battle loop and ATB both run at 15 fps): the engine-side battle phase
 *   advances (BattleMain), objects are suspended/resumed by presence (SetupBattleState), every object runs until it
 *   waits or returns (EBin.ProcessCode), then pending ATB requests become calls to the ATB function.
 * - Engine hooks (engine.ts): an enemy's full gauge → `requestAtb` (EventEngine.RequestAction(EnemyAtk)); a hit
 *   from a party member → `onHit` (end of SBattleCalculator.CalcResult: EnemyDying / EnemyCounter /
 *   EnemyReaction); "Attack" queues the enemy's command (btl_cmd.SetEnemyCommand) with the attack slot mapped
 *   through the scene's attack table; "AttackSpecial" runs a move immediately; RunBattleCode drives the phase
 *   (Disable/Enable ATB, End battle, Game over).
 * - All randomness (GetRandom, B_SELECT) uses the engine's seeded RNG.
 *
 * Supported: every opcode, expression operator, variable class and system variable the 562 battle scripts use
 * (see scripts/disasm.ts and the usage report) — flow (JMP/JMP_IF/JMP_IFN/switches/return/Wait), set, InitObject,
 * Attack, AttackSpecial, RunBattleCode, BattleDialog (emits a `scriptText` event), windows/text/fade/music
 * (no-ops), all op_binary operators incl. the list operators (count/first/random_bit, `$`-suffixed per-member
 * forms), unit members (HP/MP/ATB/statuses/elements/stats/targetability/visibility…).
 *
 * Known gaps
 * - Presentation (camera, models, meshes, animations, texture animations, scale, fades) is ignored; members that
 *   only affect visuals are stored so scripts read back their own writes.
 * - Bosses: FF9 gives "non-dying" bosses +10,000 HP and lets the script stage their death once HP < 10,000. Our
 *   bestiary stores real HP, so the VM keeps a per-unit HP buffer (10,000 for `boss` units): scripts read HP/MAX_HP
 *   with it added, writes below the buffer drop it (e.g. Plant Brain's second phase). When such a unit reaches 0
 *   HP it is held "dying" (1 HP, can't act, untargetable) for its script to end the battle; if the script hasn't
 *   within DYING_TIMEOUT ticks it really dies.
 * - An ATB function that returns without "Attack" leaves FF9's enemy frozen forever; here it just loses the turn.
 * - "AttackOnDeath" (die_atk) isn't in our bestiary: an enemy runs its Death function if its entry has one.
 * - Story flags (gEventGlobal) start zeroed: scripts that branch on game progress take the "early" path.
 * - Spawns we have no unit for (FF9 "Dummy" types) keep their objects running; story fights whose enemy isn't
 *   in our bestiary (e.g. Steiner in TH_E003) can't play out. If a script leaves the battle paused for
 *   EVENT_TIMEOUT ticks the VM resumes it.
 * - Unused-in-battle features (Memoria custom variables/opcodes, field/world opcodes) are skipped by their
 *   argument layout and logged once.
 */
import { type FF9Scene } from "@ffix-roguelike/game-data";

import { getScene, SCRIPTED_WIN_SCENES } from "../../content/ff9-scenes";
import { FF9_ACTION_BASE } from "../../content/ff9";
import type { BattleEngine } from "../engine";
import type { BattleCommand, BattleOutcome, BattleUnit, CommandSource } from "../types";
import { instructions, type EbEntry, type EbScript } from "./disasm";
import { OPCODES } from "./opcodes";
import { getBattleScript } from "./registry";
import { battleIds, bitOf, btlIndex, CHARACTER_ID, getMember, inBattleList, setMember, unitAtIndex, unitsFromBits } from "./units";

// ── constants (EventEngine / FF9StateBattleSystem) ───────────────────────────
const NIL = -1;
const STATE_NEW = 0;
const STATE_RUNNING = 1;
const STATE_INIT = 2;
const STATE_SUSPEND = 3;
const FLOW_EXEC = 0;
const FLOW_WAIT = 1;
const FLOW_DELETE = 2;
const FLOW_GAMEOVER = 8;
const WAIT_MESSAGE = 254;
const WAIT_END_REQ = 255;

export const PHASE = { INIT: 0, EVENT: 1, ENTER: 2, MENU_ON: 3, NORMAL: 4, MENU_OFF: 5 } as const;
const LOAD = { BBG: 1, NPC: 2, CHR: 4, INITNPC: 8, INITCHR: 16, FADENPC: 32, FADECHR: 64 } as const;

/** Ticks a "dying" boss waits for its script to end the battle before it simply dies. */
export const DYING_TIMEOUT = 15 * 6;
/** Ticks outside the normal phase before the VM forces the battle to resume (stuck intro/cutscene safety). */
const EVENT_TIMEOUT = 15 * 120;
/**
 * Boss fights whose script keeps its own HP margin instead of FF9's +10,000 (Memoria btl_para: "the HP gap is not
 * always 10 000 (Gizamaluke…)"): Gizamaluke's script reads his HP, maxes it out at 65,535 as room for his death scene
 * (sinking back into the water), and ends the fight once he has lost what it read: his real 3,875.
 */
const NO_HP_BUFFER = new Set(["GZ_E014"]);
/** Instructions per object run before the VM assumes an infinite loop and yields. */
const MAX_STEPS = 20000;

const VC = { GLOBAL: 0, MAP: 1, INSTANCE: 2, NULL: 3, OBJECT: 4, SYSTEM: 5, MEMBER: 6, INT26: 7 } as const;

/** FF9 command ids (BattleCommandId) the scripts compare against. */
export const CMD = { attack: 1, item: 14, throw: 15, enemyAtk: 47, counter: 49, magicCounter: 50, autoPotion: 51, enemyCounter: 53, enemyDying: 54 } as const;

const PREVENT_ENEMY_CMD = ["petrify", "venom", "stop", "freeze", "death", "sleep"] as const;

// ── state ────────────────────────────────────────────────────────────────────
export interface AiObj {
  /** Script entry (-1: no code). */
  sid: number;
  uid: number;
  ip: number;
  /** Priority level of the running function (0 Death, 1 Counter, 2 CounterEx, 3 ATB, 7 Loop). */
  level: number;
  state: number;
  wait: number;
  winnum: number;
  btlchk: number;
  flags: number;
  /** Instance variable bytes. */
  vars: number[];
  /** Call stack: [ip, wait, level] per call. */
  calls: number[];
}

export interface AiCommandInfo {
  cmd: number;
  sub: number;
  caster: number;
  targets: number;
  element: number;
  weaponElement: number;
}

export interface AiState {
  scene: string;
  pattern: number;
  special: boolean;
  phase: number;
  load: number;
  enterFrames: number;
  /** Ticks spent outside the normal phase since it was last normal. */
  eventTicks: number;
  /** Sparse gEventGlobal (byte index → value). */
  global: Record<number, number>;
  map: number[];
  sys: number[];
  /** Command id / ability id of the attack that triggered the running reaction (_btlCmdPrmCmd/_btlCmdPrmSub). */
  prm: [number, number];
  objs: AiObj[];
  /** btl index → object uid (-1 = none). */
  ptr: number[];
  opl: number;
  /** +10,000 HP buffers by btl index. */
  hpBuf: number[];
  /** Dying bosses: unit id → tick they hit 0 HP. */
  dying: Record<string, number>;
  /** Dead enemies: unit id → tick of death (they stay in the battle list for their death animation). */
  deadAt: Record<string, number>;
  /** Visual-only member values, "index:kind" → value. */
  mem: Record<string, number>;
  /** The command currently playing (FF9 cur_cmd), for AttackerId / GetAttackCommandId outside reactions. */
  cur: AiCommandInfo | null;
  /** Unsupported opcodes met (logged once each). */
  unsupported: number[];
}

/** Per-object frame budget guard and other scratch values live on the VM instance, not in the state. */
export class BattleAi {
  readonly s: AiState;
  private readonly script: EbScript;
  private readonly scene: FF9Scene | undefined;
  // calc stack (EBin.CalcStack): values stay in place when popped, as advance/retreat rely on it
  private stack: number[] = [];
  private top = 0;
  private o!: AiObj;
  private data: Uint8Array = new Uint8Array(0);
  private flow = FLOW_EXEC;
  private argFlag = 0;
  private argUsed = 0;
  private memberTarget = -1;
  private exprLoop = false;
  private halted = false;

  private constructor(
    private readonly eng: BattleEngine,
    script: EbScript,
  ) {
    this.s = eng.state.ai!;
    this.script = script;
    try {
      this.scene = getScene(this.s.scene);
    } catch {
      this.scene = undefined;
    }
  }

  /** The VM for a battle in progress (null if the battle has no AI state or its script isn't registered). */
  static attach(eng: BattleEngine): BattleAi | null {
    const st = eng.state.ai;
    if (!st) return null;
    const script = getBattleScript(st.scene);
    return script ? new BattleAi(eng, script) : null;
  }

  /**
   * Set up a battle's AI (EventEngine.StartEvents for battles): the main entry and the party's entries, then
   * the first frame (Main_Init creates the enemies' objects). Returns false if no script is registered.
   */
  static start(eng: BattleEngine, scene: string, pattern: number): boolean {
    const script = getBattleScript(scene);
    if (!script) return false;
    let special = false;
    try {
      // A special start hands the intro to the script, which must re-enable the ATB (RunBattleCode 35). A few
      // unused scenes are flagged but never do; they start normally.
      special = getScene(scene).flags.includes("Special") && enablesAtb(script);
    } catch {
      special = false;
    }
    eng.state.ai = {
      scene,
      pattern,
      special,
      phase: PHASE.INIT,
      load: 0,
      enterFrames: 0,
      eventTicks: 0,
      global: {},
      map: new Array(80).fill(0),
      sys: new Array(8).fill(0),
      prm: [0, 0],
      objs: [],
      ptr: new Array(8).fill(-1),
      opl: 0,
      hpBuf: new Array(8).fill(0),
      dying: {},
      deadAt: {},
      mem: {},
      cur: null,
      unsupported: [],
    };
    const ai = new BattleAi(eng, script);
    const s = ai.s;
    if (!NO_HP_BUFFER.has(scene)) for (const u of eng.state.units) if (u.side === "enemy" && u.boss) s.hpBuf[btlIndex(u)] = 10000;
    // NewThread(0, 0): the main entry starts in its Init function right away.
    ai.newObj(0, 0, 2).state = STATE_INIT;
    // Party members' entries (linked by character), one per battle slot.
    const n = script.entries.length;
    for (let i = 0; i < 4; i++) {
      const u = unitAtIndex(eng, i);
      s.opl = i;
      if (!u) continue;
      const c = CHARACTER_ID[u.key];
      const sid = c == null ? -1 : c === 11 ? n - 1 : c <= 7 ? c + n - 9 : -1;
      ai.newActor(sid >= 0 && sid < n ? sid : -1, 0, true);
    }
    s.opl = 4;
    ai.processEvents();
    s.phase = PHASE.ENTER;
    return true;
  }

  // ── engine interface ─────────────────────────────────────────────────────
  /** FF9 btl_id bit of a unit. */
  bit(u: BattleUnit): number {
    return bitOf(u);
  }

  isNormal(): boolean {
    return this.s.phase === PHASE.NORMAL;
  }

  /** Is this unit driven by the script (has an object in the battle's object table)? */
  drives(u: BattleUnit): boolean {
    return this.objAt(btlIndex(u)) != null;
  }

  /**
   * An enemy's gauge is full (EventEngine.RequestAction(EnemyAtk)). Returns null if the unit isn't scripted,
   * true if its ATB function was requested, false if it's busy with a higher-priority function (retry later).
   */
  requestAtb(u: BattleUnit): boolean | null {
    const o = this.objAt(btlIndex(u));
    if (!o) return null;
    if (o.level > 3) {
      o.btlchk = 2;
      return true;
    }
    return false;
  }

  /** End of CalcResult for a hit on an enemy: EnemyDying / EnemyCounter / EnemyReaction requests. */
  onHit(caster: BattleUnit, target: BattleUnit, cmd: number, sub: number, declarable: boolean) {
    if (target.side !== "enemy") return;
    const o = this.objAt(btlIndex(target));
    if (!o) return;
    const casterBit = bitOf(caster);
    const preventCounter = PREVENT_ENEMY_CMD.some((s) => s !== "death" && target.statuses[s] !== undefined);
    if (caster.side === "party" && !preventCounter) {
      const dead = !this.eng.isAlive(target) && !target.ff9Dying;
      if (dead && this.fnIp(o.sid, 9) !== NIL) this.reaction(o, 0, 9, casterBit, cmd, sub);
      else if (!dead && declarable) this.reaction(o, 1, 6, casterBit, cmd, sub);
    }
    this.reaction(o, 2, 7, null, cmd, sub);
  }

  /** A command starts playing (FF9 cur_cmd). */
  commandStart(info: AiCommandInfo) {
    this.s.cur = info;
  }

  /**
   * The move's animation sequence ran (btlseq): the only part of it scripts can observe is ToggleStandAnimation,
   * the caster's idle stance (bi.def_idle → STAND_ANIMATION) — Zorn & Thorn's and Black Waltz No.3's AI branch on it.
   */
  sequencePlayed(caster: BattleUnit, slot: number) {
    const stance = this.scene?.stance?.[slot];
    if (stance != null && caster.side === "enemy") this.s.mem[`${btlIndex(caster)}:69`] = stance;
  }

  /** KO hook: a buffered boss at 0 HP is held "dying" for its script. Returns true if the death is held. */
  holdDeath(u: BattleUnit): boolean {
    if (u.side !== "enemy" || (this.s.hpBuf[btlIndex(u)] ?? 0) <= 0) return false;
    if (u.ff9Dying) return true;
    const since = this.s.dying[u.id];
    if (since != null && this.eng.state.tick - since >= DYING_TIMEOUT) return false;
    u.ff9Dying = true;
    u.hp = 1;
    this.s.dying[u.id] = this.eng.state.tick;
    this.eng.killStandardCommands(u);
    this.eng.state.queue = this.eng.state.queue.filter((q) => q.command.actorId !== u.id);
    return true;
  }

  /** One battle frame: BattleMain's phase bookkeeping, then EventEngine.ProcessEvents. */
  frame() {
    const s = this.s;
    const st = this.eng.state;
    if (s.cur && st.busy === 0) s.cur = null;
    // Deaths (for the die-sequence window) and dying bosses whose script never ended the fight.
    for (const u of st.units) {
      if (u.side !== "enemy") continue;
      if (!this.eng.isAlive(u) && s.deadAt[u.id] == null) s.deadAt[u.id] = st.tick;
      else if (this.eng.isAlive(u) && s.deadAt[u.id] != null) delete s.deadAt[u.id];
      const since = s.dying[u.id];
      if (u.ff9Dying && since != null && st.tick - since >= DYING_TIMEOUT) {
        u.ff9Dying = false;
        s.hpBuf[btlIndex(u)] = 0;
        this.eng.killUnit(u);
      }
    }
    switch (s.phase) {
      case PHASE.ENTER: {
        // BattleLoadLoop / SFX.UpdateCamera: models load and fade in, then the battle starts.
        const f = ++s.enterFrames;
        if (f >= 1) s.load |= LOAD.BBG | LOAD.INITNPC | LOAD.INITCHR;
        if (f >= 3) s.load |= LOAD.FADENPC | LOAD.FADECHR;
        if (f >= 6) s.load |= LOAD.NPC | LOAD.CHR;
        if (f >= 7 && (s.load & 7) === 7) s.phase = s.special ? PHASE.EVENT : PHASE.MENU_ON;
        break;
      }
      case PHASE.MENU_ON:
        s.phase = PHASE.NORMAL;
        break;
      case PHASE.MENU_OFF:
        // BattleTrailingLoop (SEQ_MENU_OFF_EVENT): once nothing is playing, hand the battle to the script.
        if (st.busy === 0 && st.queue.length === 0) s.phase = PHASE.EVENT;
        break;
    }
    if (s.phase === PHASE.NORMAL) s.eventTicks = 0;
    else if (++s.eventTicks > EVENT_TIMEOUT && !st.outcome) {
      this.warn(-1, `battle stuck in phase ${s.phase}; resuming`);
      s.phase = PHASE.NORMAL;
      s.eventTicks = 0;
    }
    this.processEvents();
  }

  // ── event loop (EventEngine.ProcessEvents / EBin.ProcessCode) ────────────
  private processEvents() {
    const s = this.s;
    if (s.phase !== PHASE.INIT) {
      // SetupBattleState: enemies out of the battle list have their objects suspended.
      const present = battleIds(this.eng, 1);
      for (let i = 4; i < 8; i++) {
        const o = this.objAt(i);
        // Script-only spawns we have no unit for (FF9 "Dummy" enemies that run the fight) keep running.
        if (!o || !unitAtIndex(this.eng, i)) continue;
        const here = (present & (1 << i)) !== 0;
        if (o.state === STATE_RUNNING && !here) o.state = STATE_SUSPEND;
        else if (o.state === STATE_SUSPEND && here) o.state = STATE_RUNNING;
      }
    }
    this.halted = false;
    for (let i = 0; i < s.objs.length && !this.halted && !this.eng.state.outcome; i++) {
      const o = s.objs[i]!;
      if (o.state === STATE_NEW) {
        o.state = STATE_INIT;
        continue;
      }
      if (o.state === STATE_SUSPEND || o.ip === NIL) continue;
      if (o.wait !== 0) {
        if (o.wait === WAIT_MESSAGE) {
          // Battle text windows close on their own here.
          o.winnum = 255;
          o.wait = 0;
        } else if (o.wait !== WAIT_END_REQ) o.wait--;
        continue;
      }
      this.run(o);
      if (this.flow === FLOW_DELETE) i--;
    }
    // Pending ATB requests become calls to the ATB function (tag 5) at level 3.
    for (const o of s.objs) if (o.btlchk === 2 && this.request(o, 3, 5)) o.btlchk = 1;
  }

  /** Run one object until it waits or returns (EBin.EnterFunctionLoop). */
  private run(o: AiObj) {
    this.o = o;
    this.data = this.entryData(o.sid);
    const idx = this.s.ptr.indexOf(o.uid);
    this.setSys(1, idx >= 0 ? 1 << idx : 0); // EventEngine.ProcessCodeExt
    this.flow = FLOW_EXEC;
    let done = false;
    for (let n = 0; !done; n++) {
      if (this.flow !== FLOW_EXEC) break;
      if (n > MAX_STEPS) {
        this.warn(-2, `entry ${o.sid} ran ${MAX_STEPS} steps without yielding`);
        break;
      }
      if (o.ip < 0 || o.ip >= this.data.length) {
        o.ip = NIL;
        break;
      }
      const op = this.data[o.ip]!;
      if (op > 0x6d) {
        this.commandDefault();
        continue;
      }
      o.ip++;
      done = this.codeFlow(op);
    }
  }

  /** EBin.commandCodeFlow. Returns true when the object's run is over (return). */
  private codeFlow(op: number): boolean {
    const o = this.o;
    switch (op) {
      case 0x01: // JMP
        this.bra();
        return false;
      case 0x02: {
        // JMP_IFN
        const v = this.eval();
        if (v !== 0) o.ip += 2;
        else o.ip += 2 + this.u16(o.ip);
        return false;
      }
      case 0x03: {
        // JMP_IF
        const v = this.eval();
        if (v === 0) o.ip += 2;
        else this.bra();
        return false;
      }
      case 0x04: // return
        this.ret(o);
        return true;
      case 0x05:
        this.expr();
        return false;
      case 0x06: {
        // JMP_SWITCHEX
        let cases = this.byte(o.ip);
        const v = this.eval() & 0xffff;
        let off = 3;
        while (cases-- > 0) {
          const value = this.u16(o.ip + off);
          off += 4;
          if (value === v) {
            o.ip += this.u16(o.ip + off - 2) + 3;
            return false;
          }
        }
        o.ip += this.u16(o.ip + 1) + 3;
        return false;
      }
      case 0x0b:
        this.jmpSwitch(this.byte(o.ip));
        return false;
      case 0x0d: {
        const cases = this.s16(o.ip);
        o.ip++;
        this.jmpSwitch(cases);
        return false;
      }
      case 0x1c: {
        // TerminateEntry
        const uid = this.byte(o.ip + 1);
        o.ip += 2;
        const target = uid === 255 ? o : this.objByUid(uid);
        if (target === o) {
          this.dispose(o);
          this.flow = FLOW_DELETE;
          return true;
        }
        if (target) this.dispose(target);
        return false;
      }
      case 0x22: {
        // Wait
        const flag = this.byte(o.ip);
        o.ip++;
        let v: number;
        if (flag & 1) {
          this.expr();
          v = this.eval();
        } else v = this.byte(o.ip++);
        if (v !== 0) {
          o.wait = v > WAIT_MESSAGE ? 253 : v - 1;
          this.flow = FLOW_WAIT;
        }
        return false;
      }
      case 0x30: // PRINT1
      case 0x31: // PRINTF
      case 0x6c: // PPRINT
      case 0x6d: // PPRINTF
        return false;
      case 0x32: {
        // LOCATE
        let flag = this.byte(o.ip);
        o.ip++;
        for (let i = 0; i < 2; i++, flag >>= 1) {
          if (flag & 1) {
            this.expr();
            this.eval();
          } else o.ip++;
        }
        return false;
      }
      default:
        o.ip--;
        this.commandDefault();
        return false;
    }
  }

  private bra() {
    const off = this.s16(this.o.ip);
    this.o.ip += 2 + off;
  }

  private jmpSwitch(cases: number) {
    const o = this.o;
    const base = this.byte(o.ip + 1) + (((this.byte(o.ip + 2) << 24) >> 24) << 8);
    const v = this.eval() - base;
    if (v < 0 || v - cases >= 0) {
      o.ip += this.u16(o.ip + 3);
      return;
    }
    o.ip += this.byte(o.ip + v * 2 + 5) + (this.byte(o.ip + v * 2 + 6) << 8);
  }

  /** EBin.commandDefault → EventEngine.DoEventCode. */
  private commandDefault() {
    const o = this.o;
    let code = 0;
    let b = this.geti();
    while (b === 0xff) {
      b = this.geti();
      code += 0x100;
    }
    code += b;
    this.argFlag = this.geti();
    this.argUsed = 0;
    this.flow = this.doEventCode(code);
    if (this.argUsed === 0) o.ip--;
    if (this.flow === FLOW_GAMEOVER) {
      this.halted = true;
      this.eng.finish("defeat");
    }
  }

  private doEventCode(code: number): number {
    const o = this.o;
    switch (code) {
      case 0x00: // NOTHING
        return FLOW_WAIT;
      case 0x07: // InitCode
      case 0x08: {
        // InitRegion
        const sid = this.argFlag;
        const uid = this.geti();
        this.newObj(sid, uid, 2);
        this.argUsed = 1;
        return 0;
      }
      case 0x09: {
        // InitObject
        let sid = this.argFlag;
        const uid = this.geti();
        this.argUsed = 1;
        if (sid >= 251 && sid <= 254) {
          const u = unitAtIndex(this.eng, sid - 251);
          const actor = u ? this.objAt(sid - 251) : undefined;
          if (!actor) return 0;
          sid = actor.sid;
        }
        this.newActor(sid, uid, false);
        return 0;
      }
      case 0x1b: // ContinueBattleMusic
      case 0x21: // CloseWindow
        this.getv1();
        return 0;
      case 0x1f: {
        // WindowSync
        o.winnum = this.getv1() & 0xff;
        this.getv1();
        const text = this.getv2();
        this.text(text);
        o.wait = WAIT_MESSAGE;
        return FLOW_WAIT;
      }
      case 0x20: {
        // WindowAsync
        o.winnum = this.getv1() & 0xff;
        this.getv1();
        this.text(this.getv2());
        return 0;
      }
      case 0x38: {
        // Attack
        const unit = this.unitByBits(this.sys(1));
        switch (o.level) {
          case 0:
            this.setEnemyCommand(unit, "dying", this.getv1(), this.sys(0));
            return 0;
          case 1:
            this.setEnemyCommand(unit, "counter", this.getv1(), this.sys(0));
            return 0;
          case 3:
            o.btlchk = 0;
            this.setEnemyCommand(unit, "main", this.getv1(), this.sys(0));
            return 0;
          default:
            // FF9 leaves the argument unread here (no script does this); consume it to stay in sync.
            this.getv1();
            return 0;
        }
      }
      case 0x4a: {
        // RunBattleCode
        const battleCode = this.getv1();
        const val = this.getv2();
        this.battleCode(battleCode, val);
        return 0;
      }
      case 0x4c: // AttachObject
        this.getv1();
        this.getv1();
        this.getv1();
        return 0;
      case 0x54: // WaitWindow
        o.winnum = this.getv1() & 0xff;
        o.wait = WAIT_MESSAGE;
        return FLOW_WAIT;
      case 0x66: // SetTextVariable
        this.getv1();
        this.getv2();
        return 0;
      case 0xd0: // BattleDialog
        this.text(this.getv2());
        return 0;
      case 0xe1: // TerminateBattle
      case 0xeb: // CloseAllWindows
        return 0;
      case 0xe5: {
        // AttackSpecial
        const slot = this.getv1();
        this.attackSpecial(this.unitByBits(this.sys(1)), slot, this.sys(0));
        return 0;
      }
      case 0xec: // FadeFilter
        for (let i = 0; i < 6; i++) this.getv1();
        return 0;
      case 0xf5: // GameOver
        return FLOW_GAMEOVER;
    }
    // Anything else: consume the arguments by the opcode's layout and carry on.
    this.warn(code, `unsupported opcode ${OPCODES[code]?.[1] || OPCODES[code]?.[0] || code}`);
    const info = OPCODES[code];
    const n = info ? info[2] : 0;
    for (let i = 0; i < n; i++) {
      if (this.argFlag & 1) {
        this.calcExpr();
        this.getv();
      } else o.ip += info?.[3]?.[i] ?? 1;
      this.argFlag >>= 1;
      this.argUsed = 1;
    }
    return 0;
  }

  // ── objects ──────────────────────────────────────────────────────────────
  private entry(sid: number): EbEntry | undefined {
    return sid >= 0 ? this.script.entries[sid] : undefined;
  }

  private entryData(sid: number): Uint8Array {
    return this.entry(sid)?.data ?? new Uint8Array(0);
  }

  /** EventEngine.GetIP. */
  private fnIp(sid: number, tag: number): number {
    const e = this.entry(sid);
    if (!e || e.data.length === 0) return NIL;
    return e.functions.find((f) => f.tag === tag)?.ip ?? NIL;
  }

  private objByUid(uid: number): AiObj | undefined {
    if (uid === 255) return this.o;
    return this.s.objs.find((x) => x.uid === uid);
  }

  private objAt(index: number): AiObj | undefined {
    const uid = this.s.ptr[index];
    if (uid == null || uid < 0) return undefined;
    return this.s.objs.find((x) => x.uid === uid);
  }

  /** new Obj(sid, uid): replaces any object with the same uid, appended to the active list. */
  private newObj(sid: number, uid: number, _cid: number): AiObj {
    if (uid === 0) uid = sid;
    const old = this.s.objs.find((x) => x.uid === uid);
    if (old) this.dispose(old);
    const varn = this.entry(sid)?.varn ?? 0;
    const o: AiObj = {
      sid,
      uid,
      ip: this.fnIp(sid, 0),
      level: 0,
      state: STATE_NEW,
      wait: 0,
      winnum: 255,
      btlchk: 0,
      flags: 0,
      vars: new Array((varn + 3) & ~3).fill(0),
      calls: [],
    };
    this.s.objs.push(o);
    return o;
  }

  /** new Actor(sid, uid): also takes the next battle index (addObjPtrList). */
  private newActor(sid: number, uid: number, party: boolean): AiObj {
    const o = this.newObj(sid, party && sid < 0 ? 200 + this.s.opl : uid, 4);
    o.flags |= 4;
    if (this.s.opl < 8) this.s.ptr[this.s.opl++] = o.uid;
    return o;
  }

  private dispose(o: AiObj) {
    const i = this.s.objs.indexOf(o);
    if (i >= 0) this.s.objs.splice(i, 1);
  }

  /** EventEngine.Request. */
  private request(o: AiObj, level: number, tag: number): boolean {
    if (level >= o.level) return false;
    const ip = this.fnIp(o.sid, tag);
    if (ip === NIL) return false;
    // EventEngine.Call
    o.calls.push(o.ip, o.wait, o.level);
    o.ip = ip;
    o.level = level;
    o.wait = 0;
    return true;
  }

  private reaction(o: AiObj, level: number, tag: number, casterBit: number | null, cmd: number, sub: number) {
    if (casterBit != null) this.setSys(0, casterBit);
    this.s.prm = [cmd, sub];
    this.request(o, level, tag);
  }

  /** EventEngine.Return. */
  private ret(o: AiObj) {
    if (o.level === 3 && o.btlchk === 1) {
      // The ATB function ended without an attack: the turn is lost (FF9 would leave the enemy frozen).
      o.btlchk = 0;
      const u = this.unitByBits(this.sys(1));
      if (u && u.busyCommand && !this.eng.state.queue.some((q) => q.command.actorId === u.id && q.source === "main")) {
        u.busyCommand = false;
        u.atb = 0;
      }
    }
    if (o.calls.length >= 3) {
      o.level = o.calls.pop()!;
      o.wait = o.calls.pop()!;
      o.ip = o.calls.pop()!;
    } else if (o.state === STATE_INIT) {
      o.state = STATE_RUNNING;
      o.ip = this.fnIp(o.sid, 1);
      o.level = 7;
    } else o.ip = NIL;
  }

  // ── battle effects ───────────────────────────────────────────────────────
  private unitByBits(bits: number): BattleUnit | undefined {
    for (let i = 0; i < 8; i++) if (bits & (1 << i)) return this.presentAt(i);
    return undefined;
  }

  private presentAt(i: number): BattleUnit | undefined {
    const u = unitAtIndex(this.eng, i);
    return u && inBattleList(this.eng, u) ? u : undefined;
  }

  private actionFor(slot: number): number | null {
    const uid = this.scene?.attacks[slot];
    return uid == null || uid < 0 ? null : FF9_ACTION_BASE + uid;
  }

  /** btl_cmd.SetEnemyCommand. */
  private setEnemyCommand(u: BattleUnit | undefined, source: "main" | "counter" | "dying", slot: number, targets: number) {
    if (!u) return;
    const eng = this.eng;
    const reject = () => {
      if (source === "main") u.busyCommand = false;
    };
    if (PREVENT_ENEMY_CMD.some((s) => (source !== "dying" || s !== "death") && u.statuses[s] !== undefined)) return reject();
    if (u.ff9Dying && source !== "dying") return reject();
    const q = eng.state.queue;
    if (source === "main") {
      if (this.s.phase !== PHASE.NORMAL) return reject();
      if (q.some((x) => x.command.actorId === u.id && x.source === "main")) return reject();
    } else if (source === "counter" && q.some((x) => x.command.actorId === u.id && (x.source === "counter" || x.source === "dying"))) return;
    const actionId = this.actionFor(slot);
    if (actionId == null) {
      this.warn(-3, `${this.s.scene}: attack slot ${slot} not in the scene's attack table`);
      if (source === "main") {
        u.busyCommand = false;
        u.atb = 0;
      }
      return;
    }
    const command: BattleCommand = { actorId: u.id, kind: "ability", actionId, targetIds: unitsFromBits(eng, targets).map((t) => t.id), scripted: true, ff9Slot: slot };
    eng.enqueue(command, source as CommandSource);
    if (source === "main") u.busyCommand = true;
  }

  /** btlseq.StartBtlSeq: the move plays at once, outside the command queue. */
  private attackSpecial(u: BattleUnit | undefined, slot: number, targets: number) {
    if (!u) return;
    const actionId = this.actionFor(slot);
    if (actionId == null) return this.warn(-3, `${this.s.scene}: special attack slot ${slot} not in the scene's attack table`);
    const command: BattleCommand = { actorId: u.id, kind: "ability", actionId, targetIds: unitsFromBits(this.eng, targets).map((t) => t.id), scripted: true, ff9Slot: slot };
    const ticks = this.eng.executeScripted(u, command);
    this.eng.state.busy = Math.max(this.eng.state.busy, ticks);
  }

  /** btl_scrp.SetBattleData. */
  private battleCode(code: number, val: number) {
    const s = this.s;
    const eng = this.eng;
    switch (code) {
      case 32: // Disable ATB
        s.phase = PHASE.MENU_OFF;
        eng.killAllCommands();
        return;
      case 33: // End battle
        if (s.phase === PHASE.EVENT) {
          const outcome: BattleOutcome = val === 4 ? "fled" : val === 0 || val === 3 || val === 6 ? "defeat" : "victory";
          if (val === 7) {
            // FF9's "the enemy fled" ending (Cleyra's soldiers retreating, Ralvurahva's Escape): whoever's still on
            // the field has run off, so they leave it (no EXP: they weren't defeated).
            for (const u of eng.state.units) if (u.side === "enemy" && eng.isAlive(u)) u.removed = true;
            eng.emit({ type: "message", text: "The enemy fled" });
          }
          // A scripted win (Beatrix's duels): the boss is still standing, and withdraws.
          else if (outcome === "victory" && eng.state.scene && SCRIPTED_WIN_SCENES.has(eng.state.scene)) {
            const standing = eng.state.units.filter((u) => u.side === "enemy" && eng.isTargetable(u));
            if (standing.length) eng.emit({ type: "message", text: `${standing[0]!.name} withdraws` });
          }
          eng.finish(outcome);
        }
        return;
      case 34: // Game over
        if (s.phase === PHASE.EVENT) eng.finish("defeat");
        return;
      case 35: // Enable ATB
        if (s.phase === PHASE.EVENT) s.phase = PHASE.MENU_ON;
        return;
      case 38: // Add gil
        eng.state.gilBonus += val;
        return;
    }
    // 36 camera, 37 next field, 39 dragon counter, 40 song fade, 43 effect counter, 44 bonus AP: no effect here.
  }

  private text(textId: number) {
    this.eng.emit({ type: "scriptText", scene: this.s.scene, textId, actorId: this.unitByBits(this.sys(1))?.id });
  }

  // ── system lists / variables ─────────────────────────────────────────────
  private sys(n: number): number {
    n &= 7;
    const s = this.s;
    if (n >= 2 && n <= 4) s.sys[n] = battleIds(this.eng, n - 2);
    else if (n === 6) s.sys[6] = 0; // Memoria spell-stat access (unused by the original scripts)
    return s.sys[n]!;
  }

  private setSys(n: number, v: number) {
    this.s.sys[n & 7] = v & 0xffff;
  }

  /** EventEngine.GetSysvar (+ btl_scrp.GetBattleData). */
  private sysvar(code: number): number {
    const s = this.s;
    const st = this.eng.state;
    switch (code) {
      case 0:
        return this.eng.rng.int(0, 255);
      case 25: // IsAttacking
        return st.busy > 0 ? 1 : 0;
      case 26: // IsBattleResult
      case 27:
        return 0;
      case 28:
        return this.o.level <= 2 ? s.prm[0] : (s.cur?.cmd ?? 0);
      case 29:
        return this.o.level <= 2 ? s.prm[1] : (s.cur?.sub ?? 0);
      case 30:
        return s.phase;
      case 31:
        return s.pattern;
      case 32:
        return st.start === "back" ? 0 : st.start === "preemptive" ? 1 : 2;
      case 33:
        return st.gil;
      case 34:
        return s.phase;
      case 35:
        return 0;
      case 36:
        return s.cur ? s.cur.caster : -1;
      case 37:
        return s.cur ? s.cur.targets : -1;
      case 38:
        return s.cur ? s.cur.weaponElement : -1;
      case 39:
        return s.cur ? s.cur.element : -1;
      case 40:
        return s.load;
      case 41: // battle.btl_bonus.exp: only its being non-zero matters to scripts
        return st.units.filter((u) => u.side === "enemy" && !this.eng.isAlive(u) && !u.removed).length;
      case 42:
      case 43:
      case 44:
        return 0;
    }
    if (code >= 32 && code < 192) return -1; // GetBattleData default (UInt32.MaxValue)
    return 0; // field / world-map queries
  }

  // ── expressions (EBin.expr) ──────────────────────────────────────────────
  private push(v: number) {
    this.stack[this.top++] = v | 0;
  }

  private pop(): number {
    if (this.top === 0) return 0;
    return this.stack[--this.top] ?? 0;
  }

  private advance() {
    this.top++;
    while (this.stack.length < this.top) this.stack.push(0);
  }

  private retreat() {
    if (this.top > 0) this.top--;
  }

  private at(offset: number): number {
    return this.stack[this.top + offset] ?? 0;
  }

  private empty() {
    this.stack.fill(0);
    this.top = 0;
  }

  private pushInt(v: number) {
    this.push(v | (VC.INT26 << 26));
  }

  /** EBin.expr: evaluate an expression in place, leaving its value on the stack. */
  private expr() {
    const o = this.o;
    this.empty();
    this.exprLoop = true;
    while (this.exprLoop) {
      if (o.ip >= this.data.length) {
        this.warn(-4, "expression runs past the end of its entry");
        return;
      }
      const op = this.data[o.ip++]!;
      if (op >= 0x80) {
        if (op === 0xd3) {
          this.warn(0xd3, "Memoria custom expression function");
          this.pushInt(0);
          continue;
        }
        let v = ((op & 3) << 26) | ((op & 0x1c) << 27);
        let idx = this.data[o.ip++]!;
        if (op & 0x20) {
          v |= idx;
          idx = this.data[o.ip++]! << 8;
        }
        this.push(v | idx);
      } else this.exprOp(op);
    }
  }

  /** CalcExpr + getv: an opcode argument given as an expression. */
  private calcExpr() {
    this.expr();
  }

  private getv(): number {
    return this.eval();
  }

  private putv(v: number) {
    this.setVar(v);
  }

  private exprOp(op: number) {
    const o = this.o;
    const bin = (f: (x: number, y: number) => number) => {
      const y = this.eval();
      const x = this.eval();
      this.pushInt(f(x, y) | 0);
    };
    const let_ = (f: (x: number, y: number) => number, zeroGuard = false) => {
      const y = this.eval();
      const x = this.eval();
      this.advance();
      if (zeroGuard && y === 0) {
        this.pushInt(x);
        return;
      }
      const v = f(x, y) | 0;
      this.setVar(v);
      this.pushInt(v);
    };
    switch (op) {
      case 4: {
        const v = this.eval();
        this.advance();
        this.setVar(v + 1);
        this.pushInt(v);
        return;
      }
      case 5: {
        const v = this.eval();
        this.advance();
        this.setVar(v - 1);
        this.pushInt(v);
        return;
      }
      case 6: {
        const v = this.eval() + 1;
        this.advance();
        this.setVar(v);
        this.pushInt(v);
        return;
      }
      case 7: {
        const v = this.eval() - 1;
        this.advance();
        this.setVar(v);
        this.pushInt(v);
        return;
      }
      case 8:
      case 9:
      case 10:
      case 11:
        this.pushInt(this.operatorAll1(op));
        return;
      case 12: // B_SINGLE_PLUS pushes the last computed value; the operand is already the top of the stack
        this.pushInt(this.eval());
        return;
      case 13:
        this.pushInt(-this.eval());
        return;
      case 14:
        this.pushInt(this.eval() <= 0 ? 1 : 0);
        return;
      case 15:
      case 75:
      case 76:
        this.pushInt(this.operatorExtract1(op));
        return;
      case 16:
        this.pushInt(~this.eval());
        return;
      case 17:
        return bin((x, y) => Math.imul(x, y));
      case 18:
        return bin((x, y) => (y === 0 ? x : (x / y) | 0));
      case 19:
        return bin((x, y) => (y === 0 ? x : x % y));
      case 20:
        return bin((x, y) => x + y);
      case 21:
        return bin((x, y) => x - y);
      case 22:
        return bin((x, y) => x << y);
      case 23:
        return bin((x, y) => x >> y);
      case 24:
        return bin((x, y) => (x < y ? 1 : 0));
      case 25:
        return bin((x, y) => (x > y ? 1 : 0));
      case 26:
        return bin((x, y) => (x <= y ? 1 : 0));
      case 27:
        return bin((x, y) => (x >= y ? 1 : 0));
      case 28:
      case 29:
      case 30:
      case 31:
      case 34:
      case 35:
      case 84:
      case 85:
      case 86:
      case 87:
        this.pushInt(this.operatorExtract(op));
        return;
      case 32:
        return bin((x, y) => ((x ^ y) === 0 ? 1 : 0));
      case 33:
        return bin((x, y) => ((x ^ y) !== 0 ? 1 : 0));
      case 36:
        return bin((x, y) => x & y);
      case 37:
        return bin((x, y) => x ^ y);
      case 38:
        return bin((x, y) => x | y);
      case 39: {
        // B_ANDAND
        let v = this.eval();
        this.retreat();
        if (v === 0) this.pushInt(v);
        else {
          this.advance();
          v = this.eval();
          this.pushInt(v === 0 ? 0 : 1);
        }
        return;
      }
      case 40: {
        // B_OROR
        let v = this.eval() === 0 ? 0 : 1;
        this.retreat();
        if (v !== 0) this.pushInt(v);
        else {
          this.advance();
          v = this.eval();
          this.pushInt(v === 0 ? 0 : 1);
        }
        return;
      }
      case 41: {
        // B_MEMBER
        const kind = this.data[o.ip++]!;
        this.push(kind | (VC.MEMBER << 26));
        return;
      }
      case 42:
        this.pushInt(this.operatorCount());
        return;
      case 43:
        this.pushInt(this.operatorFirstOf());
        return;
      case 44: {
        const v = this.eval();
        this.setVar(v);
        this.pushInt(v);
        return;
      }
      case 45:
      case 54:
      case 55:
      case 56:
      case 57:
      case 58:
      case 59:
      case 60:
      case 64:
      case 65:
      case 66:
        this.pushInt(this.operatorAll(op));
        return;
      case 46:
      case 67:
      case 68:
      case 69:
        this.pushInt(this.operatorExtractLet(op));
        return;
      case 47:
        return let_((x, y) => Math.imul(x, y));
      case 48:
        return let_((x, y) => (x / y) | 0, true);
      case 49:
        return let_((x, y) => x % y, true);
      case 50:
        return let_((x, y) => x + y);
      case 51:
        return let_((x, y) => x - y);
      case 52:
        return let_((x, y) => x << y);
      case 53:
        return let_((x, y) => x >> y);
      case 61:
        return let_((x, y) => x & y);
      case 62:
        return let_((x, y) => x ^ y);
      case 63:
        return let_((x, y) => x | y);
      case 77:
        this.pushInt(this.randomActiveBit());
        return;
      case 95: {
        // B_PTR
        const uid = this.data[o.ip++]!;
        this.pushInt(this.objByUid(uid)?.uid ?? 0);
        return;
      }
      case 120: {
        // B_OBJSPECA
        const member = this.data[o.ip]!;
        const uid = this.data[o.ip + 1]!;
        o.ip += 2;
        this.push(member | (uid << 8) | (VC.OBJECT << 26));
        return;
      }
      case 121:
        this.push(this.data[o.ip++]! | (VC.SYSTEM << 26));
        return;
      case 122: {
        const v = this.sysvar(this.data[o.ip++]!);
        this.push((v & 0x3ffffff) | (VC.INT26 << 26));
        return;
      }
      case 125: {
        const v = this.s16(o.ip);
        o.ip += 2;
        this.push(v | (VC.INT26 << 26));
        return;
      }
      case 126: {
        const v = this.data[o.ip]! | (this.data[o.ip + 1]! << 8) | (this.data[o.ip + 2]! << 16) | (this.data[o.ip + 3]! << 24);
        o.ip += 4;
        this.push((v & 0x3ffffff) | (VC.INT26 << 26));
        return;
      }
      case 127:
        this.exprLoop = false;
        return;
      // Field/world-only operators (keys, angles, distances, party checks, item counts, field HP): their operand
      // is consumed and they yield 0 in battle.
      case 79:
      case 80:
      case 81:
      case 82:
      case 83:
      case 88:
      case 89:
      case 90:
      case 91:
      case 92:
      case 96:
      case 97:
      case 98:
      case 99:
      case 100:
      case 101:
      case 106:
      case 107:
      case 109:
      case 110:
      case 111:
      case 112:
      case 113:
        this.eval();
        this.pushInt(0);
        return;
      case 93:
      case 94:
      case 102:
      case 108:
        this.eval();
        this.eval();
        this.pushInt(0);
        return;
      case 70:
      case 71:
      case 72:
      case 73:
      case 74:
      case 78:
      case 0:
      case 1:
      case 2:
      case 3:
      case 103:
      case 104:
      case 105:
      case 123:
      case 124:
        this.pushInt(0);
        return;
    }
  }

  // List operators (EventEngine.OperatorAll / OperatorExtract / OperatorFirstOf …), ported stack-op for stack-op.
  private listBits(offset: number, retreats: number): number {
    const raw = this.at(offset);
    if (((raw >> 26) & 7) === VC.SYSTEM) return this.sys(raw);
    for (let i = 0; i < retreats; i++) this.retreat();
    const bits = this.getv();
    for (let i = 0; i <= retreats; i++) this.advance();
    return bits;
  }

  private operatorFirstOf(): number {
    let result = 0;
    let bits = this.listBits(-2, 1);
    let i = 0;
    while (i < 8 && (bits & 1) === 0) {
      i++;
      bits >>= 1;
    }
    if (i < 8) {
      this.memberTarget = i;
      result = this.getv();
    } else this.retreat();
    this.retreat();
    return result;
  }

  private operatorCount(): number {
    const bits = this.getv();
    let n = 0;
    for (let i = 0; i < 16; i++) if (bits & (1 << i)) n++;
    return n;
  }

  private randomActiveBit(): number {
    let bits = this.getv();
    const set: number[] = [];
    for (let i = 0; i < 8; i++) {
      if (bits & 1) set.push(i);
      bits >>= 1;
    }
    if (!set.length) return 0;
    const index = (set.length * this.eng.rng.int(0, 255)) >> 8;
    return 1 << set[index]!;
  }

  private operatorAll(op: number): number {
    let a = 0;
    let bits = this.listBits(-3, 2);
    const y = this.getv();
    for (let i = 0; i < 8; i++) {
      if (bits & 1) {
        this.memberTarget = i;
        switch (op) {
          case 45:
            a = y;
            break;
          case 54:
            a = Math.imul(this.getv(), y);
            this.advance();
            break;
          case 55: {
            const x = this.getv();
            a = y === 0 ? x : (x / y) | 0;
            this.advance();
            break;
          }
          case 56: {
            const x = this.getv();
            a = y === 0 ? x : x % y;
            this.advance();
            break;
          }
          case 57:
            a = (this.getv() + y) | 0;
            this.advance();
            break;
          case 58:
            a = (this.getv() - y) | 0;
            this.advance();
            break;
          case 59:
            a = this.getv() << y;
            this.advance();
            break;
          case 60:
            a = this.getv() >> y;
            this.advance();
            break;
          case 64:
            a = this.getv() & y;
            this.advance();
            break;
          case 65:
            a = this.getv() ^ y;
            this.advance();
            break;
          case 66:
            a = this.getv() | y;
            this.advance();
            break;
        }
        this.putv(a);
        this.advance();
      }
      bits >>= 1;
    }
    this.retreat();
    this.retreat();
    return a;
  }

  private operatorAll1(op: number): number {
    let a = 0;
    let bits = this.listBits(-2, 1);
    for (let i = 0; i < 8; i++) {
      if (bits & 1) {
        this.memberTarget = i;
        const v = this.getv();
        this.advance();
        if (op === 8) {
          a = v;
          this.putv(v + 1);
        } else if (op === 9) {
          a = v;
          this.putv(v - 1);
        } else {
          a = op === 10 ? v + 1 : v - 1;
          this.putv(a);
        }
        this.advance();
      }
      bits >>= 1;
    }
    this.retreat();
    this.retreat();
    return a;
  }

  private operatorExtract(op: number): number {
    let out = 0;
    let bits = this.listBits(-3, 2);
    const y = this.getv();
    for (let i = 0; i < 8; i++) {
      out >>= 1;
      if (bits & 1) {
        this.memberTarget = i;
        const x = this.getv();
        let r = 0;
        switch (op) {
          case 28:
            r = x < y ? 1 : 0;
            break;
          case 29:
            r = x > y ? 1 : 0;
            break;
          case 30:
            r = x <= y ? 1 : 0;
            break;
          case 31:
            r = x >= y ? 1 : 0;
            break;
          case 34:
            r = x === y ? 1 : 0;
            break;
          case 35:
            r = x !== y ? 1 : 0;
            break;
          case 84:
            r = (x & y) !== 0 ? 1 : 0;
            break;
          case 85:
            r = (x & y) === 0 ? 1 : 0;
            break;
          case 86:
            r = (x ^ y) !== 0 ? 1 : 0;
            break;
          case 87:
            r = (x | y) !== 0 ? 1 : 0;
            break;
        }
        out |= r << 7;
        this.advance();
      }
      bits >>= 1;
    }
    this.retreat();
    this.retreat();
    return out;
  }

  private operatorExtract1(op: number): number {
    let out = 0;
    let best = 0;
    let bits = this.listBits(-2, 1);
    if (op === 75 || op === 76) {
      let extreme = op === 75 ? -32768 : 32767;
      for (let i = 0; i < 8; i++) {
        if (bits & 1) {
          this.memberTarget = i;
          const v = this.getv();
          this.advance();
          if (op === 75 ? extreme < v : extreme > v) {
            extreme = v;
            best = i;
          }
        }
        bits >>= 1;
      }
      out = 1 << best;
    } else {
      for (let i = 0; i < 8; i++) {
        out >>= 1;
        if (bits & 1) {
          this.memberTarget = i;
          out |= (this.getv() !== 0 ? 0 : 1) << 7;
          this.advance();
        }
        bits >>= 1;
      }
    }
    this.retreat();
    this.retreat();
    return out;
  }

  private operatorExtractLet(op: number): number {
    let a = 0;
    let bits = this.listBits(-2, 1);
    for (let i = 0; i < 8; i++) {
      a >>= 1;
      if (bits & 1) {
        this.memberTarget = i;
        a |= (this.getv() === 0 ? 0 : 1) << 7;
        this.advance();
      }
      bits >>= 1;
    }
    this.retreat();
    this.retreat();
    if (op !== 46) {
      const v = this.getv();
      a = op === 67 ? a & v : op === 68 ? a ^ v : a | v;
      this.advance();
    }
    this.putv(a);
    return a;
  }

  // ── variables (EBin.EvaluateValueExpression / SetVariableValue) ──────────
  private eval(): number {
    const t0 = this.pop();
    const type = (t0 >>> 29) & 7;
    const cls = (t0 >> 26) & 7;
    switch (cls) {
      case VC.GLOBAL:
        return this.readBuf((i) => this.s.global[i] ?? 0, t0 & 0xffff, type);
      case VC.MAP:
        return this.readBuf((i) => this.s.map[i] ?? 0, t0 & 0xffff, type);
      case VC.INSTANCE:
        return this.readBuf((i) => this.o.vars[i] ?? 0, t0 & 0xffff, type);
      case VC.NULL:
        return 0;
      case VC.OBJECT: {
        const obj = this.objByUid((t0 >> 8) & 0xff);
        return obj ? this.objField(obj, t0 & 0xff) : 0;
      }
      case VC.SYSTEM:
        return this.sys(t0 & 0xff);
      case VC.MEMBER:
        return this.memberGet((t0 << 6) >> 6);
      default:
        return (t0 << 6) >> 6;
    }
  }

  private setVar(v: number) {
    const t0 = this.pop();
    const type = (t0 >>> 29) & 7;
    const cls = (t0 >> 26) & 7;
    switch (cls) {
      case VC.GLOBAL:
        this.writeBuf((i, b) => {
          if (i < 2048) this.s.global[i] = b;
        }, (i) => this.s.global[i] ?? 0, t0 & 0xffff, type, v);
        return;
      case VC.MAP:
        this.writeBuf((i, b) => {
          if (i < this.s.map.length) this.s.map[i] = b;
        }, (i) => this.s.map[i] ?? 0, t0 & 0xffff, type, v);
        return;
      case VC.INSTANCE:
        this.writeBuf((i, b) => {
          if (i < this.o.vars.length) this.o.vars[i] = b;
        }, (i) => this.o.vars[i] ?? 0, t0 & 0xffff, type, v);
        return;
      case VC.SYSTEM:
        this.setSys(t0 & 0xff, v);
        return;
      case VC.MEMBER:
        this.memberSet(t0 & 0xff, v);
        return;
    }
  }

  private readBuf(get: (i: number) => number, ofs: number, type: number): number {
    switch (type) {
      case 0:
      case 1:
        return (get(ofs >> 3) >> (ofs & 7)) & 1;
      case 2:
      case 3:
        return get(ofs) | (get(ofs + 1) << 8) | ((get(ofs + 2) << 24) >> 8);
      case 4:
        return (get(ofs) << 24) >> 24;
      case 5:
        return get(ofs);
      case 6:
        return get(ofs) | ((get(ofs + 1) << 24) >> 16);
      case 7:
        return get(ofs) | (get(ofs + 1) << 8);
    }
    return 0;
  }

  private writeBuf(set: (i: number, b: number) => void, get: (i: number) => number, ofs: number, type: number, v: number) {
    switch (type) {
      case 0:
      case 1: {
        const i = ofs >> 3;
        const bit = 1 << (ofs & 7);
        set(i, v === 0 ? get(i) & ~bit & 0xff : (get(i) | bit) & 0xff);
        return;
      }
      case 2:
      case 3:
        set(ofs, v & 0xff);
        set(ofs + 1, (v >> 8) & 0xff);
        set(ofs + 2, (v >> 16) & 0xff);
        return;
      case 4:
      case 5:
        set(ofs, v & 0xff);
        return;
      case 6:
      case 7:
        set(ofs, v & 0xff);
        set(ofs + 1, (v >> 8) & 0xff);
        return;
    }
  }

  /** EBin.getvobj for object fields 0–7 (positions are 0 in our battles). */
  private objField(obj: AiObj, type: number): number {
    if (type === 4) return obj.flags;
    if (type === 5) return obj.uid;
    if (type === 6) return obj.level;
    if (type < 8) return 0;
    const idx = this.s.ptr.indexOf(obj.uid);
    const u = idx >= 0 ? this.presentAt(idx) : undefined;
    return u ? getMember(this.s, u, type) : 0;
  }

  /** The battle index a member access resolves to (EventEngine.GetBattleCharData's lookup of gMemberTarget). */
  private memberIndex(): number {
    const i = this.memberTarget;
    if (i >= 0 && this.s.ptr[i]! >= 0 && this.objAt(i)) return i;
    // A missing object resolves to the first empty slot of the object table, like FF9.
    return this.s.ptr.findIndex((uid) => uid < 0 || !this.s.objs.some((x) => x.uid === uid));
  }

  private memberGet(kind: number): number {
    const i = this.memberIndex();
    if (i < 0) return 0;
    const obj = this.objAt(i);
    if (obj && kind < 8) return this.objField(obj, kind);
    const u = this.presentAt(i);
    return u ? getMember(this.s, u, kind) : 0;
  }

  private memberSet(kind: number, v: number) {
    // EventEngine.putvobj: nothing happens without an object.
    const i = this.memberTarget;
    if (i < 0 || !this.objAt(i) || kind === 2) return;
    const u = kind === 32 ? unitAtIndex(this.eng, i) : this.presentAt(i);
    if (u) setMember(this.eng, this.s, u, kind, v);
  }

  // ── byte access ──────────────────────────────────────────────────────────
  private byte(i: number): number {
    return this.data[i] ?? 0;
  }

  private u16(i: number): number {
    return this.byte(i) | (this.byte(i + 1) << 8);
  }

  private s16(i: number): number {
    return (this.u16(i) << 16) >> 16;
  }

  private geti(): number {
    return this.byte(this.o.ip++);
  }

  private getv1(): number {
    let v: number;
    if (this.argFlag & 1) {
      this.calcExpr();
      v = this.getv();
    } else v = this.geti();
    this.argFlag >>= 1;
    this.argUsed = 1;
    return v;
  }

  private getv2(): number {
    let v: number;
    if (this.argFlag & 1) {
      this.calcExpr();
      v = this.getv();
    } else v = ((this.geti() | (this.geti() << 8)) << 16) >> 16;
    this.argFlag >>= 1;
    this.argUsed = 1;
    return v;
  }

  private warn(code: number, msg: string) {
    if (this.s.unsupported.includes(code)) return;
    this.s.unsupported.push(code);
    if (typeof console !== "undefined") console.warn(`[battle-ai ${this.s.scene}] ${msg}`);
  }
}

/** Does the script ever run RunBattleCode(35) (Enable ATB)? */
function enablesAtb(script: EbScript): boolean {
  for (const { ins } of instructions(script)) if (ins.op === 0x4a && (ins.args[0]?.kind === "expr" || ins.args[0]?.value === 35)) return true;
  return false;
}

/** FF9 command id (BattleCommandId) / sub id of a command, as reaction scripts see it. */
export function commandIds(eng: BattleEngine, actor: BattleUnit, cmd: BattleCommand, source: CommandSource, sceneAttacks?: number[]): [number, number] {
  if (actor.side === "enemy") {
    const slot = cmd.actionId != null && sceneAttacks ? sceneAttacks.indexOf(cmd.actionId - FF9_ACTION_BASE) : -1;
    const id = source === "counter" ? CMD.enemyCounter : source === "dying" ? CMD.enemyDying : CMD.enemyAtk;
    return [id, slot >= 0 ? slot : 0];
  }
  switch (cmd.kind) {
    case "attack":
      return [source === "counter" ? CMD.counter : CMD.attack, 176];
    case "item":
      return [source === "autoPotion" ? CMD.autoPotion : CMD.item, cmd.itemId ?? 0];
    case "throw":
      return [CMD.throw, cmd.itemId ?? 0];
    default: {
      if (source === "magicCounter") return [CMD.magicCounter, cmd.actionId ?? 0];
      if (source === "spear") return [10, cmd.actionId ?? 0];
      const c = eng.commandOf(actor, cmd.actionId ?? -1);
      return [c?.id ?? 0, cmd.actionId ?? 0];
    }
  }
}
