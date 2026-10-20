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
};

/** Boss fights with their own FF9 theme, by the boss's kill key (lower-case name). */
export const BOSS_MUSIC: Record<string, string> = {
  "zorn": "music037", // Jesters of the Moon
  "thorn": "music037",
  "beatrix": "music091", // Mystery Sword
  "trance-kuja": "music098", // Dark Messenger
  "necron": "music101", // The Final Battle
};
