/**
 * FF9 event-script (.eb) parser and disassembler (Memoria EventEngineUtils.SetupEventData / BinaryScript, EBin).
 *
 * File layout: "EV", version, entry count, 124 bytes of padding (PSX name) → 128; then 8 bytes per entry
 * (offset u16, size u16, local var bytes u8, flags u8, pad u16); entry data at 128 + offset. Entry data: type u8,
 * function count u8, then (tag u16, offset u16) pairs; a function's ip (relative to the entry data) is 2 + offset.
 */
import { OPCODES } from "./opcodes";

export interface EbFunction {
  tag: number;
  /** Start ip, relative to the entry's data. */
  ip: number;
  /** End ip (exclusive): the next function's start or the entry's end. */
  end: number;
}

export interface EbEntry {
  index: number;
  /** Local (instance) variable bytes. */
  varn: number;
  flags: number;
  /** 0 = code, 1 = region, 2 = object/actor; 0xFF = empty entry. */
  type: number;
  data: Uint8Array;
  functions: EbFunction[];
}

export interface EbScript {
  entries: EbEntry[];
}

export const EB_HEADER = 128;

export function parseScript(bytes: Uint8Array): EbScript {
  if (bytes[0] !== 0x45 || bytes[1] !== 0x56) throw new Error("Not an FF9 event script (missing \"EV\")");
  const count = bytes[3]!;
  const entries: EbEntry[] = [];
  for (let i = 0; i < count; i++) {
    const p = EB_HEADER + i * 8;
    const ofs = bytes[p]! | (bytes[p + 1]! << 8);
    const size = bytes[p + 2]! | (bytes[p + 3]! << 8);
    const data = bytes.subarray(EB_HEADER + ofs, EB_HEADER + ofs + size);
    const entry: EbEntry = { index: i, varn: bytes[p + 4]!, flags: bytes[p + 5]!, type: 0xff, data, functions: [] };
    if (data.length >= 2) {
      entry.type = data[0]!;
      const n = data[1]!;
      const starts: { tag: number; ip: number }[] = [];
      for (let f = 0; f < n; f++) {
        const q = 2 + f * 4;
        starts.push({ tag: data[q]! | (data[q + 1]! << 8), ip: 2 + (data[q + 2]! | (data[q + 3]! << 8)) });
      }
      entry.functions = starts.map((s, f) => ({ ...s, end: f + 1 < starts.length ? starts[f + 1]!.ip : data.length }));
    }
    entries.push(entry);
  }
  return { entries };
}

/** Function tags (EventEngine.tagXxx; Hades Workshop names). */
export const TAG_NAMES: Record<number, string> = {
  0: "Init",
  1: "Loop",
  2: "Range",
  3: "SpeakBTN",
  4: "Refresh",
  5: "ATB",
  6: "Counter",
  7: "CounterEx",
  8: "Card",
  9: "Death",
  10: "BattleEnd",
};

// ── expressions ──────────────────────────────────────────────────────────────

