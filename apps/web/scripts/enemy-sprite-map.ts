/**
 * Monster → FFRK sprite, keyed by the battle sprite key's name (`enemy/<name>` / `boss/<name>`: FF9 monsters use
 * their name slugified, hand-made monsters their id). Read by `build-enemy-sprites.ts` (`pnpm -F web sprites:enemies`).
 *
 * - `enemy`: an FFRK enemy sheet (`.docs/assets/FFRK-data/_raw/enemies/<id>`, one pose + white/thunder frames).
 * - `boss`: an FFRK boss rig (`_raw/bosses/<id>` sheet + `.anim.json`): animated idle/attack/damage/death.
 * - `player`: an FFRK party sheet (`_raw/characters/<id>`) for story characters fought as enemies.
 * - `crop`: frames cut from a local image (a Spriters Resource rip under `.docs/assets`), looping as the idle, its
 *   flat background colour made see-through; `flip` mirrors them so they face right like the FFRK sheets.
 *
 * `src` says where the art comes from. Names were matched to sheets pixel-for-pixel (`pnpm -F web ffrk:names`)
 * unless noted "identified by eye"; "stand-in" means FFRK never drew this FF9 monster and another game's
 * look-alike is used (James OK'd reuse). Unmapped monsters keep the placeholder — see /bestiary.
 */
export interface CropFrames {
  /** Under `.docs/assets`. */
  file: string;
  /** The first frame's cell, and how far apart the rest are (frames in a row). */
  x: number;
  y: number;
  w: number;
  h: number;
  step: number;
  count: number;
  fps: number;
  /** The sheet's background colour (r, g, b), made see-through. */
  key?: [number, number, number];
  flip?: boolean;
}
export type EnemySpriteSource = ({ enemy: number } | { boss: number } | { player: number } | { crop: CropFrames }) & { src: string };

