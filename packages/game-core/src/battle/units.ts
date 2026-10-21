/** Build battle units from character builds (party) and bestiary entries (enemies). */
import { getAction, getCharacter, getItem, setting, type Status } from "@ffix-roguelike/game-data";

import { baseStats, enemyItemId, getEnemy, type EnemyDef } from "../content/enemies";
import { ff9 } from "../content/enemy-actions";
import { ff9AttackPower } from "../content/ff9";
import { activeSupports, availableActions, deriveStats, type CharacterBuild } from "../stats";
import { isMagicSword } from "./magic-sword";
import { atbMaxFor, ENEMY_CATEGORY, type BattleUnit, type CommandDef, type EnemyFamily } from "./types";

/** HP/MP and lasting statuses a party member carries between battles. */
export interface Vitals {
  hp: number;
  mp: number;
  statuses?: Status[];
}

/** Status immunities granted by support abilities (StatusInit "ResistStatus"). */
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

export function supportImmunities(supports: number[]): Status[] {
  return STATUS_GUARDS.filter(([id]) => supports.includes(id)).flatMap(([, s]) => s);
}

/** Statuses that stay on after a battle (FF9 OutOfBattle): they're carried between fights. */
export const LASTING_STATUSES: Status[] = ["petrify", "venom", "virus", "silence", "blind", "trouble", "zombie"];

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
        id: c.id,
        name: c.name,
        // Single-ability commands like Steal / Eat / Jump / Throw are innate; ability lists are filtered. Magic Sword
        // isn't learned: the battle keeps the swords whose spell the party's Vivi knows (magic-sword.ts).
        actionIds: c.actionIds.length <= 1 || c.actionIds.every(isMagicSword) ? c.actionIds : c.actionIds.filter((id) => known.has(id)),
      }));
  const statuses: BattleUnit["statuses"] = {};
  for (const s of vitals?.statuses ?? []) if (LASTING_STATUSES.includes(s)) statuses[s] = {};
  const weaponId = build.equipment.weapon;
  const bonusElements = build.equipment
    ? Object.values(build.equipment)
        .filter((id): id is number => id != null)
        .flatMap((id) => getItem(id).bonus?.attackElement ?? [])
    : [];
  const hp = Math.min(st.maxHp, vitals?.hp ?? st.maxHp);
  return {
    id: `p${slot}`,
    side: "party",
    key: build.key,
    name: data.name,
    sprite: `hero/${build.key}`,
    level: st.level,
    hp,
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
    weaponId: weaponId ?? null,
    attackElements: st.weapon?.elements ?? [],
    bonusElements: [...new Set(bonusElements)],
    elements: st.elements,
    statusImmune: supportImmunities(supports),
    statuses,
    permanent: [],
    atb: 0,
    atbMax: atbMaxFor(st.speed),
    trance: 0,
    backRow: build.backRow,
    supports,
    turns: 0,
    busyCommand: false,
    playerCategory: data.category,
    enemyCategory: 0,
    commands: filter(data.commands),
    tranceCommands: filter(data.trance),
  };
}

const FAMILY_CATEGORY: Record<EnemyFamily, number> = {
  beast: ENEMY_CATEGORY.beast,
  bird: ENEMY_CATEGORY.flight,
  bug: ENEMY_CATEGORY.soul,
  stone: ENEMY_CATEGORY.stone,
  undead: ENEMY_CATEGORY.undead,
  dragon: ENEMY_CATEGORY.dragon,
  devil: ENEMY_CATEGORY.devil,
  human: ENEMY_CATEGORY.humanoid,
  machine: 0,
  amorphous: 0,
};

/** FF9 steal rates by slot (common → rare). */
const STEAL_RATES = [256, 64, 16, 1];

/** HP and attack multipliers for a difficulty tier (settings `tiers.enemyHpPerTier`, `tiers.enemyAttackPerTier`). */
export const tierHpMult = (tier: number) => 1 + tier * setting("tiers.enemyHpPerTier");
export const tierAttackMult = (tier: number) => 1 + tier * setting("tiers.enemyAttackPerTier");

/**
 * FF9 monster → battle unit with its exact stats (tier/ascension scales HP and attack power). A battle stores its
 * units when it starts, so retuning the tier settings never changes a fight in progress or a replay.
 */
