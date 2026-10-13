# Changelog

All notable changes to ffix-roguelike are documented here.

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
