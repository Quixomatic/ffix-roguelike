/**
 * FFRK effect candidates for FF9's spells and Magic Swords that have no FFRK ability of the same name. Each lists
 * FFRK effect folders in order of likelihood, with why: FFRK numbers effects by family (11xxx fire, 12xxx ice, 13xxx
 * lightning, 14xxx water, 15xxx black-magic utility, 16xxx time magic, 18xxx bio, 19xxx comet/meteor, 20xxx white
 * magic, 31xxx spellblades) and names many files after the Japanese spell (carele = ケアル Cure, refrek = リフレク
 * Reflect…). The first candidate is assigned by `scripts/seed-ability-effects.ts`; the effects gallery's "FF9 spells"
 * tab lists them all to check and swap.
 */
export type School = "black" | "white" | "blue" | "none";

export interface SpellCandidates {
  /** FF9 action name (party abilities). */
  name: string;
  school: School;
  /** Shown in the gallery ("Summon", "Blue Magic"…); spells leave it out. */
  group?: string;
  /** FFRK effect folder ids, most likely first, with the reason; `launch` names the folder file to use as the launch. */
  candidates: Candidate[];
}

export interface Candidate {
  folder: string;
  why: string;
  launch?: string;
}

export const c = (folder: string, why: string, launch?: string): Candidate => ({ folder, why, ...(launch ? { launch } : {}) });

export const SPELL_CANDIDATES: SpellCandidates[] = [
  // ── white magic ──
  { name: "Cure", school: "white", candidates: [c("20000", "carele sprite (ケアル)"), c("20010", "carele sprite, with a shot")] },
  { name: "Cura", school: "white", candidates: [c("20001", "carelela sprite (ケアルラ); FFRK's Hi-Potion uses it"), c("20011", "carelela sprite, with a shot")] },
  { name: "Regen", school: "white", candidates: [c("20200", "white-magic status range"), c("20201", "white-magic status range")] },
  { name: "Life", school: "white", candidates: [c("20010", "raise-type with a shot"), c("20400", "own art"), c("20011", "raise-type with a shot")] },
  { name: "Full-Life", school: "white", candidates: [c("20011", "raise-type with a shot"), c("20400", "own art")] },
  { name: "Scan", school: "white", candidates: [c("20310", "light lines"), c("20502", "status range")] },
  { name: "Panacea", school: "white", candidates: [c("20301", "poisona hit (ポイゾナ = cure poison)"), c("20302", "Eye Drops' sparkle")] },
  { name: "Stona", school: "white", candidates: [c("20303", "stone art in the status-cure range")] },
  { name: "Esuna", school: "white", candidates: [c("20005", "water-drop cure, own launch/shot"), c("20006", "water-drop cure, own launch/shot"), c("20301", "poisona")] },
  { name: "Silence", school: "white", candidates: [c("20502", "status range"), c("20521", "status range")] },
  { name: "Mini", school: "white", candidates: [c("20510", "own art"), c("20507", "glass pieces")] },
  { name: "Reflect", school: "white", candidates: [c("20508", "refrek sprite (リフレク)")] },
  { name: "Confuse", school: "white", candidates: [c("20521", "status range"), c("20523", "glass hit")] },
  { name: "Blind", school: "white", candidates: [c("20500", "own hit sprite"), c("20504", "status range")] },
  { name: "Float", school: "white", candidates: [c("20526", "wind sprites"), c("20522", "tornado")] },
  { name: "Dispel", school: "white", candidates: [c("20507", "glass pieces"), c("20523", "glass hit"), c("20524", "glass hit")] },
  { name: "Might", school: "white", candidates: [c("20506", "shield art"), c("20510", "own art")] },
  { name: "Jewel", school: "white", candidates: [c("20400", "own art")] },
  // ── black magic ──
  { name: "Blizzard", school: "black", candidates: [c("12000", "ice tier 1 (12001 Blizzara, 12002 Blizzaga)")] },
  { name: "Thunder", school: "black", candidates: [c("13000", "lightning tier 1 (13001 Thundara, 13002 Thundaga)")] },
  { name: "Water", school: "black", candidates: [c("14000", "water tier 1"), c("14001", "water tier 2")] },
  { name: "Sleep", school: "black", candidates: [c("15040", "black utility, own launch/shot"), c("15060", "black utility, own launch/shot")] },
  { name: "Slow", school: "black", candidates: [c("16020", "time-magic circle"), c("15030", "clock parts")] },
  { name: "Stop", school: "black", candidates: [c("16021", "time-magic circle"), c("15032", "clock parts")] },
  { name: "Poison", school: "black", candidates: [c("15010", "sludge hit sprite"), c("18000", "bio art")] },
  { name: "Bio", school: "black", candidates: [c("18000", "img_bio"), c("18001", "img_bio")] },
  { name: "Osmose", school: "black", candidates: [c("15500", "water drop, own launch/shot"), c("15011", "water drop, own launch/shot")] },
  { name: "Drain", school: "black", candidates: [c("15011", "water drop, own launch/shot"), c("15500", "water drop, own launch/shot")] },
  { name: "Demi", school: "black", candidates: [c("15100", "gravity-style damage"), c("15042", "damage, own shot")] },
  { name: "Comet", school: "black", candidates: [c("19020", "commet hit sprite (コメット)")] },
  { name: "Death", school: "black", candidates: [c("15300", "skull sprite")] },
  { name: "Break", school: "black", candidates: [c("15020", "stone art"), c("15021", "stone art")] },
  { name: "Meteor", school: "black", candidates: [c("19050", "meteor sprite (メテオ)")] },
  { name: "Flare", school: "black", candidates: [c("11004", "fire + flare + light lines, own launch/shot"), c("17010", "shards (kakera)")] },
  { name: "Doomsday", school: "black", candidates: [c("17014", "shards + sludge + stone"), c("15400", "meteor-style, own launch/shot")] },
  // ── Steiner's Magic Swords: FFRK's spellblades ──
  { name: "Fire Sword", school: "none", candidates: [c("31001", "Fire Strike")] },
  { name: "Fira Sword", school: "none", candidates: [c("31002", "fire spellblade 2"), c("31001", "Fire Strike")] },
  { name: "Firaga Sword", school: "none", candidates: [c("31002", "fire spellblade 2"), c("31004", "fire spellblade, own launch/shot")] },
  { name: "Blizzard Sword", school: "none", candidates: [c("31005", "ice spellblade")] },
  { name: "Blizzara Sword", school: "none", candidates: [c("31006", "ice spellblade 2"), c("31005", "ice spellblade")] },
  { name: "Blizzaga Sword", school: "none", candidates: [c("31006", "ice spellblade 2"), c("31007", "ice spellblade, own launch/shot")] },
  { name: "Thunder Sword", school: "none", candidates: [c("31009", "Thunder Strike")] },
  { name: "Thundara Sword", school: "none", candidates: [c("31010", "thunder spellblade 2")] },
  { name: "Thundaga Sword", school: "none", candidates: [c("31011", "thunder spellblade 3")] },
  { name: "Water Sword", school: "none", candidates: [c("31013", "water spellblade"), c("31014", "water spellblade, own launch/shot")] },
  { name: "Bio Sword", school: "none", candidates: [c("31032", "Venom Buster")] },
  { name: "Doomsday Sword", school: "none", candidates: [c("31029", "Dark Buster")] },
];

