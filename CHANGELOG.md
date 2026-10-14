# Changelog

All notable changes to ffix-roguelike are documented here.

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
