# Changelog

All notable changes to ffix-roguelike are documented here.

## [0.2.19] - 2026-10-16

### Fixed
- **Going back played two sounds** (the cancel plus a cursor tick: the page change moves the sidebar's highlight, which ticks). Backing out now plays only FF9's cancel; the cursor tick is held back for a moment. Applies to the browser's Back, close buttons and `data-sound="cancel"` links.
- **The browser's Forward played the cancel sound.** Only Back does now. The router numbers history entries (`__TSR_index`), so the entry being left tells a Back (lower) from a Forward (higher). Forward keeps the normal cursor tick.

## [0.2.18] - 2026-10-16

### Changed
- **Going back plays FF9's cancel sound**: the browser's Back and Forward (and a mouse's back button, through `popstate`), and the in-app back links: Embark's "◂ Journeys", and the character page's "← Back" (already a Close button).

## [0.2.17] - 2026-10-16

The two camp shops are separate pages, side by side on the Play hub; the sidebar uses the header's wordmark.

### Changed
- **Supplies and Gear catalog are their own pages**: **`/shops/supplies`** and **`/shops/gear`**, each with its own sidebar entry. This replaces the tabbed `/shops` page.
- **Play hub**: the Shops slot holds two half-size cards side by side, each with its own art and details:
  - **Supplies**: starting-kit ranks, gil banked.
  - **Gear**: how many pieces you can unlock, how many are unlocked.
- **Sidebar logo** is the header bar's "FFIX **Roguelike**" wordmark (was "IX / Final Fantasy / A ROGUELITE").

## [0.2.16] - 2026-10-16

The new hub is the game's camp: Play, Story, Party, Shops and Challenges in the sidebar layout, at their own paths. The old single-page camp is tucked away at /legacy/camp.

### Changed
- **The hub replaces camp** (from the v0.2.13 mockup):
  - **`/play`** is the Play hub (the title screen's Play, "Go to camp" and the header's Camp all land there).
  - **`/story`**, **`/story/:journey`** (pick the party), **`/party`**, **`/party/:character`**, **`/shops`** and **`/challenges`**.
  - **Achievements** and **Settings** moved into the hub layout too.
  - Routes live under a pathless layout, `_auth/_hub`, whose `staticData.shell = "sidebar"` tells the root to show the sidebar instead of the header bar. Code lives in `features/camp/` (was `features/mockup/`).
- **Picked party cards turn FF9 green** on the embark page, like the old camp's (`.ff-panel[data-on="true"]`).
- The sidebar's version line drops "mockup"; a small **Legacy camp** link sits above the player card.
- Pages outside the hub keep the header bar: title, login, runs and battles, Items, Dev, the effects gallery, practice battle.

### Kept
- **The old camp** (`features/hub/camp.tsx`, its shop dialogs and character sheet) at **`/legacy/camp`**, unchanged.

### Removed
- `/mock` (its pages are the real ones now).

## [0.2.15] - 2026-10-16

### Changed
- **Mockup Shops → Gear catalog is a grid of icon tiles**: icon, name and price for what you can unlock now (click to unlock; the price is red when you can't afford it), then everything already unlocked (green, "Unlocked ✓"). Hovering a tile shows the item's full card in a popover: stats, FF9's help, abilities taught, who can wear it, and what it would change for each character.
- `ItemDetails` (`run/item-info.tsx`): the item card's contents, for cards and popovers alike; `ItemCard` uses it.

### Fixed
- **/mock/party showed "Hello /_auth/mock/party/!"**: the running dev server's router plugin scaffolded a placeholder into the route file the moment it was created. It's the Party page again.

## [0.2.14] - 2026-10-16

### Changed
- Mockup Play hub: the gil/CP chips and the round shortcuts sit in the top-right corner of the window, not the content column's, and stay there while the page scrolls.

## [0.2.13] - 2026-10-16

A mockup of the new hub layout at **/mock**, alongside the current camp (which is unchanged): a sidebar shell, an FF theme for shadcn, the Play hub, and Story, Embark, Party, character, Shops and Challenges pages.

### Added
- **`/mock` sidebar shell** (`features/mockup/shell.tsx`):
  - **Sidebar:** logo and name, the version as the separator line, the game's destinations (Play, Story, Party, Shops, Challenges; the FF9 glove marks the current one), the account pages (Items, Achievements, Settings), a way back to the current camp, and the player (avatar, gil) at the bottom.
  - **Layout:** the page scrolls beside it over the title screen's backdrop (dimmed); the header bar is hidden on `/mock`.
- **FF theme for shadcn** (`.theme-ff` in `index.css`): shadcn's tokens re-pointed to FF9's menu colours, so Popover, Dialog, Tabs, HoverCard, Tooltip and Button come out in FF9 colours. Also `.ff-panel` (FF9's gradient window with the double border, for shadcn content), `.ff-lift` (hover glow for big cards) and `.ff-chip` (currency).
- **shadcn components** in `packages/ui`: dialog, popover, hover-card, tabs, separator, progress (Base UI).
- **Play hub** (`/mock`):
  - gil and CP top right, with a floating stack of round shortcuts (Items, Achievements, Settings) with tooltips
  - a "Continue run" banner when a run is in progress
  - the **cast line**
  - four big cards with live details: **Story** (next journey, journeys cleared), **Party** (recruited, who can spend CP), **Shops** (gil banked), **Challenges** (challenges done)
- **Cast line** (`RosterLine`): everyone in FF9's order. Recruited characters hop and have a ★ when they can spend CP; the rest are silhouettes. Hovering shows their card in an FF popover (`CharacterCard`): start level, HP/MP/Str/Mag, starter gear, gear slots and CP, or how to recruit them. Clicking a recruited character opens **/mock/party/:character**.
- **Story** (`/mock/story`): every journey as a card (maps, final boss, the hero it recruits) with **per-journey tier pips**. Normal is always open; higher tiers open once that journey is cleared, for now capped by the account's tier until the rules track a tier per journey. **Choose ▸** goes to the embark page.
- **Embark** (`/mock/story/:journey?tier=N`): the journey and its tier, four **party slots**, and the roster as cards to pick from (up to four; the last party is remembered). **Begin run ▶** starts the run for real, as camp does.
- **Party** (`/mock/party`): the roster as cards; **/mock/party/:character** is the camp character sheet as a page (paperdoll, training, gear, abilities; spending works).
- **Shops** (`/mock/shops`): Supplies and Gear catalog as tabs.
- **Challenges** (`/mock/challenges`): Boss Gauntlet, Solo runs and Higher tiers (coming soon), and the challenge achievements as goals.

### Changed
- `CharacterModal` / `CharacterSheet` take `inline` (render as a page instead of a dialog). `ShopContents` is the shop dialogs' body, exported. The current camp and run screens are unchanged.

## [0.2.12] - 2026-10-16

### Changed
- **`MemoriaBackdrop` has a `dim` setting** (0 to 1): a black veil over the sky and motes. The title screen stays at full strength (0). **Camp uses 0.6** (`CAMP_DIM` in `hub/camp.tsx`), since at full strength the blue tinted all of its windows.

## [0.2.11] - 2026-10-16

### Added
- **`MemoriaBackdrop`** (`components/memoria-backdrop.tsx`): the title screen's background (the deep-blue radial sky and the drifting "memoria" motes fading toward the bottom) as a reusable wrapper. It draws behind its children in its own stacking layer, so content needs no z-index; it fills at least the page area and grows with long pages, and `className` sets the container's layout.

### Changed
- **Camp uses the title screen's backdrop** (and while it loads). The title screen now uses the component too; it looks the same.

## [0.2.10] - 2026-10-16

### Fixed
- **The run screen no longer fills the height** (since v0.2.9): its layout relied on being stretched by the old grid row, and the new scrolling `<main>` did not stretch it. `<main>` is now a one-row grid whose row is at least the full height and grows with taller pages (`grid-rows-[minmax(100%,max-content)]`), so every page fills the area under the header whether or not it sets its own height, and long pages still scroll under the header.

## [0.2.9] - 2026-10-16

The header stays put: pages scroll in their own area under it.

### Changed
- **App shell**: the header bar, then `<main>` as the page's one scroll area (`grid-rows-[auto_minmax(0,1fr)]`, main `min-h-0 overflow-y-auto`). Camp, Settings, Achievements, Items and the other long pages scroll under the header instead of scrolling it out of view. Full-screen pages (the run's map and stages, battles, the effects gallery) fill the area exactly, as before.
- Navigating to another page starts it at the top, and back/forward restores where you were: the router resets and restores the main area's scroll (`scrollToTopSelectors`, `data-scroll-restoration-id`), not the window's.
- The effects gallery fills the area (`h-full`) instead of guessing the header's height.

## [0.2.8] - 2026-10-16

FF9's own menu sounds: the cursor tick, cancel, the "can't do that" buzzer and the shop purchase chime, across the whole app.

### Added
- **FF9's menu sounds**, extracted from the game (`python apps/web/scripts/extract-ff9-sfx.py`). FF9's sound table (`SoundEffectMetaData.txt` in `resources.assets`) maps each sound index to its file in the sound-effect bundles; which index the menus play comes from Memoria's UI code: 103 the cursor tick, 101 cancel, 102 buzzer, 1045 shop purchase, 682 help.
- **Where they play** (`features/audio/ui-sounds.ts`, mounted once for the whole app):
  - **Cursor tick** whenever the highlighted option in any menu changes, by keyboard or mouse: battle commands, ability, item and target lists, every `.ff-option` list. Clicking a button or link ticks too; FF9 uses the same tick for moving and selecting.
  - **Cancel** on Escape and on close buttons (dialogs, the character sheet).
  - **Buzzer** on pressing something you can't do: unaffordable or sold-out items, buttons that are disabled.
  - **Purchase chime** when a buy goes through: the run shop, Stiltzkin, synthesis, camp supplies and the gear catalog.
  - Any element can pick its own sound with `data-sound="purchase|buzzer|cancel|help|none"`.
- They follow the **Sound effects** volume in Settings, are decoded at boot so the first tick isn't late, and the same sound twice within 60 ms plays once (a click that also moves the cursor).
- The sounds ship as a new `sfx` asset pack (5 files, 40 KB), loaded with the boot packs from R2. `public/sfx/` is git-ignored, like the music.

### Notes
- Restart `pnpm dev` (Vite config changed).

## [0.2.7] - 2026-10-16

### Fixed
- Effects gallery: the middle (stage) panel now shrinks to fit between the wider sidebars instead of pushing the right sidebar off screen. The grid column could not shrink below the Phaser canvas, and the canvas sized itself to the column. The stage also keeps the target and effect centred when it resizes.

## [0.2.6] - 2026-10-16

### Changed
- Effects gallery: wider side panels: the move/effect list is 28rem (was 20rem) and the target/assign panel 30rem (was 22rem), so names, statuses and candidate reasons fit.

## [0.2.5] - 2026-10-16

The effects gallery has a "To map" tab: every FF9 move, with what it plays now, filtered to the ones still needing an effect.

### Added
- **Effects gallery → "To map"** (the first tab): the moves themselves, not the effects.
  - **What's listed:** every party command move, labelled with its command (Blue Magic, Sword Art, Summon…), and every monster move. A monster move is one row per name, covering all of FF9's copies of it ("Monster ×4").
  - **Status per move:** **needs effect** (red), **generic default** (yellow, with what it falls back to: claw swipe, status sparkle…), **partly mapped**, **mapped** (green, with where it came from), or **staging** (FF9's script-only moves, which play nothing).
  - **Filters:** Unmapped / All, Party / Enemy / Both, and search. The counts are in the header; right now 1 needs an effect (Flee, on purpose), 120 monster moves are on a generic default, 338 are mapped and 121 are staging.
  - **Picking a move** plays what it plays now and pins it as the **target**: name, kind, how many copies, whether the other side (party/monster) uses the same name, and its candidates as one-click previews.
  - **Assigning:** browse any tab (Candidates, FFRK named, Folders) and use the shown effect as the whole recipe or one phase (launch/shot/hit). It applies to every move with that name, party and monster, every copy. **Next unmapped →** moves to the next one; **clear** removes an assignment.
- "FF9 moves" is renamed **Candidates**. Clicking a move name in the "Assign to an FF9 move" search makes it the target.

### Fixed
- **Assigning an effect to a monster move in the gallery only reached one of its copies**: FF9 has many same-named monster attacks (one per monster that uses it), and the gallery kept only the first. It now assigns every copy. Moves assigned by `effects:seed` weren't affected: it always covered every copy, and there are no partly-mapped moves.

## [0.2.4] - 2026-10-16

Asset packs are gzipped: the first-visit download drops from 44 MB to 25 MB.

### Changed
- **`assets:pack` gzips every pack** (`<name>.<hash>.pack.gz`). The manifest records the download size, the unpacked size and `encoding: "gzip"`. Savings:
  - effect rigs and particle files (JSON): 9.7 MB → 1.1 MB
  - the monster sheets (mostly empty space in the boss frame grids): 23.7 MB → 13.7 MB
  - effect PNGs and sounds, music: barely change; they're already compressed
- **The loader unzips with the browser's own gzip decoder** (`DecompressionStream`, no library). The progress bar counts the compressed bytes actually downloaded, and Cache Storage keeps the unzipped pack, so later visits don't unzip again. Packs cached in the old format are cleared on the next visit.
- Every pack was re-uploaded and the old ones pruned. Checked from the CDN: the downloads match the manifest sizes and unzip to byte-identical files.

## [0.2.3] - 2026-10-16

### Fixed
- **Summon creatures (and other effects' pieces) were drawn pulled apart**: Ifrit's arms, legs and accessories each sat away from the body, all animating correctly.
  - **Cause:** FFRK's atlases store each piece trimmed, as a small crop that remembers where it sat in a bigger source box (Ifrit's 12×10 leg piece sits at (65, 17) in a 93×93 box). FFRK's rigs size and place pieces by the crop itself, but Phaser draws a trimmed frame offset inside its source box, so each piece moved by its own trim offset.
  - **Fix:** atlases now load into Phaser as plain rectangles, with the trim dropped.
  - **Scope:** checked across every effect the game uses (237 rigs, 1,454 atlas-drawn parts): 1,425 parts are sized exactly to their trimmed crop, and 1,412 crops are trimmed. So pieces in many other effects were also slightly misplaced, and are now where FFRK puts them.

## [0.2.2] - 2026-10-16

Every party command and most monster special moves play an FFRK effect, summons bring their creature on screen, and the effects gallery's "FF9 moves" tab lists every pick to check and swap.

### Added
- **Move candidates** (`features/effects/move-candidates.ts`), in the same form as the spell candidates: FFRK effect folders for each move, most likely first, with the evidence. The evidence is FFRK's own file and image names (often Japanese: `ab_shiva`, `ab_efreet`, `img_issen` 一閃 = iai flash, `img_70582_senkoku` 宣告 = Doom, `img_gil_enki` thrown gil, `img_ycherry`, `img_dragons_crest`, `img_Luna`, `img_mighty_g`, `img_needle`, `img_missile`, `img_curse`, `img_library` = Libra), FFRK abilities that do the same thing, and the spell families. They cover:
  - **Summon**: Shiva, Ifrit, Ramuh, Atomos, Odin, Leviathan, Bahamut and Ark (FFRK's own summons), plus Carbuncle, Fenrir and Madeen.
  - **Sword Art and Flare Sword**: Darkside → Dark Buster, Iai Strike → `img_issen`, Armour Break → Armor Break, Thunder Slash → Thunder Strike, Shock and Stock Break → ground-cracking shock.
  - **Dragon**: Lancer, Reis's Wind, Dragon Breath → Bahamut's Megaflare, White Draw, Luna, Six Dragons, Cherry Blossom, Dragon's Crest.
  - **Skill**: Steal, Detect → Libra, Lucky Seven → slot reels, Thievery → Zidane's Dagger of Resolve, and the rest.
  - **Flair**: Spare Change → thrown gil, Curse → `img_curse`, Countdown → Doom's countdown, and the rest.
  - **Blue Magic**: all 23, which also gives the monsters that use these moves their own effect.
  - **Eat, Focus**.
  - **Monster moves**: about 120 names that had the generic claw swipe or status sparkle. Knives, swords, spears and axes use FFRK's weapon hits; tentacles, slams, beaks and wings use FFRK's monster attacks. Death and Doom moves, Needles, Flare/Nanoflare, Mind Blast, Glowing Eyes, bubbles, water and ice breaths, powders, shockwaves, cannons and boomerangs get their own art.
- `effects:seed` assigned the first pick: **351 more moves**, 661 in all. Assignments made in the gallery are never overwritten. Every party command move now has an effect (Flee plays none on purpose); monsters went from 51 to 201 move names with their own effect.
- **Summon creatures appear**: FFRK's summon effects embed the creature as a linked animation rig (`abjson` nodes, e.g. Shiva's launch plays `ab_shiva.json`'s `idle_add`). The rig evaluator now draws linked rigs on the schedule their link gives (`linkAnim` play/stop steps, the tag's own loop and frame rate), from the linked node down, in the node's transform. The effect loader loads linked rigs (nested too) with their images, particles and frame animations.
- Shot-only effect folders (FFRK's summon abilities: Ramuh 60016, Phoenix, Mind Flare) play FFRK's own way: summon launch → the creature as the shot → empty hit.

### Changed
- **Effects gallery**: the "FF9 spells" tab is now **"FF9 moves"**. It lists every spell, command and monster-move candidate with its group ("Summon · Shiva — 62010 (first pick)"); "Use this for every FF9 *move*" assigns it to every party and monster move with that name.
- The effects asset pack holds every file these effects use: 1,392 files, 20.7 MB (from 7 MB, mostly the summon creatures). It's packed and uploaded to R2.

## [0.2.1] - 2026-10-16

The game loads its sprites, effects and music from Cloudflare R2, with a loading bar the first time and instant loads after.

### Added
- **`pnpm -F web assets:upload [--prune]`** (`scripts/upload-assets.ts`): uploads the packs from `assets:pack` that the bucket doesn't have yet, then the manifest last, so players never see a manifest naming a missing pack. Uses the server's R2 credentials (run through varlock from apps/server); `--prune` deletes packs the manifest no longer names. Done: 25 packs, 69.5 MB, at `https://ff-like.turboforge.io/assets`.
- **Asset loader** (`src/lib/assets.ts`): with `VITE_ASSET_BASE_URL` set, the game reads the manifest and downloads the packs it needs, showing progress. Whole packs are kept in the browser's Cache Storage, and since pack names change with their contents, an update downloads only the packs that changed. Files are served from memory: `assetUrl(path)` gives a blob URL (Phaser, images, CSS) and `assetFetch(path)` a response. Old packs are cleared from the cache.
- **Loading screen** (`components/asset-gate.tsx`): before the game renders, the sprite and effect packs load (~31 MB the first visit, a moment from the cache after) behind an FF-window progress bar ("12.3 / 31.2 MB"), with Try again on an error.
- **Music streams per track**: each track is its own pack, downloaded the first time it plays; the six session tracks (title, camp, battle, boss, victory, game over) download in the background after boot.

### Changed
- Every asset URL goes through `assetUrl` / `assetFetch`: hero, weapon and monster sprites, item icons, both gloves (the menu glove through a CSS variable), FFRK effect files and their sounds, and music.
- **Production builds leave out `public/sprites` and `public/music`** when assets come from R2: the build is 2.7 MB instead of ~67 MB.
- Without `VITE_ASSET_BASE_URL`, everything loads from the app's own files as before, and the dev effects library (`/ffrk-raw`) still backs the effects gallery.

### Notes
- Workflow after rebuilding sprites, music or effect assignments: `pnpm -F web assets:pack && pnpm -F web assets:upload`.
- Restart `pnpm dev` (Vite config and env changed).

## [0.2.0] - 2026-10-16

Version 0.2: the game is built on FF9's real data and battle engine, with FFRK art and effects, FF9's soundtrack, and its assets moving to Cloudflare R2.

### Milestone
- The 0.1 series (0.1.0–0.1.101) built:
  - the FF9 battle engine and the server-replayed runs
  - the story journeys through Disc 1
  - Completion Points, training and achievement-gated supplies
  - FFRK party and monster sprites and FFRK spell effects with their sounds
  - FF9's music
  - an R2 bucket (`ff-like.turboforge.io`) with avatar uploads and per-class asset packs (`assets:pack`)
- 0.2.x continues from here: uploading the packs and loading assets from R2, and effects for the remaining moves.

### Changed
- Version 0.2.0 (minor bump; no code changes in this release).

## [0.1.101] - 2026-10-16

A local command packs the game's assets, one pack per asset class, ready to upload to R2.

### Added
- **`pnpm -F web assets:pack [class…]`** (`scripts/pack-assets.ts`): packs the shipped assets from their local build outputs into `apps/web/.assets/packs/` with a `manifest.json` (git-ignored). Classes:
  - **heroes**, **weapons**, **items**, **ui**, **enemies**: the built sprites.
  - **effects**: only the FFRK effect files the game can play. That is `usedEffectPaths()` plus everything they reference (particles, frame animations, images and their atlases, sounds); 589 files, 7 MB, out of the 4 GB library. It warns about any referenced file that isn't downloaded.
  - **music**: one pack per track ("music/music006"), so a track downloads the first time it plays, not with the whole soundtrack.
- **Re-run it whenever local files change**:
  - Pack names carry a hash of their contents, so only packs whose contents changed are rewritten; the rest print "unchanged". Old versions are removed.
  - `assets:pack effects` repacks one class and keeps the others in the manifest.
  - A full pack takes under a second: 25 packs, 69.5 MB.
- **Pack format** (`src/lib/asset-pack.ts`): a small header (each file's path, type and position) followed by the files' bytes, plus `readPack()` for the browser loader that will fill the asset cache from them.

## [0.1.100] - 2026-10-16

Players can set an avatar, stored in the R2 bucket.

### Added
- **Avatar uploads**:
  - **Settings → Avatar**: upload, change or remove your picture (PNG, JPEG, GIF or WebP, up to 2 MB). It shows in the header's account button too, or your initial when you have none.
  - **Flow** (same split as ChannelGuide's uploads, and GuideEngine's avatar flow):
    - `POST /api/uploads/avatar` (`apps/server/src/uploads.ts`) is a thin, cookie-authed Hono multipart route, since tRPC is JSON-only.
    - It calls the api service (`packages/api/src/services/avatar.ts`), which stores the file through `@ffix-roguelike/storage` at `avatars/users/<id>.<ext>` and returns its public URL.
    - The client sets that URL with **better-auth's `authClient.updateUser({ image })`** and refreshes the session, so `user.image` stays better-auth's.
  - The image format is read from the file's bytes, not taken from the browser, so only real images are stored. Each upload replaces the last; the URL carries a `?v=` stamp so browsers and the CDN pick up the new picture.
- The api package depends on `@ffix-roguelike/storage`.

### Notes
- Assets and avatars are served from **ff-like.turboforge.io**, the bucket's custom domain.
- Restart `pnpm dev` (new server route).

## [0.1.99] - 2026-10-16

The server is connected to the R2 bucket.

### Changed
- The server depends on `@ffix-roguelike/storage` (for the upcoming Hono upload routes) and its `.env` points at the `ff-like` bucket. A round trip works: put, exists, list, a public GET through the r2.dev URL (200, correct content type), and delete.

## [0.1.98] - 2026-10-16

Cloudflare R2 storage for game assets and user uploads, and the effects gallery can no longer wipe assignments.

### Added
- **`@ffix-roguelike/storage`** (`packages/storage`): Cloudflare R2 (S3-compatible) through Bun's built-in S3 client, so it needs no SDK. `storageFromEnv()` returns `put` / `exists` / `delete` / `list` / `publicUrl`, or null when R2 isn't configured. `KEYS.asset(path)` → `assets/…` and `KEYS.userAvatar(userId, ext)` → `avatars/users/<id>.<ext>` namespace the one public bucket. It is a package rather than server code because both the API (Hono: avatars and other uploads) and the web build's asset upload script use it.
- Optional env vars, using GuideEngine's names:
  - **server**: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`.
  - **web**: `VITE_ASSET_BASE_URL`, where the game's assets will be served from (unset = the app's own files).

### Fixed
- **The effects gallery could erase assignments**: it saved its whole in-memory map, so a tab opened before v0.1.96 wrote its old 161 entries over the 310 (restored). It now sends only the moves it changed, the dev server merges them into the file on disk and returns the result.

## [0.1.97] - 2026-10-16

The FFRK scrapers share one proper downloader — progress bars, parallel downloads with timeouts, no memory blow-ups — and effect sounds are fetched only for moves the game uses.

### Added
- **`scripts/lib/fetcher.ts`** — a reusable downloader for every asset scraper: disk cache (files mirror the server path), a remembered-missing list (`.missing`, so re-runs skip what the server doesn't have), a parallel pool with per-request **timeouts and retries** (one stalled connection can no longer hang a run), and **live progress bars** per stage — count, rate, ETA (periodic lines when output isn't a terminal).
- `src/features/effects/effect-recipes.ts` — the weapon-attack and monster-default effect recipes as plain data (out of the Phaser player), with `usedEffectPaths()`: every effect file the game can play.

### Changed
- **`ffrk:effects`** runs in stages, each with a progress bar — catalog → probe → variants → crawl → index → sounds. The crawl caches each file's own references instead of growing per-effect sets (the old one reached 7 GB of RAM and was killed); a full re-crawl of 13,653 folders from cache takes ~1.5 minutes. **Sounds default to only those the game's effects use** (`--sounds used`, 66 right now; `--sounds all|none` too); `--skip-probe` refreshes from the indexed folders without re-probing 90,000 ids.
- `ffrk:fetch` (sheets, weapons, relic icons) and `ffrk:names` (wiki images) use the shared fetcher — progress bars, timeouts, remembered misses.
- `.docs/ffrk-assets.md` §7 documents the fetcher.

## [0.1.96] - 2026-10-16

FF9's spells and Magic Swords play FFRK effects — 310 FF9 moves have one now — and the effects gallery has an "FF9 spells" tab to check and swap them.

### Added
- **All 13,653 FFRK effect folders indexed** (with the art and sounds each uses; the download finished).
- **Spell candidates** (`features/effects/spell-candidates.ts`): every FF9 spell and Magic Sword without a same-named FFRK ability gets an ordered list of FFRK effects with the reason for each — FFRK's family numbering (12000 = ice tier 1 → **Blizzard**, 13000 → **Thunder**, 14000 → **Water**…) and FFRK's own file names, which use the Japanese spell names (carele = ケアル → **Cure**, carelela → **Cura**, poisona → **Panacea**, refrek = リフレク → **Reflect**, img_bio → **Bio**, commet → **Comet**, meteor → **Meteor**, skull → **Death**, time-magic circles → **Slow/Stop**), plus FFRK's spellblades for Steiner's swords (Fire Strike → Fire Sword, ice/thunder/water spellblades, Venom Buster → Bio Sword, Dark Buster → Doomsday Sword).
- `effects:seed` assigns the first candidate to every party and monster move with that name — **148 more moves**, 310 in all. Assignments made in the gallery are never overwritten.
- **Effects gallery → "FF9 spells" tab** (now the first tab): each spell's candidates side by side, labelled with the reason; pick one, watch it, and "Use this for every FF9 *Spell*" assigns it to all party and monster moves of that name (and shows what's assigned now).

### Notes
- The surest picks are the tier, Cure/Cura, Reflect, Bio, Comet, Meteor and Death ones; the status spells (Silence, Confuse, Blind, Float, Dispel, Might, Sleep…) have two or three candidates each — worth a look in the gallery.

## [0.1.95] - 2026-10-16

### Fixed
- The "🔒 Locked" tag on locked character cards sits and centres its text exactly like the Manage button.

## [0.1.94] - 2026-10-16

Camp cards line up, locked journeys match unlocked ones, and the shops have a section label.

### Changed
- **Journey and party cards line up across each row**: cards in a grid row share row tracks (CSS subgrid), so titles, subtitles, detail lines, stats, gear and the Manage buttons sit at the same height in every card, however much text each has.
- **Locked journeys use the same layout as unlocked ones**: "???" with "🔒 Locked", "Unlock: clear *the previous journey*", the map count with "Final boss: ???", and "Clear to recruit: ???" — instead of a shorter, faded card.
- **"Shops" label** above the Supplies and Gear catalog buttons, like "Journey" and "Party".

## [0.1.93] - 2026-10-16

Camp supplies are unlocked by achievements — story clears among them — and locked characters' cards match the roster.

### Added
- **Story achievements** (a new "Story" category): Out of the Forest (clear The Evil Forest), Through the Ice (The Ice Cavern), The Secret Under Dali (Dali), Hunter's Chance (Lindblum), The Bell Tolls (Gizamaluke's Grotto) — gil, and camp supplies.
- **Triumph** — win a run (gil, CP, and the Remedy supply).
- Achievements can unlock **camp supplies** (`reward.supplies`); the achievements page and the run-over screen list them.

### Changed
- **Supplies are gated by achievements.** Potion, Phoenix Down, Antidote, Eye Drops and Echo Screen are always stocked; Hi-Potion and Soft come with clearing The Evil Forest, Magic Tag and Vaccine with The Ice Cavern, Tent and Annoyntment with Dali, Ether with Lindblum, Remedy with winning a run, and Elixir with **Iron Will** (win on Tier 3) — Elixir caps at 2 ranks and, as a never-sold rarity, is priced like one (ranks 200,000 / 400,000 gil). Replaces the "furthest world reached" gating.
- **Locked supplies show in the grid** as greyed cards with their effect and "🔒 Unlock: *achievement* — *what to do*".
- **Locked characters on the camp roster use the same card layout as unlocked ones** — silhouette with "???" and "Locked", the stat and gear lines (the unlock condition where the gear goes), and a 🔒 footer where Manage would be — so the roster lines up.

### Notes
- Achievements are checked when a run ends, so story clears you've already made unlock their supplies at the end of your next run.

## [0.1.92] - 2026-10-16

### Changed
- **Supplies are a grid of cards** instead of full-width rows: each card has the item's icon in a square tile, its name and how many every run starts with ("×6 per run"), its exact effect and FF9's description, its 5 rank boxes, and a "+ gil" button for the next rank (red when you can't afford it, "Max" when full).

## [0.1.91] - 2026-10-16

Supplies are permanent starting-kit upgrades, bought like training.

### Changed
- **Camp → Supplies** no longer sells one-off items for your next run. Each supply (Potion, Phoenix Down, Antidote, Eye Drops, Echo Screen; Hi-Potion, Ether, Soft, Tent and Remedy, Elixir as you reach further worlds) has **5 ranks**: each rank adds one more of it to what **every** run starts with. Rows look like training — the item, its rank boxes, "rank/5", how many runs start with ("×6" = the starter kit's 4 Potions + 2 ranks), its exact effect and FF9's description, and "+ n gil".
- **Ranks cost far more than buying the item in a run**: rank n costs 10 × the item's FF9 price × n — a Potion's ranks are 500, 1,000, 1,500, 2,000, 2,500 gil (`SUPPLY_COST_FACTOR`, `SUPPLY_MAX` in game-core `meta/profile.ts`).
- Supplies already bought the old way are still packed into your next run.

### Added
- game-core `buySupplyRank`, `supplyRank`, `supplyRankCost`, `startingSupplies`; API `profile.buySupplyRank`; DB `player_profile.supplyRanks` (migration `supply_ranks`). Runs start with the starter kit + supply ranks.
- `TrainRow` (character sheet) is reusable: any label, currency unit and label width.

### Notes
- Restart `pnpm dev` (schema change).

## [0.1.90] - 2026-10-16

The camp's shops are two big buttons with their own windows, and "How runs work" is a dismissible help card.

### Changed
- **Supplies** and **Gear catalog** are two big buttons on the camp page (icon tile, title, what they're for); each opens its own window like the character sheet — banked gil in the header, the items as cards, Escape or clicking outside closes it. Replaces the inline shop panel with its tabs.
- **"How runs work"** is a help card pinned to the top-right corner instead of a block at the bottom of the page. ✕ dismisses it — remembered in this browser — and a small "?" button brings it back.

### Added
- `components/game-dialog.tsx` — **`GameDialog`**, the reusable full-screen FF window (title, header content, close; scrolling body; Escape/outside click closes).
- `components/help-card.tsx` — **`HelpCard`**, dismissible corner help remembered per id in localStorage.

## [0.1.89] - 2026-10-16

Items and abilities say what they do — in FF9's own words and with their exact effect.

### Added
- **FF9's help text** for every item, ability and support ability, extracted from the game (`packages/game-data/scripts/extract-help-text.py` reads the English `itm_help` / `aa_help` / `sa_help` tables from `FF9_Data/resources.assets`) into the seed tables as a `help` field (`db/seed/ff9/help-text.json`; `bun scripts/apply-help-text.ts`, and `import:memoria` attaches it on every import). E.g. Echo Screen "Cures **Silence**.", Soft "Cures **Petrify** and **Gradual Petrify**.", Mage Masher "Weapon originally used for combating mages. Add ST: **Silence**." — FF9's highlighted words shown in yellow.
- **Exact effects from the engine's data** for consumables (`itemEffectText`): "Restores 150 HP · one target", "Cures Venom, Silence, Blind, Stop, Poison, Mini, Gradual Petrify · one target" (Remedy), "Fully restores HP and MP", "Revives a KO'd ally with a little HP", "Restores half of max HP and MP; may cause Silence, Blind, Poison" (Tent)…
- Shown where you use or pick items and abilities:
  - **Battle menus**: the highlighted ability or item's help (and an item's exact effect) under the list, like FF9's help bar.
  - **Item cards** (rewards, shops, treasure, catalog, Items page): consumables show their exact effect; all items show FF9's line.
  - **The run's Items panel**: effect and help under each item; the sidebar's quick-use buttons say what they do on hover.
  - **Character sheet**: Abilities and Support cards show FF9's description.

### Notes
- The FF9 seed tables changed (help lines); the server re-seeds them on the next start.

## [0.1.88] - 2026-10-16

### Changed
- **Baku** (Alexandria's boss) uses FFRK's Masked Man sprite instead of the placeholder — FFRK never drew Baku.

## [0.1.87] - 2026-10-16

### Changed
- Stat changes show a signed number again instead of carets: "+2 Def" with a green "+2", "−1 Eva" with a red "−1" (the stat name in plain text, on the subtle badge).

## [0.1.86] - 2026-10-16

### Changed
- Badges are muted tints instead of solid colours (`Badge` tones `neutral`, `good`, `bad`, `highlight`, `info`): an ability lost is a dark-red chip with red text (struck through), an ability gained a dark-yellow chip with yellow text — the look gear comparisons had before.

## [0.1.85] - 2026-10-16

Gear comparisons are built from reusable badge components.

### Added
- `components/badge.tsx` — **`Badge`**, a small inline chip with tones: `neutral` (the subtle default background) and fully coloured `gain` (green), `loss` (red), `info`, `warn`.
- `components/stat-delta.tsx` — **`StatDelta`**: a stat change on a neutral badge with only the caret and number coloured ("▲2" green / "▼1" red) and the stat name in plain text.

### Changed
- Gear comparisons (`DeltaChips`, everywhere gear is compared) use them: stat changes are subtle `StatDelta` badges; abilities gained are green **gain** badges ("+ Mug"), abilities lost red **loss** badges (struck through); "Equipped" and "No change" are neutral badges.

## [0.1.84] - 2026-10-16

### Changed
- In gear comparisons only the caret and the number are coloured (green ▲ / red ▼); the stat name is normal text.

## [0.1.83] - 2026-10-16

### Changed
- Carets are for stats only: abilities a piece of gear would add show as "+ Mug" (yellow) and ones it would take away as struck-through red text, as before.

## [0.1.82] - 2026-10-16

### Changed
- **Gear comparisons use carets instead of badges**: a green ▲ for a stat that goes up and a red ▼ for one that goes down ("▲2 Def", "▼1 Eva"), as plain coloured text; abilities gained show "▲ Mug" in yellow and lost ones "▼ ~~Steal~~" in red. Everywhere gear is compared: the gear picker, item cards (rewards, shops, synthesis, treasure, Stiltzkin), the camp catalog and the Items page.

## [0.1.81] - 2026-10-16

Swapping gear in a run is a grid of proper tiles.

### Changed
- **The in-run gear picker** (character sheet → Equipment) is a grid of bordered cards with gaps (two columns, three on wide screens). Each card has the item's icon in a square 64 px tile on the left and its details on the right: name (and who's wearing it / "found"), stats, and the stat changes it would make for this character. Cards highlight on hover.
- **Remove** is a card of the same size, with a crossed-out slot symbol in its tile and "Leave this slot empty".

## [0.1.80] - 2026-10-16

Stealing shows what happened.

### Fixed
- **Steal didn't say what it took or whether it failed.** A successful steal now pops "Stole Potion!" (the item's name) over the monster and in the banner; a failed one pops "Miss" over the monster, with FF9's reason in the banner — "Couldn't steal anything" or "Doesn't have anything!".
- **Battle result messages appeared as the action started** (and the action's name banner could hide them). Messages now wait until the action's effect has landed.

## [0.1.79] - 2026-10-16

### Changed
- The target glove is a touch bigger: 24 px (32 px on very large screens), up from 16.

## [0.1.78] - 2026-10-16

FF9's menu hand: the highlighted menu option has a pixel glove pointing at it.

### Changed
- Menus (battle commands, ability/item lists, target lists, and every other `.ff-option` list) point at the highlighted option with the pixel glove from the Time Fantasy icon pack instead of the "☛" text character — the menu-side partner of the target glove.

## [0.1.77] - 2026-10-16

The target glove is marker-sized.

### Changed
- The target glove was drawn at the heroes' pixel scale (48 px). It now takes the yellow ▼ marker's place and size — 16 px (32 px on very large screens), at the marker's spot with the same bob.

## [0.1.76] - 2026-10-16

An FF9-style pointing glove shows exactly who you're about to hit.

### Added
- **Target glove**: while choosing a target, a gloved hand (Time Fantasy icon pack) bobs over the unit you're aiming at — the highlighted name in the target list, or every candidate when **All** is highlighted. The yellow markers stay on the other valid targets, so you still see your options.
- **Hovering a unit on the battlefield aims at it** (moves the menu's cursor), like hovering its name; clicking still picks it.
- `pnpm -F web sprites:ui` (`scripts/build-ui-icons.ts`) ships just the UI icons used (`public/sprites/ui/`): the target glove and a right-pointing menu glove.

### Fixed
- **"All" in the target list didn't highlight on hover** (it had no hover handler); it does now, and moves the glove onto every target.

## [0.1.75] - 2026-10-16

Music, sounds and spell effects are cached in the browser, so they load instantly after the first time — even after a hard reload.

### Added
- **Asset cache** (`lib/asset-cache.ts`, the browser's Cache Storage): music tracks, ability sounds and FFRK effect files (rigs, particle files, frame animations, effect images and their atlases) are downloaded once and then read from disk. Hard reloads skip the browser's normal HTTP cache, but not this one. The cache is versioned (`ffix-assets-v1`); old versions are cleared automatically.
- **Core music is warmed in the background** when the app is idle — Title, Camp, Battle, Boss, Victory, Game Over — so the first battle doesn't wait for its track.

## [0.1.74] - 2026-10-16

Only ever one song at a time — including through dev hot reloads.

### Fixed
- **A hot reload in development started the same song again on top of the one playing** (the reload re-ran the audio module, which made a second player while the first kept going). The player's state now lives on the page itself (`globalThis`), so a reload keeps using the same audio context and the track already playing.
- **No overlapping tracks**: every music source still sounding is tracked; starting a track fades out and stops all the others, not just the last one.

## [0.1.73] - 2026-10-16

Battles end when the last hit lands, not when the engine decides them; quieter default volumes.

### Fixed
- **"Victory!" appeared (and the fanfare started, and the battle handed back) the moment the final action began**, before its effect had even reached the monsters: the engine decides the fight instantly. The battlefield now tracks when each target's effect lands; the Victory/Defeat banner, its music and the hand-back wait until the last hit has landed (plus the usual pause).
- **The enemy list dropped monsters and their ATB gauges emptied as soon as they were targeted** (the engine zeroes a fallen unit's gauge at once). Monsters stay listed with their gauge where it was until the hit lands; the field's ATB gauges hold too. The party panel's HP and ATB likewise wait for the hit.

### Added
- The enemy list shows "No enemies left" once they're all gone.

### Changed
- **Music and sound effects default to 25** (were 60 and 80) — in Settings, for new players and anyone who hasn't saved a volume (migration `audio_defaults_25`). Saved volumes stay as they are.

## [0.1.72] - 2026-10-16

Every monster move plays an FFRK effect and sound — not just the handful assigned by name.

### Added
- **Default effects for FF9 monster moves** that have no assignment yet, from what each move is (its FF9 battle script, category and element):
  - physical hits → FFRK's claw swipe (Bite/Fang/Chomp-like names → FFRK's Bite); fire/thunder/shadow physicals → Fire Strike / Thunder Strike / Dark Buster
  - elemental magic → FFRK's matching spell: fire → Fira, ice/water → Blizzara, thunder → Thundara, wind → Aerospark, earth → Quake, holy → Holy, shadow → Dark Buster
  - heals → Curaga's sparkle; Protect/Shell/Haste/Berserk → their FFRK spells; poison/venom → Venom Buster; other statuses → a status sparkle; drains/Osmose → dark; Comet/Meteor → Meteor Crush
  - FF9's script-only staging moves (taunts, phase changes) play nothing.
- Assignments made in the effects gallery always win over these defaults; the art-based mapping of the full effect library (after the download finishes) will replace defaults with closer matches.

## [0.1.71] - 2026-10-16

Battles have sound, and plain attacks swing with their weapon's own effect.

### Added
- **Sound effects in battle.** FFRK's effects carry their own sounds (each rig's `action_sound` events — FFRK's `lang/se/se_ogg/*.ogg`, downloaded with the effects); they now play on their frames: the black-magic circle's chime, Fire's roar, Curaga's sparkle, a dagger's slash. Played through a sound-effect channel that follows the **Sound effects** volume in Settings (0 = off). The effects gallery plays them too.
- **Plain attacks use FFRK's weapon-type attack effects** — FFRK's own recipes per weapon category, taken from captured party data: Zidane a dagger slash (30004), Steiner/Beatrix/Blank/Marcus a sword slash (30003), Freya and Quina a spear thrust (30044), Amarant a claw/fist strike (30054), Garnet a rod (30064), Vivi a staff (30074), Eiko a flute's flying note (30093). Monsters' plain attacks use FFRK's claw swipe (30051). Each has its sound, and the damage waits for the slash.

## [0.1.70] - 2026-10-16

Music: FF9's own soundtrack plays everywhere — title, camp, each area's overworld, battles, bosses, the victory fanfare and Game Over.

### Added
- **FF9's soundtrack**, extracted from the game's install (`python apps/web/scripts/extract-ff9-music.py`): all 109 tracks from FF9's sound bundle, with the **Moguri remasters** (13 tracks) where installed, and FF9's own track names (92, read from the PC version's audio exporter table).
- **Where each track plays** (`apps/web/scripts/music-map.ts`):
  - Title: *Title Music* · Camp: *Memories of that Day*
  - Overworld: each area's FF9 theme — Alexandria *Queen of the Abyss*, Evil Forest, Ice Cavern, Dali Village, Lindblum, Festival of the Hunt *Hunter's Chance*, Qu's Marsh, Gizamaluke's Grotto *Freya's Theme*; *Crossing those Hills* (the world map theme) elsewhere
  - Battles: *Battle Theme*; bosses and fortress semi-bosses: *Boss Battle Theme*
  - Winning a fight: *Victory Fanfare*, carrying on through the rewards; losing: *Game Over*; a finished run plays the fanfare or Game Over.
- **Seamless loops at FF9's own loop points** (read from each track's AKB header) and crossfades between tracks (Web Audio). Music starts on your first click or key press (browsers block sound until then).
- **Settings**: Music and Sound effects volume sliders (0 = off), saved to your account (`user_settings.musicVolume` / `sfxVolume`, migration `audio_settings`).
- `pnpm -F web audio:music` (`scripts/build-music.ts`) copies just the used tracks to `public/music/` with their loop points (`music.gen.ts`).

### Notes
- `public/music/` (39 MB) is git-ignored and built from the local FF9 install; it moves to the asset CDN with the rest of the assets.
- Restart `pnpm dev` (the database schema changed).

## [0.1.69] - 2026-10-16

Damage, KOs and deaths wait for the spell to actually hit.

### Fixed
- **Monsters faded out and died before the effect reached them** (and heroes dropped to their KO/kneel pose early): the battlefield read the engine's state, which already has the result when the action starts. A unit that an effect is still flying at now keeps standing until the hit lands; then it fades, falls or kneels.
- **Damage numbers appeared before the hit's real impact**: the impact was timed to FFRK's hand-off frame, which comes before the burst peaks (Fire hands off at frame 5 of 80). Numbers, Miss/Guard, status pops and the hurt pose now appear at the later of that frame and a third of the way into the hit — when the flames/sparkles are at their height.

## [0.1.68] - 2026-10-16

Spells and abilities play FFRK's effects in battle: Vivi's Fire bursts on the target, Curaga sparkles, and the damage numbers wait for the hit.

### Added
- **Effects in battle.** When a move has an FFRK effect, it plays the way FFRK's client chains them: the **launch** on the caster (e.g. the black-magic circle), then the **shot** flying from caster to target (when there is one), then the **hit** on every target — each phase starting at the previous one's hand-off frame. **Damage/heal numbers, Miss/Guard, status pops, KOs and the hurt pose wait for the impact** instead of appearing as the move starts. Effects play faster at ×2/×4 and are drawn at the heroes' pixel scale (FFRK's own size ratio). Every effect a fight can use (party commands, monster AI moves, the FF9 scene's attack table) is preloaded when the battle opens; a move whose effect isn't loaded yet just shows its result as before.
- **First pass of assignments** (`pnpm -F web effects:seed`, `scripts/seed-ability-effects.ts`): **158 FF9 moves** — party abilities and monster attacks — whose names are FFRK ability names get that ability's recipe: Fire/Fira/Firaga, Blizzara/Blizzaga, Thundara/Thundaga, Curaga, Protect, Shell, Haste, Berserk, Holy, Phoenix, Jump, Power/Magic Break, Earth Shake, and monster moves like Pollen, Megavolt/Electrocute, Armor Break, Rush. It never overwrites an assignment made in the effects gallery. Plain "Attack" is left for the weapon-hit effects.

### Changed
- game-core `actionStart` events carry the `actionId`/`itemId` (presentation only; replays and rules are unchanged).

## [0.1.67] - 2026-10-16

The effects gallery plays FFRK's named abilities with the exact files the game used — and Fire actually shows.

### Fixed
- **Effects showed nothing** (e.g. Fire, 11000): particle emitters treated FFRK's emission `time`/`startframe` as seconds — they're frames at 60 fps — and the gallery reused effects loaded into an earlier (discarded) Phaser game, whose textures were gone. Effects are now cached per game.
- Selecting an effect crashed the gallery ("Cannot read properties of undefined (reading 'map')") after the download index changed format.

### Changed
- **Effects are addressed by their real file paths.** FFRK names effect files many ways (`<n>_hit.json`, `hit.json`, `hit_1.json`, `launch.json`, `shot.json`, `common/launch_black.json`…), and magicite effects live in other folders, so:
  - `ffrk:effect-names` now writes `effects/catalog.json`: each FFRK effect's names **and the exact launch/shot/hit files** the game played, from captured game data (327 named, 122 with full recipes — e.g. Fire = black-magic launch → no shot → `11000_hit`; Holy = its launch + four hit layers).
  - `ffrk:effects` downloads every catalog file, then probes each folder for all the known file names (not just `<n>_hit.json`), remembers misses (`.missing`) so re-runs are fast, and indexes by folder.
  - **Gallery**: an "FFRK abilities" list (named, with their phases) and a "Folders" list (everything downloaded). Phase buttons show every file (launch, shot, hit, hit_1…). Assign a named ability's **whole recipe** to an FF9 move in one click, or the shown file as a move's launch/shot/hit.
- `.docs/ffrk-assets.md` §6: how FFRK maps abilities to effects (the client gets each ability's effect files from the server per battle — no static table exists), the catalog, file naming, id families, shot/hit type constants, formats.

## [0.1.66] - 2026-10-16

FFRK's own names for its effects, from captured game data, shown in the effects gallery.

### Added
- `pnpm -F web ffrk:effect-names` (`scripts/name-ffrk-effects.ts`): FFRK links an ability to its effect only in live battle data (`ability_animation_id`), and no public table exists. This collects every name → effect pair from the captured game payloads in RK² (rk-squared) test data, markcerqueira/ff-record-keeper and ffrk-proxy (cloned into `.refs/`): **327 effects named** — e.g. Fire 11000 / Fira 11001 / Firaga 11002, Blizzara 12001, Thundara 13001, Curaga 20007, Protect 20509, Shell 20517, Berserk 20514, Jump 10003, Power/Magic Break, Pollen 50346, Bite 50220, Phoenix 60015, and ~250 soul breaks.
- The effects gallery shows those names in the list and the preview title, searches by them, and can list only named effects.

### Changed
- `ffrk:effects` writes its index as it goes (every 5,000 ids), so the gallery can browse a download in progress.

### Notes
- The effect ids are grouped by family (10xxx physical/support skills, 11–13xxx fire/ice/lightning magic, 20xxx white magic and items, 30–31xxx weapon hits and spellblades, 50xxx enemy attacks, 60–61xxx summons/magicite, 70xxx+ soul breaks), so unnamed neighbours (e.g. Blizzard ≈ 12000, Thunder ≈ 13000) can be confirmed by eye in the gallery.

## [0.1.65] - 2026-10-15

FFRK's spell and ability effects: downloaded, playable, and browsable in a new effects gallery.

### Added
- `pnpm -F web ffrk:effects [from] [to]` (`scripts/fetch-ffrk-effects.ts`) downloads FFRK's ability effects from the game's server — every `ab/ability/<id>/<id>_{hit,launch,shot}.json` rig plus everything it uses: particle files, frame animations (`.sajson`), the shared effect art and its frame lists, and the sound effects (`lang/se/se_ogg/*.ogg`) — into `.docs/assets/FFRK-data/_raw/effects` with an `index.json` (id → phases, art, sounds).
- **FFRK effect player** (`features/effects/ffrk-effect.ts`): loads an effect and plays it in Phaser — the animated rig (images, additive glows, scrolling textures), FFRK's frame-by-frame sprite animations, and a particle system that follows FFRK's emitter settings (circle/line/box emitters, rate, lifetime, speed and direction, gravity/drag/radial/tangential acceleration, spin, size, scale/alpha/colour over life, random textures, additive blending). Speed control for ×2/×4 battles and frame callbacks (for timing damage numbers to the impact) are built in.
- **Effects gallery** (`/effects`, an orange "Effects" link in development): every downloaded effect in a searchable list (by id, by the art it uses — "fire", "cure", "slash" — or by the move it's assigned to), playing on loop on a target with its launch/shot/hit phases and ×¼–×2 speed. Pick an effect and assign it to any FF9 move (party abilities and enemy attacks); assignments save to `src/features/effects/ability-effects.json`.
- `rig evaluation` (`ffrk-anim.ts` `evalRig`) now also returns frame-animation and particle nodes, and plain images with animated UVs.

### Notes
- The dev server serves the downloaded library at `/ffrk-raw/` (dev only); restart `pnpm dev` to pick up the Vite change. Builds will ship only the effects that get assigned.
- Effects aren't in battles yet — next is mapping the spells and timing launch → hit with the damage numbers.

## [0.1.64] - 2026-10-15

Monsters have their real FFRK sprites — and the bosses move with FFRK's own animations.

### Added
- **Monster sprites from FF Record Keeper** for 127 monsters (FF9's bestiary and the Echoes crossovers), replacing the coloured blob placeholders:
  - **FF9's own FFRK art** where FFRK drew it — e.g. Bomb, Masked Man, Plant Spider, Sand Golem, Malboro, Black Mage types, Wraith, Grenade, Hecteyes.
  - **Bosses are animated with FFRK's own rigs**: Plant Brain, Black Waltz 1–3, Sealion, Gizamaluke, Zaghnol, Prison Cage, Beatrix, Antlion, Ralvurahva, Lani, Soulcage, Hilgigars, Taharka, Meltigemini, the Chaos guardians, Hades, Ozma, Deathguise, Kraken, Tiamat, Lich, Maliris and more — idle loop, attack lunge, the damage flash, and the death fade, all from FFRK's animation files.
  - **Stand-ins from other Final Fantasy games** where FFRK never drew an FF9 monster (labelled in `enemy-sprite-map.ts`): Cave Imp → Imp (FFII), Mu → Wild Rat (FFVI), Serpion → Scorpion (FFI), Gigan Toad → Poison Toad (FFII), Lizard Man → Twin Lizard (FFV), Ladybug, Clipper, Mandragora, Goblin Mage, Torama → Coeurl… Garnet, Blank and Kuja use their FFRK party sprites when fought.
- In battle, FFRK monsters face the party, are drawn at the heroes' pixel scale (FFRK's size ratios; one step smaller in crowds of 4+), flash white when hit (their own white frame), play their attack/damage animations, freeze under Stop/Petrify/Sleep/Freeze, and play their death animation.
- **FFRK animation player** (`features/sprites/ffrk-anim.ts`): evaluates FFRK's AnimationBuilder rigs (node tree, linear + Bézier keyframes for position/rotation/scale/alpha/colour). Its conventions were pinned down by pixel-comparing renders with FFRK's own composited boss stills. The same format drives FFRK's spell effects, which come next.
- `pnpm -F web sprites:enemies` builds the sheets (`public/sprites/enemies/`, `enemy-sprites.gen.ts`) from the monster → sprite map; `pnpm -F web ffrk:names` names FFRK's numbered enemy sheets by matching them pixel-for-pixel with the Final Fantasy Wiki's FFRK images (749 of 1,292 named).
- `.docs/ffrk-assets.md`: how the FFRK server assets were found, every URL pattern, the id scheme, the atlas and animation formats, where names come from, the spell-effect paths (`lang/ab/ability/<id>/…`, `lang/ab/effect_image/…` — confirmed live), and the tools.

### Notes
- Still placeholders (no FFRK art and no good stand-in yet): Baku, Zorn & Thorn, King Leo, Zenero/Benero, Axe Beak, Trick Sparrow, Zuu, Griffin, Drakan, Grimlock, Jabberwock, Gimme Cat, Necron and a few others.
- Ark and Deathguise show both of their forms at once in idle (their rigs hold alternate forms) — to fix.

## [0.1.63] - 2026-10-15

The run dock moves to the bottom centre.

### Changed
- The Items / Gear / Run tabs sit in a row at the bottom centre of the map instead of floating on the right edge; their panels still slide out on the right, stopping above the tabs.
- The map's stage description (on hover) and the controls hint moved up so they never sit under the tabs; stage screens keep clear space at the bottom for them.

## [0.1.62] - 2026-10-15

Party cards in the run sidebar stop growing.

### Fixed
- **Party cards stretched to fill the whole sidebar** with only one or two members. Each card now grows to at most 13rem tall: a full party still shares the height, a small party stacks at the top.

## [0.1.61] - 2026-10-15

Gear tooltips on the paperdoll no longer get cut off.

### Fixed
- **Paperdoll slot tooltips clipped at the column edge** (they were drawn inside the scrolling column). They now render at page level (`HoverTip`, `components/hover-tip.tsx`): below the slot, or above it when there's no room, and always kept inside the window.

## [0.1.60] - 2026-10-15

Start level reads like the other training rows, and gear slots unlock right on the paperdoll.

### Changed
- **Start level is a training row** at the top of Training: the same rank boxes, "ranks/20", the value ("Lv 6") and a "+ n CP" button. It's now capped at **Lv 21** (20 ranks, level n costing n CP — 210 CP in all, like a stat), down from 99.
- **Gear slots unlock from the paperdoll**: hover a locked slot and it turns into "Unlock · n CP"; click to unlock (dimmed with the cost in red if you can't afford it). The separate Start level and Gear slots panels are gone.

## [0.1.59] - 2026-10-15

All Completion Point spending lives on one tab.

### Changed
- The camp character sheet's first tab is **Training**: Start level and Gear slots side by side, then the stat training rows, then the combat numbers — everything you spend CP on in one place. The Progress tab became **Record** (runs, wins and bosses with that character).

## [0.1.58] - 2026-10-15

Training: spend Completion Points to raise a character's base stats for every run.

### Added
- **Training** (camp character sheet → Stats): one row per stat — Strength, Magic, Spirit, Speed, HP, MP — with 20 rank boxes, "ranks/20", the stat's resulting value and a **+ n CP** button. Rank n costs n CP (a full stat is 210 CP). Each rank adds +1 Strength/Magic/Spirit (Strength and Magic also raise HP and MP, as in FF9), +1 Speed every two ranks, or +2% HP/MP. Tuning lives in `TRAIN_EFFECT` (game-core `stats.ts`). The in-run sheet shows the ranks read-only.
- game-core `trainStat` / `trainRank` / `trainCost`; API `profile.trainStat`; DB `player_character.training` (migration `character_training`).
- **Starting gear upgrades** (camp → Equipment): a preview of the planned upgrade path — each open slot's starter item, then locked steps ("coming soon").

### Changed
- The long Strength/Magic/Spirit/Speed bars are gone; the Stats tab shows Training plus the combat numbers at camp, and HP/MP/EXP bars plus Training in a run.

## [0.1.57] - 2026-10-15

The paperdoll has room to breathe.

### Fixed
- **The head slot and its label overlapped the sprite**: the figure's middle rows were barely as tall as the sprite. They're taller now, with more space between rows.
- **The right slot pressed against the column edge**: the doll was wider than its column. The left column is wider (25rem), and the doll fits inside it with even padding on both sides.

## [0.1.56] - 2026-10-15

The equipment list is back under the paperdoll.

### Changed
- The left column of the character sheet shows the paperdoll **and** the equipped list under it (icon, name, stats, abilities taught, notes), as before v0.1.55. Clicking a slot or a row opens the **Equipment** tab, which now holds just the gear choices for that slot (with stat comparisons) in a run, or a note at camp.

## [0.1.55] - 2026-10-15

The character sheet is a proper window: fixed header, paperdoll on the left, tabs on the right, and only the body scrolls.

### Changed
- **Character sheet layout** (camp and in-run, one shared window): the header (name, level, CP, close) stays put; the paperdoll figure fills the left column; the right side has tabs, and each side scrolls on its own. The window is wider (95% of the screen, up to 1400 px) and 90% tall.
- **Tabs**: **Stats** (HP/MP as bars — current/max in a run — an EXP bar, Strength/Magic/Spirit/Speed as bars against FF9's caps, Attack/Defence/Evade/M.Defence/M.Evade/Stones as cells, lasting statuses), **Equipment** (the equipped list; clicking a slot on the doll opens this tab with that slot's gear choices and their stat comparisons), **Abilities**, **Support** (stone meter), and **Progress** at camp (start level, gear slots, record) or **Items** in a run (field items on this character).
- The doll shows Blind's glasses when the character is blinded.

## [0.1.54] - 2026-10-15

Dev tools for balance testing: put any character on (or off) your roster, and grant Completion Points and gil.

### Added
- **Dev tools page** (`/dev`, an orange "Dev" link in the header in development builds): every character with **Unlock / Relock** (Zidane always stays) and **+10 CP**; **+10/50/100 CP** for the whole roster; **+1,000/10,000/100,000** banked gil. Roster changes apply to the next run you start.
- API `dev` router (`setUnlocked`, `grantPoints`, `grantGil`, `enabled`) — refused whenever the server runs with `NODE_ENV=production`.

### Notes
- For testing two-member starts (e.g. Zidane + Vivi) before deciding whether Vivi should join from the beginning.

## [0.1.53] - 2026-10-15

Status effects show on the party's sprites the way FFRK draws them: Blind puts the glasses on.

### Added
- **Blind** — every pose switches to FFRK's "glass" set (the shades), in battle and on the run sidebar's portraits (Blind lasts between battles).
- **Mini** — the party member shrinks to FFRK's tiny sprite set (idle, ready, walk, attack, hurt, kneel, KO); no weapon is drawn on the tiny sprite.
- **Sleep** and **Petrify** use FFRK's own asleep and stone-statue poses instead of freezing the current frame (Petrify no longer just tints grey for heroes with the pose).
- The slicer packs these sets into each hero strip (`variants` per animation + single `poses` in `hero-sheets.gen.ts`); `heroAnimKey(sprite, anim, variant)` and `HeroSprite`'s `variant` prop pick them.

## [0.1.52] - 2026-10-15

The party stands in a tidy column again on a full-screen battlefield.

### Fixed
- **The party formed a steep diagonal** once the battlefield filled the screen (their positions were stretched with the canvas). They now stand in an FF-style column on the right, spaced by sprite size with just a slight step right per member, kept above the menus.
- **Change Row** now visibly moves the character back (or forward) during the fight.

## [0.1.51] - 2026-10-15

Battles fill the screen like the overworld does.

### Changed
- **The battlefield uses all the space it's given** instead of a letterboxed 16:9 box capped at 1200 px. The canvas resizes with the window (Phaser RESIZE); unit positions are kept as proportions of the original 960×540 layout and recomputed for the real size, heroes scale by whole numbers (2×–5×, from the height) so the pixel art stays crisp, and monsters, ATB gauges, damage popups and the step-forward on actions scale with it. The background redraws at full size.
- Run battles fill the screen below the header; the practice battle fills the page under its controls. "Loading/Verifying battle…" floats over the field instead of pushing it down.

## [0.1.50] - 2026-10-15

Hides the TanStack Router and React Query devtools buttons from the corners of the screen.

### Changed
- Removed the TanStack Router (bottom-left) and React Query (bottom-right) devtools overlays from the app root. The packages stay installed; re-add the two components in `routes/__root.tsx` to debug with them.

## [0.1.49] - 2026-10-15

Walking onto a stage no longer enters it: you stop there and choose.

### Changed
- **Stages wait for you.** Walking onto a stage (WASD/arrows) leaves the party standing on it with an "Enter ⏎" prompt; **Enter or Space** (or clicking that stage) goes in. Until then you can walk back the way you came. Clicking a different reachable stage still walks there and goes straight in — a click is already a choice.
- Navigation tests re-run with the new step (400 maps, 7,384 stages, 2,840 forks): every unentered stage can be walked back from, and confirming enters exactly that stage.

## [0.1.48] - 2026-10-15

Walk the overworld like Super Mario World: WASD/arrows move the party along the roads, stopping at forks.

### Added
- **Free walking**: press a direction at your stage and the party walks the road that leaves that way — taking corners on its own — until it reaches the next stage or a fork. At a fork it stops and bouncing arrows show the branches; press one to go on (holding a direction that's one of the branches rolls straight through). Before you arrive you can turn around and walk back to the stage you left; arriving at a stage is what commits the move (that's when the stage opens), and there's no road back to earlier stages.
- Clicking a glowing stage still walks there on its own, taking the right branches.
- **Road graph** (`map/layout.ts` `branchesFrom`): roads leaving a stage that share tiles are merged, so forks sit exactly where they split. **Navigation** (`map/navigation.ts`) is a pure state machine (walk, forks, reversing, auto-walk) — checked on 400 generated maps (7,384 stages, 2,840 forks): every key path reaches only the stage's next stages and all of them are reachable, reversing always returns home.
- Smooth constant-speed walking (no stutter at corners), facing the way it's going, camera following. Held keys are polled, the arrows don't scroll the page, and typing in inputs is left alone. If a move never lands (server error), the party returns to its stage after 6 s.

### Changed
- The choose-then-Enter keyboard control is replaced by free walking.

## [0.1.47] - 2026-10-15

The overworld is a Super Mario World–style map: stages on a tile grid joined by roads that run up, down, left and right with L-turns, and a zoomed-in camera following the party.

### Added
- **Map layout & routing** (`features/run/map/layout.ts`, pure TypeScript): every stage gets a tile position (left→right by column, with a little deterministic wobble for SMW-style jogs), and every connection is routed as an orthogonal road — straight runs, Z and L shapes, a "staircase" for roads that swap rows. Candidates are scored (never through another stage, avoid running alongside unrelated roads, prefer shared stretches where roads branch from or merge into the same stage) and the best combination is searched per map (~3 ms). Checked on 500 generated maps: no road through a stage, no unrelated roads overlapping. The map data in saved runs is unchanged — this is presentation only, so procedural terrain can be built around it later.
- **New map rendering**: beaded roads (open roads from your stage shimmer, walked roads darken), level dots for battles/events/treasure, little houses for shops, synthesis, Stiltzkin, Chocobo and Moogles, a fortress and a castle for the bosses; cleared stages fade, reachable ones pulse.
- **Camera** zoomed in (about 4–5 columns across), following the party; the map fills the middle of the run screen and resizes with the window.
- The party walks the routed road corner by corner (walk animation, facing the way it's going); the stage opens when the walk actually ends.

### Notes
- Keyboard: ←↑↓→/WASD choose among the next stages, Enter/Space goes. Free SMW-style walking (stop at forks, walk back before committing) is next.

## [0.1.46] - 2026-10-15

The run screen is laid out like a proper game HUD: party on the left, the map filling the middle, slide-out panels on the right.

### Changed
- **Run screen layout.** Full height, three parts:
  - **Party sidebar (left)**: area, journey progress and gil on top, then the four party members filling the height — animated portrait (kneels at Low HP, down when KO'd), Lv, HP/MP/EXP bars, Atk/Def/Mag/Spd, lasting statuses, equipped gear icons, and quick actions: **Manage** and one-click field items (Potion, Ether, Phoenix Down…) on that member. "Optimize gear" at the bottom.
  - **Main area**: the map (or the current stage's screen — shop, rewards, Moogle…) fills the rest.
  - **Dock (right edge)**: Items (use a field item on anyone), Gear (everything the party carries — who wears it, found vs safe) and Run (journey route, stats, Abandon run) slide out over the map.
- **The in-run character sheet** matches the camp one: paperdoll and gear picker (with stat comparisons) on the left; stats, field items, support abilities (stone meter) and abilities in panels on the right.

## [0.1.45] - 2026-10-15

Gear shows what it would actually do to your characters, everywhere you see it.

### Added
- **Stat comparisons on gear.** `gearChange(build, itemId)` (game-core) works out what equipping an item would change for a character against what they wear in that slot now — from their full derived stats (level, growth, support abilities…), not just the item's own numbers: HP, MP, Str, Mag, Spr, Spd, Atk, Def, Eva, MDef, MEva and magic stones, plus abilities it would make usable or take away. Only for characters who can wear it; a locked slot is flagged.
- Shown as green/red chips ("+1 Def", "−2 Eva", "+ Mug", struck-through abilities lost):
  - **Item cards** — loot choices, treasure, shops, synthesis and Stiltzkin compare against each party member who can use the item; the camp gear catalog and the Items page (signed in) compare against your roster as they start a run (`rosterAtStart`).
  - **The in-run gear picker** compares each option against the character you're equipping.

## [0.1.44] - 2026-10-15

A Settings page saved to your account — menu font, battle speed, auto battle — and the Wait/Active battle mode finally applies in runs.

### Added
- **Settings page** (`/settings`, ⚙ in the header): menu font (four sets, each with a live sample), battle mode (Wait/Active), battle speed (×1/×2/×4, what battles start at) and auto battle (start fights with Auto on).
- **`user_settings` table** (migration `user_settings`): one row per user — `menuFont`, `battleSpeed`, `autoBattle` — created on first save; a missing row means defaults. API: `settings.get`, `settings.update` (any subset).
- The menu font follows your account across browsers: it's applied before first paint from the browser's cached choice, then synced from the account when settings load.

### Fixed
- **Wait/Active did nothing in runs** (every run battle was Wait). A run now records the player's battle mode when it starts, every battle it creates uses it (the server's replay check uses the same mode), and switching it in Settings mid-run applies from the next battle.

### Changed
- The header's font dropdown (v0.1.43) moved into Settings.

## [0.1.43] - 2026-10-15

The camp's Manage screen is one readable panel, the paperdoll is laid out WoW-style, and the menu font is your choice.

### Changed
- **Manage character is one screen, no tabs.** Left: the paperdoll and equipment list. Right, in a grid of panels: Stats (every stat in its own cell), Start level (with the CP rules), Gear slots (unlock buttons), Support abilities (toggle cards with gem cost and AP progress, a magic-stone meter in the header) and Abilities (cards with AP bars / ★ Learned).
- **Paperdoll, WoW-style**: the slots sit around the figure — head above it, body and arm on its left, weapon on its right, accessory at its feet — as icon tiles (hover for stats), with a readable list of what's equipped underneath (icon, name, stats, notes). The in-run character sheet uses it too, and its stats are the same cell grid (current/max HP and MP, EXP).

### Added
- **Menu font picker** (header dropdown, saved per browser): **Rounded** (Nunito text, pixel headings — the new default, much easier to read), **Classic pixel** (the old Pixelify Sans everywhere), **Retro JRPG** (DotGothic16), **Storybook** (Alegreya Sans with Cinzel headings). Fonts are CSS variables (`--ff-font`, `--ff-display`), and `.ff-display` marks headings.

## [0.1.42] - 2026-10-15

Garnet's rackets look like rackets, and the staves have the right icons.

### Fixed
- **Staves were off by one column** on the icon sheet — Flame Staff showed the ice staff, and so on. Vivi: Flame Staff → flame staff, Ice Staff → ice staff, Lightning Staff → gold-sparkle wand, Oak Staff → leafy staff, Cypress Pile → grey leafy staff, Octagon Rod → dark blue-orb staff, High Mage Staff → red-orb staff, Mace of Zeus → purple staff. Garnet's Wizard Rod and Whale Whisker moved to their intended icons.
- **Rackets were a harp.** The pack has no racket, so the build now makes one from its hand mirror: the glass becomes a string mesh and the frame is recoloured per racket — Priest's gold, Air green, Multina silver, Magic purple, Mythril blue, Tiger orange (`{ racket: hue }` entries in `item-icon-map.ts`).

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
