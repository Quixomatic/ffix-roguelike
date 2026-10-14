/**
 * Areas: one overworld map each — theme, encounter tables, a semi-boss partway along, the end boss, and the loot
 * tier (gear band, FF9 shops, synthesis tier). Journeys (below) say which areas a run visits.
 */
export interface WorldDef {
  /** Position in WORLDS (also the loot tier). */
  index: number;
  id: string;
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
  {
    id: "echoes",
    name: "Echoes of the Past",
    subtitle: "Cornelia → Baron → the World of Ruin. Kefka awaits at the end.",
    category: "echoes",
    areas: ["cornelia", "baron", "ruin"],
    unlockAfter: null,
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
