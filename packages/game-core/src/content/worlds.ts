/** The three worlds of a run, each themed on earlier Final Fantasy games, with their encounter tables. */
export interface WorldDef {
  index: number;
  name: string;
  subtitle: string;
  /** Background/tileset key for the overworld and battles. */
  theme: string;
  /** Normal encounter groups (enemy ids). */
  encounters: string[][];
  /** Elite ("fortress") encounters. */
  elites: string[][];
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