const LAUNCH: Record<School, string> = {
  black: "ab/ability/common/launch_black.json",
  white: "ab/ability/common/launch_white.json",
  blue: "ab/ability/common/launch_blue.json",
  none: "ab/ability/common/launch_empty.json",
};

/**
 * The recipe for an FFRK effect folder: its own launch/shot when it has them (else the school's common launch and an
 * empty shot), and its hit — `<n>_hit.json` or `hit.json`; a shot-only folder (FFRK's summons) plays like FFRK's own
 * summon recipe. Null when the folder has neither. `launchFile` overrides
 * the launch with another file of the folder (e.g. a summon's `magicite.json`, which brings the creature in).
 */
export function folderRecipe(folder: string, files: string[], school: School, launchFile?: string): Record<string, string> | null {
  const has = (f: string) => files.includes(f);
  const pick = (phase: string) => (has(`${folder}_${phase}.json`) ? `${folder}_${phase}.json` : has(`${phase}.json`) ? `${phase}.json` : null);
  const hit = pick("hit");
  const shot = pick("shot");
  // FFRK's summon abilities are shot-only: the creature is the shot (launch_summon → shot → empty hit).
  if (!hit && shot)
    return { launch: "ab/ability/common/launch_summon.json", shot: `ab/ability/${folder}/${shot}`, hit: "ab/ability/common/hit_empty.json" };
  if (!hit) return null;
  const launch = launchFile && has(launchFile) ? launchFile : pick("launch");
  return {
    launch: launch ? `ab/ability/${folder}/${launch}` : LAUNCH[school],
    shot: shot ? `ab/ability/${folder}/${shot}` : "ab/ability/common/shot_empty.json",
    hit: `ab/ability/${folder}/${hit}`,
  };
}
