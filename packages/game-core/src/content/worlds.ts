/**
 * Areas: one overworld map each — theme, encounter tables, a semi-boss partway along, the end boss, and the loot
 * tier (gear band, FF9 shops, synthesis tier). Journeys (below) say which areas a run visits.
 */
export interface WorldDef {
  /** Position in WORLDS. */
  index: number;
  id: string;
  /** Progression tier (0 early, 1 mid, 2 late) — gates the camp catalog and supplies, not loot. */
  tier: number;
  name: string;
  subtitle: string;
  /** Background/tileset key for the overworld and battles. */
  theme: string;
  /** Normal encounter groups (enemy ids). */
  encounters: string[][];
  /** Elite ("fortress") encounters. */
  elites: string[][];
  /** Optional semi-boss fortress at the middle of the map (every path passes it). Each map's castle boss is
   *  already the "gym leader", so most areas leave this unset. */
  semiBoss?: string[];
  boss: string[];
  /** Gear price band rewards are drawn from (FF9 shop prices as a power proxy). */
  gearPrice: [number, number];
  /** FF9 equipment shops (ShopItems.csv ids) whose stock appears in this world, in story order. */
  shops: number[];
  /** FF9 general item stores mixed into every shop for consumables. */
  itemStores: number[];
  /** Highest FF9 synthesis shop (32–39) whose recipes are available here. */
  synthTier: number;
}

