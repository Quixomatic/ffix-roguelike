/**
 * The bestiary: monsters and bosses from FF1–FF6, statted on FF9's scale.
 * Raw stats come from one level curve (`baseStats`) times per-monster multipliers, so global difficulty can be
 * tuned in one place.
 */
import { itemByName, type Element, type Status } from "@ffix-roguelike/game-data";

import type { AiRule, EnemyFamily } from "../battle/types";
import { ff9 } from "./enemy-actions";

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

/** The difficulty curve. Tier (ascension) scales HP and damage on top. */
export function baseStats(level: number, tier = 0): EnemyStats {
  const t = 1 + tier * 0.2;
  return {
    hp: Math.round((40 + level * 26 + level * level * 1.8) * t),
    mp: 30 + level * 12,
    strength: Math.round(6 + level * 0.5),
    magic: Math.round(4 + level * 0.45),
    spirit: Math.round(10 + level * 0.4),
    attack: Math.round((4 + level * 0.9) * (1 + tier * 0.1)),
    defence: Math.round(2 + level * 0.35),
    magicDefence: Math.round(2 + level * 0.35),
    speed: Math.round(12 + level * 0.35),
    evade: Math.round(3 + level * 0.3),
    magicEvade: Math.round(2 + level * 0.3),
    exp: Math.round(6 + Math.pow(level, 1.7) * 3),
    ap: 1 + Math.floor(level / 6),
    gil: 12 + level * 9,
  };
}

const atk = (weight = 3, extra: Partial<AiRule> = {}): AiRule => ({ actionId: 1000, weight, ...extra });
const use = (actionId: number, weight: number, extra: Partial<AiRule> = {}): AiRule => ({ actionId, weight, ...extra });

const COMMON_DEATH: Status[] = ["death", "petrify", "gradualPetrify", "doom"];
const BOSS_IMMUNE: Status[] = [...COMMON_DEATH, "stop", "sleep", "confuse", "berserk", "mini", "heat", "freeze", "virus", "venom", "easyKill"];

