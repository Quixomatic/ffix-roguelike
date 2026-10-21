/**
 * The bestiary: monsters and bosses from FF1–FF6, statted on FF9's scale.
 * Raw stats come from one level curve (`baseStats`) times per-monster multipliers, so global difficulty can be
 * tuned in one place.
 */
import { bestiary, bestiaryVersion, itemByName, setting, type Element, type FF9Enemy, type Status } from "@ffix-roguelike/game-data";

import type { AiRule, EnemyFamily } from "../battle/types";
import { ff9 } from "./enemy-actions";
import { ff9Move } from "./ff9";
import { ff9EnemyDef } from "./ff9-scenes";

export interface EnemyDef {
  id: string;
  name: string;
  /** Which game it comes from (for flavour / sprite sourcing). */
  origin: "FF1" | "FF2" | "FF3" | "FF4" | "FF5" | "FF6" | "FF9";
  family: EnemyFamily;
  level: number;
  sprite: string;
  mult?: Partial<Record<"hp" | "mp" | "str" | "mag" | "atk" | "def" | "mdef" | "spd" | "eva" | "meva", number>>;
  weak?: Element[];
  half?: Element[];
  immune?: Element[];
  absorb?: Element[];
  statusImmune?: Status[];
  ai: AiRule[];
  steal?: string[];
  drops?: { item: string; chance: number }[];
  eatTeaches?: string;
  boss?: boolean;
  /** Reward multiplier (elites/bosses pay more). */
  reward?: number;
  /** Exact FF9 stats (imported monsters) — used as-is instead of the level curve × multipliers. */
  stats?: EnemyStats;
  /** FF9's own monster: real stats, elements, statuses, steals, drops, rewards. */
  ff9?: FF9Enemy;
  /** FF9 enemy category bits (overrides the family mapping). */
  category?: number;
  /** Element of the basic attack. */
  attackElements?: Element[];
  /** Statuses the monster always has (Float, Reflect…). */
  autoStatus?: Status[];
  /** Answers to being hit (FF9 battle-script counters); weight = % chance. */
  counters?: AiRule[];
  /** Exact FF9 steal slots (item id + rate out of 256). */
  stealSlots?: { itemId: number; chance: number }[];
}

export interface EnemyStats {
  hp: number;
  mp: number;
  strength: number;
  magic: number;
  spirit: number;
  attack: number;
  defence: number;
  magicDefence: number;
  speed: number;
  evade: number;
  magicEvade: number;
  exp: number;
  ap: number;
  gil: number;
}

/**
 * Stats for monsters FF9 doesn't have (the FF1–FF6 crossovers), fitted to FF9's own random encounters
 * (median by level band from the battle export): Def/MDef ≈ 12 at almost every level, Str/Mag ≈ 8 + 0.3·Lv,
 * attack power ≈ 6 + 1.3·Lv, HP ≈ 4·Lv² + 20·Lv. Tier (ascension) scales HP and damage on top.
 */
export function baseStats(level: number, tier = 0): EnemyStats {
  const t = 1 + tier * setting("tiers.enemyHpPerTier");
  return {
    hp: Math.round((40 + level * 20 + level * level * 4) * t),
    mp: 30 + level * 6,
    strength: Math.round(8 + level * 0.3),
    magic: Math.round(8 + level * 0.3),
    spirit: Math.round(11 + level * 0.5),
    attack: Math.round((6 + level * 1.3) * (1 + tier * setting("tiers.enemyAttackPerTier"))),
    defence: Math.round(12 + level / 20),
    magicDefence: Math.round(12 + level / 15),
    speed: Math.min(50, Math.round(23 + level * 0.35)),
    evade: Math.round(3 + level * 0.1),
    magicEvade: Math.round(3 + level * 0.1),
    exp: Math.max(10, Math.round(2 * Math.pow(level, 2.35))),
    ap: 2 + Math.floor(level / 25),
    gil: 120 + level * 40,
  };
}