export const WORLDS: WorldDef[] = [
  {
    index: 0,
    id: "cornelia",
    tier: 0,
    name: "Cornelia",
    subtitle: "Plains of the Warriors of Light",
    theme: "grassland",
    encounters: [
      ["goblin", "goblin"],
      ["goblin", "wolf"],
      ["wolf", "wolf", "wolf"],
      ["crawler", "goblin"],
      ["skeleton", "skeleton"],
      ["black-widow", "crawler"],
      ["bomb", "goblin"],
      ["ogre"],
      ["ogre", "wolf"],
      ["skeleton", "black-widow", "bomb"],
    ],
    elites: [["gigas-worm"], ["ogre", "ogre"], ["bomb", "bomb", "bomb"]],
    boss: ["garland"],
    gearPrice: [100, 1200],
    shops: [0, 1, 2, 3],
    itemStores: [25, 26],
    synthTier: 33,
  },
  {
    index: 1,
    id: "baron",
    tier: 1,
    name: "Baron",
    subtitle: "Shadow of the Red Wings",
    theme: "castle",
    encounters: [
      ["coeurl", "coeurl"],
      ["cockatrice", "zuu"],
      ["flan", "flan"],
      ["zombie", "zombie", "zombie"],
      ["mind-flayer", "zombie"],
      ["lamia", "coeurl"],
      ["adamantoise"],
      ["zuu", "zuu", "cockatrice"],
      ["flan", "mind-flayer"],
      ["lamia", "lamia"],
    ],
    elites: [["iron-giant"], ["adamantoise", "adamantoise"], ["mind-flayer", "mind-flayer", "lamia"]],
    boss: ["golbez"],
    gearPrice: [800, 6000],
    shops: [4, 5, 6, 7, 8, 9, 10],
    itemStores: [27, 28],
    synthTier: 36,
  },
  {
    index: 2,
    id: "ruin",
    tier: 2,
    name: "World of Ruin",
    subtitle: "The light has gone out",
    theme: "ruin",
    encounters: [
      ["tonberry"],
      ["ahriman", "ahriman"],
      ["malboro"],
      ["chimera", "dullahan"],
      ["behemoth"],
      ["red-dragon"],
      ["cactuar", "ahriman"],
      ["dullahan", "dullahan"],
      ["tonberry", "malboro"],
      ["cactuar", "cactuar", "cactuar"],
    ],
    elites: [["king-behemoth"], ["ultros"], ["red-dragon", "behemoth"]],
    boss: ["kefka"],
    gearPrice: [4000, 40000],
    shops: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    itemStores: [29, 30],
    synthTier: 38,
  },
  // ══ FF9 — Disc 1 story areas ═════════════════════════════════════════════
  {
    index: 3,
    id: "alexandria",
    tier: 0,
    name: "Alexandria",
    subtitle: "I Want to Be Your Canary",
    theme: "grassland",
    encounters: [["fang"], ["goblin"], ["fang", "fang"], ["goblin", "fang"], ["mu"]],
    elites: [["mu", "mu"], ["goblin", "goblin", "fang"]],
    boss: ["masked-man"],
    gearPrice: [50, 600],
    shops: [0],
    itemStores: [25],
    synthTier: 32,
  },
  {
    index: 4,
    id: "evil-forest",
    tier: 0,
    name: "Evil Forest",
    subtitle: "The forest that swallowed a princess",
    theme: "forest",
    encounters: [["fang", "goblin"], ["dendrobium"], ["dendrobium", "fang"], ["goblin", "goblin", "fang"], ["hedgehog-pie"]],
    elites: [["prison-cage"], ["hedgehog-pie", "dendrobium"]],
    boss: ["plant-brain"],
    gearPrice: [100, 900],
    shops: [0],
    itemStores: [25],
    synthTier: 32,
  },
  {
    index: 5,
    id: "mist-plains",
    tier: 0,
    name: "Mist Plains",
    subtitle: "Beyond the North Gate",
    theme: "grassland",
    encounters: [["mu", "fang"], ["hedgehog-pie"], ["python"], ["mu", "mu"], ["python", "fang"]],
    elites: [["python", "python"], ["hedgehog-pie", "hedgehog-pie"]],
    boss: ["sealion"],
    gearPrice: [150, 1100],
    shops: [0],
    itemStores: [25, 26],
    synthTier: 32,
  },
  {
    index: 6,
    id: "ice-cavern",
    tier: 0,
    name: "Ice Cavern",
    subtitle: "Where the black mage waits",
    theme: "ice",
    encounters: [["ice-flan"], ["wyerd"], ["cave-imp", "ice-flan"], ["wyerd", "wyerd"], ["cave-imp", "cave-imp"]],
    elites: [["wyerd", "wyerd", "ice-flan"], ["cave-imp", "cave-imp", "cave-imp"]],
    boss: ["black-waltz-1"],
    gearPrice: [200, 1300],
    shops: [0, 1],
    itemStores: [26],
    synthTier: 32,
  },
  {
    index: 7,
    id: "eunorus-plains",
    tier: 0,
    name: "Eunorus Plains",
    subtitle: "Fields around Dali",
    theme: "grassland",
    encounters: [["ghost"], ["ladybug"], ["ghost", "ladybug"], ["vice"], ["ladybug", "ladybug", "ghost"]],
    elites: [["vice", "vice"], ["ghost", "ghost", "ghost"]],
    boss: ["vice", "vice", "ghost"],
    gearPrice: [300, 1600],
    shops: [0, 1],
    itemStores: [26],
    synthTier: 32,
  },
  {
    index: 8,
    id: "dali",
    tier: 1,
    name: "Dali",
    subtitle: "The windmill's secret",
    theme: "cave",
    encounters: [["ghost", "vice"], ["ladybug", "ghost"], ["vice", "vice"], ["goblin-mage"], ["ghost", "ghost"]],
    elites: [["goblin-mage", "vice"], ["vice", "vice", "vice"]],
    boss: ["black-waltz-2"],
    gearPrice: [400, 2000],
    shops: [1],
    itemStores: [26],
    synthTier: 33,
  },
  {
    index: 9,
    id: "lindblum-fields",
    tier: 1,
    name: "Lindblum Fields",
    subtitle: "Outside the Regent's city",
    theme: "grassland",
    encounters: [["goblin-mage"], ["axe-beak"], ["goblin-mage", "fang"], ["axe-beak", "axe-beak"], ["python", "goblin-mage"]],
    elites: [["axe-beak", "axe-beak", "goblin-mage"], ["goblin-mage", "goblin-mage"]],
    boss: ["goblin-mage", "goblin-mage", "goblin-mage"],
    gearPrice: [500, 2400],
    shops: [1],
    itemStores: [26],
    synthTier: 33,
  },
  {
    index: 10,
    id: "festival-of-the-hunt",
    tier: 1,
    name: "Festival of the Hunt",
    subtitle: "The streets of Lindblum",
    theme: "castle",
    encounters: [["axe-beak"], ["goblin-mage", "axe-beak"], ["fang", "fang", "mu"], ["axe-beak", "axe-beak"], ["python", "python"]],
    elites: [["axe-beak", "axe-beak", "axe-beak"]],
    boss: ["zaghnol"],
    gearPrice: [600, 2800],
    shops: [1, 2],
    itemStores: [26],
    synthTier: 33,
  },
  {
    index: 11,
    id: "qus-marsh",
    tier: 1,
    name: "Qu's Marsh",
    subtitle: "Frogs, and a very hungry Qu",
    theme: "marsh",
    encounters: [["gigan-toad"], ["hornet"], ["gigan-toad", "hornet"], ["axe-beak", "hornet"], ["hornet", "hornet"]],
    elites: [["gigan-toad", "gigan-toad"], ["hornet", "hornet", "hornet"]],
    boss: ["gigan-toad", "gigan-toad", "gigan-toad"],
    gearPrice: [700, 3200],
    shops: [1, 2],
    itemStores: [26, 27],
    synthTier: 33,
  },
  {
    index: 12,
    id: "gizamaluke-grotto",
    tier: 1,
    name: "Gizamaluke's Grotto",
    subtitle: "The bell that guards Burmecia",
    theme: "cave",
    encounters: [["lizard-man"], ["black-mage"], ["hornet", "lizard-man"], ["lizard-man", "lizard-man"], ["black-mage", "hornet"]],
    elites: [["black-mage", "black-mage"], ["lizard-man", "lizard-man", "hornet"]],
    boss: ["gizamaluke"],
    gearPrice: [800, 3600],
    shops: [2],
    itemStores: [27],
    synthTier: 33,
  },
];