/** Expression operator names (EBin.op_binary). */
export const OP_BINARY: Record<number, string> = {
  4: "POST_PLUS", 5: "POST_MINUS", 6: "PRE_PLUS", 7: "PRE_MINUS", 8: "POST_PLUS_A", 9: "POST_MINUS_A", 10: "PRE_PLUS_A", 11: "PRE_MINUS_A",
  12: "SINGLE_PLUS", 13: "SINGLE_MINUS", 14: "NOT", 15: "NOT_E", 16: "COMP", 17: "MULT", 18: "DIV", 19: "REM", 20: "PLUS", 21: "MINUS",
  22: "SHIFT_LEFT", 23: "SHIFT_RIGHT", 24: "LT", 25: "GT", 26: "LE", 27: "GE", 28: "LT_E", 29: "GT_E", 30: "LE_E", 31: "GE_E",
  32: "EQ", 33: "NE", 34: "EQ_E", 35: "NE_E", 36: "AND", 37: "XOR", 38: "OR", 39: "ANDAND", 40: "OROR", 41: "MEMBER", 42: "COUNT",
  43: "PICK", 44: "LET", 45: "LET_A", 46: "LET_E", 47: "MULT_LET", 48: "DIV_LET", 49: "REM_LET", 50: "PLUS_LET", 51: "MINUS_LET",
  52: "SHIFT_LEFT_LET", 53: "SHIFT_RIGHT_LET", 54: "MULT_LET_A", 55: "DIV_LET_A", 56: "REM_LET_A", 57: "PLUS_LET_A", 58: "MINUS_LET_A",
  59: "SHIFT_LEFT_LET_A", 60: "SHIFT_RIGHT_LET_A", 61: "AND_LET", 62: "XOR_LET", 63: "OR_LET", 64: "AND_LET_A", 65: "XOR_LET_A",
  66: "OR_LET_A", 67: "AND_LET_E", 68: "XOR_LET_E", 69: "OR_LET_E", 70: "CAST8", 71: "CAST8U", 72: "CAST16", 73: "CAST16U",
  74: "CAST_LIST", 75: "LMAX", 76: "LMIN", 77: "SELECT", 78: "OBJSPEC", 79: "KEYON", 80: "SIN2", 81: "COS2", 82: "CURHP", 83: "MAXHP",
  84: "AND_E", 85: "NAND_E", 86: "XOR_E", 87: "OR_E", 88: "KEYOFF", 89: "KEY", 90: "KEYON2", 91: "KEYOFF2", 92: "KEY2", 93: "ANGLE",
  94: "DISTANCE", 95: "PTR", 96: "ANGLEA", 97: "DISTANCEA", 98: "SIN", 99: "COS", 100: "HAVE_ITEM", 101: "BAFRAME", 102: "ANGLE2",
  106: "FRAME", 107: "PARTYCHK", 108: "SPS", 109: "PARTYADD", 110: "CURMP", 111: "MAXMP", 112: "BGIID", 113: "BGIFLOOR",
  120: "OBJSPECA", 121: "SYSLIST", 122: "SYSVAR", 125: "CONST", 126: "CONST4", 127: "END",
};

const INFIX: Record<number, string> = {
  17: "*", 18: "/", 19: "%", 20: "+", 21: "-", 22: "<<", 23: ">>", 24: "<", 25: ">", 26: "<=", 27: ">=", 32: "==", 33: "!=", 36: "&",
  37: "^", 38: "|", 39: "&&", 40: "||", 44: "=", 47: "*=", 48: "/=", 49: "%=", 50: "+=", 51: "-=", 52: "<<=", 53: ">>=", 61: "&=",
  62: "^=", 63: "|=", 28: "<$", 29: ">$", 30: "<=$", 31: ">=$", 34: "==$", 35: "!=$", 84: "&$", 85: "!&$", 86: "^$", 87: "|$",
  45: "=$", 54: "*=$", 55: "/=$", 56: "%=$", 57: "+=$", 58: "-=$", 59: "<<=$", 60: ">>=$", 64: "&=$", 65: "^=$", 66: "|=$",
  67: "&=E", 68: "^=E", 69: "|=E", 46: "=E",
};
const PREFIX: Record<number, string> = { 6: "++", 7: "--", 12: "+", 13: "-", 14: "!", 16: "~", 10: "++$", 11: "--$", 15: "!$" };
const POSTFIX: Record<number, string> = { 4: "++", 5: "--", 8: "++$", 9: "--$" };
const FUNC1: Record<number, string> = {
  42: "count", 77: "random_bit", 75: "max_of", 76: "min_of", 79: "keyon", 80: "sin2", 81: "cos2", 88: "keyoff", 89: "key", 98: "sin", 99: "cos",
  107: "partychk", 109: "partyadd", 100: "have_item", 82: "curhp", 83: "maxhp", 110: "curmp", 111: "maxmp", 70: "cast8", 71: "cast8u",
  72: "cast16", 73: "cast16u", 74: "cast_list", 96: "angle_to", 97: "distance_to", 106: "frame", 101: "baframe", 112: "bgiid", 113: "bgifloor",
  90: "keyon2", 91: "keyoff2", 92: "key2",
};
const FUNC2: Record<number, string> = { 93: "angle", 94: "distance", 102: "angle2", 108: "sps" };

/** Variable classes (EBin.VariableSource) and types (EBin.VariableType). */
const VAR_CLASS = ["G", "M", "L", "N"];
const VAR_TYPE = ["SBit", "Bit", "Int24", "UInt24", "SByte", "Byte", "Int16", "UInt16"];