/** FF9's real record for a monster (the regular-encounter version when several share a name). */
function real(name: string, level: number, boss = false): FF9Enemy {
  const all = bestiary.enemies.filter((e) => e.name === name && (boss ? e.boss || e.exp === 0 : e.exp > 0));
  const pool = all.length ? all : bestiary.enemies.filter((e) => e.name === name);
  if (!pool.length) throw new Error(`Unknown FF9 monster ${name}`);
  return pool.reduce((a, b) => (Math.abs(b.level - level) < Math.abs(a.level - level) ? b : a));
}

/** An AI rule using one of the monster's real FF9 attacks. */
const mv = (m: FF9Enemy, attack: string, weight: number, extra: Partial<AiRule> = {}, nth = 0): AiRule => ({ actionId: ff9Move(m, attack, nth), weight, ...extra });

/** FF9 monsters used by the bestiary (resolved when the list is built). */
const records = () => ({
  goblin: real("Goblin", 3),
  fang: real("Fang", 1),
  mu: real("Mu", 2),
  dendrobium: real("Dendrobium", 2),
  hedgehogPie: real("Hedgehog Pie", 7),
  python: real("Python", 2),
  flan: real("Flan", 2),
  wyerd: real("Wyerd", 2),
  caveImp: real("Cave Imp", 2),
  ghost: real("Ghost", 4),
  ladybug: real("Ladybug", 6),
  vice: real("Vice", 4),
  goblinMage: real("Goblin Mage", 15),
  axeBeak: real("Axe Beak", 6),
  giganToad: real("Gigan Toad", 7),
  lizardMan: real("Lizard Man", 10),
  hornet: real("Hornet", 7),
  typeA: real("Type A", 8),
  maskedMan: real("Masked Man", 1, true),
  prisonCage: real("Prison Cage", 3, true),
  plantBrain: real("Plant Brain", 7, true),
  sealion: real("Sealion", 3, true),
  blackWaltz1: real("Black Waltz 1", 2, true),
  blackWaltz2: real("Black Waltz 2", 6, true),
  zaghnol: real("Zaghnol", 9, true),
  gizamaluke: real("Gizamaluke", 16, true),
});

const atk = (weight = 3, extra: Partial<AiRule> = {}): AiRule => ({ actionId: 1000, weight, ...extra });
const use = (actionId: number, weight: number, extra: Partial<AiRule> = {}): AiRule => ({ actionId, weight, ...extra });

const COMMON_DEATH: Status[] = ["death", "petrify", "gradualPetrify", "doom"];
const BOSS_IMMUNE: Status[] = [...COMMON_DEATH, "stop", "sleep", "confuse", "berserk", "mini", "heat", "freeze", "virus", "venom", "easyKill"];

/**
 * Every bestiary entry. Built on first use, after the FF9 bestiary is registered (from the DB on the server, the
 * API on the client, the import cache in tests), and rebuilt if it's registered again.
 */
export function allEnemies(): EnemyDef[] {
  if (!built || builtFor !== bestiaryVersion) {
    built = buildEnemies();
    byId = new Map(built.map((e) => [e.id, e]));
    builtFor = bestiaryVersion;
  }
  return built;
}
let built: EnemyDef[] | null = null;
let builtFor = -1;
let byId = new Map<string, EnemyDef>();

