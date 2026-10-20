<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB">
  <img alt="Phaser" src="https://img.shields.io/badge/Phaser_4-8A2BE2">
  <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white">
  <img alt="Hono" src="https://img.shields.io/badge/Hono-E36002?logo=hono&logoColor=white">
  <img alt="tRPC" src="https://img.shields.io/badge/tRPC-2596BE?logo=trpc&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white">
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white">
</p>

# FFIX Roguelike

**Final Fantasy IX's real battle system, gear and abilities — rebuilt as a browser roguelite.**

FFIX Roguelike is a web game that takes the systems people love about *Final Fantasy IX* — the Active Time Battle,
gear that teaches abilities, AP and mastery, magic-stone support abilities, Trance, Steal, Eat, Blue Magic — and
wraps them in a **roguelite**: you pick a *journey*, cross a series of **Super Mario World–style overworld maps**,
fight your way through stages to a boss castle at the end of each map, and either clear the journey or fall
trying. Every run makes you permanently stronger, and FF9's story recruits the party one journey at a time.

> **Status:** pre-alpha, under very active development (v0.1.x, many releases a day). Playable end to end in the
> browser: camp → journey → overworld → server-verified ATB battles → rewards → run over → camp. Placeholder pixel
> art for now (real 2D sprites are planned). See [Status & roadmap](#status--roadmap).

---

## Table of contents

- [What it plays like](#what-it-plays-like)
- [Feature tour](#feature-tour)
  - [Battles — FF9's ATB, faithfully](#battles--ff9s-atb-faithfully)
  - [Journeys and the overworld](#journeys-and-the-overworld)
  - [Stages](#stages)
  - [Characters, gear and abilities](#characters-gear-and-abilities)
  - [Permanent progression (the roguelite layer)](#permanent-progression-the-roguelite-layer)
  - [Unlocks, the gear pool and achievements](#unlocks-the-gear-pool-and-achievements)
  - [Camp](#camp)
- [How it's built](#how-its-built)
  - [Architecture](#architecture)
  - [Server-authoritative battles](#server-authoritative-battles)
  - [Where the FF9 data comes from](#where-the-ff9-data-comes-from)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Day-to-day development](#day-to-day-development)
  - [Scripts](#scripts)
  - [The simulator (`pnpm sim`)](#the-simulator-pnpm-sim)
  - [Database & migrations](#database--migrations)
  - [Re-importing FF9 data](#re-importing-ff9-data)
  - [Tests](#tests)
  - [Versioning & releases](#versioning--releases)
- [Status & roadmap](#status--roadmap)
- [A note on Final Fantasy IX](#a-note-on-final-fantasy-ix)

---

## What it plays like

1. **Camp.** You start alone, with Zidane. Pick a journey, pick your party (up to 4), spend your Completion Points,
   buy supplies, browse the gear catalog.
2. **The overworld.** A journey is a campaign of overworld maps. Each map is a winding path of stages —
   battles, elites, treasure, shops, synthesis shops, Stiltzkin, Chocobo Hot & Cold, "?" events, a Moogle — that
   branches and merges like Super Mario World. You choose your route.
3. **Battles.** Real-time-with-pause ATB, exactly as FF9 plays it: gauges fill by Speed, menus open when a hero is
   ready, enemies keep acting in Active mode (or time stops while you choose in Wait mode). Every unit's ATB gauge
   is visible, so you can see who's about to act.
4. **The castle.** Each map ends at a boss castle — a "gym leader". Beat it, rest, and travel to the next map.
   The last castle holds the journey's **final boss**.
5. **The end of the run.** Win or fall, levels reset — but everyone who came earns **Completion Points**, abilities
   you mastered stay mastered, and FF9's hidden growth pool keeps every level-up you've ever earned. Win, and every
   piece of gear you found is **unlocked** into future runs. Clear a story journey and the next party member joins.

## Feature tour

### Battles — FF9's ATB, faithfully

- **Deterministic tick engine** (20 ticks/second) in pure TypeScript (`packages/game-core/src/battle`).
- **FF9's formulas**, by Memoria battle-script id:
  - Physical: `(Atk − Def) × (Str + Rnd(0 … (Lv + Str) / 8))`
  - Magic: `(Power − MDef) × (Mag + Rnd(0 … (Lv + Mag) / 8))`
  - Healing, status hit rates (`Rate + Mag/4 + Lv − TargetLv`), criticals (Spirit/4 %), back row, Defend,
    Protect/Shell, multi-target halving, elemental weak (×1.5) / half / immune / absorb, Reflect.
  - Thief swords use (Str+Spd)/2, rackets (Str+Mag)/2, Blood Sword drains…
- **Commands**: Attack, each hero's two FF9 commands (Steal & Skill, Black Magic & Focus, Summon & White Magic,
  Sword Art & Sword Magic, Jump & Dragon, Eat & Blue Magic…), Item, Defend, row change, Flee.
- **Trance** fills when hit (High Tide doubles it) and swaps in the Trance command set (Dyne, Double Black…).
- **32 FF9 statuses** — Poison/Venom/Regen ticks, Doom and Gradual Petrify countdowns, Sleep breaks on hit,
  Confuse/Berserk auto-actions, Heat, Freeze shatter, Mini, Float vs. Earth, Zombie, Auto-Life…
- **Support abilities** that actually do things: killers, Auto-Haste/Regen/Reflect/Float/Life, Counter, MP Attack,
  Concentrate, Half MP, Chemist, High Tide, Bandit/Master Thief, Initiative, status guards…
- **Steal & Eat**: FF9-style steal slots (256/64/16/1) and Quina's Eat/Cook teaching Blue Magic.
- **Enemy AI** with weighted rules (HP thresholds, turn patterns, once-per-battle, targeting).
- **Wait / Active** modes; **Auto** battle; ×1/×2/×4 speed.
- **Visible ATB for every unit** — enemy gauges flash red just before they act.

### Journeys and the overworld

- **Journeys** are pokelike-style campaigns: a series of overworld maps, each ending in a boss castle; the last
  castle holds the journey's final boss. Journeys unlock in order.
- **FF9 story journeys** follow the game and recruit the party:

  | # | Journey | Maps → final boss | Recruits |
  |---|---|---|---|
  | 1 | The Evil Forest | Alexandria (Masked Man) → Evil Forest → **Plant Brain** | Vivi |
  | 2 | The Ice Cavern | Mist Plains (Sealion) → Ice Cavern → **Black Waltz No.1** | Steiner |
  | 3 | Dali | Eunorus Plains → Dali → **Black Waltz No.2** | Garnet |
  | 4 | Lindblum | Lindblum Fields → Festival of the Hunt → **Zaghnol** | Freya |
  | 5 | Gizamaluke's Grotto | Qu's Marsh → the Grotto → **Gizamaluke** | Quina |
  | — | *Echoes of the Past* (side journey) | Cornelia (Garland) → Baron (Golbez) → World of Ruin → **Kefka** | — |

- **Maps** are generated per run (9 columns, 1–3 stages each, branching paths), drawn in Phaser with labelled
  stage icons and a hover description; the party walks the dotted path to the stage you pick.
- **Encounters scale with depth** — the weakest groups at the start of a map, the toughest by the castle — and
  shrink to fit small parties (a lone hero meets one monster at a time).

### Stages

| Stage | What happens |
|---|---|
| Battle / Elite | Fights. Elites are tougher and offer a pick of 3 gear. |
| Castle (boss) | The map's "gym leader" — or, on the last map, the journey's final boss. |
| Treasure | Pick 1 of 3 gear + gil. |
| Item Shop | A **real FF9 shop** for that part of the story (Dali Weapon Shop, Lindblum Dragoos' Armory…) + a general store. |
| Synthesis Shop | **FF9's 64 real recipes**, available by story tier (combine gear + gil into better gear). |
| Stiltzkin | Discounted bundles and one rare piece of gear from the next tier. |
| Chocobo Hot & Cold | Nine dig spots, three digs. |
| Moogle | Full rest (revives the fallen) and a place to sell gear. |
| ??? | FF-flavoured events with choices (Chocobo's Forest, Tantalus, Stiltzkin's bargain, a suspicious chest…). |

### Characters, gear and abilities

- **The FF9 cast** with their real base stats, command sets, Trance sets and learnable abilities (AP costs from
  the game), plus FF9's starting equipment.
- **FF9's real level-up model** (verified against Memoria's `ff9level.cs`): Max HP = HPTable[Lv] × Str / 50, Max
  MP = MPTable[Lv] × Mag / 100, Str/Mag +Lv×3/10, Spirit +Lv×3/20, Speed +Lv/10, plus the hidden bonus pool (each
  level-up adds Str/Mag +3, Spirit +1, Stones +5 and the stat bonuses of gear worn at the time; stats gain pool ÷
  32). Caps: Speed 50, Str 99, Mag 99, Spirit 50. Zidane Lv 1 = 105 HP / 36 MP, as in the game.
- **255 FF9 items**: weapons, armour, accessories and consumables, with their stat bonuses, elements, statuses and
  the abilities they teach.
- **Abilities from gear**: equipped gear lets a hero use its abilities right away; AP from battles fills them;
  full AP masters an ability **permanently**.
- **Magic stones**: support abilities cost stones; capacity = base + Lv × 4/10 + pool ÷ 32 (FF9's formula).
- **WoW-style paperdoll**: the hero's sprite in the middle, Head/Body/Arm on the left, Weapon/Accessory on the
  right; hover for stats and abilities taught.

### Permanent progression (the roguelite layer)

- **Levels reset every run.** Each hero starts at their **start level** and levels up with FF9's EXP from there.
- **Completion Points (CP)** for everyone in the party when a run ends: +1 per level gained, +1 per 3 battles won,
  +3 per boss defeated, +10 for a win.
- **Spend CP before a run**:
  - **+1 start level** (cost = current start level).
  - **Unlock an equipment slot** (Body / Head / Arm / Accessory; 5 → 10 → 20 → 35 CP; the weapon slot is always
    open). An unlocked slot starts every run with that hero's **FF9 starter gear** and can hold anything found in
    the run. Locked slots can't be used at all.
- **Mastered abilities** and FF9's **growth pool** are permanent.
- **Banked gil**: all of a won run's gil, half of a lost run's.

### Unlocks, the gear pool and achievements

- **The drop pool** for each area is the stock of its real FF9 shops, **plus gear you've unlocked**. Unlocking
  never hands you an item — it means that item *can now show up* in runs (drops, treasure, shops, Stiltzkin), à la
  Megabonk.
- Ways to unlock gear:
  1. **Win a run** — every piece of gear you found is unlocked.
  2. **The gear catalog** at camp — spend banked gil.
  3. **Achievements** — the legendary pieces.
- **Legendary gear** = every hero's best FF9 weapon (Ultima Weapon, Excalibur II, Mace of Zeus, Dragon's Hair,
  Rune Claws, Gastro Fork…) and their computed best-in-slot armour. It never drops, is never sold and never
  appears in the catalog until its achievement unlocks it.
- **38 achievements** — milestones, bosses, challenges (clear a late journey solo with each hero, win on Tiers
  1/3/5) and secret legends. Most pay big banked gil and/or CP; only legends unlock gear.
- **Characters** join by clearing **FF9 story journeys** in roughly the game's order.
- **Difficulty tiers** (0–5): win at your max tier to unlock the next.

### Camp

- Journey picker (cleared ✓, final boss, who it recruits; locked ones say what opens them).
- Party picker with sprites; locked heroes appear as silhouettes.
- **Manage** a hero: *Progress* (start level, slot unlocks), *Gear* (paperdoll of their starting gear), *Abilities*
  (support toggles within the stone budget; AP progress on everything).
- **Shop**: *Supplies* (consumables packed into the next run) and the *Gear catalog* (unlocks).
- **Achievements** page; animated **victory** and **run-over** screens (EXP/AP bars filling, LEVEL UP!, Learned!,
  CP counting up).

## How it's built

### Architecture

```
┌────────────── apps/web (Vite · React 19 · TanStack Router · React Query · Phaser 4) ──────────────┐
│  Title · Camp · Character sheet · Run (Phaser overworld + battlefield, React menus/HUD)         │
│  The battle runs locally in game-core's BattleEngine at 20 ticks/s; inputs are recorded.       │
└───────────────────────────────────────────── tRPC ─────────────────────────────────────────────┘
┌────────────── apps/server (Hono on Bun) + packages/api (tRPC routers, services) ─────────────────┐
│  profile.*  run.*  — every action loads RunState, applies a game-core transition, saves it with │
│  an optimistic revision; battles are REPLAYED from their input log before the result counts.    │
└──────────────────────────────── Prisma 7 · PostgreSQL ───────────────────────────────────────────┘
┌──────── packages/game-core (pure TS: battle engine, run state machine, meta/profile, content) ───┐
│  Used by BOTH the browser and the server — the same rules on both sides.                         │
└──────── packages/game-data (FF9 tables imported from Memoria CSVs → committed JSON) ─────────────┘
```

### Server-authoritative battles

The client never tells the server "I won". It sends the **input log** — `(tick, command)` pairs — and the server
re-runs the battle from the stored initial state with `replayBattle()`. Because the engine is deterministic (a
seeded, serializable RNG; fixed ticks; Wait mode doesn't advance time while you think), the replay produces exactly
the same outcome, HP and spoils. Tampered logs are rejected, and every verified battle is kept in `run_battle`
for auditing. Run state transitions are pure functions; the server stores the JSON `RunState` and guards writes
with a `revision` counter so two tabs can't double-apply.

### Where the FF9 data comes from

`packages/game-data/scripts/import-memoria.ts` reads the CSV tables that the
[Memoria](https://github.com/Albeoris/Memoria) engine mod exports from a Steam copy of FF9
(`StreamingAssets/Data`); `import-ff9-battles.ts` reads Memoria's battle export (every battle scene's monsters, attacks and
spawn patterns) plus the compiled battle AI scripts extracted from the game's `p0data7.bin`. Both write seed files to
`packages/db/seed/ff9/`; **the data lives in Postgres** (`ff9_*` tables), seeded automatically when the server starts
and the files have changed. The server loads it into game-core at startup; the web app fetches it from the API.



| Table | Count |
|---|---|
| Characters (base stats, command sets, learnable abilities + AP, starting gear) | 12 |
| Actions (spells, skills, commands) | 192 |
| Support abilities (+ magic-stone costs) | 64 |
| Items (weapons, armour, accessories, consumables; bonuses; abilities taught) | 255 |
| Synthesis recipes (with FF9's story-order shop tiers) | 64 |
| Shops (real FF9 inventories) | 30 |
| Statuses · level curve | 32 · 99 |

Enemies aren't in those tables, so the bestiary (`packages/game-core/src/content/enemies.ts`, 55 monsters and
bosses: FF1–FF6 crossovers + FF9 Disc 1) is authored on FF9's stat scale from a single level curve with
per-monster multipliers, using FF9's own spells where enemies cast them.

## Repository layout

```
apps/
  web/                    React + Phaser client
    src/features/
      battle/             Phaser battlefield, FF9-style command menu, party status, practice battle
      run/                overworld (Phaser map), stage panels, party panel, run screen, data hooks
      hub/                title screen, camp, character sheet, camp shop, achievements page
      gear/               paperdoll + gear picker
      results/            animated victory screen, tween helper
      sprites/            shared pixel-art recipe (Phaser + React SVG), placeholder textures, backgrounds
    src/routes/           thin TanStack Router routes (/, /play, /run, /achievements, /battle)
  server/                 Hono on Bun; serves tRPC + Better Auth
packages/
  game-data/              Memoria import scripts, FF9 data types, runtime registries + typed accessors
  game-core/              the game: battle engine, run state machine, profile/meta, content, sim CLI
    src/battle/           engine, FF9 effects/formulas, units, autoplay AI, types
    src/run/              map generation, loot/encounters, events, specials, run state machine, optimize
    src/meta/             profile (CP, unlocks, camp economy), achievements
    src/content/          bestiary, enemy moves, areas & journeys
    scripts/sim.ts        `pnpm sim` — battle/balance/run/runs simulator
  api/                    tRPC routers (profile, run) + services (profile mapping, server-authoritative runs)
  db/                     Prisma schema (multi-file) + migrations
  auth/ ui/ config/       Better Auth, shared UI, tsconfig base
scripts/
  bump-version.ts         lockstep version bump for apps/*
  dev-server.ts           API dev runner that restarts on any workspace package change
.claude/skills/version-bump/   the release flow
```

## Getting started

### Prerequisites

- **Node.js 22** and **Bun 1.3+**
- **pnpm 10.34.7** (pinned in `package.json` — a global pnpm 10.x will hand off to it automatically)
- **PostgreSQL** (any recent version)
- *(Optional)* a Steam copy of **Final Fantasy IX** with **Memoria** installed — only needed to re-import the game
  data; the seed files are committed and the server loads them into Postgres on startup.

### Setup

```bash
pnpm install

# 1. Database: create a role + database, then point the server at it
#    apps/server/.env
#      DATABASE_URL=postgresql://<user>:<password>@localhost:5432/<db>?schema=public
#      BETTER_AUTH_SECRET=<32+ random chars>
#      BETTER_AUTH_URL=http://localhost:3000
#      CORS_ORIGIN=http://localhost:3001
#      GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET   (optional: social sign-in;
#        redirect URIs http://localhost:3000/api/auth/callback/google and /github)
#    apps/web/.env
#      VITE_SERVER_URL=http://localhost:3000

pnpm -F @ffix-roguelike/db db:migrate:deploy   # apply migrations
pnpm db:generate                               # generate the Prisma client

# 2. Run everything (web http://localhost:3001, API http://localhost:3000)
pnpm dev
```

Open <http://localhost:3001>, sign up, and press **Play**.

## Day-to-day development

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Web (Vite, http://localhost:3001) + API (Bun, http://localhost:3000). The API restarts on changes to any workspace package. |
| `pnpm check-types` | Type-check every package (and build the web app). |
| `pnpm -F @ffix-roguelike/game-core test` | Engine, run and profile tests (Bun). |
| `pnpm sim <cmd>` | The simulator — see below. |
| `pnpm db:generate` / `db:studio` | Prisma client / Prisma Studio. |
| `pnpm -F @ffix-roguelike/db db:migrate --name <x>` | Create + apply a migration (dev). |
| `pnpm -F @ffix-roguelike/game-data import:memoria [dir]` | Re-import FF9 tables from Memoria CSVs. |
| `pnpm version:bump <patch\|minor\|major>` | Lockstep version bump of `apps/*`. |

### The simulator (`pnpm sim`)

The real engine from the command line — for balancing, debugging and reproducing fights.

```bash
# Interactive battle: when a hero is ready, type a command
pnpm sim battle --party zidane:5,vivi:5 --enemies goblin,wolf --seed 42
#   a e0            attack enemy 0         s fire e1      cast Fire on enemy 1
#   s cura all      multi-target           i potion p1    use an item on party member 1
#   d / f / c       defend / flee / row    auto / autoall let the AI decide
#   state           print the battlefield  q              quit
printf 'a e0\nautoall\n' | pnpm sim battle --party zidane:3 --enemies fang   # scripted via stdin
pnpm sim battle --party zidane:5 --enemies plant-brain --script fight.txt    # or a script file

pnpm sim balance --world 4 --levels 3,5,8 --n 30   # win % and fight length per encounter/elite/boss
pnpm sim run --journey evil-forest --party zidane  # one auto-played run, stage by stage
pnpm sim runs --count 20                           # multi-run meta progression with a CP strategy
```

### Database & migrations

- Schema is split by domain in `packages/db/prisma/schema/` (`auth`, `player`, `character`, `inventory`, `run`).
- Player data lives in Postgres; **game content does not** — it lives in code/JSON so client and server always
  run identical rules (and replays stay valid).
- `prisma migrate dev` refuses non-interactive destructive changes; generate SQL with
  `prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` into a new migration folder
  and apply with `db:migrate:deploy`.

### Re-importing FF9 data

```bash
pnpm -F @ffix-roguelike/game-data import:memoria "C:/Program Files (x86)/Steam/steamapps/common/FINAL FANTASY IX/StreamingAssets/Data"
```

The importer decodes Memoria's mixed UTF-8/Windows-1252 files line by line and writes `packages/db/seed/ff9/*.json`;
the server re-seeds the `ff9_*` tables on its next start. Battle data: `import:battles` (see `.docs/development.md`).

### Tests

`packages/game-core` has Bun tests covering FF9 stat parity, content integrity, replay determinism and tamper
rejection, wait-mode time, map reachability, journeys, Completion Points, slot unlocks, the gear unlock pool,
synthesis/selling, special stages and a balance sanity check.

### Versioning & releases

Every shippable app bumps in lockstep (`pnpm version:bump patch`), each finished task gets a patch release with a
`CHANGELOG.md` entry, and the commit message carries the entry. See `.claude/skills/version-bump/skill.md`.

## Status & roadmap

**Working now:** the full loop in the browser; FF9 battle system; 6 journeys (5 FF9 story + Echoes); 55 enemies;
shops/synthesis/Stiltzkin/Chocobo/events/Moogles; CP progression, slot unlocks, gear unlock pool, catalog,
supplies; 38 achievements; animated results; the simulator.

**Next:**
- FF9 story journeys 6+ (Burmecia → Treno → Cleyra → Alexandria → Fossil Roo → Madain Sari → Iifa Tree → … →
  Memoria / Necron), recruiting Eiko, Amarant, Beatrix and Blank.
- **Boss Gauntlet** challenge mode (Ozma, Hades, Necron…) feeding the legendary achievements.
- **Real 2D sprites** (FF Record Keeper–style sheets) with attack poses, plus Phaser particle spell effects.
- Balance passes with the simulator; challenge modifiers; Tetra Master.

## A note on Final Fantasy IX

*Final Fantasy IX* and its characters, names and data belong to Square Enix. This is an unofficial fan project and
is not affiliated with or endorsed by Square Enix. Game data is imported locally from a legally owned copy via the
community Memoria tools.