function ff9Unit(def: EnemyDef, slot: number, tier: number): BattleUnit {
  const f = def.ff9!;
  const t = tierHpMult(tier);
  const hp = Math.round(f.hp * t);
  return {
    id: `e${slot}`,
    side: "enemy",
    key: def.id,
    name: def.name,
    sprite: def.sprite,
    level: f.level,
    hp,
    maxHp: hp,
    mp: f.mp,
    maxMp: f.mp,
    speed: f.speed,
    strength: f.strength,
    magic: f.magic,
    spirit: f.spirit,
    attack: Math.round(ff9AttackPower(f) * tierAttackMult(tier)),
    defence: f.defence,
    evade: f.evade,
    magicDefence: f.magicDefence,
    magicEvade: f.magicEvade,
    weapon: null,
    weaponId: null,
    attackElements: [],
    bonusElements: [],
    elements: { weak: f.weak, half: f.half, immune: f.guard, absorb: f.absorb },
    statusImmune: [...f.resist],
    statuses: Object.fromEntries(f.startStatus.filter((s) => s !== "easyKill").map((s) => [s, {}])),
    permanent: [...f.autoStatus, ...(f.startStatus.includes("easyKill") ? (["easyKill"] as Status[]) : [])],
    atb: 0,
    atbMax: atbMaxFor(f.speed),
    trance: 0,
    backRow: false,
    supports: [],
    turns: 0,
    busyCommand: false,
    playerCategory: 0,
    enemyCategory: f.category,
    commands: [],
    tranceCommands: [],
    family: def.family,
    ai: def.ai,
    counters: def.counters,
    usedOnce: [],
    steal: f.steal.map((itemId, i) => ({ itemId, chance: itemId >= 0 ? (STEAL_RATES[i] ?? 1) : 0 })),
    boss: def.boss || f.boss,
    eatTeaches: f.blue > 0 ? f.blue : def.eatTeaches ? ff9(def.eatTeaches) : undefined,
  };
}

/**
 * The HP to show for a unit: its own, or, when a battle script fakes it (`hpShown`, FF9's 65,535 trick), what's left
 * before the script ends the fight.
 */
export function shownHp(u: BattleUnit, hp = u.hp): { hp: number; maxHp: number } {
  if (!u.hpShown) return { hp, maxHp: u.maxHp };
  return { hp: Math.max(0, Math.min(u.hpShown.max, hp - u.hpShown.offset)), maxHp: u.hpShown.max };
}

export function enemyUnit(def: EnemyDef, slot: number, tier = 0): BattleUnit {
  if (def.ff9) return ff9Unit(def, slot, tier);
  const b = def.stats ?? baseStats(def.level, tier);
  const m = (k: keyof NonNullable<EnemyDef["mult"]>) => (def.stats ? 1 : (def.mult?.[k] ?? 1));
  const t = def.stats ? tierHpMult(tier) : 1;
  const hp = Math.round(b.hp * m("hp") * t);
  const mp = Math.round(b.mp * m("mp"));
  const speed = Math.round(b.speed * m("spd"));
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
    speed,
    strength: Math.round(b.strength * m("str")),
    magic: Math.round(b.magic * m("mag")),
    spirit: b.spirit,
    attack: Math.round(b.attack * m("atk") * (def.stats ? tierAttackMult(tier) : 1)),
    defence: Math.round(b.defence * m("def")),
    evade: Math.min(90, Math.round(b.evade * m("eva"))),
    magicDefence: Math.round(b.magicDefence * m("mdef")),
    magicEvade: Math.min(90, Math.round(b.magicEvade * m("meva"))),
    weapon: null,
    weaponId: null,
    attackElements: def.attackElements ?? [],
    bonusElements: [],
    elements: { weak: def.weak ?? [], half: def.half ?? [], immune: def.immune ?? [], absorb: def.absorb ?? [] },
    statusImmune: def.statusImmune ?? [],
    statuses: {},
    permanent: [...(def.autoStatus ?? [])],
    atb: 0,
    atbMax: atbMaxFor(speed),
    trance: 0,
    backRow: false,
    supports: [],
    turns: 0,
    busyCommand: false,
    playerCategory: 0,
    enemyCategory: def.category ?? FAMILY_CATEGORY[def.family],
    commands: [],
    tranceCommands: [],
    family: def.family,
    ai: def.ai,
    counters: def.counters,
    usedOnce: [],
    steal: (def.stealSlots ?? (def.steal ?? []).map((name, i) => ({ itemId: enemyItemId(name), chance: STEAL_RATES[i] ?? 1 }))).map((s) => ({ ...s })),
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
