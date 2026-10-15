/**
 * Battle units as FF9 battle scripts see them (Memoria btl_scrp.GetCharacterData / SetCharacterData,
 * GetBattleID): btl_id bits (party slot i → 1 << i, enemy slot j → 1 << (4 + j)), HP with the +10,000 boss buffer,
 * status / element bit sets, and the handful of model/targeting properties scripts poke.
 */
import { ELEMENTS, STATUSES, type Element, type Status } from "@ffix-roguelike/game-data";

import type { BattleEngine } from "../engine";
import type { BattleUnit } from "../types";
import type { AiState } from "./vm";

/** Dead enemies stay in FF9's battle list while their death animation plays (Death functions still run). */
export const DIE_SEQUENCE_TICKS = 15;

/** FF9 character serial numbers (MODEL_TYPE), by our character key. */
const SERIAL: Record<string, number> = {
  zidane: 0, vivi: 2, garnet: 3, dagger: 3, steiner: 7, quina: 9, eiko: 10, freya: 12, amarant: 13, cinna: 14, marcus: 15, blank: 16, beatrix: 18,
};

/** Memoria CharacterId by character key (for party entries' player_link). */
export const CHARACTER_ID: Record<string, number> = {
  zidane: 0, vivi: 1, garnet: 2, dagger: 2, steiner: 3, freya: 4, quina: 5, eiko: 6, amarant: 7, cinna: 8, marcus: 9, blank: 10, beatrix: 11,
};

/** FF9 battle index (0–3 party, 4–7 enemies) of a unit. */
export function btlIndex(u: BattleUnit): number {
  const n = Number(u.id.slice(1));
  return u.side === "party" ? n : 4 + (u.ff9Slot ?? n);
}

export function unitAtIndex(engine: BattleEngine, index: number): BattleUnit | undefined {
  return engine.state.units.find((u) => btlIndex(u) === index && (u.side === "party") === index < 4);
}

/** In FF9's battle list (btl_scrp.FindBattleUnit / GetBattleID). */
export function inBattleList(engine: BattleEngine, u: BattleUnit): boolean {
  if (u.removed) return false;
  if (u.side === "party" || engine.isAlive(u) || u.ff9Dying) return true;
  const ai = engine.state.ai;
  const at = ai?.deadAt[u.id];
  return at != null && engine.state.tick - at < DIE_SEQUENCE_TICKS;
}

/** btl_scrp.GetBattleID: 0 = party, 1 = enemies, 2 = everyone. */
export function battleIds(engine: BattleEngine, list: number): number {
  let bits = 0;
  for (const u of engine.state.units) {
    if (!inBattleList(engine, u)) continue;
    if (list === 0 && u.side !== "party") continue;
    if (list === 1 && u.side !== "enemy") continue;
    const i = btlIndex(u);
    if (i >= 0 && i < 8) bits |= 1 << i;
  }
  return bits;
}

export function unitsFromBits(engine: BattleEngine, bits: number): BattleUnit[] {
  const out: BattleUnit[] = [];
  for (let i = 0; i < 8; i++) {
    if (!(bits & (1 << i))) continue;
    const u = unitAtIndex(engine, i);
    if (u && inBattleList(engine, u)) out.push(u);
  }
  return out;
}

export function bitOf(u: BattleUnit): number {
  return 1 << btlIndex(u);
}

function statusBits(list: Iterable<Status>): number {
  let bits = 0;
  for (const s of list) {
    const i = STATUSES.indexOf(s);
    if (i >= 0) bits |= 2 ** i;
  }
  return bits;
}

const statusSet = (u: BattleUnit) => statusBits(Object.keys(u.statuses) as Status[]);

function elementBits(list: readonly Element[]): number {
  let bits = 0;
  for (const e of list) bits |= 1 << ELEMENTS.indexOf(e);
  return bits;
}

const elementsOf = (bits: number): Element[] => ELEMENTS.filter((_, i) => bits & (1 << i));

/** Split a 32-bit status set into A (low 24 bits) / B (high 8 bits) halves as the scripts see them. */
const lowA = (bits: number) => bits % 0x1000000;
const highB = (bits: number) => Math.floor(bits / 0x1000000) & 0xffffff;

function hpBuffer(ai: AiState, u: BattleUnit): number {
  return ai.hpBuf[btlIndex(u)] ?? 0;
}

/** btl_scrp.GetCharacterData. */
export function getMember(ai: AiState, u: BattleUnit, kind: number): number {
  const buf = hpBuffer(ai, u);
  switch (kind) {
    case 35:
      return u.maxHp + buf;
    case 36:
      return u.ff9Dying ? Math.max(0, buf - 1) : u.hp + buf;
    case 37:
      return u.maxMp;
    case 38:
      return u.mp;
    case 39:
      return u.atbMax;
    case 40:
      return u.atb;
    case 41:
      return u.level;
    case 42:
      return highB(statusBits(u.statusImmune));
    case 43:
      return lowA(statusBits(u.statusImmune));
    case 44:
      return highB(statusBits(u.permanent));
    case 45:
      return lowA(statusBits(u.permanent));
    case 46:
      return highB(statusSet(u));
    case 47:
      return lowA(statusSet(u));
    case 48:
      return elementBits(u.elements.immune);
    case 49:
      return elementBits(u.elements.absorb);
    case 50:
      return elementBits(u.elements.half);
    case 51:
      return elementBits(u.elements.weak);
    case 52:
      return u.untargetable ? 0 : 1;
    case 53:
      return u.hidden ? 1 : 0;
    case 57: // MODEL: the monster's model; same-type enemies share it
      return u.side === "enemy" ? 1000 + (u.ff9Type ?? 0) : 0;
    case 64:
      return u.backRow ? 0 : 1;
    case 65:
      return btlIndex(u) & 3;
    case 66:
      return SERIAL[u.key] ?? 255;
    case 67:
      return u.playerCategory;
    case 68:
    case 113:
      return u.side === "enemy" ? u.enemyCategory : 1;
    case 69: // STAND_ANIMATION (bi.def_idle): starts at 0; scripts and attack sequences switch it
      return ai.mem[`${btlIndex(u)}:69`] ?? 0;
    case 70:
      return u.side === "enemy" ? (u.ff9Type ?? 0) : 0;
    case 72:
      return u.strength;
    case 73:
      return u.magic;
    case 74:
      return u.defence;
    case 75:
      return u.evade;
    case 76:
      return u.magicDefence;
    case 77:
      return u.magicEvade;
    case 110:
      return 0;
    case 148:
      return u.trance;
  }
  return ai.mem[`${btlIndex(u)}:${kind}`] ?? (kind === 109 || kind === 112 ? 0 : 16777215);
}

