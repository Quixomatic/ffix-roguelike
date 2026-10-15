# Changelog

All notable changes to ffix-roguelike are documented here.

## [0.1.41] - 2026-10-15

Every item has a pixel-art icon, and a new Items page shows them all.

### Added
- **Item icons for all 255 FF9 items** — weapons, armour, helmets, hats, gloves, boots, rings, ribbons, gems, potions — from the Time Fantasy "1000+ Fantasy RPG Icons" pack (finalbossblues; 16×16 pixel art in the FF6 vein). Each item is mapped by hand to the closest icon (`apps/web/scripts/item-icon-map.ts`): Zidane's daggers and thief swords, Vivi's staves (Flame Staff → the fire staff), Freya's spears, Amarant's claws, Quina's forks (tridents), Garnet's rods and rackets, Eiko's flutes, Phoenix Down → a red feather, gems → matching gemstones.
- `pnpm -F web sprites:items [--tf]` packs only the mapped icons (209 distinct) into `public/sprites/items.png` + `item-icons.gen.ts`; `--tf` uses the pack's muted Time Fantasy palette. The pack itself stays in `.docs/assets/finalbossblues` (git-ignored).
- **`/items` page** (header: Items): every item with its icon — filter by slot and character, search, view at 16/32/48/64 px, click for stats.
- Icons in the menus: item cards (rewards, shops, gear), the paperdoll's slots and the gear picker.

## [0.1.40] - 2026-10-15

The party swings weapons: an FFRK-style weapon rig draws a weapon in each hero's hand during attacks.

### Added
- **Weapons in hand.** FFRK draws the weapon as its own sprite between the body and a separate arm piece, so the hand closes over the grip. The hero strips now carry those arm pieces (`left_arm_3` raised, `left_arm_4` extended), and attacks play raise → forward → slash: the weapon starts raised behind (90°), comes up and forward (0°), and ends in a downward slash (−90°), always in 90° steps so the pixels stay crisp.
- The slicer finds each hero's hand on the arm pieces (top of the raised arm, front of the extended one) and each weapon's grip (weapons are all drawn tip up-left), and records them in `hero-sheets.gen.ts` (`rig` per attack frame, `WEAPON_GRIPS`). Weapon cells go to `public/sprites/weapons/<id>.png`.
- **Stand-in weapons for now** (one per hero, from FFRK's weapon sprite pool): Zidane a dagger, Vivi a staff, Garnet and Eiko a rod, Steiner, Blank and Marcus a sword, Beatrix a long sword, Freya and Quina a spear, Amarant claws. Next: the equipped FF9 weapon picks its own sprite.

### Changed
- The attack animation uses FFRK's raise/swing poses (`left_arm_1` → `left_arm_2`) instead of the off-hand `right_arm` frames.

## [0.1.39] - 2026-10-15

FFRK asset tooling: every party, boss and enemy sheet with its frame data, the battle weapon sprites, and gear icons.

### Added
- `pnpm -F web ffrk:fetch weapons` — FFRK's 408 battle weapon sprites (`equip/weapon/100001…`, the pool characters swing; FFRK names them only by number).
- `pnpm -F web ffrk:fetch icons [--all-realms]` — every relic's menu art (48/112/256 px) from the community Enlir database's relic list (`.refs/enlir/relics.csv`), with `icons/relics.json` (id → name, type, slot, realm, rarity). FF9's by default.
- `.refs/` (git-ignored) for third-party reference repos and data: the FFRK sprite grabber, ffrk-json, FFRK Inspector (ffrkx), lynchpt/FFRK, ffrk-proxy, and the Enlir database export.

### Notes
- Downloaded so far (in `.docs/assets/FFRK-data`, git-ignored): 471 party sheets, 2,335 boss sheets (+ animation files), 1,292 enemy sheets, 408 weapon sprites. 229 party and 652 boss sheets matched the Spriters Resource rips by pixels (43 of the 53 FF9 bosses).
- Only 29 of FF9's 238 gear pieces exist as FF9 relics in FFRK (most of FF9's signature weapons never became relics), so same-named relics from other games will stand in where FF9's is missing.

## [0.1.38] - 2026-10-15

The party's sprites now use FFRK's own frame data: every pose is the one FFRK intended, and Blank has a sprite too.