export const ENEMY_SPRITE_MAP: Record<string, EnemySpriteSource> = {
  "abadon": { boss: 209058, src: "Abadon (FF9)" },
  "abomination": { enemy: 104039, src: "stand-in: Ghoul FFIV" },
  "adamantoise": { boss: 215001, src: "Adamantoise (FF15)" },
  "ahriman": { enemy: 106269, src: "Ahriman FFVI" },
  "amdusias": { boss: 209057, src: "Amdusias (FF9)" },
  "anemone": { enemy: 106200, src: "Anemone FFVI" },
  "antlion": { boss: 209010, src: "Antlion IX (FF9)" },
  "ark": { boss: 209020, src: "Ark (FF9)" },
  "armodullahan": { enemy: 104140, src: "stand-in: Armor Construct FFIV" },
  "axe-beak": { enemy: 101054, src: "stand-in: red hawk FFI (unnamed sheet, by eye: FFRK never drew Axe Beak)" },
  "axolotl": { enemy: 105026, src: "stand-in: Elf Toad FFV" },
  "bandersnatch": { enemy: 109064, src: "Bandersnatch FFIX" },
  "basilisk": { enemy: 109050, src: "Basilisk FFIX" },
  "beatrix": { boss: 209007, src: "Beatrix (FF9)" },
  "behemoth": { enemy: 109149, src: "Behemoth FFIX (identified by eye)" },
  "black-mage": { enemy: 109045, src: "Type A FFIX (black mage)" },
  "black-waltz-1": { boss: 209002, src: "Black Waltz 1 (FF9)" },
  "black-waltz-2": { boss: 209004, src: "Black Waltz 2 (FF9)" },
  "black-waltz-3": { boss: 209005, src: "Black Waltz 3 (FF9)" },
  "black-widow": { boss: 227035, src: "Black Widow (FF7)" },
  "bomb": { enemy: 109010, src: "Bomb FFIX" },
  "cactuar": { enemy: 106185, src: "Cactuar FFVI" },
  "cactuer": { enemy: 106185, src: "stand-in: Cactuar FFVI" },
  "carrion-worm": { enemy: 104009, src: "stand-in: Sand Worm FFIV" },
  "carve-spider": { enemy: 109080, src: "Carve Spider FFIX (identified by eye)" },
  "catoblepas": { boss: 208058, src: "Catoblepas (FF8)" },
  "cave-imp": { enemy: 102057, src: "stand-in: Imp FFII" },
  "cerberus": { boss: 203027, src: "Cerberus (FF3)" },
  "chimera": { enemy: 106105, src: "Chimera FFVI" },
  "clipper": { enemy: 105003, src: "stand-in: Devil Crab FFV" },
  "cockatrice": { enemy: 104031, src: "Cockatrice FFIV" },
  "coeurl": { enemy: 104091, src: "Coeurl FFIV" },
  "crawler": { enemy: 111004, src: "Crawler FFXI" },
  "deathguise": { boss: 209036, src: "Deathguise (FF9)" },
  "dendrobium": { enemy: 109018, src: "Dendrobium FFIX (identified by eye)" },
  "dracozombie": { enemy: 109083, src: "Dracozombie FFIX" },
  "dragonfly": { enemy: 109054, src: "Dragonfly FFIX" },
  "dullahan": { boss: 206051, src: "Dullahan VI (FF6)" },
  "earth-guardian": { boss: 209024, src: "Earth Guardian (FF9)" },
  "fang": { enemy: 109012, src: "Fang FFIX (identified by eye)" },
  "flan": { enemy: 106089, src: "Flan FFVI" },
  "gargoyle": { enemy: 104032, src: "Gargoyle FFIV" },
  "garland": { boss: 209026, src: "Garland IX (FF9)" },
  "garuda": { boss: 214014, src: "Garuda (FF14)" },
  "ghost": { enemy: 109026, src: "Ghost FFIX (identified by eye)" },
  "gigan-toad": { enemy: 102044, src: "stand-in: Poison Toad FFII" },
  "gigas-worm": { enemy: 101057, src: "stand-in: Lava Worm FFI (FF1's Gigas Worm is its recolour; FFRK has no Gigas Worm)" },
  "gizamaluke": { boss: 209006, src: "Gizamaluk (FF9)" },
  "goblin": { enemy: 109126, src: "Goblin FFIX (identified by eye)" },
  "goblin-mage": { enemy: 102087, src: "stand-in: Goblin Captain FFII" },
  "golbez": { boss: 204022, src: "Golbez & Shadow Dragon (FF4)" },
  "grand-dragon": { enemy: 104150, src: "stand-in: Blue Dragon FFIV" },
  "grenade": { enemy: 109113, src: "Grenade FFIX" },
  "haagen": { enemy: 109007, src: "FF9 knight (Pluto Knight sheet, identified by eye)" },
  "hades": { boss: 209035, src: "Hades (FF9)" },
  "hecteyes": { enemy: 109128, src: "Hecteyes FFIX" },
  "hedgehog-pie": { enemy: 107015, src: "Hedgehog Pie FFVII" },
  "hilgigars": { boss: 209017, src: "Hilgigars (FF9)" },
  "hornet": { enemy: 102003, src: "Hornet FFII" },
  "ice-flan": { enemy: 106089, src: "Flan FFVI" },
  "iron-giant": { enemy: 105245, src: "Iron Giant FFV" },
  "iron-man": { boss: 207134, src: "Iron Man (FF7)" },
  "ironite": { enemy: 106217, src: "stand-in: Weredragon FFVI (FFRK never drew Ironite)" },
  "kefka": { boss: 206010, src: "Kefka (FF6)" },
  "king-behemoth": { enemy: 105246, src: "King Behemoth FFV" },
  "kraken": { boss: 209033, src: "Kraken IX (FF9)" },
  "ladybug": { enemy: 112040, src: "stand-in: Tiny Bug FFXII" },
  "lamia": { enemy: 105075, src: "Lamia FFV" },
  "land-worm": { enemy: 104049, src: "stand-in: Flood Worm FFIV" },
  "lani": { boss: 209016, src: "Lani (FF9)" },
  "lich": { boss: 209034, src: "Lich (FF9)" },
  "lizard-man": { enemy: 105055, src: "stand-in: Twin Lizard FFV" },
  "magic-vice": { enemy: 115005, src: "stand-in: Imp FFXV" },
  "malboro": { enemy: 109133, src: "Malboro FFIX" },
  "maliris": { boss: 209031, src: "Maliris (FF9)" },
  "mandragora": { enemy: 105234, src: "stand-in: Moss Fungus FFV" },
  "masked-man": { enemy: 109001, src: "Masked Man FFIX" },
  "meltigemini": { boss: 209022, src: "Meltigemini (FF9)" },
  "mimic": { enemy: 109052, src: "Mimic FFIX" },
  "mind-flayer": { enemy: 104057, src: "Mindflayer FFIV" },
  "mistodon": { boss: 209053, src: "Mistodon (FF9)" },
  "mover": { enemy: 106253, src: "Mover FFVI" },
  "mu": { enemy: 106004, src: "stand-in: Wild Rat FFVI" },
  "myconid": { enemy: 190012, src: "Myconid (Record of Mana)" },
  "nova-dragon": { boss: 209030, src: "Nova Dragon (FF9)" },
  "nymph": { enemy: 109049, src: "Nymph FFIX" },
  "ochu": { enemy: 109078, src: "Ochu FFIX" },
  "officer": { enemy: 109063, src: "stand-in: Soldier B FFIX" },
  "ogre": { boss: 209054, src: "Ogre (FF9)" },
  "ozma": { boss: 209070, src: "Ozma (FF9)" },
  "plant-brain": { boss: 209001, src: "Plant Brain (FF9)" },
  "plant-spider": { enemy: 109019, src: "Plant Spider FFIX" },
  "prison-cage": { boss: 209045, src: "Prison Cage (FF9)" },
  "python": { enemy: 105159, src: "Python FFV" },
  "ragtime-mouse": { boss: 209069, src: "Ragtime Mouse (FF9)" },
  "ralvuimago": { boss: 209015, src: "Ralvuimago (FF9)" },
  "ralvurahva": { boss: 209009, src: "Ralvurahva (FF9)" },
  "red-dragon": { boss: 209048, src: "Red Dragon IX (FF9)" },
  "sahagin": { enemy: 104015, src: "Sahagin FFIV" },
  "sand-golem": { enemy: 109056, src: "Sand Golem FFIX" },
  "sand-scorpion": { enemy: 111005, src: "stand-in: Scorpion FFXI" },
  "sealion": { boss: 209003, src: "Sealion (FF9)" },
  "seeker-bat": { enemy: 105002, src: "stand-in: Steel Bat FFV" },
  "serpion": { enemy: 101023, src: "stand-in: Scorpion FFI" },
  "shell-dragon": { boss: 209059, src: "Shell Dragon (FF9)" },
  "silver-dragon": { boss: 209025, src: "Silver Dragon (FF9)" },
  "skeleton": { enemy: 104030, src: "Skeleton FFIV" },
  "soldier": { enemy: 109063, src: "Soldier B FFIX" },
  "soulcage": { boss: 209018, src: "Soulcage (FF9)" },
  "stroper": { enemy: 105004, src: "Stroper FFV" },
  "taharka": { boss: 209023, src: "Taharka (FF9)" },
  "tiamat": { boss: 209032, src: "Tiamat (FF9)" },
  "tonberry": { enemy: 108063, src: "Tonberry FFVIII" },
  "torama": { enemy: 104091, src: "stand-in: Coeurl FFIV" },
  "trick-sparrow": { enemy: 103020, src: "stand-in: small bird FFIII (unnamed sheet, by eye: FFRK never drew Trick Sparrow)" },
  "troll": { boss: 209074, src: "Troll (FF9)" },
  "type-a": { enemy: 109045, src: "Type A FFIX" },
  "type-b": { enemy: 109061, src: "Type B FFIX" },
  "type-c": { enemy: 109065, src: "Type C FFIX" },
  "ultros": { boss: 206017, src: "Ultros (FF6)" },
  "vice": { enemy: 110107, src: "stand-in: Imp FFX" },
  "weimar": { enemy: 109008, src: "FF9 knight (Pluto Knight sheet, identified by eye)" },
  "wolf": { enemy: 190060, src: "Wolf Devil SoM" },
  "worm-hydra": { enemy: 109114, src: "Worm Hydra FFIX" },
  "wraith": { enemy: 109115, src: "Wraith (Red) FFIX" },
  "wyerd": { enemy: 109024, src: "Wyerd FFIX" },
  "yeti": { boss: 206057, src: "Yeti (FF6)" },
  "zaghnol": { boss: 209084, src: "Zaghnol (FF9)" },
  "zuu": { boss: 204102, src: "Zu (FF4)" },
  "zombie": { enemy: 109081, src: "Zombie FFIX" },
  "baku": { enemy: 109001, src: "stand-in: Masked Man FFIX (James's pick)" },
  "garnet": { player: 109002, src: "Garnet (FFRK party sheet)" },
  "blank": { player: 109066, src: "Blank (FFRK party sheet)" },
  "kuja": { player: 109010, src: "Kuja (FFRK party sheet)" },
  "trance-kuja": { player: 109010, src: "stand-in: Kuja (FFRK party sheet)" },
  // Not monsters: the overworld's stage figures (Moogle, Stiltzkin and Chocobo stages), keyed "npc-…".
  "npc-moogle": { player: 106005, src: "Mog (FFRK party sheet, FF6)" },
  "npc-stiltzkin": { player: 150013, src: "stand-in: Montblanc (FFRK party sheet, FFT) — FFRK never drew Stiltzkin" },
  "npc-chocobo": {
    // Its side-on walk (row 3: ten frames on a 30 px grid), facing left on the sheet.
    crop: { file: "FFRK/Game Boy Advance - Chocobo Land_ A Game of Dice - Playable Characters - Chocobo.png", x: 3, y: 92, w: 26, h: 27, step: 30, count: 10, fps: 8, key: [248, 248, 248], flip: true },
    src: "Chocobo (Chocobo Land: A Game of Dice, GBA)",
  },
};