/** btl_scrp.GetCharacterData / SetCharacterData member names (SV_x[...] in Hades Workshop). */
export const MEMBER_NAMES: Record<number, string> = {
  0: "POS_X", 1: "POS_Y", 2: "POS_Z", 3: "ROT", 4: "FLAGS", 5: "UID", 6: "LEVEL_EV", 7: "ANIM_FRAME",
  32: "SHOW", 33: "HIDE", 34: "KILL_COMMANDS", 35: "MAX_HP", 36: "HP", 37: "MAX_MP", 38: "MP", 39: "MAX_ATB", 40: "ATB", 41: "LEVEL",
  42: "STATUS_IMMUNE_B", 43: "STATUS_IMMUNE_A", 44: "STATUS_AUTO_B", 45: "STATUS_AUTO_A", 46: "STATUS_CURRENT_B", 47: "STATUS_CURRENT_A",
  48: "ELEMENT_IMMUNE", 49: "ELEMENT_ABSORB", 50: "ELEMENT_HALF", 51: "ELEMENT_WEAK", 52: "TARGETABLE", 53: "DISAPPEAR", 54: "SHADOW",
  55: "MODEL_SCALE", 56: "MODEL_SCALE_RESET", 57: "MODEL", 58: "MODEL_VISIBLE", 59: "MESH_HIDE", 60: "MESH_SHOW", 61: "TEXANIM_PLAY",
  62: "TEXANIM_STOP", 63: "TEXANIM_ONCE", 64: "ROW", 65: "COLUMN", 66: "MODEL_TYPE", 67: "CATEGORY", 68: "CLASS", 69: "STAND_ANIMATION",
  70: "ENEMY_ID", 71: "BONUS", 72: "STRENGTH", 73: "MAGIC", 74: "DEFENCE", 75: "EVADE", 76: "MAGICAL_DEFENCE", 77: "MAGICAL_EVADE",
  78: "TERRA_HOMING",
};

/** GetSysList names (SV_x). */
export const SYSLIST_NAMES = ["SV_Target", "SV_FunctionEnemy", "SV_PlayerTeam", "SV_EnemyTeam", "SV_AllTeams", "SV_5", "SV_6", "SV_7"];

/** GetSysvar / GetBattleData names. */
export const SYSVAR_NAMES: Record<number, string> = {
  0: "GetRandom", 24: "GetLastBattleId", 25: "IsAttacking", 26: "IsBattleResult", 27: "GetBattleResult", 28: "GetAttackCommandId",
  29: "GetAttackId", 30: "GetBattleState", 31: "GetBattleGroupId", 32: "BattleStartType", 33: "Gil", 34: "BattlePhase", 35: "BattleSeq",
  36: "AttackerId", 37: "AttackTargets", 38: "AttackerWeaponElements", 39: "AttackElements", 40: "BattleLoadStatus", 41: "BonusExp",
  42: "EikoLastPhoenix", 43: "EffectCounter", 44: "BonusAp",
};

export interface ExprOp {
  op: number;
  /** Raw operand bytes value (const / var index / member / sysvar…). */
  arg?: number;
  arg2?: number;
}

/** Decode one expression starting at `ip`. Returns ops (ending with END) and the ip after it. */
export function decodeExpr(data: Uint8Array, ip: number): { ops: ExprOp[]; next: number } {
  const ops: ExprOp[] = [];
  for (;;) {
    if (ip >= data.length) throw new Error(`Expression runs past the end (ip ${ip})`);
    const op = data[ip++]!;
    if (op >= 0x80) {
      if (op === 0xd3) throw new Error("Memoria custom expression function (0xD3) not supported");
      let idx = data[ip++]!;
      if (op & 0x20) idx |= data[ip++]! << 8;
      ops.push({ op, arg: idx });
      continue;
    }
    switch (op) {
      case 0x29: // MEMBER
      case 0x5f: // PTR
      case 0x79: // SYSLIST
      case 0x7a: // SYSVAR
        ops.push({ op, arg: data[ip++]! });
        break;
      case 0x78: // OBJSPECA: uid, member
        ops.push({ op, arg: data[ip]!, arg2: data[ip + 1]! });
        ip += 2;
        break;
      case 0x7d: {
        const v = data[ip]! | (data[ip + 1]! << 8);
        ops.push({ op, arg: (v << 16) >> 16 });
        ip += 2;
        break;
      }
      case 0x7e: {
        const v = data[ip]! | (data[ip + 1]! << 8) | (data[ip + 2]! << 16) | (data[ip + 3]! << 24);
        ops.push({ op, arg: (v << 6) >> 6 });
        ip += 4;
        break;
      }
      default:
        ops.push({ op });
    }
    if (op === 0x7f) return { ops, next: ip };
  }
}