### Fixed
- **Wrong poses** (e.g. Zidane's Blind-status frames showing as blinks, guessed attack/hurt frames). FFRK's server still hosts each sheet's TexturePacker atlas, which names every frame (`base_idle`, `base_ready`, `base_walk`, `base_left_arm_1` → `base_right_arm_1/2` for the swing, `base_chant_1/2`, `base_hands_up`, `base_damage`, `base_fatal`, `base_dead`; `glass_*` = Blind, `frog_*`, `mini_*`, `sleep`, `stone`). The slicer now builds every strip from those names and FFRK's own 32×32 placement, so poses line up exactly.

### Added
- **Blank's sprite** (FFRK sheet 109066) — the whole party now uses FFRK art.
- `pnpm -F web ffrk:fetch [characters|bosses|enemies]` downloads FFRK's sheets + atlases (and the boss animation files) into `.docs/assets/FFRK-data/_raw` (git-ignored); `pnpm -F web ffrk:organize` matches them to the Spriters Resource rips by pixels and lays them out like `.docs/assets/FFRK` (`<rip name>.png/.json/.anim.json/.id`, unmatched sheets under `_unmatched/<id>`, `index.json`).

### Changed
- `pnpm -F web sprites:heroes` reads the downloaded atlases (hero → FFRK id map in the script). Animations: attack = step, raise, swing; cast = chant loop then hands up; item = hands up; victory = cheer; hurt, Low HP kneel, KO from their own frames.

## [0.1.37] - 2026-10-15

The camp roster shows every character you haven't recruited yet, including the story recruits.

### Fixed
- **Vivi, Steiner, Garnet, Freya and Quina were missing from the camp roster until they joined.** The greyed "???" cards only came from the interim milestone unlocks (Amarant, Eiko, Beatrix, Blank); story recruits join by clearing journeys 1–5 and weren't listed at all. The roster now shows them in journey order with how to get them ("Clear the journey "The Evil Forest""), then the milestone ones (`lockedCharacters` in game-core; `profile.get` uses it).
- Changelog correction for v0.1.36: hero idle is the plain standing frame (no blink) until the FFRK pose labels are fixed — the "blink" frames turned out to be FF9's Blind-status sprites.

## [0.1.36] - 2026-10-15

The party has real sprites: FF Record Keeper's FF9 sheets, animated in battle, on the overworld and in every menu.

### Added
- **Party sprites from FFRK** for Zidane, Vivi, Garnet, Steiner, Freya, Quina, Eiko, Amarant and Beatrix (plus Marcus). Each hero is a 32×32-cell strip in `apps/web/public/sprites/heroes/` with the same animations: idle (with blinks), ready, walk, attack, chant, cast, item, defend, hurt, dying (Low HP kneel), KO, victory and evade. Blank has no FFRK sheet and keeps the placeholder.
- **Battle**: heroes stand in the pose their state calls for (KO, victory, defend, chanting while a spell waits, ready when their turn comes, kneeling below ⅙ HP, otherwise idle), and play attack/cast/item/defend on their actions, hurt when hit and evade on a miss. Petrify, Stop, Freeze and Sleep freeze the animation; Trance/poison/stone tints still apply.
- **Overworld**: the lead character idles and walks between stages.
- **Menus** (camp roster, paperdoll, title screen, party panel, stage panels, results screens): the real sprite at a crisp integer scale with an idle/blink loop; the victory screen plays the victory pose.
- `pnpm -F web sprites:heroes [--preview <dir>]` re-slices the sheets from `.docs/assets/FFRK` (`apps/web/scripts/slice-hero-sprites.ts`; the poses' positions on each sheet are a per-hero manifest in the script).

### Notes
- Weapons aren't drawn yet (FFRK draws them as separate overlay pieces).

## [0.1.35] - 2026-10-15

Fixes "Rendered more hooks than during the previous render" when reloading or starting a run.

### Fixed
- **The run screen crashed with "Something went wrong! Rendered more hooks than during the previous render"** on reload and when a run started. The hook that loads a battle's FF9 AI script (v0.1.31) ran after the "Loading…" early return, so the first render and the next one called different hooks. It now runs before any early return.

## [0.1.34] - 2026-10-15

No more frozen fights: battles play FF9's phases straight through, and a fight can never hang on a story event that can't happen here.

### Fixed
- **Black Waltz No.1 + Sealion (Ice Cavern boss) never ended.** Our engine treated a unit the script had made invisible as untargetable; in FF9 only the "targetable" flag decides that ("disappear" just stops it being drawn until Black Waltz No.1 calls the Sealion in). The Sealion can be hit again and the fight plays out.
- **Long frozen stretches in scripted fights.** Intros, battle dialogue and staged deaths now play out at once while nothing is animating — e.g. Valia Pira's nine taunts (~33 s of nothing on screen), the Chaos guardians' openings, Plant Brain's phase change. Animations still take their time.
- **Monsters whose AI depends on their stance** (Zorn & Thorn, Black Waltz No.3 and ~130 other scenes) repeated "Continue" forever: the stance is switched by FF9's attack animations, which we don't run. The importer now records which attack switches it, and the battle AI applies it; scripts also read the stance as FF9 does (it starts at 0).
- A boss at 0 HP whose script never stages its ending is held for 6 s instead of 30 s before it simply dies.
- **Masked Man's script props showed as enemies**: the hidden, untargetable masks are no longer drawn or listed.

### Changed
- **Alexandria's boss is Baku** (FF9's real Baku fight, BR_E008 — Zidane against the boss of Tantalus, with a real game over). Masked Man is out: in FF9 it's the prologue's staged fight (no game over, the masks are props).
- **Stall watchdog**: if nothing happens for 45 s and no one is waiting for the player, the fight ends ("The enemy withdrew") instead of freezing. It only ever fires on FF9 story set pieces, which stay out of the pools; the encounter test fails if any area fight needs it.
- A fight saved mid-battle under the old rules restarts under the new ones (battle rules version 2).

### Added
- `pnpm -F @ffix-roguelike/game-core sweep [SCENE…]` — plays every FF9 battle scene and reports stalls, watchdog endings, long idle stretches, pauses and held deaths.
- The encounter test now covers every area's bosses too (209 fights). New VM tests: Valia Pira's intro, the hidden-but-targetable Sealion, Masked Man's props, the Prison Cage watchdog.

### Notes
- Gizamaluke isn't bugged: his script raises his HP to 65,535 and he falls after 13,875 damage (FF9's own trick). The 0% in the balance sim was a party in starter gear. Same for Zorn & Thorn.

## [0.1.33] - 2026-10-14

All of FF9's data now lives in Postgres — the character, ability and item tables join the battle data.

### Changed
- **FF9's game tables are in the database**: characters, abilities/spells (actions), items, support abilities, synthesis recipes, shops, statuses and the level table move from JSON compiled into the code to `ff9_character`, `ff9_action`, `ff9_item`, `ff9_support_ability`, `ff9_synthesis`, `ff9_shop`, `ff9_status` and `ff9_level` (migration `ff9_game_tables`). Their seed files sit with the battle data in `packages/db/seed/ff9`, and the server's boot seed covers them all (one hash over every seed file).
- The server loads the game tables, bestiary and battle scripts from the DB at startup; the web app gets the tables and bestiary in one request (`content.ff9`, replacing `content.bestiary`) before rendering. Tests and `pnpm sim` read the seed files.
- game-data's tables are runtime registries (`registerGameData`); lookups, the engine's status rules and the legendary-gear list are built lazily so nothing reads FF9 data at import time (verified by importing every package with nothing registered).
- `import:memoria` writes its tables to `packages/db/seed/ff9`.
- `probe-ff9-data` reports the game tables too; the seed hash is computed in one place for the seeder and the probe.

### Notes
- Game design that is ours (areas, journeys, crossover monsters, events, achievements, unlock rules, balance switches) stays in code, so client and server always run the same rules and old battles keep replaying.

## [0.1.32] - 2026-10-14

No more stuck fights: FF9's story set pieces are out of the random pools, and a test keeps them out.

### Fixed
- **The prologue Bomb fight could never end** (it grows until a cutscene ends the battle in FF9) — it's out of Alexandria's pool. So are the other set pieces that only end on story cues: Haagen & Weimar (ended itself after 3 seconds), Prison Cage + Garnet (Evil Forest elite) and the second Prison Cage (Mist Plains boss).
- **"Mu" elites were FF9's friendly Mu** (asks for an item and leaves) — replaced with real Goblin/Python packs.

### Changed
- Alexandria: Mu, Goblin/Python, Goblin/Fang encounters; Goblin/Python packs as elites. Evil Forest elites: Plant Spider and a Goblin/Fang pack. Mist Plains elites: Carve Spider/Python and Goblin/Python packs; boss: the Wyerd pair.

### Added
- **Encounter test** (`content/encounters.test.ts`): every spawn pattern of every area's battles and elites is played out under FF9's scripts and must end in a real win or loss — no stall, no monster left standing at "victory" (197 fights).

## [0.1.31] - 2026-10-14

FF9's own battle AI: every FF9 monster and boss now fights with its real compiled AI script from the game.