/** btl_scrp.SetCharacterData. */
export function setMember(engine: BattleEngine, ai: AiState, u: BattleUnit, kind: number, val: number) {
  const idx = btlIndex(u);
  switch (kind) {
    case 32: // SHOW (btl_sys.AddCharacter)
      u.removed = false;
      u.hidden = false;
      return;
    case 33: // HIDE (btl_sys.DelCharacter)
      engine.killStandardCommands(u);
      u.removed = true;
      return;
    case 34:
      engine.killStandardCommands(u);
      return;
    case 35: {
      const buf = ai.hpBuf[idx] ?? 0;
      if (buf > 0 && val >= buf) u.maxHp = Math.max(1, val - buf);
      else {
        ai.hpBuf[idx] = 0;
        u.maxHp = Math.max(1, val);
      }
      return;
    }
    case 36: {
      const buf = ai.hpBuf[idx] ?? 0;
      let hp: number;
      if (buf > 0 && val >= buf) hp = val - buf;
      else {
        ai.hpBuf[idx] = 0;
        hp = val;
      }
      if (u.ff9Dying && hp > 0) {
        u.ff9Dying = false;
        delete ai.dying[u.id];
      }
      if (hp <= 0 && (ai.hpBuf[idx] ?? 0) > 0) {
        u.hp = 1;
        engine.killUnit(u); // held as "dying" by the AI
        return;
      }
      u.hp = Math.max(0, hp);
      if (u.hp === 0) engine.killUnit(u);
      return;
    }
    case 37:
      u.maxMp = Math.max(0, val);
      return;
    case 38:
      u.mp = Math.max(0, val);
      return;
    case 40:
      u.atb = val;
      return;
    case 42:
    case 43: {
      const bits = statusBits(u.statusImmune);
      const next = kind === 43 ? bits - lowA(bits) + (val & 0xffffff) : lowA(bits) + (val & 0xffffff) * 0x1000000;
      u.statusImmune = STATUSES.filter((_, i) => Math.floor(next / 2 ** i) % 2 === 1);
      return;
    }
    case 44:
    case 45: {
      const shift = kind === 45 ? 0 : 24;
      const width = kind === 45 ? 24 : 8;
      for (let i = 0; i < width && shift + i < 32; i++) {
        const s = STATUSES[shift + i]!;
        const want = (val >> i) & 1;
        if (want && !u.permanent.includes(s)) engine.makePermanent(u, s);
        else if (!want && u.permanent.includes(s)) {
          u.permanent = u.permanent.filter((x) => x !== s);
          engine.removeStatus(u, s);
        }
      }
      return;
    }
    case 46:
    case 47: {
      const shift = kind === 47 ? 0 : 24;
      const width = kind === 47 ? 24 : 8;
      for (let i = 0; i < width && shift + i < 32; i++) {
        const s = STATUSES[shift + i]!;
        const want = (val >> i) & 1;
        const has = u.statuses[s] !== undefined;
        if (want && !has) engine.alterStatus(u, s);
        else if (!want && has) engine.removeStatus(u, s);
      }
      return;
    }
    case 48:
      u.elements = { ...u.elements, immune: elementsOf(val) };
      return;
    case 49:
      u.elements = { ...u.elements, absorb: elementsOf(val) };
      return;
    case 50:
      u.elements = { ...u.elements, half: elementsOf(val) };
      return;
    case 51:
      u.elements = { ...u.elements, weak: elementsOf(val) };
      return;
    case 52:
      // During the battle intro (PHASE_ENTER) this also takes the unit out of the ATB loop.
      if (ai.phase === 2) {
        u.untargetable = true;
        u.noAtb = true;
      } else u.untargetable = val === 0;
      return;
    case 53:
      u.hidden = val !== 0;
      return;
    case 72:
      u.strength = val & 0xff;
      return;
    case 73:
      u.magic = val & 0xff;
      return;
    case 74:
      u.defence = val;
      return;
    case 75:
      u.evade = val;
      return;
    case 76:
      u.magicDefence = val;
      return;
    case 77:
      u.magicEvade = val;
      return;
    case 148:
      u.trance = Math.max(0, Math.min(255, val));
      return;
  }
  // Cosmetic / bookkeeping members (model scale, meshes, texture animations, idle pose, rewards…): remembered so
  // scripts that read them back see their own writes.
  ai.mem[`${idx}:${kind}`] = val;
}