export function varName(op: number, idx: number): string {
  return `${VAR_CLASS[op & 3]}_${VAR_TYPE[(op >> 2) & 7]}${idx}`;
}

/** Render an expression as infix text (falls back to RPN if the stack shape is unusual). */
export function exprText(ops: ExprOp[]): string {
  const st: string[] = [];
  try {
    for (const o of ops) {
      const { op } = o;
      if (op >= 0x80) st.push(varName(op, o.arg!));
      else if (op === 0x7d || op === 0x7e) st.push(String(o.arg));
      else if (op === 0x79) st.push(SYSLIST_NAMES[o.arg! & 7]!);
      else if (op === 0x7a) st.push(SYSVAR_NAMES[o.arg!] ?? `SYSVAR_${o.arg}`);
      else if (op === 0x5f) st.push(`ptr(${o.arg})`);
      else if (op === 0x78) st.push(`obj${o.arg}.${MEMBER_NAMES[o.arg2!] ?? o.arg2}`);
      else if (op === 0x29) {
        const list = pop(st);
        st.push(`${list}[${MEMBER_NAMES[o.arg!] ?? o.arg}]`);
      } else if (op === 0x2b) {
        // PICK: list[member] → value of first unit in list
        const m = pop(st);
        st.push(`first(${m})`);
      } else if (op === 0x7f) break;
      else if (INFIX[op]) {
        const b = pop(st);
        const a = pop(st);
        st.push(`(${a} ${INFIX[op]} ${b})`);
      } else if (PREFIX[op]) st.push(`${PREFIX[op]}${pop(st)}`);
      else if (POSTFIX[op]) st.push(`${pop(st)}${POSTFIX[op]}`);
      else if (FUNC1[op]) st.push(`${FUNC1[op]}(${pop(st)})`);
      else if (FUNC2[op]) {
        const b = pop(st);
        st.push(`${FUNC2[op]}(${pop(st)}, ${b})`);
      } else st.push(`<${OP_BINARY[op] ?? op}>`);
    }
  } catch {
    return ops.map((o) => (o.op >= 0x80 ? varName(o.op, o.arg!) : `${OP_BINARY[o.op] ?? o.op}${o.arg != null ? ":" + o.arg : ""}`)).join(" ");
  }
  const s = st.join(" ; ");
  return s.startsWith("(") && s.endsWith(")") && st.length === 1 ? s.slice(1, -1) : s;
}

function pop(st: string[]): string {
  const v = st.pop();
  if (v === undefined) throw new Error("underflow");
  return v;
}

// ── instructions ─────────────────────────────────────────────────────────────

export type Arg = { kind: "const"; value: number; size: number } | { kind: "expr"; ops: ExprOp[] };

export interface Instr {
  ip: number;
  op: number;
  args: Arg[];
  next: number;
}

