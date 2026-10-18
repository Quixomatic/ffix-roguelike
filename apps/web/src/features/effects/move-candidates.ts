/**
 * FFRK effect candidates for FF9's other party commands — summons, Sword Art, Dragon, Skill, Flair, Blue Magic and a
 * few singles — that have no FFRK ability of the same name. Same form as `spell-candidates.ts`: folders most likely
 * first, with the evidence. Names apply to every FF9 move called that, party or monster (Blue Magic is mostly
 * monster moves, so this also gives those monsters their own effect instead of a generic default).
 *
 * Evidence: FFRK's summon folders name their creature (`ab_shiva.json`, `ab_efreet.json`, `ab_atomos.json`,
 * `img_madeen`…; magicite summons bring the creature in with `launch.json` or `magicite.json`); file and image names,
 * often Japanese (img_issen 一閃 = iai flash, img_70582_senkoku 宣告 = Doom's countdown, img_gil_enki = thrown gil,
 * img_ycherry, img_dragons_crest, img_Luna, img_mighty_g, img_needle, img_missile, img_curse, img_library = Libra);
 * FFRK's own same-purpose abilities (Armor/Magic Break, Boost, Blade Bash, Intimidate, Bite, Body Slam); and the
 * spell families (skull = death, sludge = poison, wind/tornado, water/ice tiers).
 */
import { ITEM_CANDIDATES } from "./item-candidates";
import { c, SPELL_CANDIDATES, type SpellCandidates } from "./spell-candidates";

