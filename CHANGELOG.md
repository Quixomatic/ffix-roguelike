# Changelog

All notable changes to ffix-roguelike are documented here.

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