### Added
- **FF9 battle script VM** (`game-core/src/battle/ai/`): a port of the part of Memoria's EventEngine that battle AI uses — script parsing and a disassembler (`bun scripts/disasm.ts <SCENE>`), the expression evaluator (all 56 operators the scripts use, including the per-unit list operators and random picks), variables (global/map/instance, system lists, unit members), flow control, and the battle opcodes (choosing an attack and target, special attacks, battle code: pausing the ATB, ending the battle, adding gil…). All 562 battle scripts (108,630 instructions) decode with no errors; all 21 opcodes, 17 system values and 42 unit properties they use are supported. The VM's state lives in the battle state, so replays stay exact.
- Monsters pick their moves, counters, phase changes and death sequences the way FF9 does: Plant Brain opens with Pollen and changes phase after six turns; Masked Man takes "Oww!" reaction turns; random encounters use only their own monsters' attacks; Hades and Ozma run their full scripts.
- FF9's scripted-death bosses: scripts see the hidden +10,000 HP buffer, and a boss at 0 HP is held for its script to stage the ending.
- **Every battle carries its scene** (`createBattle({ scene })`); units carry their FF9 type and spawn slot (untargetable script pieces are fielded too, as in FF9).
- **Scripts load per battle**: the server registers every scene's script from Postgres at startup; the browser fetches just the current fight's script (`content.battleScript`) before the battle starts. Tests and `pnpm sim` load them from the seed files.
- 12 VM tests (all 562 scenes start and their enemies act; Plant Brain, a Goblin/Fang encounter, Hades and Ozma; determinism and replay).

### Changed
- **Small parties no longer face whole FF9 groups in regular battles**: when even a scene's smallest group is bigger than the party allows, the extra monsters stay home (bosses keep their full groups).
- The auto-battle AI and target menus skip units a script has hidden or made untargetable.
- `pnpm sim battle --enemies @EF_E009` fights FF9 scenes; `sim balance` rolls scene groups like a real run.

### Known issues
- A few scripted story fights wait for story events the roguelike doesn't have (Black Waltz No.1 + Sealion, the Prison Cage) and can stall; Gizamaluke looks far too hard. Being investigated next.
- Story progress flags start at zero, so scripts take their early-story branches.

## [0.1.30] - 2026-10-14

FF9 monsters were hitting about twice as hard as they should, and Alexandria threw story set pieces at a lone Zidane.

### Fixed
- **FF9 monster attacks used double power.** Real FF9 moves were treated like this project's shorthand enemy moves, whose power is *added* to the monster's attack — so e.g. Masked Man's Gwahaha! hit with 13 + 13 power instead of 13. FF9 moves now use exactly their own power.