export function getArea(id: string): WorldDef {
  const w = WORLDS.find((x) => x.id === id);
  if (!w) throw new Error(`Unknown area ${id}`);
  return w;
}

/**
 * Journeys — what you pick at camp. Like pokelike.xyz: a journey is a series of overworld maps (areas); each
 * map ends at a castle with a "gym leader" boss, and the last map's castle holds the journey's final boss.
 * By then the party is high level and geared. Journeys unlock in order. (FF9 disc journeys and the Boss Gauntlet
 * challenge come next.)
 */
export interface JourneyDef {
  id: string;
  name: string;
  subtitle: string;
  category: "story" | "echoes" | "challenge";
  /** Area ids visited in order; the last area's boss ends the journey. */
  areas: string[];
  /** Journey that must be cleared first (null = available from the start). */
  unlockAfter: string | null;
  /** Characters who join the roster the first time this journey is cleared (story journeys, like FF9's party). */
  unlocks?: string[];
}

export const JOURNEYS: JourneyDef[] = [
  // ── FF9 story: clearing each brings the next party member, in roughly the game's order ──
  {
    id: "evil-forest",
    name: "1 · The Evil Forest",
    subtitle: "Kidnap the princess. Escape the forest.",
    category: "story",
    areas: ["alexandria", "evil-forest"],
    unlockAfter: null,
    unlocks: ["vivi"],
  },
  {
    id: "ice-cavern",
    name: "2 · The Ice Cavern",
    subtitle: "Across the Mist to a frozen cave — and a black mage.",
    category: "story",
    areas: ["mist-plains", "ice-cavern"],
    unlockAfter: "evil-forest",
    unlocks: ["steiner"],
  },
  {
    id: "dali",
    name: "3 · Dali",
    subtitle: "What's being made under the windmill?",
    category: "story",
    areas: ["eunorus-plains", "dali"],
    unlockAfter: "ice-cavern",
    unlocks: ["garnet"],
  },
  {
    id: "lindblum",
    name: "4 · Lindblum",
    subtitle: "The Festival of the Hunt.",
    category: "story",
    areas: ["lindblum-fields", "festival-of-the-hunt"],
    unlockAfter: "dali",
    unlocks: ["freya"],
  },
  {
    id: "gizamaluke",
    name: "5 · Gizamaluke's Grotto",
    subtitle: "Through Qu's Marsh to the road to Burmecia.",
    category: "story",
    areas: ["qus-marsh", "gizamaluke-grotto"],
    unlockAfter: "lindblum",
    unlocks: ["quina"],
  },
  // ── Echoes: crossover side journey ──
  {
    id: "echoes",
    name: "Echoes of the Past",
    subtitle: "Cornelia → Baron → the World of Ruin. Kefka awaits at the end.",
    category: "echoes",
    areas: ["cornelia", "baron", "ruin"],
    unlockAfter: "lindblum",
  },
];

export function getJourney(id: string): JourneyDef {
  const j = JOURNEYS.find((x) => x.id === id);
  if (!j) throw new Error(`Unknown journey ${id}`);
  return j;
}

export function journeyUnlocked(id: string, cleared: readonly string[]): boolean {
  const j = getJourney(id);
  return j.unlockAfter == null || cleared.includes(j.unlockAfter);
}