/** Decode one instruction (mirrors BinaryScript.Code / DoEventCode argument reading). */
export function decodeInstr(data: Uint8Array, ip: number): Instr {
  const start = ip;
  let op = data[ip++]!;
  if (op === 0xff) op = 0x100 | data[ip++]!;
  const info = OPCODES[op];
  let argCount = info ? info[2] : 0;
  let argFlag = 0;
  if (op >= 0x10 && argCount !== 0) argFlag = data[ip++]!;
  if (op === 0x05) argFlag = 1;
  if (argCount < 0) {
    argCount = data[ip++]!;
    if (op === 0x0d) argCount |= data[ip++]! << 8;
    if (op === 0x06) argCount = 1 + 2 * argCount;
    else if (op === 0x0b || op === 0x0d) argCount = 2 + argCount;
  }
  const args: Arg[] = [];
  for (let i = 0; i < argCount; i++) {
    if (i < 8 && argFlag & (1 << i)) {
      const e = decodeExpr(data, ip);
      args.push({ kind: "expr", ops: e.ops });
      ip = e.next;
    } else {
      const size = op === 0x29 ? 4 : op === 0x06 || op === 0x0b || op === 0x0d ? 2 : (info?.[3]?.[i] ?? 0);
      let v = 0;
      for (let b = 0; b < size; b++) v |= data[ip + b]! << (8 * b);
      ip += size;
      args.push({ kind: "const", value: v >>> 0, size });
    }
  }
  if (ip > data.length) throw new Error(`Instruction at ${start} runs past the end`);
  return { ip: start, op, args, next: ip };
}

export function opName(op: number): string {
  const info = OPCODES[op];
  if (!info) return `op_${op.toString(16)}`;
  return info[1] || info[0];
}

function argText(a: Arg): string {
  return a.kind === "const" ? String(a.value) : `[${exprText(a.ops)}]`;
}

const cval = (a: Arg | undefined) => (a?.kind === "const" ? a.value : 0);
const s16 = (a: Arg | undefined) => (cval(a) << 16) >> 16;

function instrText(ins: Instr): string {
  const name = opName(ins.op);
  const a = ins.args;
  switch (ins.op) {
    case 0x01:
      return `JMP ${ins.next + (s16(a[0]))}`;
    case 0x02:
      return `JMP_IFN ${ins.next + cval(a[0])}`;
    case 0x03:
      return `JMP_IF ${ins.next + s16(a[0])}`;
    case 0x05:
      return `set ${argText(a[0]!)}`;
    case 0x06: {
      // [count][default][(value, offset)*]: targets relative to ip(count byte) + 3
      const base = ins.ip + 1 + 3;
      const v = a.map((x) => (x.kind === "const" ? x.value : 0));
      const cases: string[] = [];
      for (let i = 1; i + 1 < v.length; i += 2) cases.push(`${(v[i]! << 16) >> 16}→${base + v[i + 1]!}`);
      return `SWITCHEX default→${base + v[0]!} ${cases.join(" ")}`;
    }
    case 0x0b:
    case 0x0d: {
      const countIp = ins.ip + (ins.op === 0x0d ? 2 : 1);
      const v = a.map((x) => (x.kind === "const" ? x.value : 0));
      const baseVal = (v[0]! << 16) >> 16;
      const cases = v.slice(2).map((off, i) => `${baseVal + i}→${countIp + off}`);
      return `SWITCH default→${countIp + v[1]!} ${cases.join(" ")}`;
    }
  }
  return `${name}(${a.map(argText).join(", ")})`;
}

/** Disassemble a whole script to readable text. */
export function disassemble(bytes: Uint8Array, title = ""): string {
  const script = parseScript(bytes);
  const out: string[] = [];
  if (title) out.push(`# ${title}`);
  for (const e of script.entries) {
    out.push(`\nentry ${e.index} type=${e.type} vars=${e.varn} flags=${e.flags}`);
    for (const f of e.functions) {
      out.push(`  function ${TAG_NAMES[f.tag] ?? "tag" + f.tag} (tag ${f.tag}) @${f.ip}`);
      let ip = f.ip;
      while (ip < f.end) {
        let ins: Instr;
        try {
          ins = decodeInstr(e.data, ip);
        } catch (err) {
          out.push(`    ${ip}: <decode error: ${(err as Error).message}>`);
          break;
        }
        out.push(`    ${ip}: ${instrText(ins)}`);
        ip = ins.next;
      }
    }
  }
  return out.join("\n");
}

/** Walk every instruction of every function (for usage reports and tests). */
export function* instructions(script: EbScript): Generator<{ entry: EbEntry; fn: EbFunction; ins: Instr }> {
  for (const entry of script.entries)
    for (const fn of entry.functions) {
      let ip = fn.ip;
      while (ip < fn.end) {
        const ins = decodeInstr(entry.data, ip);
        yield { entry, fn, ins };
        ip = ins.next;
      }
    }
}
