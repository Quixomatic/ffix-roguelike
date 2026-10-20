/**
 * Which FF9 track plays where (track ids are FF9's own `musicNNN`; names in `.docs/assets/FF9/music/names.json`).
 * Read by `build-music.ts` (`pnpm -F web audio:music`), which ships only these tracks.
 */
export const MUSIC_SLOTS = {
  /** Title screen. */
  title: "music033", // Title Music
  /** Camp (roster, journeys, shop). */
  camp: "music030", // Memories of that Day
  /** Overworld map when the area has no theme of its own. */
  overworld: "music045", // Crossing those Hills (World Map Theme)
  battle: "music006", // Battle Theme
  boss: "music024", // Boss Battle Theme
  victory: "music000", // Victory Fanfare
  gameOver: "music001", // Game Over
} as const;

/** Overworld themes by area id (game-core WORLDS). */
export const AREA_MUSIC: Record<string, string> = {
  alexandria: "music020", // Queen of the Abyss
  "evil-forest": "music003", // Evil Forest
  "mist-plains": "music045", // Crossing those Hills
  "ice-cavern": "music031", // Ice Cavern
  "eunorus-plains": "music045", // Crossing those Hills
  dali: "music002", // Dali Village
  "lindblum-fields": "music047", // Lindblum Theme
  "festival-of-the-hunt": "music082", // Hunter's Chance
  "qus-marsh": "music032", // Qu's Marsh
  "gizamaluke-grotto": "music011", // Freya's Theme (Gizamaluke's Grotto)
  "south-gate": "music079", // South Border Crossing
  "burmecian-plains": "music045", // Crossing those Hills
  burmecia: "music044", // Burmecia
  "southern-plains": "music045", // Crossing those Hills
  treno: "music057", // Dark City Treno
  "gargan-roo": "music063", // Gargan Roo
  "cleyra-trunk": "music064", // Cleyra's Trunk
  "trunk-heights": "music064", // Cleyra's Trunk
  cleyra: "music049", // Cleyra Settlement
  "alexandria-castle": "music020", // Queen of the Abyss
  "castle-tower": "music020", // Queen of the Abyss
  "roo-escape": "music063", // Gargan Roo
  "pinnacle-rocks": "music045", // Crossing those Hills
  "fossil-roo": "music048", // Fossil Roo
  "fossil-roo-depths": "music048", // Fossil Roo
  "outer-continent": "music045", // Crossing those Hills
  "mountain-path": "music062", // Conde Petie
  "mountain-summit": "music062", // Conde Petie
  "black-mage-forest": "music054", // Black Mage Village
  "outer-wilds": "music045", // Crossing those Hills
  "madain-sari": "music094", // Madain Sari
  "iifa-roots": "music080", // Iifa Tree
  "iifa-depths": "music080", // Iifa Tree
  "iifa-heart": "music080", // Iifa Tree
  "mist-continent": "music045", // Crossing those Hills
  "alexandria-town": "music051", // Unfathomed Reminisce (Alexandria, later discs)
  "besieged-castle": "music051", // Unfathomed Reminisce
  "forgotten-continent": "music045", // Crossing those Hills
  "oeilvert-halls": "music025", // Oeilvert
  "oeilvert-depths": "music077", // A Transient Past (Oeilvert)
  "the-desert": "music045", // Crossing those Hills
  "desert-palace": "music067", // Kuja's Theme Millennium (Desert Palace)
  "palace-depths": "music067", // Kuja's Theme Millennium
  "esto-gaza": "music045", // Crossing those Hills
  "mount-gulug": "music081", // Mount Gulug
  "gulug-well": "music081", // Mount Gulug
  "lost-continent": "music045", // Crossing those Hills
  "ipsens-castle": "music075", // Ipsen's Heritage
  "earth-shrine": "music073", // The Four Medallions
  terra: "music095", // Terra
  "bran-bal": "music059", // Bran Bal
  pandemonium: "music092", // Pandemonium
  "pandemonium-heart": "music056", // Pandemonium (after You're Not Alone)
  memoria: "music096", // Place of Memories
  "memoria-fire": "music096",
  "memoria-water": "music096",
  "memoria-wind": "music096",
  "memorias-end": "music087", // Crystal World
  "the-crystal": "music087",
  "the-end": "music087",
  "marsh-at-dusk": "music032", // Qu's Marsh
  "quales-pond": "music009", // Quina's Theme
  "vile-shore": "music045", // Crossing those Hills
  "vile-heights": "music045",
  "dragon-plains": "music045",
  "dragon-peak": "music045",
  "memoria-lost-hall": "music096", // Place of Memories
  "air-garden": "music072", // Ukulele de Chocobo
  "hades-workshop": "music093", // Secret Library of Daguerreo
  "gauntlet-waltzes": "music017", // Sword of Fury
  "gauntlet-guardians": "music017",
  "gauntlet-end": "music017",
  "alexandria-outskirts": "music045", // Crossing those Hills
  "ice-cavern-entrance": "music031", // Ice Cavern
  "dali-fields": "music002", // Dali Village
  "cargo-ship": "music023", // Zidane's Theme (boarding the cargo ship)
  "lindblum-plateau": "music047", // Lindblum Theme
};

/** Boss fights with their own FF9 theme, by the boss's kill key (lower-case name). */
export const BOSS_MUSIC: Record<string, string> = {
  "zorn": "music037", // Jesters of the Moon
  "thorn": "music037",
  "beatrix": "music091", // Mystery Sword
  "trance-kuja": "music098", // Dark Messenger
  "necron": "music101", // The Final Battle
};
