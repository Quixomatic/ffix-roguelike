/** Build battle units from character builds (party) and bestiary entries (enemies). */
import { getAction, getCharacter, type Status } from "@ffix-roguelike/game-data";

import { baseStats, enemyItemId, getEnemy, type EnemyDef } from "../content/enemies";
import { ff9 } from "../content/enemy-actions";
import { activeSupports, availableActions, deriveStats, type CharacterBuild } from "../stats";
import { supportImmunities } from "./effects";
import type { BattleUnit, CommandDef } from "./types";

/** HP/MP and lasting statuses a party member carries between battles. */
export interface Vitals {
  hp: number;
  mp: number;
  statuses?: Status[];
}

export function partyUnit(build: CharacterBuild, slot: number, vitals?: Vitals): BattleUnit {
  const data = getCharacter(build.key);
  const st = deriveStats(build);
  const supports = [...activeSupports(build)];
  const known = new Set(availableActions(build));
  // Command lists only show abilities the character can currently use (mastered or on equipped gear).
  const filter = (cmds: typeof data.commands): CommandDef[] =>
    cmds
      .filter((c) => c.id !== 0)
      .map((c) => ({
        name: c.name,
        // Single-ability commands like Steal / Eat / Jump are innate; ability lists are filtered.
        actionIds: c.actionIds.length === 1 ? c.actionIds : c.actionIds.filter((id) => known.has(id)),
      }));
  const statuses: BattleUnit["statuses"] = {};
  for (const s of vitals?.statuses ?? []) statuses[s] = { remaining: null, nextTick: 0 };
  return {
    id: `p${slot}`,
    side: "party",
    key: build.key,
    name: data.name,
    sprite: `hero/${build.key}`,
    level: st.level,
    hp: Math.min(st.maxHp, vitals?.hp ?? st.maxHp),
    maxHp: st.maxHp,
    mp: Math.min(st.maxMp, vitals?.mp ?? st.maxMp),
    maxMp: st.maxMp,
    speed: st.speed,
    strength: st.strength,
    magic: st.magic,
    spirit: st.spirit,
    attack: st.attack,
    defence: st.defence,
    evade: st.evade,
    magicDefence: st.magicDefence,
    magicEvade: st.magicEvade,
    weapon: st.weapon,
    attackElements: st.attackElements,
    elements: st.elements,
    statusImmune: supportImmunities(supports),
    statuses,
    atb: 0,
    trance: 0,
    backRow: build.backRow,
    supports,
    turns: 0,
    commands: filter(data.commands),
    tranceCommands: filter(data.trance),
  };
}

const STEAL_ODDS = [256, 64, 16, 1];

export function enemyUnit(def: EnemyDef, slot: number, tier = 0): BattleUnit {
  const b = baseStats(def.level, tier);
  const m = (k: keyof NonNullable<EnemyDef["mult"]>) => def.mult?.[k] ?? 1;
  const hp = Math.round(b.hp * m("hp"));
  const mp = Math.round(b.mp * m("mp"));
  return {
    id: `e${slot}`,
    side: "enemy",
    key: def.id,
    name: def.name,
    sprite: def.sprite,
    level: def.level,
    hp,
    maxHp: hp,
    mp,
    maxMp: mp,
    speed: Math.round(b.speed * m("spd")),
    strength: Math.round(b.strength * m("str")),
    magic: Math.round(b.magic * m("mag")),
    spirit: b.spirit,
    attack: Math.round(b.attack * m("atk")),
    defence: Math.round(b.defence * m("def")),
    evade: Math.min(90, Math.round(b.evade * m("eva"))),
    magicDefence: Math.round(b.magicDefence * m("mdef")),
    magicEvade: Math.min(90, Math.round(b.magicEvade * m("meva"))),
    weapon: null,
    attackElements: [],
    elements: { weak: def.weak ?? [], half: def.half ?? [], immune: def.immune ?? [], absorb: def.absorb ?? [] },
    statusImmune: def.statusImmune ?? [],
    statuses: {},
    atb: 0,
    trance: 0,
    backRow: false,
    supports: [],
    turns: 0,
    commands: [],
    tranceCommands: [],
    family: def.family,
    ai: def.ai,
    usedOnce: [],
    steal: (def.steal ?? []).map((name, i) => ({ itemId: enemyItemId(name), chance: STEAL_ODDS[i] ?? 1 })),
    boss: def.boss,
    eatTeaches: def.eatTeaches ? ff9(def.eatTeaches) : undefined,
  };
}

export function enemyGroup(ids: string[], tier = 0): BattleUnit[] {
  return ids.map((id, i) => enemyUnit(getEnemy(id), i, tier));
}

/** Display name for any action id (FF9 or enemy-only). */
export function actionLabel(id: number): string {
  try {
    return getAction(id).name;
  } catch {
    return `#${id}`;
  }
}