### Changed
- **Alexandria (Journey 1, map 1)** now uses FF9's first real random encounters (Mu, Goblin/Python, Goblin/Fang) plus the castle fight against Haagen & Weimar and the Mu ambush; Masked Man stays the boss. The play's scripted set pieces (King Leo's "Poly"/"Pyro" stage effects, Blank) are out of the random pool — they only make sense inside the story.

## [0.1.29] - 2026-10-14

Probe scripts for the database, ChannelGuide-style — and a fix they caught on the first run.

### Added
- **`apps/server/scripts/probe-ff9-data.ts [scene|monster …]`** — FF9 battle data in Postgres: row counts, scenes with AI scripts, whether the loaded data matches the seed files, integrity (every scene's monster types and attack slots point at real rows), and coverage (every FF9 scene the game's areas use exists and every spawn pattern resolves). Details per scene (`EF_E009`) or monster (`"Plant Brain"`): stats, elements, immunities, steal/drop tables, attacks. Exits 1 on problems.
- **`apps/server/scripts/probe-player.ts [email]`** — every account at a glance, or one player's profile, characters, unlocks and active run, with checks that the run still loads under the current rules and that a fight in progress replays from its recorded inputs (what the server does to verify battles).
- The server app depends on game-core and game-data directly (for the probes).

### Fixed
- **FF9 scene lookups were indexed at startup, before the bestiary was loaded from the database**, so the server would have reported "Unknown FF9 battle scene" for every FF9 encounter. Scene and monster lookups now rebuild whenever the bestiary is registered.

## [0.1.28] - 2026-10-14

Fixes "Unknown enemy @EF_E009" on the camp screen.

### Fixed
- **Camp crashed with "Unknown enemy @EF_E009"**: journey cards looked up FF9 battle-scene encounters as if they were monster ids. They now show the scene's monsters by name ("Final boss: Plant Brain").
- The practice battle builds FF9 scene encounters (and lists them by monster name).
- **Boss kills from FF9 scenes are recorded by the monster's name** (`plant-brain`, `hades`, `ozma`) instead of the scene token, so unlocks and achievements that check boss kills keep working and don't depend on import order.

### Changed
- A scene encounter without a rolled pattern means its main group (FF9's catch-all pattern).

## [0.1.27] - 2026-10-14

FF9's real bestiary: every monster, attack and battle scene from the game, stored in Postgres and seeded on server startup. The Disc-1 journeys now fight FF9's actual encounters.

### Added
- **FF9 battle data import** (`game-data/scripts/import-ff9-battles.ts`): reads Memoria's battle export (562 battle scenes) into 218 unique monsters (real HP, MP, Str/Mag/Spirit/Speed, Def/MDef, Evade, level, element weaknesses/resistances/absorbs, status immunities, auto-statuses, steal and drop tables, EXP/gil/AP, Blue Magic) and 872 real attacks (power, element, status, hit rate, script). FF9's "+10,000 HP" scripted-death bosses get their true HP back (Hades and Ozma: 55,535). Each scene keeps its enemy types, attack table and spawn patterns.
- **FF9 battle AI scripts** extracted from the game (`extract-battle-scripts.py`, `p0data7.bin` → 562 `EVT_BATTLE_*.eb`), stored for the script VM (in progress).
- **Postgres tables** `ff9_enemy`, `ff9_enemy_action`, `ff9_battle_scene` (with the AI script bytes) and `ff9_import` (migrations `ff9_battle_data`, `ff9_import_version`). Seed data lives in `packages/db/seed/ff9`; **the server seeds on startup** whenever it's missing or changed (idempotent, like ChannelGuide's boot seeds). `pnpm -F @ffix-roguelike/db db:seed:ff9` forces a reload.
- The server loads the bestiary from the DB into game-core once per process; the web app loads it through `content.bestiary` before rendering. Tests and `pnpm sim` read the seed files.
- **Every FF9 monster is usable** (`ff9-<uid>` bestiary ids) with its real attacks.
- **Encounters can be FF9 battle scenes** (`"@EF_R004"`): the group is rolled with FF9's own pattern rates, so fights are exactly the groups FF9 throws at you (small parties prefer the smaller patterns).

### Changed
- **The Disc-1 journeys use FF9's real fights**: Alexandria = the prologue battles (Haagen & Weimar, the Bomb, Blank, King Leo) and Masked Man; Evil Forest = Goblin/Fang, Dendrobium, Plant Spider packs, Prison Cage, Plant Brain; Mist Plains = Mu, Python/Goblin, Carve Spider; Ice Cavern = Flan/Cave Imp, Wyerd, then Black Waltz No.1 with Sealion; Eunorus Plains and Dali's underground (Vice, Hedgehog Pie, Ghost, Ladybug, Skeleton, Mandragora, Clipper, Serpion) and Black Waltz No.2; Lindblum Fields (Lizard Man, Axe Beak, Skeleton, Carve Spider, Trick Sparrow, Yeti, Bomb) and the Festival of the Hunt's real fights with Zaghnol; Qu's Marsh (Axolotl, Gigan Toad, Sahagin); Gizamaluke's Grotto (Hornet, Lamia, Skeleton, the black mage ambush) and Gizamaluke.
- Hand-written FF9 monsters now use their real stats, steals and attacks (Goblin: Knife + Goblin Punch; Plant Brain: both tentacles, Thunder, Pollen…).
- Monsters FF9 doesn't have (the FF1–FF6 crossovers) use a stat curve fitted to FF9's random encounters (Def/MDef ≈ 12, Str ≈ 8 + 0.3·Lv, attack ≈ 6 + 1.3·Lv, HP ≈ 4·Lv² + 20·Lv) instead of the old, far too fragile one — the reason Level 1 hits were doing 100+ damage.
- Rewards for FF9 monsters are FF9's (EXP, gil, AP, drops at 256/96/32/1); bosses that gave no EXP in FF9 pay the curve so Completion Points keep flowing.
- The balance simulator builds characters in their starting gear.

### Notes
- Old balance tests are skipped until the balance pass with the real AI scripts (solo early journeys are now very hard with FF9's numbers).

## [0.1.26] - 2026-10-14

Characters start every run in their FF9 starting outfit again, behind a balance switch.

### Changed
- **`STARTER_ARMOR`** (game-core `stats.ts`): `"all"` (default) — every run starts in the character's FF9 starting gear (e.g. Zidane's Leather Hat, Wrist and Leather Shirt); `"body"` — body armour only; `"none"` — nothing until the slot is unlocked. FF9's monster stats assume armour: a Goblin's Knife hits Zidane for about 18 in his starting gear and about 72 without.
- Locked slots still can't be changed: unlocking a slot with Completion Points is what lets found gear go there.

## [0.1.25] - 2026-10-14

Saved mid-battle runs survive the engine change.

### Fixed
- A run saved in the middle of a fight under the old engine couldn't be replayed by the new FF9 engine. Loading such a run now restarts that fight (same enemies) under the new rules; everything else in the run is kept.

## [0.1.24] - 2026-10-14

FF9's battle system, ported faithfully from Memoria's source: every battle script, every support ability, the real status and ATB rules, Trance specials, Cover/Protect Girls, counters and Reflect.

### Added
- **Battle calculator ported from Memoria** (`battle/calc.ts`): FF9's BattleCalculator and all ~100 battle scripts used by FF9's abilities — weapon formulas 1–7, Zidane's Skills/Dyne, Sword Arts, Magic Sword, Blue Magic (Goblin Punch, LV5 Death, LV4 Holy, LV3 Def-less, Matra Magic, Limit Glove, White Wind, Mighty Guard…), Spare Change (costs gil), Lucky Seven, Thievery, Dragon's Crest, Six Dragons, Curse, Chakra, Charge!, Sacrifice, Soul Blade, Lancer, Dragon Breath, White Draw, summons (+gem bonuses, short/long summons), Atomos, Odin, Phoenix, Comet/Meteor misses, steal rates by slot, Eat/Cook, items (Potion = power × 15, Elixir, Phoenix Down, Soft on stone monsters, Dead Pepper, Tent…). Damage modifiers stack on Attack (×1.5 / ×½) exactly like FF9.
- **All 64 support abilities**: Cover, Protect Girls, Counter, Eye 4 Eye, Return Magic, Auto-Potion, Restore HP, Absorb MP, Reflect-Null, Reflect×2, Mag Elem Null, Distract, Accuracy+, Healer (and the Healing Rod), Power Up, Power Throw, Boost, Odin's Sword, Gamble Defence, Add Status, Chemist, Concentrate, killers, MP Attack, Long Reach, High Jump, Master Thief, Bandit, Steal Gil, Mug, Flee-Gil, Initiative (preemptive strikes), Alert (no back attacks), Auto-Reflect/Float/Haste/Regen/Life, and every status guard.
- **Trance specials**: Double Black / Double White (two spells per turn, half the Trance cost each), Garnet's Eidolon recasting its Phantom attack on its own, Freya's Jump in Trance (stays airborne, Spear hits all enemies repeatedly), Steiner's doubled attacks, Quina's Cook, Amarant's Elan, Zidane's Dyne. Trance fills by Rnd(Spirit) per hit taken and drains (300 − Lv) ÷ Spirit × 10 per action.
- **Jump** is two-phase: Freya leaves the field (can't be targeted), then lands with Spear.
- **Throw**: Amarant throws spare weapons from the bag (weapon power × 2, more against flying enemies).
- **Reflect** works FF9's way, including the classic trick of bouncing your own spells off a reflecting ally onto the enemy, and multi-target reflection.
- Battle menu: Double Black/White asks for a second spell; Throw lists spare weapons; "Guard" popups for nullified elements; jumping and vanished units disappear from the field.
- 26 new mechanics tests (Protect Girls, Cover, Counter, Return Magic, Auto-Potion, Reflect bounces, Double Black, Jump, Eidolon recast, Trance, Haste, poison timing, freeze shatter, Easy Kill bosses…).

### Changed
- **FF9 time model**: 15 ticks/s; gauge max = (60 − Speed) × 160, +40 per tick (+60 Haste, +24 Slow). Statuses last FF9 durations (scaled by Spirit) and tick on FF9 intervals; Stop and Sleep let poison/regen keep ticking only when they should.
- **Statuses follow FF9's rules** (from Memoria's StatusData): what each status clears and blocks, Petrify/Venom/Stop on the whole party = game over, Defend halves hit rate as well as damage, sleep/confuse break on physical hits, Vanish breaks on magic, Heat kills on acting, Freeze shatters on a physical hit, Mini, Trouble splashes half the damage onto allies, Zombie reverses healing, Doom/Gradual Petrify count down 10 ticks, Low HP at ⅙ max HP.
- Bosses are "Easy Kill" proof (no Death, Demi, Gravity…) instead of halving every status chance.
- Lasting statuses (Petrify, Venom, Virus, Silence, Blind, Trouble, Zombie) stay on between battles until a Moogle rest; Virus and Zombie block EXP/AP.
- Battles can start with a preemptive strike or a back attack (not in boss fights).
- Importer: statuses carry clear/immunity rules; actions carry their ability type and effect id; characters carry FF9's male/female category.

### Notes
- Monster stats are still this project's own curve (why early hits are too big). Importing FF9's real bestiary from Memoria's battle export is next.

## [0.1.23] - 2026-10-14

A detailed root README, and local project docs.

### Added
- **`README.md`** — what the game is and plays like; a feature tour (FF9 battle formulas, journeys and the overworld, stages, characters/gear/abilities, Completion Points, the gear unlock pool, legendary gear, achievements, camp); architecture and server-authoritative replay; where the FF9 data comes from; repository layout; setup; scripts; the `pnpm sim` simulator; migrations; tests; versioning; status and roadmap; an IP note.

### Internal
- `.docs/` (git-ignored, like ChannelGuide): overview, vision, game design, architecture, content & data, development, a design-decision log with James's words, and a detailed session summary in `.docs/summaries/`.

## [0.1.22] - 2026-10-14

FF9's story, part one: five journeys through Disc 1, each recruiting the next party member.

### Added
- **Story journeys 1–5** (each a two-map campaign ending in a story boss; clearing it recruits a party member, in roughly FF9's order):
  1. **The Evil Forest** — Alexandria (Masked Man) → Evil Forest (**Plant Brain**) → recruits **Vivi**
  2. **The Ice Cavern** — Mist Plains (Sealion) → Ice Cavern (**Black Waltz No.1**) → **Steiner**
  3. **Dali** — Eunorus Plains → Dali (**Black Waltz No.2**) → **Garnet**
  4. **Lindblum** — Lindblum Fields → Festival of the Hunt (**Zaghnol**) → **Freya**
  5. **Gizamaluke's Grotto** — Qu's Marsh → the Grotto (**Gizamaluke**) → **Quina**
- **FF9 Disc-1 bestiary**: Fang, Mu, Dendrobium, Hedgehog Pie, Python, Flan, Wyerd, Cave Imp, Ghost, Ladybug, Vice, Goblin Mage, Axe Beak, Gigan Toad, Lizard Man, Hornet, Black Mage, plus Prison Cage, Masked Man, Plant Brain, Sealion, Black Waltz No.1 & No.2, Zaghnol and Gizamaluke — using FF9 spells (Fire/Blizzard/Thunder/Sleep/Silence/Cure…) and new moves (Pollen, Silent Voice, Absorb, Stinger, Tsunami Wave…).
- New map/battle themes: forest, ice, cave, marsh. Journey cards show map count, final boss and who they recruit.

### Changed
- **Story journeys now recruit the party** (Vivi, Steiner, Garnet, Freya, Quina); their milestone unlocks are removed. Eiko, Amarant, Beatrix and Blank keep interim milestones until their journeys exist. **Echoes of the Past** is a side journey, unlocked after Lindblum.
- Areas have a **progression tier** (early/mid/late) that drives the camp catalog, supplies, events, treasure gil and special stages — area order no longer matters. "Next-tier" bonus loot always steps *up* a gear band.
- **Solo achievements** now require clearing a late-game journey alone (the early story is meant to be soloable).
- `pnpm sim runs` plays the next uncleared story journey first.

### Verification
- 16-run progression sim: Journey 1 cleared solo around run 6, then Vivi → Steiner → Garnet → Freya join over runs 6–11; Gizamaluke is the wall after that.

## [0.1.21] - 2026-10-14

Journeys are campaigns of several overworld maps, pokelike-style: each map ends with a "gym leader" boss, and the last map's castle is the journey's final boss.

### Changed
- **Echoes of the Past** is now one journey across three maps — Cornelia (Garland) → Baron (Golbez) → World of Ruin (final boss Kefka) — instead of three one-map journeys.
- The mid-map semi-boss fortress is off by default (each map's castle boss is already the semi-boss tier); it stays available per area. Gigas Worm, Iron Giant and King Behemoth are elites again.
- The overworld shows the area and progress ("Cornelia — map 1/3") with the journey name; the world-clear screen follows the journey's own map order.
- Runs saved under the old one-map journey ids are mapped to the journey containing their current map.
- DB: `run.journey` defaults to `echoes` (migration `journey_default_echoes`).

## [0.1.20] - 2026-10-14

Journeys: pokelike-style separate runs — one map each, fodder, a semi-boss fortress halfway, and a hard end boss.

### Added
- **Journeys** (`JOURNEYS` in game-core): each journey is one map; you pick one at camp. Journeys unlock in order (clear one → the next opens). The first three are the Echoes crossovers — Cornelia (Garland), Baron (Golbez), World of Ruin (Kefka). FF9's own story journeys and the Boss Gauntlet challenge are next.
- **Semi-boss fortress**: when an area has a semi-boss, the middle column of its map is a single fortress stage every path passes through (Gigas Worm, Iron Giant, King Behemoth for the Echoes). Better loot than elites.
- **Journey-granted character unlocks**: a journey can bring characters into the roster on its first clear — the planned way FF9's party joins via the story journeys (current milestone unlocks stay until those exist).
- Camp **journey picker** (cleared marks, end boss, what unlocks locked ones); the overworld shows the journey name; the run-over screen announces journeys cleared and newly opened.
- `pnpm sim run --journey <id>`; `sim runs` plays the newest unlocked journey.

### Changed
- Beating the boss of a journey's last area wins the run (no more three worlds per run).
- DB: `player_profile.journeysCleared`, `run.journey` (migration `journeys`). Runs saved before this update are upgraded on load (`upgradeRunState`).

## [0.1.19] - 2026-10-13

Server-side simulation tooling, and a Completion Points fix it surfaced.

### Added
- **`pnpm sim`** — the real game-core engine from the command line, no browser:
  - `sim battle --party zidane:5,vivi:5 --enemies goblin,wolf` — **interactive** battles: when a hero is ready, type `a e0`, `s fire e1`, `s cura all`, `i potion p1`, `d`/`f`/`c`, `auto` (AI picks this turn), `autoall`, `state`. Commands can be piped or read from `--script` for repeatable scenarios; `--auto` runs it fully on the AI. Prints a live event log and an HP/MP/ATB/Trance table.
  - `sim balance` — win rate and average fight length for every encounter, elite and boss of a world at several party levels.
  - `sim run` — one full auto-played run with a stage-by-stage log (`--party`, `--level`, `--slots`, `--seed`).
  - `sim runs --count N` — multi-run meta progression with a CP-spending strategy (start levels, slots, unlocks, achievements per run).

### Changed
- **Completion Points now also pay +1 per 3 battles won.** The multi-run sim showed runs 3–10 earning ~0 CP while a party walled at Garland (bought start levels left little to level up), i.e. no progress for several runs. Every run now moves you forward.

### Internal
- `.plans/` (local, git-ignored) holds the living master plan and feature plans.

## [0.1.18] - 2026-10-13

Achievements, and a Megabonk-style unlock model: slots and gear are unlocked, not carried.

### Added
- **Achievements** (`meta/achievements.ts`, `/achievements` page): milestones, bosses, challenges (win solo with each hero, win on Tiers 1/3/5) and secret legends (Soulcage, Deathguise, Kuja, Hades, Ozma, Necron, "Legend of <hero>"). Most pay big banked gil and/or Completion Points (to everyone, or to the solo hero). Only legends award gear.
- **Legendary gear**: every hero's best FF9 weapon (Ultima Weapon, Excalibur II, Mace of Zeus, Dragon's Hair, Rune Claws, Gastro Fork…) plus each hero's computed best-in-slot head/arm/body/accessory. It never drops, is never sold, and is never in the catalog until its achievement unlocks it.
- **Gear catalog** at camp: spend banked gil to unlock gear into future runs' drop pools (2× its FF9 price). Never-sold FF9 rarities (Ribbon, Genji gear…) are priced as late-game treasure.
- The run-over screen shows achievements earned (with rewards), gear unlocked by a win, and gear found on a loss.

### Changed
- **Equipment slots are unlocked per slot with CP** (Body/Head/Arm/Accessory; 5/10/20/35 CP; weapon always open). An unlocked slot starts every run with the hero's **FF9 starter gear** and can hold gear found during the run; locked slots can't be used at all.
- **No pre-equipping from a stash.** Every run starts with starter gear; what you find is what you wear.
- **Drop pools** = each world's real FF9 shop stock + gear you've unlocked (catalog, achievements, or found in a **won** run — winning brings its gear home as unlocks).
- The camp shop now has *Supplies* (consumables packed into the next run) and *Gear catalog*; the stash holds supplies only. The camp workshop is gone (synthesis stays in runs).
- DB: `player_character.unlockedSlots` replaces `slots`; `player_profile` gains `achievements`, `gearUnlocked`, `soloWins`, `legendClears` (migration `unlocks_and_achievements`).

## [0.1.17] - 2026-10-13

Stiltzkin and Chocobo stages, camp supplies, and two fairness fixes.

### Added
- **Stiltzkin** stage (rare, from mid-map): three deals — a discounted supply bundle, a restorative pack, and one piece of gear from the *next* world's band at 80% price. Each sells once.
- **Chocobo Hot & Cold** stage: nine dig spots (buried gear, two gil caches, three consumables, three duds), three digs; the rest are revealed when Choco tires out.
- **Camp supplies**: the camp shop now has Gear and Supplies tabs. Supplies (Potions, Phoenix Downs, Ethers… more as you reach further worlds) are packed into your next run on top of the starter kit and used up there. Camp shows the stash and "packed for your next run" separately.
- API: `run.buyOffer`, `run.dig`; starting a run packs camp supplies and removes them from the stash in the same transaction.

### Fixed
- **A lone hero could meet a strong single monster on the first stage** (e.g. a solo Ogre): encounters are now ordered by the threat of the group *after* trimming it to party size.
- **Lost battles counted as "battles won"**: the battle stat (which drives unlocks like "Win 3 battles") now counts victories only.

## [0.1.16] - 2026-10-13

A title screen, an FF-styled header, and sprites on the camp roster.

### Added
- **Title screen** (`/`): "FINAL FANTASY IX — a roguelite" with the eight-character cast hopping in a line, and Play / Sign in plus a practice-battle link. Replaces the scaffold's ASCII placeholder page.
- **Roster sprites** at camp: every unlocked character card shows their sprite (hopping when they're in the party); locked characters appear as black silhouettes beside their unlock hint.

### Changed
- **Header** restyled as an FF menu bar: "FFIX Roguelike" home link, Camp / Run / Practice, active page highlighted.

## [0.1.15] - 2026-10-13

Animated FF9-style results screens.

### Added
- **Victory screen**: the party lined up with sprites; EXP bars fill from before to after (crossing level boundaries) with a **LEVEL UP!** pop and a sprite hop; AP bars fill toward every ability on the character's gear with **Learned!** when one completes; gil counts up; spoils pop in. Knocked-out members are shown down with "no EXP".
- **Run-over screen**: party sprites with **Completion Points counting up** per character, the world reached, battles and bosses, gil banked, gear left behind, and newly unlocked characters popping in with their sprite.
- `RewardSummary.members` (game-core): per-member level/EXP before and after, and AP before/after/cost per ability, so the client can animate real values.

### Internal
- `useTween` (eased number animation) and `ff-pop` / `ff-hop` CSS animations.

## [0.1.14] - 2026-10-13

A WoW-style paperdoll for gear, character sprites in the menus, and visible ATB gauges for every unit in battle.

### Added
- **Paperdoll** (`features/gear/paperdoll.tsx`): the character's sprite in the middle with Head/Body/Arm tiles on the left and Weapon/Accessory on the right. Tiles show the item and a note (free starting weapon, loadout, "found — kept only if you win"); hover for stats and abilities taught; click to open the gear picker. Locked slots show a lock until a gear slot is bought. Used for the camp loadout and the in-run character sheet.
- **ATB gauges on the battlefield** under every unit — orange for enemies (flashing red when they're about to act), yellow for the party, white when full, grey while stopped/asleep — and mini gauges in the enemy list.
- Party sprites with HP bars in the in-run sidebar.

### Internal
- Placeholder pixel art moved to a shared recipe (`features/sprites/pixels.ts`) drawn by both Phaser and a React `HeroSprite` SVG, so every screen shows the same character until the FFRK sheets replace it.

## [0.1.13] - 2026-10-13

Completion Points: levels reset every run, and finishing runs is how characters get stronger.

### Changed
- **Levels reset every run.** Each run starts at the character's *start level* and levels up with FF9's normal EXP system.
- **Completion Points (CP)** are earned by everyone in the party when a run ends: +1 per level gained, +3 per boss defeated, +10 for a win.
- **Spend CP before a run** on +1 start level (cost = current start level) or a **gear slot** (5 / 10 / 20 / 35 / 50 CP) — slots let a character bring stash gear into a run. Replaces the run-count slot unlocks.
- **Found gear only comes home if you win the run.** Moogles no longer mail gear home; they fully rest the party and buy gear. Gear brought in from the loadout is always kept.
- AP (mastered abilities) and FF9's hidden growth pool remain permanent across runs.

### Added
- **Character screen at camp** ("Manage"): *Progress* (start level and gear-slot purchases with CP), *Gear* (stash gear into bought slots), *Abilities* (support abilities with the magic-stone budget, AP progress on every ability).
- **Camp shop**: buy gear for the stash with banked gil, from the real FF9 shops of every world you've reached.
- Run-over screen shows CP earned per character.
- API: `profile.raiseStartLevel`, `profile.buySlot`, `profile.buyGear`; profile mutations are blocked while a run is active.
- DB: `player_character.points`, `slots` (migration `completion_points`).

### Fixed
- Camp crashed with "does not provide an export named nextLoadoutUnlock" after the slot rules changed.

## [0.1.12] - 2026-10-13

Synthesis, selling and the camp workshop in the UI, and Phaser labels on the overworld.

### Added
- **Overworld labels**: every stage has an always-visible name under its icon (Battle, Elite, Treasure, Shop, Synth, Moogle, ???, BOSS); the bottom-center overlay still gives the longer description on hover.
- **Synthesis stage UI**: FF9 recipes with ingredients (red when missing) and price; makeable recipes sort first.
- **Selling** unequipped gear for half price at shops, synthesis shops and Moogles.
- Shops show their real FF9 name (e.g. "Lindblum Dragoos' Armory").
- **Camp workshop**: synthesize from stash gear with banked gil; toggle between "what I can make" and all unlocked recipes.
- API: `run.synthesize`, `run.sell`, `profile.synthesize`.

## [0.1.11] - 2026-10-13

FF9's real shops and synthesis come to the run, plus selling and a camp workshop (game rules; UI follows).

### Added
- Imported from Memoria: `synthesis.json` (FF9's 64 recipes — ingredients, gil price, and the synthesis shops 32–39 that sold them in story order) and `shops.json` (30 real shop inventories, e.g. Dali Weapon Shop, Lindblum Dragoos' Armory, Daguerreo Weaponsmith).
- **Item shops use real FF9 stock**: each world draws from the shops of its part of the story (world 1: Dali/Lindblum/Burmecia/Aerbs; world 2: Treno, Cleyra, Conde Petie, Black Mage Village, Madain Sari…; world 3: Alexandria, Oeilvert, Esto Gaza, Daguerreo, Bran Bal…) plus a general store's consumables.
- **Synthesis stage** on the map: recipes available up to the world's synthesis tier (world 1: shops 32–33, world 2: up to 36, world 3: up to 38). Synthesizing consumes unequipped gear/consumables and gil; the result counts as mailed home only if every gear ingredient already was.
- **Selling** gear for half price at shops, synthesis shops and Moogles.
- **Camp workshop**: synthesize from stash gear with banked gil; recipes unlock with the furthest world reached, and Hades Workshop (tier 39) after your first win.

### Fixed
- Shop selection rolled a new random shop on every comparison; now picks once.

## [0.1.10] - 2026-10-13

Earned loadout slots replace level-gated gear slots, and character growth now matches FF9 exactly.

### Changed
- **Loadout slots are earned, starting from zero.** Each character may bring N pieces of stash gear into a run (any equipment slot; their FF9 starting weapon is always free). N unlocks from that character's own record: 1 after 3 runs, 2 after 8, 3 after 15 runs + 3 bosses, 4 after 25 runs + 1 win, 5 after 35 runs + 3 wins. Over-budget gear is left at camp when a run starts and returned to the stash when it ends.
- **FF9's real level-up model** (from Memoria's `ff9level.cs`): each level-up adds Str/Mag +3, Spirit +1 and Stones +5 to a hidden bonus pool, plus the stat bonuses of the gear worn at that moment; stats gain pool ÷ 32. Max HP/MP use the pre-gear "basis" Strength/Magic. Caps: Speed 50, Strength 99, Magic 99, Spirit 50.
- **Magic stones** = base + Lv × 4/10 + pool ÷ 32 (was Lv × 4/5, about twice FF9's rate).
- Camp loadout sheet shows slots used/earned, the character's runs/wins/bosses, and what unlocks the next slot.

### Added
- `player_character` columns for the growth pool (`growthSpeed/Strength/Magic/Spirit/Gems`) and per-character record (`runs`, `wins`, `bossKills`); migration `character_growth_and_record`.
- Tests: zero starting slots, budget enforcement, loadout-only gear entering a run, per-character records, and FF9 growth-pool math.

## [0.1.9] - 2026-10-13

The API dev server now restarts when any workspace package changes.

### Fixed
- **Stale game rules in dev.** `bun --hot` only watched `apps/server`, so edits to game-core, game-data, api or db kept serving the old code (Bun warned "not in the project directory and will not be watched"). The server's `dev` script now runs `scripts/dev-server.ts`, which watches `apps/server/src`, every `packages/*/src` and the generated Prisma client, and restarts the server on change (debounced). It still runs from `apps/server`, so varlock loads `apps/server/.env` as before.

### Verification
- On a spare port: server up → edit a game-core file → "restarting" → server answering again.

## [0.1.8] - 2026-10-13

The game, end to end in the browser — and progression reworked to start with Zidane alone.

### Added
- **Camp** (`/play`): roster cards with level, HP/MP and gear, party picker (up to 4), difficulty tier, Begin/Continue run, stash, lifetime stats, and "???" cards with unlock hints.
- **Loadout** at camp: pre-equip stash gear into the slots a character has unlocked by level.
- **Run screen** (`/run`), driven by the server's run state: a Super Mario World–style Phaser overworld (stages on dotted paths, the party walking between them, pulsing reachable stages, boss castle, hover descriptions), battles (the input log goes to the server for replay-verification), rewards with level-ups and newly mastered abilities, gear picks, treasure, shop, Moogle, events, world-clear and run-over screens (gil banked, gear lost, new unlocks).
- **Party panel** in a run: HP/MP, gil, items, Optimize gear, and a character sheet — stats, equipment swapping (flags gear not yet mailed home), out-of-battle items, support abilities with magic-stone budget and AP progress, active abilities with AP progress.
- Header: Play, Practice Battle.

### Changed
- **You start with only Zidane.** Companions unlock one at a time: Vivi (win 3 battles), Steiner (finish a run), Garnet (defeat Garland), Freya (40 battles), Quina (6 runs), Amarant (15 steals), Eiko (defeat Golbez), then Beatrix and Blank.
- **Gear slots unlock with level for pre-equipping**: weapon Lv1, body Lv3, head Lv6, arm Lv10, accessory Lv15. New characters start with only their FF9 starting weapon.
- **Only pre-equipped gear comes into a run** — the stash stays at camp; everything else drops along the way. Kept gear is added to the stash at the end.
- Encounter size follows party size (a lone hero meets one monster; a full party up to five).

### Verification
- A 15-run simulation shows a roguelite curve: one new companion every few runs, levels climbing (Lv 1 → 18), the stash growing, and the first world-3 runs around run 13.

## [0.1.7] - 2026-10-13

Server-authoritative game API: profiles and runs over tRPC, persisted in Postgres.

### Added
- `profile` router: `get` (creates the profile with Zidane/Vivi/Steiner on first visit; returns builds, stash, stats, unlock hints and the active run id), `setBattleMode`, and between-run `equip` (from the stash) / `setSupports`.
- `run` router: `active`, `history`, `start` (party of 1–4 unlocked characters, unlocked tier only), `move`, `finishBattle` (the client sends only its input log — the server replays the battle to verify it), `claim`, `buy`, `leave`, `choose`, `nextWorld`, `equip`, `optimize`, `setSupports`, `useItem`, `abandon`.
- `services/runs.ts`: every action loads the stored `RunState`, applies a game-core transition and saves with an optimistic `revision` check (two tabs can't double-apply). Verified battles are recorded in `run_battle`. When a run ends, its outcome folds into the profile in the same transaction (levels/AP kept, secured gear to the stash, gil banked, unlocks and tiers checked).
- `services/profile.ts`: maps the relational player tables to game-core's `Profile` and back.
- game-core: `equipFromStash` / `setProfileSupports` for managing gear between runs.

### Verification
- Smoke-tested against Postgres: profile creation, run start, four replay-verified battles, rewards, an event, abandon → profile updated (EXP, AP, gil) with the battle audit rows written.

## [0.1.6] - 2026-10-13

Database schema for permanent progression and server-authoritative runs.

### Added
- `player.prisma`: `PlayerProfile` (one per user — banked gil, max difficulty tier, Wait/Active battle preference, lifetime stats that drive unlocks) and `BossKill` counts.
- `character.prisma`: `PlayerCharacter` (unlocked flag, level, EXP, row, five equipment slots as FF9 item ids, active support abilities) and `CharacterAbility` (AP toward each ability; full AP = mastered).
- `inventory.prisma`: `StashItem` — unequipped gear owned permanently.
- `run.prisma`: `Run` (seed, tier, status, the game-core `RunState` as JSON, a `revision` counter for optimistic concurrency) and `RunBattle` (every verified battle's seed and input log, enough to replay it exactly).
- `User.profile` relation; first migration `init_game` (dev database reset to start migration history cleanly).

## [0.1.5] - 2026-10-13

The run layer: Mario World–style maps, depth-scaled encounters, loot and permanent progression rules.

### Added
- World map generator (`run/map.ts`): nine columns from the start to the boss castle, 1–3 stages per column with branching/merging paths. Early stages are plain battles; elites, treasure, shops and "?" events appear deeper in; the stage before every castle is a Moogle.
- Depth-scaled encounters (`run/loot.ts`): each world's groups are sorted by threat and picked from a window that slides with map depth — weak monsters first, the toughest just before the boss.
- Rewards: FF9-style EXP split among survivors, AP to every ability on equipped gear (permanent mastery), gil, drops and steals; elites and bosses offer a pick of 3 gear from the world's FF9 price band. Treasure, shops (consumables + gear) and five events (Chocobo's Forest, Tantalus, Stiltzkin, a suspicious chest, a ruined shrine).
- Run state machine (`run/run.ts`): pure, JSON-serializable transitions — move, battle (verified by replaying the input log), claim reward, buy, event choice, Moogle (full heal + mail gear home), next world, equip, support abilities, out-of-battle items, abandon.
- Permanence rules: levels/EXP/AP always kept; gear kept if mailed home at a Moogle or if the run is won; half the gil is banked on a loss.
- Profile + unlocks (`meta/profile.ts`): start with Zidane, Vivi and Steiner; unlock Garnet (defeat Garland), Freya (15 battles), Quina (3 runs), Eiko (defeat Golbez), Amarant (20 steals), Beatrix (defeat Kefka), Blank (win on Tier 1+); winning a tier unlocks the next.
- `optimizeParty()` best-gear helper, and tests: map reachability, deterministic runs, forged-log rejection, gear loss on defeat, and multi-run progression.

## [0.1.4] - 2026-10-13

The first playable screen: a practice battle at `/battle`, running the real ATB engine in the browser.

### Added
- **Practice Battle** (`/battle?world=&level=&encounter=`, typed search params): pick a world, any encounter (normal, elite or boss) and a party level, and fight Zidane, Vivi, Steiner and Garnet against it.
- Phaser 4.2.1 battlefield (`features/battle/battle-scene.ts`): enemies left, party right, idle bob, step-forward on action, hit shake, floating damage/heal/miss/status numbers, KO and Trance effects, click-to-target cursors.
- FF9-style menu windows (React overlay): party HP/MP with ATB and Trance gauges, the command menu (Attack, each character's two commands, Item, Defend, row change, Flee) with ability/item sub-lists showing MP costs, ally/enemy targeting with "All" for multi-target spells, full keyboard control, an Auto battle toggle and ×1/×2/×4 speed.
- Pixel-art placeholder sprites keyed by the sprite manifest (`hero/<name>`, `enemy/<id>`, `boss/<id>`), so FFRK sheets can replace them by key.

### Internal
- Web code follows the ChannelGuide layout: thin routes, `features/<domain>/` kebab-case modules, `@/` imports.

## [0.1.3] - 2026-10-13

The battle engine: FF9's ATB system as a deterministic, replayable simulation, plus the first bestiary.

### Added
- `BattleEngine` (`battle/engine.ts`): 20-tick/s ATB gauges driven by Speed (Haste ×1.5, Slow ×½), a command queue with animation time, Wait mode (time fully stops while a command is being chosen) and Active mode, Trance gauge filling on hits, and status timers (Poison/Venom/Regen ticks, Doom and Gradual Petrify countdowns, durations scaled by Spirit).
- FF9 formulas by Memoria script id (`battle/effects.ts`): physical (Atk − Def) × (Str + Rnd), magic (Power − MDef) × (Mag + Rnd), healing, status hit rates, crits, back row, Defend/Protect/Shell, multi-target halving, elemental weak/half/immune/absorb, Reflect, killer/support abilities, Steal/Mug, Eat/Cook (Quina learns Blue Magic), Blue Magic, Sword Art, Dyne-style skills, and consumable items.
- `replayBattle()`: re-runs a battle from its initial state and recorded `(tick, command)` inputs; tampered logs are rejected. The server will use this to verify results.
- Bestiary (`content/enemies.ts`): 29 monsters and bosses from FF1–FF6 across three worlds (Cornelia → Garland, Baron → Golbez, World of Ruin → Kefka), statted from one level curve with per-monster multipliers, with AI rules, steal slots, drops and Blue Magic.
- Party/enemy unit builders, an auto-battle AI (`battle/autoplay.ts`), and tests: FF9 stat parity, content integrity, replay determinism, tamper rejection, and a world 1 balance check.

## [0.1.2] - 2026-10-13

Adds the `@ffix-roguelike/game-core` package with the deterministic RNG and FF9 character stat model.

### Added
- `Rng` (mulberry32): seeded, serializable, with `fork()` for independent per-node streams, so server and client roll identical results.
- `CharacterBuild` + `deriveStats()`: FF9's real growth formulas — Max HP = HPTable[lv] × Str / 50, Max MP = MPTable[lv] × Mag / 100, Str/Mag +Lv×3/10, Spirit +Lv×3/20, Speed +Lv/10 (Zidane Lv1 = 105 HP / 36 MP, matching the game).
- Equipment totals (defence/evade, stat bonuses, elemental guard/absorb/half/weak), abilities usable from equipped gear, permanent mastery via AP, and the magic-stone (gem) budget for support abilities, including HP+/MP+ supports.

## [0.1.1] - 2026-10-13

Adds the `@ffix-roguelike/game-data` package: FF9's real tables, imported from the Memoria CSV exports and committed as JSON.

### Added
- `packages/game-data/scripts/import-memoria.ts` — converts Memoria's `StreamingAssets/Data` CSVs (per-line UTF-8/Windows-1252 decoding) into `src/generated/*.json`: 12 characters (base stats, command sets, learnable abilities with AP costs, default equipment), 192 actions, 64 support abilities, 255 items (weapons, armour, accessories, consumables with stat bonuses, elements and taught abilities), 32 statuses and the 99-level XP/HP/MP curve.
- Typed accessors (`getAction`, `getItem`, `getCharacter`, `itemByName`, `abilityName`, …) and shared domain types (elements, statuses, targeting).

## [0.1.0] - 2026-10-13

Initial scaffold: a Better-T-Stack monorepo for a browser roguelite built on Final Fantasy IX's battle, gear and ability systems.

### Added
- Better-T-Stack monorepo (create-better-t-stack 3.36.3, matching ChannelGuide): TanStack Router web app, Hono-on-Bun server, tRPC, Prisma/Postgres, Better Auth, Turborepo, pnpm 10.34.7.
- `pnpm version:bump` (`scripts/bump-version.ts`) and the `/version-bump` skill — every `apps/*/package.json` bumps in lockstep.