export const ENEMIES: EnemyDef[] = [
  // ── World 1: Cornelia (FF1) ───────────────────────────────────────────────
  {
    id: "goblin", name: "Goblin", origin: "FF1", family: "human", level: 2, sprite: "enemy/goblin",
    ai: [atk(4), use(ff9("Goblin Punch"), 1)], steal: ["Potion", "Eye Drops"], drops: [{ item: "Potion", chance: 30 }],
    eatTeaches: "Goblin Punch",
  },
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
  // ══ FF9 — Disc 1 ════════════════════════════════════════════════════════
  // Fodder
  { id: "fang", name: "Fang", origin: "FF9", family: "beast", level: 2, sprite: "enemy/fang", mult: { spd: 1.2, hp: 0.8 }, ai: [atk(3), use(1001, 2)], steal: ["Potion"], drops: [{ item: "Potion", chance: 25 }] },
  { id: "mu", name: "Mu", origin: "FF9", family: "beast", level: 3, sprite: "enemy/mu", ai: [atk(3), use(1021, 1)], steal: ["Potion", "Eye Drops"], drops: [{ item: "Potion", chance: 25 }] },
  { id: "dendrobium", name: "Dendrobium", origin: "FF9", family: "bug", level: 3, sprite: "enemy/dendrobium", weak: ["fire"], ai: [atk(2), use(1036, 1)], steal: ["Eye Drops"], drops: [{ item: "Eye Drops", chance: 30 }] },
  { id: "hedgehog-pie", name: "Hedgehog Pie", origin: "FF9", family: "beast", level: 4, sprite: "enemy/hedgehog-pie", mult: { def: 1.3 }, ai: [atk(3), use(1003, 1)], steal: ["Potion"], drops: [{ item: "Potion", chance: 30 }], eatTeaches: "Pumpkin Head" },
  { id: "python", name: "Python", origin: "FF9", family: "beast", level: 5, sprite: "enemy/python", ai: [atk(2), use(1004, 2)], steal: ["Antidote"], drops: [{ item: "Antidote", chance: 40 }] },
  { id: "ice-flan", name: "Flan", origin: "FF9", family: "amorphous", level: 5, sprite: "enemy/flan", mult: { def: 3, mdef: 0.5 }, weak: ["fire"], absorb: ["ice"], ai: [atk(2), use(ff9("Blizzard"), 2)], steal: ["Potion"], drops: [{ item: "Potion", chance: 30 }] },
  { id: "wyerd", name: "Wyerd", origin: "FF9", family: "devil", level: 6, sprite: "enemy/wyerd", mult: { mag: 1.2 }, weak: ["fire"], ai: [atk(2), use(ff9("Blizzard"), 2), use(ff9("Silence"), 1)], steal: ["Echo Screen", "Ether"], drops: [{ item: "Echo Screen", chance: 30 }] },
  { id: "cave-imp", name: "Cave Imp", origin: "FF9", family: "devil", level: 6, sprite: "enemy/cave-imp", mult: { spd: 1.15 }, ai: [atk(3), use(1002, 1)], steal: ["Potion", "Hi-Potion"], drops: [{ item: "Potion", chance: 35 }] },
  { id: "ghost", name: "Ghost", origin: "FF9", family: "undead", level: 7, sprite: "enemy/ghost", weak: ["fire", "holy"], absorb: ["shadow"], statusImmune: ["poison", "venom", "death"], ai: [atk(2), use(1040, 2)], steal: ["Phoenix Down", "Ether"], drops: [{ item: "Phoenix Down", chance: 20 }] },
  { id: "ladybug", name: "Ladybug", origin: "FF9", family: "bug", level: 7, sprite: "enemy/ladybug", mult: { spd: 1.3, hp: 0.7, eva: 2 }, weak: ["wind"], ai: [atk(3), use(1042, 1)], steal: ["Antidote"], drops: [{ item: "Antidote", chance: 30 }] },
  { id: "vice", name: "Vice", origin: "FF9", family: "devil", level: 8, sprite: "enemy/vice", mult: { spd: 1.2 }, ai: [atk(3), use(ff9("Fire"), 1)], steal: ["Hi-Potion", "Ether"], drops: [{ item: "Hi-Potion", chance: 20 }] },
  { id: "goblin-mage", name: "Goblin Mage", origin: "FF9", family: "human", level: 9, sprite: "enemy/goblin-mage", mult: { mag: 1.3, hp: 0.9 }, ai: [atk(1), use(ff9("Fire"), 2), use(ff9("Blizzard"), 2), use(ff9("Thunder"), 2)], steal: ["Ether"], drops: [{ item: "Ether", chance: 25 }], eatTeaches: "Goblin Punch" },
  { id: "axe-beak", name: "Axe Beak", origin: "FF9", family: "bird", level: 10, sprite: "enemy/axe-beak", weak: ["wind"], ai: [atk(3), use(1023, 1)], steal: ["Hi-Potion"], drops: [{ item: "Hi-Potion", chance: 25 }] },
  { id: "gigan-toad", name: "Gigan Toad", origin: "FF9", family: "amorphous", level: 11, sprite: "enemy/gigan-toad", mult: { hp: 1.3 }, weak: ["ice"], ai: [atk(2), use(1024, 2)], steal: ["Hi-Potion", "Ether"], drops: [{ item: "Ether", chance: 20 }] },
  { id: "lizard-man", name: "Lizard Man", origin: "FF9", family: "beast", level: 12, sprite: "enemy/lizard-man", mult: { atk: 1.15 }, weak: ["ice"], ai: [atk(3), use(1002, 1)], steal: ["Hi-Potion"], drops: [{ item: "Hi-Potion", chance: 30 }] },
  { id: "hornet", name: "Hornet", origin: "FF9", family: "bug", level: 12, sprite: "enemy/hornet", mult: { spd: 1.3, hp: 0.8 }, weak: ["wind"], ai: [atk(2), use(1042, 2)], steal: ["Antidote", "Hi-Potion"], drops: [{ item: "Antidote", chance: 40 }] },
  { id: "black-mage", name: "Black Mage", origin: "FF9", family: "human", level: 13, sprite: "enemy/black-mage", mult: { mag: 1.4, hp: 0.9 }, ai: [use(ff9("Fira"), 2), use(ff9("Blizzara"), 2), use(ff9("Thundara"), 2), atk(1)], steal: ["Ether"], drops: [{ item: "Ether", chance: 30 }] },

  // Map bosses ("gym leaders") and journey finals
  {
    id: "masked-man", name: "Masked Man", origin: "FF9", family: "human", level: 4, sprite: "boss/masked-man", boss: true, reward: 3,
    mult: { hp: 3.2, atk: 1.1 }, statusImmune: BOSS_IMMUNE, ai: [atk(3), use(1038, 2, { every: 3, offset: 2 })], steal: ["Potion", "Wrist", "Mage Masher"], drops: [{ item: "Potion", chance: 100 }],
  },
  {
    id: "prison-cage", name: "Prison Cage", origin: "FF9", family: "amorphous", level: 5, sprite: "boss/prison-cage", reward: 2,
    mult: { hp: 2.4 }, weak: ["fire"], statusImmune: COMMON_DEATH, ai: [atk(2), use(1040, 2)], steal: ["Broadsword", "Leather Wrist"], drops: [{ item: "Hi-Potion", chance: 50 }],
  },
  {
    id: "plant-brain", name: "Plant Brain", origin: "FF9", family: "amorphous", level: 7, sprite: "boss/plant-brain", boss: true, reward: 5,
    mult: { hp: 4.2, mag: 1.2 }, weak: ["fire"], statusImmune: [...BOSS_IMMUNE, "blind"],
    ai: [atk(2), use(ff9("Thunder"), 3), use(1036, 2, { every: 3 }), use(ff9("Fire"), 1, { hpBelow: 50 })], steal: ["Eye Drops", "Iron Helm"], drops: [{ item: "Hi-Potion", chance: 100 }],
  },
  {
    id: "sealion", name: "Sealion", origin: "FF9", family: "beast", level: 8, sprite: "boss/sealion", boss: true, reward: 4,
    mult: { hp: 3.4, mag: 1.15 }, weak: ["fire"], absorb: ["ice"], statusImmune: BOSS_IMMUNE,
    ai: [atk(2), use(ff9("Blizzard"), 3), use(1011, 2, { every: 3, offset: 1 }), use(ff9("Blizzara"), 2, { hpBelow: 50 })], steal: ["Ether", "Mythril Dagger"], drops: [{ item: "Ether", chance: 100 }],
  },
  {
    id: "black-waltz-1", name: "Black Waltz No.1", origin: "FF9", family: "human", level: 9, sprite: "boss/black-waltz-1", boss: true, reward: 5,
    mult: { hp: 3.6, mag: 1.3 }, statusImmune: BOSS_IMMUNE,
    ai: [atk(1), use(ff9("Fire"), 3), use(ff9("Blizzard"), 3), use(ff9("Sleep"), 1), use(ff9("Cure"), 4, { hpBelow: 45, aim: "self" })], steal: ["Remedy", "Silk Shirt"], drops: [{ item: "Ether", chance: 100 }],
  },
  {
    id: "black-waltz-2", name: "Black Waltz No.2", origin: "FF9", family: "human", level: 11, sprite: "boss/black-waltz-2", boss: true, reward: 6,
    mult: { hp: 4, mag: 1.35 }, statusImmune: BOSS_IMMUNE,
    ai: [use(ff9("Fire"), 3), use(ff9("Blizzard"), 3), use(ff9("Thunder"), 3), use(ff9("Fira"), 3, { hpBelow: 50 }), use(ff9("Silence"), 1, { once: true })], steal: ["Steepled Hat", "Linen Cuirass"], drops: [{ item: "Ether", chance: 100 }],
  },
  {
    id: "zaghnol", name: "Zaghnol", origin: "FF9", family: "beast", level: 13, sprite: "boss/zaghnol", boss: true, reward: 6,
    mult: { hp: 4.3, atk: 1.2 }, statusImmune: BOSS_IMMUNE, ai: [atk(3), use(1044, 2, { every: 3 }), use(1039, 2), use(1020, 1)], steal: ["Hi-Potion", "Mythril Gloves"], drops: [{ item: "Hi-Potion", chance: 100 }],
  },
  {
    id: "gizamaluke", name: "Gizamaluke", origin: "FF9", family: "dragon", level: 16, sprite: "boss/gizamaluke", boss: true, reward: 7,
    mult: { hp: 4.6, mag: 1.3 }, weak: ["thunder"], absorb: ["water"], statusImmune: BOSS_IMMUNE,
    ai: [atk(2), use(1045, 3), use(1037, 2, { every: 4, offset: 1 }), use(1038, 2, { hpBelow: 60 })], steal: ["Elixir", "Magus Hat", "Ice Staff"], drops: [{ item: "Elixir", chance: 100 }],
  },
];

const byId = new Map(ENEMIES.map((e) => [e.id, e]));
export function getEnemy(id: string): EnemyDef {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown enemy ${id}`);
  return e;
}

/** Resolve the item names in steal/drop tables (throws on typos, so tests catch them). */
export const enemyItemId = (name: string) => itemByName(name).id;