function buildEnemies(): EnemyDef[] {
  const R = records();
  return [
  // ── World 1: Cornelia (FF1) ───────────────────────────────────────────────
  { id: "goblin", name: "Goblin", origin: "FF9", family: "human", level: 3, sprite: "enemy/goblin", ff9: R.goblin, ai: [mv(R.goblin, "Knife", 4), mv(R.goblin, "Goblin Punch", 1)] },
  {
    id: "wolf", name: "Wolf", origin: "FF1", family: "beast", level: 3, sprite: "enemy/wolf", mult: { spd: 1.25, hp: 0.8 },
    ai: [atk(3), use(1001, 2)], steal: ["Potion"], drops: [{ item: "Antidote", chance: 25 }],
  },
  {
    id: "crawler", name: "Crawler", origin: "FF1", family: "bug", level: 3, sprite: "enemy/crawler", mult: { def: 1.4, spd: 0.8 },
    ai: [atk(2), use(1024, 2)], steal: ["Antidote", "Potion"], drops: [{ item: "Potion", chance: 25 }],
  },
  {
    id: "skeleton", name: "Skeleton", origin: "FF1", family: "undead", level: 4, sprite: "enemy/skeleton",
    weak: ["fire", "holy"], absorb: ["shadow"], statusImmune: ["poison", "venom", "death"],
    ai: [atk(3), use(1002, 1)], steal: ["Soft", "Phoenix Down"], drops: [{ item: "Phoenix Down", chance: 15 }],
  },
  {
    id: "black-widow", name: "Black Widow", origin: "FF1", family: "bug", level: 4, sprite: "enemy/black-widow", mult: { hp: 0.9 },
    weak: ["fire"], ai: [atk(2), use(1004, 2)], steal: ["Antidote"], drops: [{ item: "Antidote", chance: 40 }],
  },
  {
    id: "bomb", name: "Bomb", origin: "FF4", family: "amorphous", level: 5, sprite: "enemy/bomb", mult: { hp: 0.8 },
    weak: ["ice", "water"], absorb: ["fire"],
    ai: [atk(2), use(1010, 2), use(1009, 6, { hpBelow: 40 })], steal: ["Hi-Potion", "Potion"], drops: [{ item: "Potion", chance: 30 }],
  },
  {
    id: "ogre", name: "Ogre", origin: "FF1", family: "human", level: 6, sprite: "enemy/ogre", mult: { hp: 1.3, atk: 1.2, spd: 0.85 },
    ai: [atk(3), use(1016, 1)], steal: ["Hi-Potion", "Potion"], drops: [{ item: "Hi-Potion", chance: 20 }],
  },
  {
    id: "gigas-worm", name: "Gigas Worm", origin: "FF1", family: "beast", level: 8, sprite: "enemy/gigas-worm", reward: 2,
    mult: { hp: 2.2, atk: 1.15, def: 1.3 }, weak: ["ice"], statusImmune: COMMON_DEATH,
    ai: [atk(3), use(1003, 2), use(1021, 1, { every: 3 })], steal: ["Ether", "Hi-Potion"], drops: [{ item: "Ether", chance: 50 }],
  },
  {
    id: "garland", name: "Garland", origin: "FF1", family: "human", level: 10, sprite: "boss/garland", boss: true, reward: 5,
    mult: { hp: 4, atk: 1.1, mag: 1.2, def: 1.3, mdef: 1.2 }, statusImmune: BOSS_IMMUNE,
    ai: [
      atk(4),
      use(1019, 2, { every: 3, offset: 2 }),
      use(ff9("Fire"), 2),
      use(1034, 3, { hpBelow: 50, once: true }),
      use(1010, 2, { hpBelow: 50 }),
    ],
    steal: ["Ether", "Phoenix Down", "Mythril Dagger", "Bone Wrist"], drops: [{ item: "Phoenix Down", chance: 100 }],
  },

  // ── World 2: Baron (FF2 / FF4) ────────────────────────────────────────────
  {
    id: "coeurl", name: "Coeurl", origin: "FF4", family: "beast", level: 10, sprite: "enemy/coeurl", mult: { spd: 1.2 },
    ai: [atk(3), use(1007, 1)], steal: ["Hi-Potion", "Phoenix Down"], drops: [{ item: "Hi-Potion", chance: 25 }],
  },
  {
    id: "cockatrice", name: "Cockatrice", origin: "FF2", family: "bird", level: 10, sprite: "enemy/cockatrice",
    weak: ["wind"], ai: [atk(3), use(1005, 2)], steal: ["Soft"], drops: [{ item: "Soft", chance: 40 }],
  },
  {
    id: "flan", name: "Flan", origin: "FF4", family: "amorphous", level: 11, sprite: "enemy/flan",
    mult: { def: 3.5, mdef: 0.5, hp: 0.9 }, weak: ["fire"], half: ["ice", "thunder"],
    ai: [atk(2), use(ff9("Blizzard"), 2)], steal: ["Ether"], drops: [{ item: "Ether", chance: 20 }],
  },
  {
    id: "zombie", name: "Zombie", origin: "FF2", family: "undead", level: 11, sprite: "enemy/zombie", mult: { hp: 1.2, spd: 0.8 },
    weak: ["fire", "holy"], absorb: ["shadow"], statusImmune: ["poison", "venom", "death"],
    ai: [atk(3), use(1004, 1)], steal: ["Soft", "Phoenix Down"], drops: [{ item: "Phoenix Down", chance: 20 }],
  },
  {
    id: "mind-flayer", name: "Mind Flayer", origin: "FF4", family: "devil", level: 12, sprite: "enemy/mind-flayer", mult: { mag: 1.3, hp: 0.9 },
    ai: [atk(2), use(1022, 1), use(ff9("Thunder"), 2), use(ff9("Osmose"), 1)], steal: ["Ether", "Echo Screen"], drops: [{ item: "Ether", chance: 25 }],
    eatTeaches: "Matra Magic",
  },
  {
    id: "zuu", name: "Zuu", origin: "FF4", family: "bird", level: 12, sprite: "enemy/zuu", mult: { spd: 1.15 },
    weak: ["wind"], ai: [atk(3), use(1023, 1)], steal: ["Hi-Potion"], drops: [{ item: "Eye Drops", chance: 30 }],
  },
  {
    id: "lamia", name: "Lamia", origin: "FF2", family: "devil", level: 13, sprite: "enemy/lamia", mult: { mag: 1.2 },
    ai: [atk(2), use(1006, 1), use(ff9("Confuse"), 1), use(ff9("Fira"), 2)], steal: ["Echo Screen", "Ether"], drops: [{ item: "Echo Screen", chance: 25 }],
  },
  {
    id: "adamantoise", name: "Adamantoise", origin: "FF3", family: "stone", level: 14, sprite: "enemy/adamantoise",
    mult: { hp: 1.6, def: 2.2, spd: 0.7 }, weak: ["thunder"], half: ["earth"],
    ai: [atk(3), use(1014, 1, { every: 3 })], steal: ["Hi-Potion", "Ore"], drops: [{ item: "Hi-Potion", chance: 35 }],
    eatTeaches: "Mighty Guard",
  },
  {
    id: "iron-giant", name: "Iron Giant", origin: "FF4", family: "machine", level: 16, sprite: "enemy/iron-giant", reward: 2,
    mult: { hp: 2.4, atk: 1.25, def: 1.6, mdef: 0.8, spd: 0.8 }, weak: ["thunder"], statusImmune: COMMON_DEATH,
    ai: [atk(3), use(1019, 2), use(1016, 1)], steal: ["Elixir", "Mythril Armor"], drops: [{ item: "Elixir", chance: 30 }],
  },
  {
    id: "golbez", name: "Golbez", origin: "FF4", family: "human", level: 19, sprite: "boss/golbez", boss: true, reward: 5,
    mult: { hp: 4.2, mag: 1.35, mdef: 1.4, def: 1.2 }, statusImmune: BOSS_IMMUNE, half: ["shadow"],
    ai: [
      use(ff9("Thundara"), 3),
      use(ff9("Blizzara"), 3),
      use(ff9("Fira"), 3),
      use(1012, 2),
      use(ff9("Bio"), 2, { hpBelow: 70 }),
      use(1015, 4, { hpBelow: 40, every: 3 }),
      use(1034, 4, { hpBelow: 60, once: true }),
    ],
    steal: ["Elixir", "Ether", "Black Robe", "Gold Helm"], drops: [{ item: "Elixir", chance: 100 }],
  },

  // ── World 3: World of Ruin (FF5 / FF6) ────────────────────────────────────
  {
    id: "cactuar", name: "Cactuar", origin: "FF6", family: "amorphous", level: 19, sprite: "enemy/cactuar",
    mult: { hp: 0.4, eva: 6, spd: 1.5 }, ai: [use(ff9("1,000 Needles"), 1)],
    steal: ["Elixir", "Hi-Potion"], drops: [{ item: "Elixir", chance: 15 }], eatTeaches: "1,000 Needles", reward: 2,
  },
  {
    id: "tonberry", name: "Tonberry", origin: "FF5", family: "human", level: 20, sprite: "enemy/tonberry", mult: { hp: 1.2, spd: 0.6 },
    ai: [use(1018, 3), use(1017, 1, { every: 4, offset: 3 })], steal: ["Elixir", "Ether"], drops: [{ item: "Ether", chance: 35 }],
  },
  {
    id: "ahriman", name: "Ahriman", origin: "FF5", family: "devil", level: 20, sprite: "enemy/ahriman", mult: { mag: 1.2 },
    weak: ["wind"], ai: [atk(2), use(1026, 1), use(ff9("Blizzaga"), 2)], steal: ["Echo Screen", "Ether"], drops: [{ item: "Ether", chance: 25 }],
    eatTeaches: "Doom",
  },
  {
    id: "malboro", name: "Malboro", origin: "FF5", family: "amorphous", level: 21, sprite: "enemy/malboro", mult: { hp: 1.3 },
    weak: ["fire"], ai: [atk(2), use(1025, 1, { every: 3 })], steal: ["Remedy", "Hi-Potion"], drops: [{ item: "Remedy", chance: 30 }],
    eatTeaches: "Bad Breath",
  },
  {
    id: "chimera", name: "Chimera", origin: "FF5", family: "beast", level: 22, sprite: "enemy/chimera", mult: { hp: 1.2, mag: 1.1 },
    absorb: ["fire"], weak: ["ice"], ai: [atk(2), use(ff9("Aqua Breath"), 2), use(ff9("Firaga"), 1)],
    steal: ["Hi-Potion", "Ether"], drops: [{ item: "Hi-Potion", chance: 40 }], eatTeaches: "Aqua Breath",
  },
  {
    id: "dullahan", name: "Dullahan", origin: "FF6", family: "undead", level: 22, sprite: "enemy/dullahan", mult: { mag: 1.3 },
    weak: ["fire", "holy"], absorb: ["ice"], statusImmune: ["poison", "venom", "death"],
    ai: [use(1011, 2), use(ff9("Blizzaga"), 2), atk(1)], steal: ["Phoenix Down", "Ether"], drops: [{ item: "Phoenix Down", chance: 35 }],
  },
  {
    id: "behemoth", name: "Behemoth", origin: "FF6", family: "beast", level: 23, sprite: "enemy/behemoth", mult: { hp: 1.5, atk: 1.2 },
    ai: [atk(3), use(1020, 2), use(ff9("Meteor"), 1, { hpBelow: 30, once: true })], steal: ["Elixir", "Hi-Potion"], drops: [{ item: "Elixir", chance: 15 }],
  },
  {
    id: "red-dragon", name: "Red Dragon", origin: "FF5", family: "dragon", level: 24, sprite: "enemy/red-dragon", mult: { hp: 1.5, mag: 1.2 },
    absorb: ["fire"], weak: ["ice"], ai: [atk(2), use(ff9("Firaga"), 2), use(1028, 1)], steal: ["Elixir", "Ether"], drops: [{ item: "Ether", chance: 30 }],
  },
  {
    id: "king-behemoth", name: "King Behemoth", origin: "FF6", family: "beast", level: 27, sprite: "enemy/king-behemoth", reward: 2,
    mult: { hp: 2.6, atk: 1.3, mag: 1.2 }, statusImmune: COMMON_DEATH,
    ai: [atk(3), use(1020, 2), use(ff9("Meteor"), 2, { every: 3 })], steal: ["Elixir", "Diamond Armor"], drops: [{ item: "Elixir", chance: 40 }],
  },
  {
    id: "ultros", name: "Ultros", origin: "FF6", family: "amorphous", level: 26, sprite: "enemy/ultros", reward: 2,
    mult: { hp: 2.3, mag: 1.2 }, weak: ["thunder"], absorb: ["water"], statusImmune: COMMON_DEATH,
    ai: [atk(2), use(1013, 2), use(ff9("Blind"), 1), use(1003, 2)], steal: ["Elixir", "Rubber Suit"], drops: [{ item: "Elixir", chance: 40 }],
  },
  {
    id: "kefka", name: "Kefka", origin: "FF6", family: "human", level: 30, sprite: "boss/kefka", boss: true, reward: 8,
    mult: { hp: 4.6, mag: 1.45, mdef: 1.4, def: 1.2, spd: 1.1 }, statusImmune: BOSS_IMMUNE,
    ai: [
      use(ff9("Firaga"), 2),
      use(ff9("Thundaga"), 2),
      use(ff9("Blizzaga"), 2),
      use(1031, 2, { every: 4, offset: 1 }),
      use(1032, 2, { hpBelow: 70, every: 3 }),
      use(1027, 3, { hpBelow: 50, every: 3, offset: 1 }),
      use(1029, 6, { hpBelow: 25, every: 4 }),
      use(1035, 4, { hpBelow: 75, once: true }),
    ],
    steal: ["Elixir", "Phoenix Pinion", "Ribbon", "Robe of Lords"], drops: [{ item: "Elixir", chance: 100 }],
  },
  // ══ FF9 — Disc 1 (real FF9 stats, elements, steals and attacks from the battle export) ══════════
  // Fodder
  { id: "fang", name: "Fang", origin: "FF9", family: "beast", level: 1, sprite: "enemy/fang", ff9: R.fang, ai: [mv(R.fang, "Rush", 2), mv(R.fang, "Fang", 2)] },
  { id: "mu", name: "Mu", origin: "FF9", family: "beast", level: 2, sprite: "enemy/mu", ff9: R.mu, ai: [mv(R.mu, "Tail", 3), mv(R.mu, "Stone", 1)] },
  { id: "dendrobium", name: "Dendrobium", origin: "FF9", family: "bug", level: 2, sprite: "enemy/dendrobium", ff9: R.dendrobium, ai: [mv(R.dendrobium, "Wind", 3), mv(R.dendrobium, "Pollen", 1), mv(R.dendrobium, "Pollen", 1, {}, 1)] },
  { id: "hedgehog-pie", name: "Hedgehog Pie", origin: "FF9", family: "beast", level: 7, sprite: "enemy/hedgehog-pie", ff9: R.hedgehogPie, ai: [mv(R.hedgehogPie, "Ram", 3), mv(R.hedgehogPie, "Fat Press", 1), mv(R.hedgehogPie, "Pumpkin Head", 1, { hpBelow: 60 })] },
  { id: "python", name: "Python", origin: "FF9", family: "beast", level: 2, sprite: "enemy/python", ff9: R.python, ai: [mv(R.python, "Rapid Fire", 3), mv(R.python, "Thunder", 1)] },
  { id: "ice-flan", name: "Flan", origin: "FF9", family: "amorphous", level: 2, sprite: "enemy/flan", ff9: R.flan, ai: [mv(R.flan, "Head Attack", 2), mv(R.flan, "Blizzard", 2)] },
  { id: "wyerd", name: "Wyerd", origin: "FF9", family: "devil", level: 2, sprite: "enemy/wyerd", ff9: R.wyerd, ai: [mv(R.wyerd, "Strike", 3), mv(R.wyerd, "StrikeC", 1), mv(R.wyerd, "Blizzard", 2), mv(R.wyerd, "HP Switching", 1, { hpBelow: 40 })] },
  { id: "cave-imp", name: "Cave Imp", origin: "FF9", family: "devil", level: 2, sprite: "enemy/cave-imp", ff9: R.caveImp, ai: [mv(R.caveImp, "Rusty Knife", 3), mv(R.caveImp, "Sleeping Juice", 1)] },
  { id: "ghost", name: "Ghost", origin: "FF9", family: "undead", level: 4, sprite: "enemy/ghost", ff9: R.ghost, ai: [mv(R.ghost, "Fire", 2), mv(R.ghost, "Thunder", 2), mv(R.ghost, "Osmose", 1)] },
  { id: "ladybug", name: "Ladybug", origin: "FF9", family: "bug", level: 6, sprite: "enemy/ladybug", ff9: R.ladybug, ai: [mv(R.ladybug, "Spear", 3), mv(R.ladybug, "Fire", 1, {}, 1)] },
  { id: "vice", name: "Vice", origin: "FF9", family: "devil", level: 4, sprite: "enemy/vice", ff9: R.vice, ai: [mv(R.vice, "Slice", 3), mv(R.vice, "Fire", 1), mv(R.vice, "Steal", 1)] },
  { id: "goblin-mage", name: "Goblin Mage", origin: "FF9", family: "human", level: 15, sprite: "enemy/goblin-mage", ff9: R.goblinMage, ai: [mv(R.goblinMage, "Axe", 2), mv(R.goblinMage, "Thundara", 2), mv(R.goblinMage, "Goblin Punch", 1), mv(R.goblinMage, "Vanish", 1, { once: true, aim: "self" })] },
  { id: "axe-beak", name: "Axe Beak", origin: "FF9", family: "bird", level: 6, sprite: "enemy/axe-beak", ff9: R.axeBeak, ai: [mv(R.axeBeak, "Beak", 3), mv(R.axeBeak, "Thundara", 1), mv(R.axeBeak, "Glowing Eyes", 1)] },
  { id: "gigan-toad", name: "Gigan Toad", origin: "FF9", family: "amorphous", level: 7, sprite: "enemy/gigan-toad", ff9: R.giganToad, ai: [mv(R.giganToad, "Water", 2), mv(R.giganToad, "Blizzara", 2), mv(R.giganToad, "Glowing Eyes", 1)] },
  { id: "lizard-man", name: "Lizard Man", origin: "FF9", family: "beast", level: 10, sprite: "enemy/lizard-man", ff9: R.lizardMan, ai: [mv(R.lizardMan, "Hatchet", 3), mv(R.lizardMan, "Protect", 1, { once: true, aim: "self" })] },
  { id: "hornet", name: "Hornet", origin: "FF9", family: "bug", level: 7, sprite: "enemy/hornet", ff9: R.hornet, ai: [mv(R.hornet, "Stinger", 3), mv(R.hornet, "Buzz", 1)] },
  { id: "black-mage", name: "Black Mage", origin: "FF9", family: "human", level: 8, sprite: "enemy/black-mage", ff9: R.typeA, ai: [mv(R.typeA, "Strike", 1), mv(R.typeA, "Fire", 2), mv(R.typeA, "Blizzard", 2), mv(R.typeA, "Thunder", 2)] },

  // Map bosses ("gym leaders") and journey finals — FF9 boss data (Easy Kill proof comes from the data).
  {
    id: "masked-man", name: "Masked Man", origin: "FF9", family: "human", level: 1, sprite: "boss/masked-man", boss: true, reward: 3, ff9: R.maskedMan,
    ai: [mv(R.maskedMan, "Get some!", 3), mv(R.maskedMan, "Gwahaha!", 2), mv(R.maskedMan, "Mask Jump", 1)],
  },
  {
    id: "prison-cage", name: "Prison Cage", origin: "FF9", family: "amorphous", level: 3, sprite: "boss/prison-cage", reward: 2, ff9: R.prisonCage,
    ai: [mv(R.prisonCage, "Right Stem", 2), mv(R.prisonCage, "Left Stem", 2), mv(R.prisonCage, "Absorb", 2)],
  },
  {
    id: "plant-brain", name: "Plant Brain", origin: "FF9", family: "amorphous", level: 7, sprite: "boss/plant-brain", boss: true, reward: 5, ff9: R.plantBrain,
    ai: [mv(R.plantBrain, "Right Tentacle", 3), mv(R.plantBrain, "Left Tentacle", 2), mv(R.plantBrain, "Thunder", 2, {}, 1), mv(R.plantBrain, "Thunder", 1, { hpBelow: 60 }), mv(R.plantBrain, "Pollen", 1, { every: 4 })],
  },
  {
    id: "sealion", name: "Sealion", origin: "FF9", family: "beast", level: 3, sprite: "boss/sealion", boss: true, reward: 4, ff9: R.sealion,
    ai: [mv(R.sealion, "Wing", 3), mv(R.sealion, "Blizzard", 2), mv(R.sealion, "Blizzara", 2, { hpBelow: 50 }), mv(R.sealion, "Tsunami", 1, { every: 4, offset: 2 })],
  },
  {
    id: "black-waltz-1", name: "Black Waltz No.1", origin: "FF9", family: "human", level: 2, sprite: "boss/black-waltz-1", boss: true, reward: 5, ff9: R.blackWaltz1,
    ai: [mv(R.blackWaltz1, "Hit", 2), mv(R.blackWaltz1, "Fire", 2), mv(R.blackWaltz1, "Blizzard", 2, {}, 1)],
  },
  {
    id: "black-waltz-2", name: "Black Waltz No.2", origin: "FF9", family: "human", level: 6, sprite: "boss/black-waltz-2", boss: true, reward: 6, ff9: R.blackWaltz2,
    ai: [
      mv(R.blackWaltz2, "Fire", 2), mv(R.blackWaltz2, "Blizzard", 2), mv(R.blackWaltz2, "Thunder", 2), mv(R.blackWaltz2, "Teleport", 1),
      mv(R.blackWaltz2, "Fira", 2, { hpBelow: 60 }), mv(R.blackWaltz2, "Blizzara", 2, { hpBelow: 60 }), mv(R.blackWaltz2, "Thundara", 2, { hpBelow: 60 }),
      mv(R.blackWaltz2, "Osmose", 1, { hpBelow: 80 }),
    ],
  },
  {
    id: "zaghnol", name: "Zaghnol", origin: "FF9", family: "beast", level: 9, sprite: "boss/zaghnol", boss: true, reward: 6, ff9: R.zaghnol,
    ai: [mv(R.zaghnol, "Heave", 3), mv(R.zaghnol, "Thunder", 2), mv(R.zaghnol, "Thunder", 1, { every: 3 }, 1)],
  },
  {
    id: "gizamaluke", name: "Gizamaluke", origin: "FF9", family: "dragon", level: 16, sprite: "boss/gizamaluke", boss: true, reward: 7, ff9: R.gizamaluke,
    ai: [mv(R.gizamaluke, "Crash", 3), mv(R.gizamaluke, "Water", 2), mv(R.gizamaluke, "Water", 1, { every: 3 }, 1), mv(R.gizamaluke, "Silent Voice", 1, { every: 4, offset: 1 })],
  },
];
}

export function getEnemy(id: string): EnemyDef {
  allEnemies();
  const e = byId.get(id);
  if (e) return e;
  // Any FF9 monster, auto-generated from the battle export ("ff9-<uid>").
  if (id.startsWith("ff9-")) return ff9EnemyDef(Number(id.slice(4)));
  throw new Error(`Unknown enemy ${id}`);
}

/** Resolve the item names in steal/drop tables (throws on typos, so tests catch them). */
export const enemyItemId = (name: string) => itemByName(name).id;