export const MOVE_CANDIDATES: SpellCandidates[] = [
  // ── Summon (Garnet, Eiko) ──
  { group: "Summon", name: "Shiva", school: "none", candidates: [c("62010", "ab_shiva creature (magicite)")] },
  { group: "Summon", name: "Ifrit", school: "none", candidates: [c("62000", "ab_efreet creature (magicite)")] },
  { group: "Summon", name: "Ramuh", school: "none", candidates: [c("40420", "img_sammon_ramuh"), c("60016", "img_ramuu (ラムウ), FFRK's Ramuh summon"), c("60110", "img_ramuu")] },
  { group: "Summon", name: "Atomos", school: "none", candidates: [c("62130", "ab_atomos creature (magicite)", "magicite.json")] },
  { group: "Summon", name: "Odin", school: "none", candidates: [c("62051", "img_odin, own launch"), c("62050", "img_odin cut-in (magicite)", "magicite.json")] },
  { group: "Summon", name: "Leviathan", school: "none", candidates: [c("61990", "ab_leviathan creature (magicite)"), c("31504", "ab_leviathan")] },
  { group: "Summon", name: "Bahamut", school: "none", candidates: [c("62070", "ab_bahamut0 creature (magicite)"), c("60210", "img_bahamut + Megaflare"), c("62080", "ab_bahamutkai (magicite)")] },
  { group: "Summon", name: "Ark", school: "none", candidates: [c("62140", "ab_ark creature (magicite)", "magicite.json")] },
  { group: "Summon", name: "Carbuncle", school: "none", candidates: [c("48051", "img_carbuncle_pk"), c("72844", "img_carbuncle_pk")] },
  { group: "Summon", name: "Fenrir", school: "none", candidates: [c("71282", "img_fenrir"), c("70805", "fenrir.json")] },
  { group: "Summon", name: "Madeen", school: "none", candidates: [c("60290", "img_madeen")] },

  // ── Sword Art (Steiner) ──
  { group: "Sword Art", name: "Darkside", school: "none", candidates: [c("31029", "Dark Buster (dark spellblade)"), c("40376", "img_darknight_raid")] },
  { group: "Sword Art", name: "Minus Strike", school: "none", candidates: [c("10116", "Blade Bash"), c("10029", "Wrath")] },
  { group: "Sword Art", name: "Iai Strike", school: "none", candidates: [c("10236", "img_issen (一閃, iai flash) + sword"), c("10301", "img_issen")] },
  { group: "Sword Art", name: "Armour Break", school: "none", candidates: [c("10092", "Armor Break")] },
  { group: "Sword Art", name: "Mental Break", school: "none", candidates: [c("10093", "Magic Break"), c("10091", "Power Break")] },
  { group: "Sword Art", name: "Charge!", school: "none", candidates: [c("10029", "Wrath (power surge)"), c("10095", "Intimidate")] },
  { group: "Sword Art", name: "Thunder Slash", school: "none", candidates: [c("31009", "Thunder Strike"), c("31010", "thunder spellblade 2")] },
  { group: "Sword Art", name: "Stock Break", school: "none", candidates: [c("71153", "img_shock_ziware (ground-cracking shock)"), c("10116", "Blade Bash")] },
  { group: "Sword Art", name: "Shock", school: "none", candidates: [c("71153", "img_shock_ziware"), c("10116", "Blade Bash")] },
  { group: "Sword Magic", name: "Flare Sword", school: "none", candidates: [c("11004", "Flare's hit")] },

  // ── Dragon (Freya) ──
  { group: "Dragon", name: "Lancer", school: "none", candidates: [c("10003", "Jump (lance strike)"), c("48151", "img_ronzo_jump")] },
  { group: "Dragon", name: "Reis's Wind", school: "white", candidates: [c("20200", "Regen range"), c("20526", "wind sprites")] },
  { group: "Dragon", name: "Dragon Breath", school: "none", candidates: [c("60210", "Bahamut's Megaflare breath"), c("62070", "ab_bahamut0")] },
  { group: "Dragon", name: "White Draw", school: "white", candidates: [c("20001", "carelela sparkle"), c("20302", "status-cure sparkle")] },
  { group: "Dragon", name: "Luna", school: "none", candidates: [c("71209", "img_Luna"), c("10925", "img_lunar")] },
  { group: "Dragon", name: "Six Dragons", school: "none", candidates: [c("74262", "img_sixt"), c("71196", "img_dragons_crest")] },
  { group: "Dragon", name: "Cherry Blossom", school: "none", candidates: [c("32287", "img_ycherry (cherry blossoms)")] },
  { group: "Dragon", name: "Dragon's Crest", school: "none", candidates: [c("71196", "img_dragons_crest")] },

  // ── Skill (Zidane) — Flee plays nothing on purpose ──
  { group: "Skill", name: "Steal", school: "none", candidates: [c("30004", "Zidane's dagger slash")] },
  { group: "Skill", name: "Detect", school: "white", candidates: [c("71781", "img_library (Libra)"), c("20310", "Scan's light lines")] },
  { group: "Skill", name: "What's That!?", school: "none", candidates: [c("10095", "Intimidate")] },
  { group: "Skill", name: "Soul Blade", school: "none", candidates: [c("10116", "Blade Bash"), c("31029", "Dark Buster")] },
  { group: "Skill", name: "Annoy", school: "none", candidates: [c("10095", "Intimidate")] },
  { group: "Skill", name: "Sacrifice", school: "none", candidates: [c("70924", "img_candleheal (self-giving heal)"), c("20011", "raise-type")] },
  { group: "Skill", name: "Lucky Seven", school: "none", candidates: [c("71416", "slot reels (img_break_heart_slot)"), c("70777", "img_kira")] },
  { group: "Skill", name: "Thievery", school: "none", candidates: [c("70999", "Dagger of Resolve (Zidane's)"), c("71444", "Solution 9 (Zidane's)")] },

  // ── Flair (Amarant) ──
  { group: "Flair", name: "Chakra", school: "white", candidates: [c("20000", "carele heal"), c("70924", "img_candleheal")] },
  { group: "Flair", name: "Spare Change", school: "none", candidates: [c("31564", "img_gil_enki (thrown gil)")] },
  { group: "Flair", name: "No Mercy", school: "none", candidates: [c("50501", "Punch"), c("10116", "Blade Bash")] },
  { group: "Flair", name: "Aura", school: "white", candidates: [c("20200", "Regen range"), c("70777", "img_baria (barrier)")] },
  { group: "Flair", name: "Curse", school: "none", candidates: [c("74142", "img_curse")] },
  { group: "Flair", name: "Demi Shock", school: "none", candidates: [c("15100", "gravity-style damage"), c("71153", "img_shock_ziware")] },
  { group: "Flair", name: "Countdown", school: "none", candidates: [c("70582", "img_70582_senkoku (宣告, Doom's countdown)"), c("51638", "senkoku")] },

  // ── Blue Magic (Quina; most are monster moves too) ──
  { group: "Blue Magic", name: "Goblin Punch", school: "none", candidates: [c("50501", "Punch")] },
  { group: "Blue Magic", name: "LV5 Death", school: "blue", candidates: [c("15300", "skull sprite")] },
  { group: "Blue Magic", name: "LV4 Holy", school: "blue", candidates: [c("33077", "holy pillars")] },
  { group: "Blue Magic", name: "LV3 Def-less", school: "blue", candidates: [c("10092", "Armor Break")] },
  { group: "Blue Magic", name: "Doom", school: "blue", candidates: [c("70582", "img_70582_senkoku (宣告 = Doom)"), c("51638", "senkoku")] },
  { group: "Blue Magic", name: "Roulette", school: "blue", candidates: [c("15300", "skull sprite"), c("71416", "slot reels")] },
  { group: "Blue Magic", name: "Aqua Breath", school: "blue", candidates: [c("14001", "water tier 2"), c("71674", "img_neo_aqua_saber")] },
  { group: "Blue Magic", name: "Mighty Guard", school: "blue", candidates: [c("71485", "img_mighty_g_great_buff")] },
  { group: "Blue Magic", name: "Matra Magic", school: "blue", candidates: [c("50226", "img_missile")] },
  { group: "Blue Magic", name: "Bad Breath", school: "blue", candidates: [c("15010", "sludge sprite (eff_doro)"), c("31032", "Venom Buster")] },
  { group: "Blue Magic", name: "Limit Glove", school: "blue", candidates: [c("50501", "Punch"), c("10116", "Blade Bash")] },
  { group: "Blue Magic", name: "1,000 Needles", school: "blue", candidates: [c("33004", "img_needle")] },
  { group: "Blue Magic", name: "Pumpkin Head", school: "blue", candidates: [c("10095", "Intimidate")] },
  { group: "Blue Magic", name: "Night", school: "blue", candidates: [c("15040", "sleep (black utility)"), c("40376", "dark wind")] },
  { group: "Blue Magic", name: "Twister", school: "blue", candidates: [c("20522", "tornado"), c("71444", "img_mir_twister")] },
  { group: "Blue Magic", name: "Angel's Snack", school: "blue", candidates: [c("20302", "status-cure sparkle"), c("51082", "img_angel")] },
  { group: "Blue Magic", name: "Frog Drop", school: "blue", candidates: [c("50216", "Body Slam (a drop from above)")] },
  { group: "Blue Magic", name: "White Wind", school: "blue", candidates: [c("20526", "wind sprites"), c("20007", "Curaga")] },
  { group: "Blue Magic", name: "Vanish", school: "blue", candidates: [c("71453", "img_resolclear (fade out)"), c("20526", "wind sprites")] },
  { group: "Blue Magic", name: "Freeze", school: "blue", candidates: [c("12002", "Blizzaga"), c("62010", "Shiva's ice shock")] },
  { group: "Blue Magic", name: "Mustard Bomb", school: "blue", candidates: [c("50575", "img_50575_bomb"), c("40199", "img_bomb")] },
  { group: "Blue Magic", name: "Magic Hammer", school: "blue", candidates: [c("30031", "hammer hit sprite")] },
  { group: "Blue Magic", name: "Auto-Life", school: "blue", candidates: [c("20010", "raise-type with a shot"), c("60015", "Phoenix")] },

  // ── singles ──
  { group: "Eat", name: "Eat", school: "none", candidates: [c("50220", "Bite (img_fang2)")] },
  { group: "Focus", name: "Focus", school: "none", candidates: [c("10006", "Boost")] },

  // ── Monster moves that would otherwise get the generic claw swipe or status sparkle ──
  // Weapons and body attacks: FFRK's weapon-type hits (300xx) and monster attacks (50xxx).
  ...monster(["Knife", "Rusty Knife", "Trouble Knife", "Stab", "Dagger's first hit", "Mug"], [c("30004", "dagger slash")]),
  ...monster(["Slash", "Blade", "Cleave", "Hack", "Chop", "Helm Divide", "Whirl Slash", "Slice", "Edge", "Taste steel!", "Saw", "Raining Swords", "Sword Quiver", "Judgment Sword"], [c("30003", "sword slash")]),
  ...monster(["Spear", "Impale", "Horn", "Counter Horn", "Stinger", "Sting", "Antenna"], [c("30044", "spear thrust")]),
  ...monster(["Axe", "Hatchet"], [c("30021", "axe hit (eff_ono 斧)"), c("30022", "axe hit")]),
  ...monster(["Fist", "Slap", "Silent Slap", "Smash", "Knock Down", "Head Attack", "Hit"], [c("30054", "fist strike (knock)")]),
  ...monster(["Body Ram", "Ram", "Charge", "Rolling Attack", "Fat Press", "Heave", "The Drop", "Dive", "Crash", "Stretch", "Rrrragh!"], [c("50216", "Body Slam")]),
  ...monster(["Tentacle", "Right Tentacle", "Left Tentacle", "Right Stem", "Left Stem", "Thorn Whip", "String", "Clamp Pinch", "Virus Tentacles", "Leg"], [c("50213", "Eight Arms")]),
  ...monster(["Beak", "Swallow", "Stomach", "Virus Crunch"], [c("50220", "Bite")]),
  ...monster(["Wings", "Wing", "Propeller Wind", "High Wind", "Whirlwind"], [c("50889", "Aerospark (wind)"), c("20522", "tornado")]),
  ...monster(["Boomerang"], [c("50619", "img_boomerang")]),
  ...monster(["Cannon", "Rapid Fire"], [c("50952", "eff_gun")]),
  ...monster(["Blowup"], [c("40199", "img_bomb"), c("50575", "img_50575_bomb")]),
  // Named magic and specials.
  ...monster(["3,000 Needles", "10,000 Needles"], [c("33004", "img_needle")]),
  ...monster(["LV2 Death +", "LV3 Death", "LV4 Death", "Mega Death", "Death Cutter"], [c("15300", "skull sprite")]),
  ...monster(["Final Sentence", "LV2 Doom"], [c("70582", "img_70582_senkoku (宣告 = Doom)")]),
  ...monster(["Flare Star", "LV2 Flare", "Nanoflare"], [c("11004", "Flare")]),
  ...monster(["Curaja"], [c("20007", "Curaga")], "white"),
  ...monster(["Elixir"], [c("20001", "carelela sparkle")], "white"),
  ...monster(["Dispelga", "Release Dispelga"], [c("20507", "glass pieces (dispel)")], "white"),
  ...monster(["Petrify", "Gradual Petrify", "Stone"], [c("20303", "stone art"), c("15020", "stone art")]),
  ...monster(["Mind Blast"], [c("60027", "img_60027_mindflare")]),
  ...monster(["Glowing Eyes", "Hypnotize"], [c("50203", "orso_eye")]),
  ...monster(["Bubbles", "Bubble-gun"], [c("50533", "img_bubble_gray")]),
  ...monster(["Maelstrom", "Tidal Wave", "Tsunami", "Waterga", "Water-gun"], [c("14002", "water tier 3"), c("14001", "water tier 2")], "black"),
  ...monster(["Cold Breath", "Snowstorm", "Cocytus"], [c("12002", "Blizzaga")], "black"),
  ...monster(["Ultra Sound Wave", "Shriek", "Screech"], [c("10095", "Intimidate (a shout)")]),
  ...monster(["Shockwave", "Blue Shockwave"], [c("71153", "img_shock_ziware")]),
  ...monster(["Solution", "Meo Twister"], [c("71444", "Solution 9 / img_mir_twister (Zidane's)")]),
  ...monster(["Neutron Ring", "Photon"], [c("50234", "Energy Ray")]),
  ...monster(["Venom Powder", "Virus Powder", "Viral Smoke", "Zombie Powder"], [c("50346", "Pollen")]),
  ...monster(["Venom Breath", "Zombie Breath"], [c("15010", "sludge sprite"), c("31032", "Venom Buster")]),
  ...monster(["Ink", "Web", "Mucus", "Trouble Mucus"], [c("50221", "Slime")]),
  ...monster(["Sleeping Juice"], [c("15040", "sleep")], "black"),
  ...monster(["Silent Kiss", "Devil's Kiss"], [c("20502", "status range")]),
  ...monster(["Sandstorm"], [c("33052", "earth (Quake)")]),
];

/** The same candidates for several monster move names. */
function monster(names: string[], candidates: ReturnType<typeof c>[], school: SpellCandidates["school"] = "none"): SpellCandidates[] {
  return names.map((name) => ({ group: "Monster", name, school, candidates }));
}

/** Spells first, then the other commands, then items — what `effects:seed` and the gallery's candidates go through. */
export const ALL_CANDIDATES: SpellCandidates[] = [...SPELL_CANDIDATES.map((s) => ({ group: "Magic", ...s })), ...MOVE_CANDIDATES, ...ITEM_CANDIDATES];
