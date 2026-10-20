# Changelog

All notable changes to ffix-roguelike are documented here.

## [0.3.66] - 2026-10-19

### Added
- **Two synergies:**
  - **Thieves** (Zidane, Amarant, Blank; dagger badge, teal). 2 members: thieves get Speed +10%. 3 members: thieves get Speed +15% and Evade +10%.
  - **Raised by Qu** (Vivi and Quina: Quan raised Vivi as one of the clan; cooking-pot badge, frog green). With both in the party: Magic +10% for each, and a killing blow restores 5% MP to the one who dealt it.
- **Seeded synergy tags reach existing characters.** On every seed (server start), each character gains the default tags it's missing, kept after the ones it has, like the achievement-badge and synergy-colour fills. Removing a default tag for good means exporting from the admin page, so the seed drops it too.

### Changed
- **Locked journey cards:** a big padlock (64 px) centred over the dimmed card. On hover the card blurs, the padlock rises, and why it's locked ("Clear … to unlock") slides up and fades in beneath it.
- **Journey cards drop the "Cleared" chip.** The footer's "Highest tier cleared" and the recruit's check still show it.
- **Character card synergy chips stay on one line.** As many as fit show, then a **+N** chip whose popover lists all of that character's synergies (tiers, the one reached, who carries the tag). The row is measured against the footer's width and re-measured on resize.
- **Sidebar:** Relics sits above Achievements.

### Notes
- The dev database's synergies table was reloaded from the seed files (the Thieves badge).
- The plan for the rest of FF9's story is in `.plans/journeys-full-story.md`.

## [0.3.65] - 2026-10-19

The shop sells targeted wares, relics get an admin page and 42 more of them, and the map's synthesis badge and chocobo change.

### Added
- **Shop wares** (`.plans/shop-wares.md`). The shop node is now a counter with two parts:
  - **Six wares:** reward cards for sale, each for one party member and saying exactly what it does (stat changes, "Teaches…", "Stops learning…").
    - Buying one applies it at once, like taking a reward: gear is equipped on that member and bound to them (their old piece goes to the bag); boons and AP surges land immediately.
    - Each ware sells once, and you can buy as many as your gil allows.
    - A relic can be among them; with a full rack it asks which relic to give up.
  - **Supplies:** the area's consumables, unlimited, at FF9 prices. The long list of FF9 shop gear is gone.
  - Selling is unchanged.
  - **Prices:** gear costs its FF9 price × a markup by rarity (×1.0 common to ×1.5 legendary). Boons, AP surges and relics cost a per-rarity shop price (150 / 300 / 600 / 1,200 / 2,500) × (tier + 1).
  - Wares are rolled from a new **`shop` reward source** (6 cards, mostly gear, then boons and AP; no supplies or gil cards; at least one gear upgrade).
  - Game-core `buyWare`, `warePrice`, `ShopWares`; API `run.buyWare`. Shops entered before this keep their old list until left.
- **Relic chance per reward source** (Admin → Sources, 0–100, 0 = never). It replaces the fixed boss 100% / fortress 50%, which stay the defaults; the shop starts at 15%.
- **Shop prices per rarity** (Admin → Rarities): "Shop: gear × FF9 price" and "Shop: other cards (× tier)".
- **Admin → Relics** (relics plan phase 5):
  - every relic with search and filters (starter, cursed, disabled);
  - an editor for name, rarity, description, flavour, collection number, minimum tier, offer weight, enabled / starter / cursed, the unlocking achievement (or free), and the badge;
  - an **effects editor:** stat ±%, start-of-battle status, Trance head start, steal %, MP discount, or HP / MP on a kill, each for the party, a synergy tag or one character, with a plain-English line under each;
  - New relic and Delete.
  - The server checks the achievement, tags and characters exist.
- **Admin → Synergies:** edit each synergy (name, tag, colour, badge, tiers and their effects), add new ones, and set each character's synergy tags.
- **Practice → Relics:** toggle any relic into the practice fight (with the party's synergies, as in a run); the fight restarts with it.
- **42 new relics** (`.plans/relics-content.md` part A), each with a badge and flavour line:
  - **Story and bosses:** Plant Brain Spore, Frozen Bell, Mist Lantern, Lindblum Crest, Gizamaluke's Bell, Garland's Visor, Golbez's Gauntlet, Kefka's Plume.
  - **Superbosses:** Soulcage Root, Deathguise Scythe, Hades' Hammer, Ozma Shard, Necron's Eye, Memoria Fragment.
  - **One per solo challenge,** for that character only.
  - **One per synergy.**
  - **Milestone and tier relics.**
  - **Four new starters:** Prima Vista Ticket, Fang Necklace, Old Map, Mist Charm.
  - **Cursed:** Kefka's Plume, Necron's Eye, Berserker's Mask, Glass Heart, Phantom Veil, Heavy Gauntlets.
- **13 new achievements** that unlock them, all metric thresholds: Seasoned Traveller, Explorer, Wanderer, Professional, Better Luck Next Time, Inner Power, Field Medic, Spellslinger, Heavyweight, Glass Cannon, Ten Thousand, Untouchable, Again and Again. Each has a badge.
- **Sprite build: `crop` sources** (`enemy-sprite-map.ts`). Frames are cut from a local rip in a row, the flat background colour is keyed out, they can be mirrored, and they play as a looping idle. Rips with bytes after the PNG's end are read up to IEND.

### Changed
- **The Chocobo stage's chocobo** is the Chocobo Land (GBA) chocobo: its 10-frame side walk, about 20 px. It was the Fat Chocobo rig. The `enemies` pack is rebuilt and uploaded to R2.
- **Stage characters animate only when reachable:** the Moogle, Stiltzkin and Chocobo figures play their idle animation (and bob) only on stages the party can go to next.
- **Synthesis stages' badge:** iron anvil (853).
- The admin page's shared form pieces moved to `admin/admin-fields.tsx`; the new tabs are in `admin/relics-admin.tsx`.
- Tests: 5 for the shop wares (shelf and wares, prices, buying, sold-out, gil, relic chance per source). Game-core: 340 pass, 0 fail.

### Notes
- Restart `pnpm dev` so the server reloads the reward tables (the new relics, achievements and `shop` source are already in the dev database).

## [0.3.64] - 2026-10-19

### Changed
- **Synthesis stages' badge** is now "anvil and hammer" (499), replacing the plain iron anvil (442).

## [0.3.63] - 2026-10-19

### Changed
- **The stage characters stand a smidge lower:** their feet rest 3 px below the dot's centre (`FIGURE_FEET`). v0.3.62 put them at the centre, which read as too high; the bottom edge, before that, was too low.

## [0.3.62] - 2026-10-19

### Changed
- **The Moogle, Stiltzkin and Chocobo characters stand on their marker by their feet.** The bottom of what each actually draws now rests at the dot's centre, so they sit higher instead of hanging down to its bottom edge.
- **The Moogle and Stiltzkin are a little smaller:** 0.85× their sheets (about 20 px tall, was 23).

## [0.3.61] - 2026-10-19

### Changed
- **The Moogle and Stiltzkin characters are bigger:** drawn at their sheets' own size (about 16×23 px, `FIGURE_SCALE`) instead of shrunk to 16 px, so they're also pixel-crisp. The Chocobo stays scaled down to 16 px, since its sheet is far larger.

## [0.3.60] - 2026-10-19

### Changed
- **Only the stages you can walk to next bob.** These are the ones with the pulsing ring. Every other stage's badge or character holds still until the party gets there.

## [0.3.59] - 2026-10-19

### Changed
- **The Moogle, Stiltzkin and Chocobo characters float right on their marker** like the badges. Each is centred on the dot by what it actually draws, its longer side 16 px (`FIGURE_SIZE`), in front of the dot. It idles and bobs out of step with the others, and holds still once its stage is done or cut off.
- **They face left now** (flipped; the FFRK sheets face right).
- The two-monster stacking from the old battle-stage previews is gone; a stage has at most one character (`placeFigure`).

## [0.3.58] - 2026-10-19

### Changed
- **Stage badges float right on their marker** instead of standing above it. Each is centred on the dot (by what the badge actually draws), raised 3 px (`BADGE_LIFT`) and in front of it, and bobs gently. The bobs are out of step with each other; done and cut-off stages hold still. The coloured dot shows around it as its base.
- **Shop stages show the money-bag badge again** (989), so battle, elite, shop, synthesis and treasure all try the floating look together. The start signpost, the Moogle / Stiltzkin / Chocobo characters, and the event, fortress and boss pictures are unchanged.

## [0.3.57] - 2026-10-19

### Changed
- **Shop stages show a building again,** drawn from the overworld tileset like the boss castle, instead of the money-bag badge (the badges are front-on icons and looked out of place on the top-down map). It's two orange shopfronts side by side, one with a chimney: a small market street 2 tiles wide, centred over the marker and fading like the castle once visited or cut off (`STAGE_SPRITES.shop`).
- Battle, elite, synthesis and treasure keep their badges for now, until top-down art for them is chosen.

## [0.3.56] - 2026-10-19

### Changed
- **Bigger stage markers:** 16×14 px (was 12×10), and 20×16 px for the fortress and boss (was 16×12). They're still pixel-drawn and centred on their tile. The label below, the badge or figure above, and the pulsing ring all follow the new size.

## [0.3.55] - 2026-10-19

### Fixed
- **Stage badges were blown up** by v0.3.54. It scaled each badge to 24 px tall on the assumption that they draw bigger than that. Measured, they draw only 15–20 px at 1× (#997 20×20, #989 17×20, #442 18×10, #210 15×14), so they grew 1.2–2.4×, and the flat anvil the most. Now each badge's longer side is 14 px (`BADGE_SIZE`): between ½ (too small) and 1× (too big), and the same for every badge.

## [0.3.54] - 2026-10-19

### Changed
- **Stage badges are one standard size: 24 px tall** (a tile and a half, `BADGE_HEIGHT`). Each is scaled by what it actually draws, so every stage's badge stands the same height. At their own size (v0.3.52) they were 32–40 px, far too big beside the 12 px markers.

## [0.3.53] - 2026-10-19

### Changed
- **Battle stages' badge** is now "Crossed swords over shield" (997), replacing plain crossed swords (334).

## [0.3.52] - 2026-10-19

### Changed
- **Stage badges are twice the size**, drawn at their own size instead of ½.
- **Badges and figures stand clear of their marker.** Their bottom now sits 3 px above the marker's top edge (`FIGURE_GAP`); before, it sat 3 px above the marker's centre, so they touched the dot or tucked behind it. The Moogle, Stiltzkin and Chocobo characters get the same lift.

## [0.3.51] - 2026-10-19

### Changed
- **Battle, elite, shop, synthesis and treasure stages show a badge** from the achievement badge set over their marker. They were picked from the badge catalog (`scripts/badge-catalog.json`), all plain, unframed ones so they match:

  | Stage | Badge |
  |---|---|
  | Battle | crossed swords (334) |
  | Elite | horned demon head (254) |
  | Shop | Dollar money bag (989) |
  | Synthesis | iron anvil (442) |
  | Treasure | treasure chest (210) |

  - They're drawn at ½, which is native pixels at the map's 2× zoom, and stand on the marker by what each badge actually draws.
  - `STAGE_BADGES` in `map-scene.ts` holds the badge numbers.
  - The badge atlas is the `badges` boot pack that's already on R2.
  - Treasure stages had no picture before.

### Removed
- **The monster previews on battle and elite stages** (v0.3.48–0.3.49). They could show monsters that never turn up in that map's fights. game-core's `encounterPreview` is gone with them.
- Moogle, Stiltzkin and Chocobo stages keep their FFRK characters. The start, event, fortress and boss stages keep their pictures.

## [0.3.50] - 2026-10-19

### Added
- **Moogle, Stiltzkin and Chocobo stages show their own character** over the marker, at the same standard height as the battle stages' monsters, idling:
  - **Moogle:** Mog, from FFRK's party sheet 106005 (FF6).
  - **Stiltzkin:** Montblanc, from FFRK's party sheet 150013 (FFT), as a stand-in, since FFRK never drew Stiltzkin.
  - **Chocobo:** the Fat Chocobo, from FFRK boss rig 390001, animated. FFRK has no small chocobo sheet; the only small one is a single FFT still with no atlas, which the pipeline can't take yet.
- They go through the same pipeline as the monster sprites: `npc-moogle`, `npc-stiltzkin` and `npc-chocobo` entries in `scripts/enemy-sprite-map.ts`, built by `sprites:enemies` into `enemy-sprites.gen.ts` (only these three entries were added; the other sheets are unchanged).
- The `enemies` asset pack is rebuilt and uploaded to R2.
- The other stages (shop, synthesis, event, start, fortress, boss) keep their object-sheet pictures.

## [0.3.49] - 2026-10-19

### Changed
- **Battle stages' monsters stand like the Party card's heroes.** They're the same height whatever their sheet: each is scaled so its figure stands 20 px tall on the map. The figure is measured from the sprite's opaque pixels, since the frame padding varies a lot between sheets.
  - They stand side by side on one baseline, overlapping by a third, the first facing left and the second facing right.
  - A single monster stands centred.

### Fixed
- **Only some battle stages showed monsters.** A monster with no FFRK sheet yet (Axe Beak, Zuu, Trick Sparrow and a few others) can't be drawn, and a stage whose previewed group was all such monsters fell back to the tent. Those stages now show two monsters from the same map's pool that do have sheets (elites from the elite and battle pools), picked by the stage so they stay put.

## [0.3.48] - 2026-10-19

### Changed
- **New stage markers on the overworld.** Each stage is an SMW-style pixel dot drawn pixel by pixel, so it stays crisp at every zoom: a dark outline, a lighter top, a darker bottom and a soft shadow. Each dot is centred exactly on its tile, where the roads' beads meet.
  - It replaces the anti-aliased circle with a text glyph (⚔, ☠, $…), which sat off-centre.
  - Sizes are 12×10 px, and 16×12 px for the fortress and boss.
  - Colours are by kind, as before. The boss is now crimson instead of near-black.
  - The ring that pulses on stages you can walk to now takes the marker's shape.
- **Battle and elite stages show their monsters.** One or two FFRK monster sprites idle just above the marker, in place of the tent / tower picture.
  - They come from the likely group for that stage's depth on this map: game-core `encounterPreview`, the same depth window the real encounter is picked from. It's seeded by the run and stage, so a stage always shows the same monsters.
  - It's a preview: the actual fight is still rolled when you enter.
  - Monsters keep FFRK's size ratios: small ones at 1×, bigger sheets at ½ or ¼, so nothing towers over the map.
  - Other stages keep their object-sheet pictures for now.

## [0.3.47] - 2026-10-19

### Changed
- **Relics page tiles look like the Items page's.** Each relic is its own FF window tile: the badge, with its name under it and its number ("No. 001") in the corner. The tiles sit on the page instead of inside a window.
  - **Locked relics** show their badge as a black silhouette with a padlock, like locked items, instead of an empty "?" circle. Their name stays "???" until unlocked.
  - The tile under the cursor has a yellow ring, and tiles brighten on hover.
- The detail panel's large badge is a silhouette for locked relics too.

## [0.3.46] - 2026-10-19

### Changed
- **Battle numbers default to Jersey 10.** The default fonts are now Pixelify Sans for the title, Pixelify Sans for headings, Nunito for body text and Jersey 10 for battle numbers. The new default is set in `fonts.ts` `DEFAULT_FONTS`, the index.css fallback, the API's defaults, and the column's database default (migration `numbers_font_jersey`, generated by `db:migrate`).
  - A settings row saved before this keeps its pick; Settings → Fonts → Battle numbers changes it.

## [0.3.45] - 2026-10-19

### Added
- **Settings → Fonts → Battle numbers:** a fourth font pick, for battle's damage and healing numbers, Miss / Guard, and Doom's countdown. It can be any of the seven fonts, drawn at the font's regular weight. The default is Pixelify Sans, so nothing changes until you pick.
  - The font preview shows sample numbers (1,234, a heal, Miss) in the pick.
  - Saved to your account (`user_settings.numbersFont`, migration `numbers_font` generated by `db:migrate`). It applies through `--ff-numbers-font` / `--ff-numbers-weight`, which the battle scene reads (`numbersFont()`).
- The map's stage labels still follow Headings.

### Changed
- **The Fonts panel is at the bottom of Settings,** below everything else.

### Notes
- Restart `pnpm dev` (schema changed).

## [0.3.44] - 2026-10-19

### Changed
- **Settings → Fonts: pick a font for each level of text**, instead of preset font sets plus a pixel font (v0.3.43 made Silkscreen the default heading and title font everywhere, which didn't suit the sidebar wordmark or the title screen). Three rows:
  - **Title:** the wordmark in the sidebar and header bar, and the title screen.
  - **Headings:** page and window headings and names, plus the map's stage labels and battle's damage numbers / Doom countdown.
  - **Body text:** everything else in the menus.

  Each row can be any of **Pixelify Sans, Silkscreen, Jersey 10, DotGothic16, Nunito, Alegreya Sans or Cinzel**. Each button is drawn in its own font, and a preview below shows the three levels together.
- **Defaults are the look from before v0.3.43:** Pixelify Sans title and headings, Nunito body text.
- Each font brings its own weights (body / heading) and, as body text, FF9's hard drop shadow for pixel fonts or a soft one otherwise (`features/settings/fonts.ts` `FONTS`).
- **How it applies:** the picks set CSS variables on `<html>` (`--ff-title-font`, `--ff-display`, `--ff-font` and their weights, `--ff-shadow`). `index.html` sets them from the browser's cache before the first paint. The wordmarks and the title screen use the new `.ff-brand` class. Phaser text reads the heading font (`gameFontFamily()`).
- **Saved to your account:** `user_settings.titleFont` / `headingFont` / `bodyFont` (migration `font_levels`, generated by `db:migrate`). It replaces `menuFont` and v0.3.43's `pixelFont`, so earlier font choices reset to the defaults.

### Notes
- Restart `pnpm dev` (schema changed).

## [0.3.43] - 2026-10-19

### Added
- **Settings → Pixel font**: **Silkscreen** (the new default), **Jersey 10**, or **Pixelify Sans** (the old blocky one). It sets the pixel text of whichever menu font you use:
  - the headings in Rounded and Retro JRPG;
  - everything in Classic pixel;
  - the game screens' text: map stage labels, battle damage numbers and Doom's countdown, and the title screen.

  Storybook keeps its Cinzel headings. Each option shows a sample, and the menu font samples follow the pixel font you pick.
- **Saved to your account** (`user_settings.pixelFont`, migration `pixel_font` generated by `db:migrate`) and cached in the browser, so it applies before the first paint like the menu font.
- index.css: the pixel font is `--ff-pixel` (with its heading weight, `--ff-pixel-weight`), chosen by `data-pixel-font`. The font sets use it for their pixel text. Phaser text reads it through `pixelFontFamily()`.

### Notes
- Restart `pnpm dev` (schema changed). The migration is already applied to the dev database.

## [0.3.42] - 2026-10-19

### Added
- **The run's party collapses to mini mode.** A new icon button after Party / Bag (⇕) switches the party cards to a row of mini cells, and back. The header, relics and synergies above stay as they are.
  - **Each cell** shows the member's sprite (kneeling at Low HP, down when KO'd, shades when Blind), with a thin HP bar and a thin MP bar under it.
  - **Hover a cell (or put the cursor on it)** for that member's full card. Click it for their character sheet.
  - Optimize gear is hidden while collapsed.
  - The choice is remembered in this browser (`ffix-party-mini`).

### Removed
- **The party sidebar's Menu button.** It sent Start, which opens the hub's left sidebar. When the sidebar was already out, it only moved the keyboard cursor into it, so a click looked like it did nothing. The round menu button in the corner and Start / M still open the menu.

## [0.3.41] - 2026-10-19

### Removed
- **The dirt path under the overworld roads.** The routes are the SMW dotted beads on the ground again, as before v0.3.38. The terrain, water and scenery stay, and so does the open ground around the routes.
  - `buildTerrain` no longer returns a roads layer, and the map scene draws ground → water → scenery.
  - The road tiles are still built into terrain.png (`ROAD_PIECES` in the tile build), but nothing draws them. They come out of the build with the next tile-pack rebuild, or become a different road style if we want one.

## [0.3.40] - 2026-10-19

### Changed
- **The overworld map opens at 2× zoom** wherever it's shown. It used to pick 2–4× from the frame's width, so docking or floating the party sidebar jumped the zoom (3× floating, 2× docked). It only goes higher if 2× would leave the map short of filling the view.

### Added
- **Map zoom controls**, in whole steps from 1× to 4× so the pixel-art tiles stay crisp:
  - **mouse wheel**: one step per notch (a trackpad's small scrolls add up to a step);
  - **− / +** on the keyboard (also `=` and the numpad's − / +);
  - **LT / RT** on a controller.

  While the camera follows the party, zooming keeps the party in view. While looking around, the wheel zooms toward the pointer, and the keys and triggers zoom about the middle of the view. The map never zooms out past the point where it would stop filling the view.
  - **Your zoom is remembered on this device** (browser storage), like the sidebar's dock choice.
  - The map's hint line shows the zoom buttons; Settings → Controller lists LT = 6 / RT = 7.
- **Two new input actions,** `l2` / `r2` (FF9's L2 / R2), in the shared controls table (`input/actions.ts`). Only the map uses them so far; battles and menus ignore them.

### Fixed
- Two stale comments in the overworld code: the flat dirt tile is no longer under the map (it's unused since v0.3.39's path roads), and the tilemap's layer list now includes the roads.

## [0.3.39] - 2026-10-19

### Changed
- **Narrow roads.** The dirt roads were carved out of the ground autotile, whose edges ate into the neighbouring tiles, so each road read about two tiles wide. Now they're the tileset's own narrow path art (about half a tile wide, soft grass edging), as 16 connection tiles built from its path pieces (`ROAD_PIECES`):
  - a straight or corner per pair of connected sides, unioned (edging first, dirt over it, so forks and crossings join cleanly), or an end cap;
  - see-through outside the path, so they sit on any theme's ground.

  Each road tile connects exactly the sides its routes leave through (from the routes' tile paths). The road tiles are an extra row in terrain.png (`ROAD_BASE` + N/E/S/W bits); the ground is plain fill again.
- **Scenery away from the middle.** Forests and water fade in with distance from the nearest road: nothing within 2 tiles, full strength from 8. They gather toward the map's edges, leaving the route area open ground, so the map reads calmer.
- The `overworld` pack is rebuilt and uploaded to R2.

## [0.3.38] - 2026-10-19

The overworld map is a real tilemap, from the Super Retro World — Overworld tileset (16×16; credit Gif @gif_not_jif, Noiracide @Noiracide, Romi @DessRomaric; its licence asks for that credit and forbids redistributing the raw tiles, so they ship only inside the R2 pack).

### Added
- **Tile build** (`pnpm -F web tiles:overworld`, `scripts/build-overworld-tiles.ts`). The pack's RPG Maker MZ sheets are exact 3× upscales of its 16px art (checked), so they're scaled back to native 16px and baked into:
  - **terrain.png:** 31 autotiles (grass ×4, sand rocks, snow, ice, stone, lava, 16 forests and plants, 4 waters, flat dirt), each as its 47 RPG-Maker floor-autotile shapes;
  - **objects.png:** the object sheet (buildings, castles, forts, towers, tents, stalls).
  - Both are **extruded** (edge pixels repeated 1px; margin 1, spacing 2), the standard fix for tile bleeding and seams.
  - Output goes to `public/sprites/overworld/` (git-ignored) and the new **`overworld` asset pack** (boot, 0.2 MB gz), uploaded to R2.
- **Autotiles** (`map/autotile.ts`, pure TS, shared by the build and the game): RPG Maker's MV/MZ floor autotile rules. Each tile's four quarters come from its 2×3 source block by the neighbours on that corner. 47 shapes, baked once and indexed at runtime.
- **The overworld tilemap** (map scene): a Phaser `Tilemap` the layout's size with blank `TilemapLayer`s per depth, all from the extruded tilesets:
  - **base:** dirt;
  - **ground:** the theme's ground everywhere except the roads, so **roads are real dirt paths** with natural edges, every turn, fork and merge handled by the autotile;
  - **water** and **scenery** (forests, plants, ice, lava);
  - **stage objects.**

  The SMW beads still run along the roads.
- **Scenery** (`map/terrain.ts`): smooth seeded value noise over the free land (2 tiles clear of every stage, 1 of every road). Each area theme sets its ground, water and scenery and how much each covers, e.g. grassland grass + green forests + lakes, forest dense woods, ice snow + frozen pines, cave stone + dark pines + lava, marsh lots of water. The same map always gets the same scenery.
- **Stages are circle markers on the road with a picture just above them** (`STAGE_SPRITES`): signpost (start), tent (battle), stone tower (elite), shops and a stall, tent (chocobo), house (Moogle), flag (event), grey fort (fortress), red castle (boss). Done stages fade; cut-off ones fade more. Treasure has no picture yet.

### Changed
- **Whole-number camera zoom (2–4×) with rounded pixels,** so the pixel-art tiles stay crisp.
- The old drawn ground checker, castle, fortress and houses are gone. The plain ground remains as a fallback if the tileset can't load.

## [0.3.37] - 2026-10-19

### Changed
- **The overworld map is wider instead of the camera running off its edge.** v0.3.36 let the camera scroll past the map into plain background.
  - Now the map itself carries on 14 tiles past the castle (`MARGIN_END` in `map/layout.ts`; 5 before the start as before), so its ground, and the tileset scenery later, fills the space under the floating party sidebar.
  - 14 tiles is enough for the castle to scroll clear of the sidebar even at the lowest zoom (1.5×).
  - The camera stays within the map and still centres the party in the part of the view the sidebar doesn't cover.

## [0.3.36] - 2026-10-19

### Fixed
- **The boss castle no longer hides under the floating party sidebar.** The map camera was clamped to the map's right edge, so at the last stage the castle sat under the sidebar.
  - The map scene now knows how much of its right side the floating sidebar covers (`MapBridge.insetRight`; 17rem + margin, 0 when the party is docked).
  - The camera may scroll that far past the edge, and centres the party in the part of the view that shows, including when starting and when easing back after looking around.
  - It follows layout changes (docking / floating resizes the map, which refits the camera).

## [0.3.35] - 2026-10-19

### Fixed
- **Run sidebar relics: no ring.** Each held relic was wrapped in a rarity-coloured ring that stretched into a tall oval around the badge. The badge alone shows now (its popover still gives the rarity).

## [0.3.34] - 2026-10-19

### Changed
- **The run sidebar lists only active synergies** again. The not-yet-active ones (greyed, "1/2") show only on the embark page's Party synergies card, where they help pick a party.

## [0.3.33] - 2026-10-19

### Changed
- **Party synergies show the ones not yet active.** The embark page's Party synergies card and the run sidebar list every synergy the party has at least one member of.
  - Active ones look as before.
  - Ones short of their first tier are plainly off: greyed, a dashed edge, a progress count ("Outsiders 1/2"), and on the embark card "Needs 2 in the party". Active ones come first, then the closest to turning on.
  - game-core `partySynergies(keys)` returns each with its count, the tier reached (if any) and the members needed for the next tier.
- **Character card footers drop the numbers:** their synergy chips show just the badge and name (the popover still highlights the tier the party has reached), and they never grey out.
- Test: `partySynergies` (active / short / next tier, active first). Game-core: 335 pass, 0 fail.

## [0.3.32] - 2026-10-19

### Added
- **Each synergy has its own colour** (`SynergyData.color`, data like the rest; editable once the admin synergy tab exists). First pass: Summoners light purple, Alexandria gold, Mages deep indigo, Tantalus crimson, Knights steel blue, Outsiders moss green.
  - Server start fills the colour into synergy rows that have none (like achievement badges); an edited colour stays.

### Changed
- **One standard synergy chip everywhere** (`SynergyChip` in `features/hub/relic-popover.tsx`). It's tinted with the synergy's colour and shows its badge, name, the party count, optionally the tier reached beneath, and its popover.
  - **Where:** character card footers (embark and Party pages), the embark page's Party synergies card (with the tier text), and the run sidebar.
  - On character cards the chip is a hover-only span (the card is the button); elsewhere it's a cursor stop.
- The synergy popover's heading is in the synergy's colour, and the tier the party has reached is highlighted in it.

## [0.3.31] - 2026-10-19

### Fixed
- **A chosen character card's footer goes green with the card.** On the embark page, a selected party member's card turned green but its synergy footer band stayed blue. The footer now takes a green gradient a shade darker than the card while the card is chosen (`.ff-panel[data-on="true"] .ff-panel-footer`).

## [0.3.30] - 2026-10-19

### Changed
- **Embark page run buttons are green:** Begin run, New run and Continue run all use the green "on" panel.

### Fixed
- **A disabled button no longer shows the frame behind it.** The run buttons straddle the party card's edge, and `opacity-50` let its white border show through like a strikethrough.
  - Buttons now have a proper disabled look: a flat grey FF window, fully opaque, with dimmed text, no lift and no clicks (`.ff-panel.ff-btn:disabled` in `index.css`).
  - It's opt-in with the `ff-btn` class. So far it's on the embark run buttons and the admin page's Save / Export buttons; cards and frames keep their own looks.

## [0.3.29] - 2026-10-19

### Changed
- **Embark page:** the run buttons sit at the party card's bottom-right corner (still straddling its bottom edge), not centred.

## [0.3.28] - 2026-10-19

### Changed
- **Embark page run buttons:** the main action is always on the right: Continue run when this journey has a run in progress, else Begin run. New run sits to its left. Both are now the same medium size (Continue run was oversized). The cursor lands on the main action when you arrive.

## [0.3.27] - 2026-10-19

### Changed
- **Embark page: the party card is laid out top to bottom.**
  - The "Party" heading is on top, then the four slots in a centred row.
  - The run buttons (Begin run, or Continue run + New run) are centred and float half on, half off the card's bottom edge, with room below so nothing overlaps.

## [0.3.26] - 2026-10-19

### Changed
- **Embark page: the starting relic is a sticky sidebar.** The page is now two columns inside its usual width: the journey, party and roster on the left, and a sidebar on the right that stays in view while you scroll the roster. On narrow screens it drops below.
  - **Starting relic:** compact badge-only tiles in a grid, plus "None", each showing its full card on hover or cursor (the items' popover, opening toward the page). The chosen relic's name and effects show beneath.
  - **Party synergies:** a stacked list (name, count, the tier reached), each with its popover; it updates as the party changes.
  - The roster grid is three across beside the sidebar.

## [0.3.25] - 2026-10-19

### Added
- **Relic and synergy popovers** (`features/hub/relic-popover.tsx`): the same FF hover card the items use. Hover them, or reach them with the cursor.
  - **Relic card:** badge, name and rarity in colour, Cursed / Starter, description, every effect in plain words, the flavour line.
  - **Synergy card:** badge, name, description, every tier (the one the party has reached highlighted), and which characters carry the tag (the party's highlighted).
  - **Where:** embark page (starting relic tiles, party synergy chips), run sidebar (each relic in the rack, each active synergy), and the "give up which relic?" chooser. These replace the old browser tooltips.
- **Character cards show their synergies.** On the embark page and the Party page, every character card has a new footer band (the journey cards' footer style) with the character's synergy tags as badges. Hover one for its card; on the embark page it also counts how many of the chosen party share it. The cards' subgrid grows to six rows, so the footers line up across a row.

## [0.3.24] - 2026-10-19

Relics phase 3 (`.plans/relics-and-synergies.md`): relics in runs.

### Added
- **Starting relic** on the embark page.
  - Your unlocked starter relics appear as badge tiles, plus "None". The last pick is remembered, and each tile shows its effects on hover.
  - The panel also shows the party synergies the chosen party has going in, live as you change the party.
  - The server checks the relic is unlocked and a starter (`run.start` `relic`).
- **Relics in every battle:** a run's relics and its party's active synergies become the battle's modifiers (`createBattle({ modifiers })`), so Protect Ring's Protect, Power Wrist's Strength and Summoners' Trance head start all apply.
- **Relic reward cards.** Boss rewards always include one; fortress (semi-boss) rewards do half the time. It replaces the offer's last card.
  - It's chosen from your unlocked relics you don't hold, in the area's tier, weighted (`rollRelicCard`).
  - The card shows its badge, name in rarity colour, "Cursed" when it is, and its effects.
- **The rack (swap only).**
  - A run has 3 slots, plus achievements' `relicSlots`.
  - A relic fills a free slot. When the rack is full, taking one asks which held relic to give up ("Back to the cards" cancels). There's no selling or discarding.
  - `claim` takes `replace`.
- **Run sidebar:** the relic rack (badges ringed in rarity colour, then empty slots) and the active synergies, each with what it does on hover.
- **Metrics:** `relics.taken` (starting relic and cards) and `relics.runs_won` per relic. The relic collection page shows "Taken N×" and "Runs won with it" for unlocked relics, and the Stats page names relic subjects.
- **Tests:** 5 in `run/relics-run.test.ts` (starting relic rules, battle modifiers from relics and synergies, rack fill/full/swap/duplicate, relic card rolls, boss offers). Game-core: 334 pass, 0 fail.

### Notes
- A run already in progress has no relics (it started before them); new runs do.

## [0.3.23] - 2026-10-19

Relics phase 2 (`.plans/relics-and-synergies.md` §3.7): the relic collection page.

### Added
- **Relics page** (`/relics`, in the sidebar after Achievements), modelled on FF9's card browse screen.
  - **Numbered grid** of every relic in collection order (No. 001…). Unlocked ones show their badge; locked ones show an empty "?" slot.
  - **Detail panel:** follows the cursor, keyboard, controller or mouse alike.
    - Unlocked relics: large badge, number, name, rarity (in its colour), Cursed / Starter tags, description, each effect in plain words ("+10% Strength", "Steal chances +100% (Tantalus members)", "A killing blow restores 5% HP"), which synergies it works with, and its flavour line.
    - Locked relics: the achievement that unlocks it, with its description and progress bar ("???" if the achievement is secret).
  - **Collector rank:** count, bar and an FF9-style title from Beginner to Master.
  - **Filters and slots:** All / Unlocked / Locked / Starters, plus the relic slots per run.
- `effectText(effect)` (`features/hub/relics-page.tsx`): any effect primitive in words, for later run screens.

### Notes
- Lifetime numbers per relic (times taken, runs won) come with relics in runs (phase 3), when there's something to count.

## [0.3.22] - 2026-10-19

Relics phase 1 (`.plans/relics-and-synergies.md`): the data and the battle engine for the run-power layer. Nothing shows in runs yet.

### Added
- **Tables:** `relic`, `synergy` and `character_tag` (migration `relics`, generated with `db:migrate`), plus `player_profile.relicsUnlocked`. Seeded on server start like the reward tables (insert-missing-only), exported by the admin export, and loaded into the reward registry (`relicTable`, `relicById`, `synergyTable`, `characterTags`).
- **Seeds:**
  - **10 placeholder relics** with badge icons: Thief's Gloves, Ether Pouch, Power Wrist, Rosetta Ring (free starters); Protect Ring, Blood Fang, Tantalus Bandana, Hermes Sandals, Pumice Piece; cursed Kuja's Mirror.
  - **6 synergies:** Tantalus, Summoners, Alexandria, Knights, Mages, Outsiders.
  - **Tags** for all ten characters.
- **Relic data** (game-data `RelicData`): rarity, cursed, starter, free, `unlockedBy` (achievement id), badge, effects, weight, minTier, sort.
- **Unlocking** (game-core `meta/relics.ts`): a relic is unlocked when it's free, when the player has its `unlockedBy` achievement (retroactive), or when it's in `relicsUnlocked`.
  - `starterRelics` lists those that can start a run.
  - `relicSlotCount` = 3 + earned achievements' new `reward.relicSlots`.
- **Battle modifiers** (game-core `battle/modifiers.ts`): relics and active synergies become effect specs. `createBattle({ modifiers })` ties them to the party units their scope covers (whole party, a tag, or one character) and stores them in `BattleState.modifiers`, so replays use exactly those however relics are re-tuned.
  - **Six effect primitives:** `stat` (± % to a battle stat, applied up front), `startStatus`, `trance` (gauge head start), `steal` (+% steal chance, capped at certain), `mpDiscount` (adds up, at most 90%), `onKill` (the killing blow's attacker gets back % max HP / MP).
  - `activeSynergies(partyKeys)` gives each tag's highest tier reached, counting the active party only.
- **Tests:** 12 in `battle/modifiers.test.ts`: each primitive, tag scope, a cursed relic, synergy tiers, unlock and slot rules, and an exact replay of a battle with relics. Game-core: 329 pass, 0 fail.

### Notes
- **Restart the server** to seed the new tables.

## [0.3.21] - 2026-10-19

### Changed
- **No asset files in git.** All of `apps/web/public/sprites/` is git-ignored and untracked: 150 files, 22 MB of enemy sheets, hero strips, weapons, UI icons and the item atlas, committed before the R2 pack system existed. Music, menu sounds and badges were already ignored. The repo now tracks no image or audio files.
  - The asset scripts still write their outputs to `public/` (sprites, music, sfx). Those local copies are `assets:pack`'s input and the **dev-only** fallback when `VITE_ASSET_BASE_URL` is unset.
  - **Production always loads from R2:** a build never ships the local copies (vite `dropPackedAssets` now drops them always, not only when R2 is set). A build without `VITE_ASSET_BASE_URL` warns, and a production page without it logs an error.
- Git history still has the old copies (up to v0.3.20).

## [0.3.20] - 2026-10-19

### Changed
- **The badge atlas is no longer in git.** `public/sprites/badges/` is git-ignored like `public/sfx/` and the music. It's built locally from the bought badge set (`pnpm -F web sprites:badges`) and reaches players only through the `badges` asset pack on R2. The local copy stays as `assets:pack`'s source and the no-R2 dev fallback. The catalog of names and tags (`scripts/badge-catalog.json`) stays committed, since it's our data, not the art. Git history still has the v0.3.19 copy.

## [0.3.19] - 2026-10-19

### Added
- **Achievement badges.** Every achievement can have a badge from the purchased badge set (`.docs/assets/achievement-badges`, 1,015 icons).
  - **Achievements page:** each card shows its badge, in colour once earned and greyed until then. A secret one shows "?" until earned.
  - **Admin → Rewards & gear → Achievements:** a badge picker in the editor shows the current badge, a searchable grid of the whole set (by name, tags or number), and Clear. Saves with the achievement (`AchievementData.badge`, validated 1…`BADGE_COUNT`).
  - **First pass for the 44 seeded achievements** in `packages/db/seed/rewards/achievement-badges.json` (id → badge). On server start these fill in only achievements that have no badge yet, so existing rows get them and a badge picked on the admin page is never overwritten. A badge in `achievements.json` (e.g. after an admin export) counts too.
- **Badge atlas + catalog:** `pnpm -F web sprites:badges` (`scripts/build-badges.ts`) packs the set into `public/sprites/badges/badges.png` (48 px cells, badge n at cell n − 1) and `badges.json`. The catalog includes `scripts/badge-catalog.json`, a name, search tags and frame style for all 1,015 badges, written by looking at each one.
- **`badges` asset pack** (boot pack, 1.0 MB gzipped), uploaded to R2. `<Badge id scale view locked />` draws one (`features/hub/badge.tsx`).

## [0.3.18] - 2026-10-19

### Fixed
- **Gizamaluke's fight counted him as still standing when it ended.** Once his real 3,875 HP is gone, his script plays his death scene (sinking back into the water) and ends the battle itself, but our engine never marked him as down: v0.3.17 shipped with the encounter test for his fight failing. He now enters FF9's dying state the moment his real HP runs out: out of reach and not acting while the scene plays. This is the state Memoria's `IsSpecialHPInDyingState` checks for, though it can't detect it in Gizamaluke's fight. Game-core tests: 317 pass, 0 fail.

## [0.3.17] - 2026-10-19

### Fixed
- **Gizamaluke has his real 3,875 HP and the boss frame shows 3,875.** We gave every boss FF9's hidden +10,000 HP buffer, but Gizamaluke's fight doesn't use it. Memoria's `btl_para` notes "the HP gap is not always 10 000 (Gizamaluke…)". His script reads his HP, maxes it out at 65,535 as room for his death scene (sinking back into the water), and ends the fight once he has lost what it read. With our extra buffer, it read 13,875, so the fight ran 10,000 HP too long.
  - His fight (`GZ_E014`) now has no buffer (`NO_HP_BUFFER` in `battle/ai/vm.ts`). His script reads 3,875, and 3,875 damage ends the fight.
  - The boss frame shows 3,875 counting down to 0 (the display offset from v0.3.16).
  - The test now pins the kill at 3,875.

## [0.3.16] - 2026-10-19

### Changed
- **Boss fights are flagged by us, not by FF9's monster flags.** `BattleState.bossFight` is set for a run's boss and fortress (semi-boss) nodes and for Practice's boss pick. The boss frame shows in every such fight; Black Waltz 1 in the Ice Cavern was missing it because FF9 doesn't flag him as a boss. The big frame goes to FF9's flagged boss(es), else to the enemy with the most HP; the rest get the small frames.
- **The boss frame shows each enemy's level** ("Lv 16").

### Fixed
- **Gizamaluke showed 55,535 HP.** His FF9 battle script fakes his HP: it maxes it out at 65,535 and ends the fight itself once he has lost what he had. That's **13,875**: FF9's data gives him 13,875, which is 3,875 plus the 10,000 every FF9 boss carries, and his script doesn't take the 10,000 off. The engine already ran this faithfully (he falls after exactly 13,875 damage, now pinned by a test), but the frame showed the faked number. When a script maxes HP out, the unit now records its real total (`hpShown`), and `shownHp(u)` gives what's left: 13,875 counting down to 0.
- **Auto-battle cast Double Black / Double White only once.** The auto AI now adds the second spell when the spell it picks comes from a Double command and there's MP for both. (Casting it from the menu already asked for the second spell; the engine casts both.)

### Notes
- My first checks of Gizamaluke's kill point were wrong: they stepped a Wait-mode battle that was paused for a party command, so nothing happened. Feeding the party commands shows the script working.

## [0.3.15] - 2026-10-19

### Added
- **Boss frame** (`battle/boss-frame.tsx`): in fights with a boss, the boss's frame sits at the top centre of the battlefield.
  - **HP**: a red bar plus the numbers left to chew through. Like the party window, it holds the HP from before a hit until that hit's effect lands.
  - **Items left to steal**: one dot per item the enemy carried. The dot stays lit (gold) while the item is still there and becomes an empty ring once it's stolen. Hover the dots for "2 of 4 items left to steal".
  - **Other enemies in the fight** (adds, parts, escorts) get smaller frames of the same kind on either side of the boss's.
  - Fallen and hidden enemies drop out. Fights without a boss show nothing new.
- The action banner (the move's name) now sits just under the boss frame instead of over it.

## [0.3.14] - 2026-10-19

### Fixed
- **Trance's flashy entry burst looped for as long as Trance lasted.** FFRK's Trance rig (`status_eff_trance.json`) isn't a loop: it holds two one-off bursts, `eff_trance` (rays, bolts and a flash going in) and `stop` (the flash coming out). It was played as a looping status rig. Now the burst plays **once when Trance begins**, the exit flash **once when it ends** (not on a KO), and the pink body tint is what lasts, as in FFRK. New `BURST` table in `status-looks.ts`; `StatusView` plays these.
- **A tagged section of an effect rig no longer fires the sounds of the rig's other sections.** Sound cues before the section's first frame all went off at once when it started, so Trance's exit sound would have played on entry. Sounds are now limited to the frames played (`FfrkEffectPlayer.sounds()`).

## [0.3.13] - 2026-10-19

### Fixed
- **Ability effects were drawn 1.5× too big.** FFRK places characters, bosses and the status rig on a character at 1.5× its stage scale, but ability effects (spells, hits, items, summons) at 1×. Our rig evaluator leaves those placements out, so characters and effects were both drawn at the heroes' pixel scale, and every effect came out half again as big as FFRK draws it next to the party. Effects now play at the heroes' scale ÷ 1.5 (`CHARACTER_STAGE_SCALE` in `battle-effects.ts`). Status auras and live bosses were already right: they share the characters' 1.5.

## [0.3.12] - 2026-10-19

Live bosses polish: they freeze, take status colours, have the cursor and gauge on their real figure, and play FFRK's own particles.

### Fixed
- **Stop, Sleep, Petrify and Freeze now hold a live boss still.** They paused only the hidden baked sprite, so the live rig kept moving. The effect player has a `paused` switch (the frame holds and is still drawn).
- **Status colours show on live bosses**: Petrify's grey, Poison's green, Trance's pink, and the Protect / Shell pulse. They were set on the hidden sprite only; the effect player's new `tint` is multiplied over the rig's own colours.
- **Cursor, target glove, ATB gauge and status bubble sit on a live boss's real figure.** They came from the baked sheet's box, which spans every pose (attack lunges included), so they hung too high and too low. A live boss is now measured by its rig's idle pose (worked out once per rig); anything else is measured as before, and a battle that drops back to the sheets switches back too.

### Added
- **Bosses play FFRK's own particles and frame animations**: death puffs and explosions, smoke, water, feathers. 17 of the 46 in-game boss rigs use them; they were never downloaded, so they were silently skipped.
  - `ffrk:fetch bosses` now also downloads each rig's `pb_*.json` / `.sajson` files (saved as `<id>~<file>`), and the shared effect images they use into the effect library.
  - The `bosses` pack carries them, plus the effect images the effects pack doesn't already have: 177 files, 1.0 MB gzipped. Uploaded to R2.
  - The dev server serves them at their FFRK paths like the rigs' other files.

### Changed
- Comments that still called live bosses a Practice-only / dev-only feature are updated.

## [0.3.11] - 2026-10-18

Bosses animate live from FFRK's own rigs, for everyone.

### Changed
- **Live boss animation is the default.** Bosses are drawn from their FFRK rig in Phaser: each piece is rotated and scaled by the GPU at screen resolution, every frame at 60 fps. This replaces the baked sprite sheets, whose rotations stepped by whole art pixels at 20 fps and read like tearing.
  - **Settings → Live boss animation** (On / Off) turns it off on a slow device. It's saved on this device, not the account, since it's about the device's performance.
  - **Falls back by itself:**
    - a rig that doesn't load keeps the baked sprite;
    - a battle running under 30 fps for 3 seconds switches to the baked sprites for the rest of that battle (logged in the console).
  - Practice's switch is the same setting. It's on by default and no longer dev-only.

### Added
- **`bosses` asset pack** (`assets:pack bosses`): the in-game bosses' rigs, main sheets and further body sheets at their FFRK paths, so the effect player loads them like any effect. 140 files, 0.9 MB gzipped, loaded at startup with the other sprites. Uploaded to R2.

## [0.3.10] - 2026-10-18

### Added
- **Practice → "Live boss animation"** (dev server; Practice is admin-only): bosses are drawn live from their FFRK rig in Phaser instead of the baked sprite sheet, to compare against baking at a higher resolution.
  - The pieces are rotated and scaled by the GPU at screen resolution, every frame at 60 fps, with no baked frames.
  - The rig's own idle loops; attack and damage play the rig's tags, then return to idle; a KO plays its dead tag.
  - The baked sprite stays underneath, drawing nothing, so clicking, targeting, stepping forward and fading work as before.
  - The toggle restarts the fight and is remembered in the browser. Other monsters (sheets without a rig) are unchanged.
- **The effect player follows a rig's visibility switches** (`rigVisibility`), so live bosses don't show their hidden second form either.
- **Dev server: boss rigs by their FFRK paths** (`/ffrk-raw/ab/character/boss/<id>/…`), mapped to the boss downloads (rig, main sheet, extra sheets).
- Sprite data records each boss's rig id (`EnemySpriteInfo.rig`).

### Notes
- The live mode needs the dev server's raw FFRK files (`ffrk:fetch bosses`). Shipping it to players would mean packing the boss rigs and sheets.

## [0.3.9] - 2026-10-18

### Fixed
- **Bosses drew a frozen copy of themselves over the animation**, which looked like screen tearing (well spotted). FFRK rigs switch whole groups on and off on their timeline. The entrance animation, which FFRK's battle engine plays first, hides alternate forms; Black Waltz 1's transformed body is one. The sprite builder ignored those switches, so the still second form sat on top of the moving one: Black Waltz 1 drew 24 pieces, two whole bodies.
  - **`visibilityAt(rig, tag, frame)`** (`ffrk-anim.ts`): the switches made by the entrance (`in`) plus the current animation up to the frame. `poseAt` / `evalRig` take it, and the sprite builder uses it for every pose.
  - **18 boss sprites change**: Black Waltz 1, Ark and Deathguise (the long-known "both forms at once"), Ralvuimago, Meltigemini, Taharka, Earth Guardian, Garland, Maliris, Tiamat, Red Dragon, Amdusias, Abadon, Shell Dragon, Ragtime Mouse, Zaghnol, Adamantoise and Black Widow.
  - The `enemies` pack is rebuilt and uploaded to R2.

### Added
- **`sprites:enemies --scale N --step N --out <dir>`**: trial bakes at N× detail and 60/N fps into a scratch folder, reporting the sheets' size (raw and gzipped). The game's sprite data is left alone. Measured, the whole monster set gzipped (today: 1×, 20 fps = 15.0 MB):
  - 2× detail at 20 fps: 22.2 MB
  - 3× detail at 20 fps: 29.0 MB (3 sheets taller than 4096 px)
  - 3× detail at 30 fps: 41.3 MB (4 sheets taller than 4096 px)
  - 1× detail at 60 fps: 36.0 MB
  - 2× detail at 60 fps: 57.4 MB
- `.docs/ffrk-assets.md`: timeline visibility and rigs with several sheets.

## [0.3.8] - 2026-10-18

### Fixed
- **Black Waltz 1 showed only his hat.** His FFRK rig draws his body, wings, arms and bell from a second sheet (`img_209002_1`), which was never downloaded, so every piece but the head was silently skipped. He's whole now: wings, robe, arms, the bell, in every animation.
  - **`ffrk:fetch bosses`** now reads each rig for the sheets its pieces name and downloads the extra ones with their atlases, saved as `<id>~img_<id>_1.png/.json`. 224 boss rigs reference extra sheets.
  - **`sprites:enemies`** draws each piece from the sheet it names (`render-rig`'s `renderPose` takes a per-part lookup). It only uses further body sheets (`img_<id>_N`): masks and overlays (`img_mask_…`) need FFRK's special blending, so they stay out as before.
  - Of the monsters in the game, only Black Waltz 1 changed. The `enemies` pack is rebuilt and uploaded to R2.

## [0.3.7] - 2026-10-18

### Added
- **`apps/web/scripts/probe-rig-trim.ts [bossId…] [--all]`**, a permanent read-only inspector. For each FFRK boss rig it checks whether image nodes are sized by their atlas piece's trimmed crop, which is what the sprite builder's renderer assumes, or by the untrimmed source box, which would stretch and shift pieces (the summon bug fixed in v0.2.3). It lists any rig that does the latter and exits 1.
  - Run on Plant Brain: all 32 pieces are sized by their crop, so its slightly gapped right arm isn't a trim problem. It's how its idle animation rotates that arm (and FFRK's rotation convention can't be confirmed from the assets we have).

## [0.3.6] - 2026-10-18

### Fixed
- **Status bubbles in battle were far too big and floated off the unit.** They were scaled at half the unit's pixel scale regardless of the icon's 64 px size, so at the heroes' 4–5× scale a bubble drew 128–160 px tall.
  - **Size:** now about 13 of the hero art's pixels tall, sized from the unit's scale, so it keeps the same proportion at any window size.
  - **Position:** just above the head and a little behind it, since the bubble's tail points down toward the head. Behind means to the right for the party (they face left) and to the left for monsters.
  - **Bob:** a gentle bob that scales with the unit.
- Doom's / Gradual Petrify's countdown number sits just above the bubble (or the head) at the same scale.

## [0.3.5] - 2026-10-18

Metrics: leaderboards and an admin view of every player's stats, plus 15 more metrics.

### Added
- **Admin → Metrics** (`/admin/metrics`, in the sidebar's Admin section):
  - **Leaderboard** for any tracked metric, ranked by one of:
    - **the player's total**;
    - **the best single character** (showing whose number it is);
    - **one character**.

    It's for the whole metric or one subject (an enemy, item…), top 10 / 20 / 50 / 100. "Lowest ever" records (fastest win) rank lowest first. Click a player to see their stats.
  - **Player stats**: pick any player and see their Stats page as they see it (party table, every metric, top tens).
- **`metricLeaderboard`** (api `services/metrics.ts`): the top players for any metric / subject / character. The base for every leaderboard, including the endless challenge runs planned for later, which only need their own "furthest reached" record metric.
- API: `admin.players`, `admin.playerMetrics`, `admin.metricLeaderboard`.
- **More metrics:**
  - stages entered by kind (battle, shop, Moogle…)
  - things bought in run shops / from Stiltzkin, and gil spent there and on synthesis
  - items synthesized (per item)
  - gear sold, and gil from selling
  - ? event choices (per event)
  - Chocobo digs
  - reward cards taken (by kind) and skipped
  - items used on the map (per item, per character)
  - **best win streak** (from the player's run history when a run is won)

### Changed
- The Stats page's body is a shared `MetricsOverview` (the admin player view uses it).

## [0.3.4] - 2026-10-18

Metrics, step 5: the numbers are visible: a Stats page, each character's lifetime numbers, and an MVP at the end of a run.

### Added
- **Stats page** (`/stats`, in the sidebar after Achievements):
  - **Party**: every recruited character side by side, sortable by clicking a column (enemies defeated, damage dealt, biggest hit, healing, steals, times KO'd, battles won, runs won).
  - **Every tracked metric, by section**: Battles, Combat, Support, Runs, Bosses, Camp. Durations show as m:ss; hover a line for what it counts.
  - **Top tens**: most defeated enemies, bosses, items used, abilities used, by name.
- **Character page → Record tab**: under runs / wins / bosses, that character's own lifetime metrics by section.
- **Run-over screen → This run**: the run's own metrics.
  - The **MVP** (most enemies defeated, then damage) with their victory pose.
  - Each member's kills, damage dealt, biggest hit and healing for the run.
  - Battles won, enemies defeated and items stolen.

## [0.3.3] - 2026-10-18

Metrics, step 4: achievements can be built on any tracked metric.

### Added
- **Achievement condition `metric`**: a lifetime metric reaches a number, counted for one of:
  - **the player's total**;
  - **any one character** (the best of them);
  - **a given character**.

  It's overall, or for one **subject**, e.g. "Vivi defeats 100 enemies", "any character lands a 9,999 hit", "defeat 50 Goblins", "use 30 Potions". Its progress bar comes from the metric.
- **Admin → Achievements → condition editor:**
  - **Metric** lists every tracked metric (label, key, and "highest / lowest ever" for records), with its description.
  - **Subject** appears with a hint for what it takes (an enemy's bestiary id, an item id, a status, a journey, a stage kind), or stays empty for all.
  - **Counted for** offers player / any / each character, for per-character metrics.
  - **At least** sets the number.
  - The server checks that the metric exists and is kept per subject / per character as asked.
- **The profile carries its lifetime metrics** (`Profile.metrics`, loaded with it), so conditions and the Achievements page's progress bars read them. A run's end checks achievements after its metrics are added, in the same transaction.
- Tests: a metric condition for the player, any character, a given one and a subject, and its progress (316 pass).

## [0.3.2] - 2026-10-18

Metrics, step 3: lifetime metrics backfilled from the history recorded before metrics existed.

### Added
- **`apps/server/scripts/backfill-metrics.ts [email] [--before <ISO>] [--apply]`**, a permanent tool, dry run by default.
  - **From every verified battle** (`run_battle`): fought / won (by stage kind) / lost / fled, time in battle, fastest win, enemies defeated by enemy, and bosses by boss. These go to the player and to every member of that run's party.
  - **From every finished run:** finished / won / lost by journey (player and party), highest tier won, gil earned.
  - **It refuses players who already have live metrics** unless `--before` limits it to history before metrics started, so nothing is counted twice.
- **Run on the dev account:** 50 runs and 209 battles → 171 battles won, 279 enemies defeated, 22 bosses, 8 runs won.

### Notes
- **Per-character combat detail can't be rebuilt.** `run_battle` keeps each battle's seed and inputs but not its starting state (the party's levels, gear and HP at the time), so old battles can't be replayed exactly. Who landed each kill, damage and steals are counted from v0.3.1 on. The plan (`.plans/metrics.md`) assumed a replay was possible; it isn't.

## [0.3.1] - 2026-10-18

Metrics, steps 1–2 (`.plans/metrics.md`): every battle, run and camp purchase now records metrics, lifetime per player and per character, and per run. The backfill, achievements on metrics and the Stats page come next.

### Added
- **Metrics registry** (game-core `metrics/registry.ts`): 37 metrics in six sections. Each has a label, a description, how it adds up (a running sum, or a record kept at its highest / lowest), whether it's kept per character, and an optional subject (an enemy, item, ability, status, journey, stage).
  - **Battles**: fought, won (by stage kind), lost, fled, flawless wins, preemptive strikes, back attacks, time in battle, fastest win.
  - **Combat, per character**: enemies defeated (and per enemy), damage dealt / taken, biggest hit, critical hits, actions, abilities used (per ability), statuses inflicted (per status), times KO'd, trances.
  - **Support, per character**: healing done, revives, items used (per item), steals (per item) and missed steals, monsters eaten.
  - **Runs**: finished / won / lost (per journey, per character), highest tier won, gil earned, levels gained.
  - **Bosses**: defeated, per boss and per character.
  - **Camp**: CP spent, gil spent, training ranks, gear slots, start levels, starting-gear tiers.
- **Collection, server-authoritative** (game-core `metrics/collect.ts`, pure):
  - **Battles count from the server's verified replay.** `replayBattle` now hands back its events. `battleMetrics` attributes damage, heals, KOs, steals and statuses to the actor of the action they belong to; enemies are counted by bestiary id, bosses by theirs.
  - **Each run keeps its own metrics** (`RunState.metrics`): the run's summary.
  - **A run's end** adds finished / won / lost by journey and levels gained.
  - **Camp** spending is counted from the profile before and after each camp action.
- **`player_metric` table** (migration `player_metrics`): one row per player, character, metric and subject.
  - Each run action adds what it changed in the run's metrics, in the same transaction that saves the run, so nothing unverified is counted. Sums add up; records keep the higher / lower.
  - Done as one bulk upsert per kind (`services/metrics.ts`: `addMetrics`, `loadMetrics`).
- Tests: totals per subject and character, records, merge and delta, the registry, a real battle's kills / damage / actions per character from its replay, a run's end, and camp spending (315 pass).

### Notes
- Restart `pnpm dev` (schema changed).

## [0.3.0] - 2026-10-18

Version 0.3: the game's own design (reward tables, gear availability, starting-gear upgrades, and now achievements) is data in Postgres, managed on the admin page.

### Added
- **Admin → Rewards & gear → Achievements** tab:
  - **The list**: every achievement grouped by category, each showing its condition in a line ("Battles won ≥ 100", "Clear The Ice Cavern", "Recruit Zidane, Vivi…"). Disabled ones are dimmed; secret ones are marked. Search and a category filter.
  - **The editor**:
    - id (new achievements only), name, description, category, order within the category, enabled, secret (shown as ??? until earned)
    - **the condition**: pick its kind and fill in its fields
      - a lifetime stat ≥ n (battles won, runs finished, runs won, items stolen, monsters eaten, highest tier won)
      - a journey cleared
      - bosses defeated (ids, as recorded in boss kills)
      - roster size ≥ n
      - characters recruited (checkboxes)
      - abilities learned ≥ n
      - a solo late-game clear
      - Terra & Memoria with a character
    - **the reward**: gil, CP (for everyone or one character), gear unlocked (legendary gear only drops this way), best-in-slot armour for a character, camp supplies unlocked
    - notes
  - **New achievement** and **Delete**. Players who earned a deleted one keep it in their profile, but it isn't listed.
  - Saves are checked on the server: the journey, characters, items and supplies must exist, and empty reward fields are dropped. They go live at once.
  - **Export to seed files** includes `achievements.json`.
- API: `admin.saveAchievement`, `admin.deleteAchievement` (zod, with the condition as a discriminated union).

### Changed
- Version 0.3.0 (minor bump).

## [0.2.113] - 2026-10-18

Achievements move into the database, step 1: the definitions are data in an `achievement` table. The admin page comes next.

### Changed
- **Achievement definitions live in Postgres** (`achievement` table, migration `achievements`).
  - Seeded from `packages/db/seed/rewards/achievements.json`: all 44, exactly as before, generated by `gen-reward-seeds.ts achievements`.
  - Inserted missing-only, loaded with the reward tables, and covered by `db:seed:rewards --reset achievements` / `--export`.
  - Which achievements a player has earned stays in `player_profile.achievements`.
- **Conditions are data** (`AchievementCondition` in game-data):
  - a lifetime stat ≥ n (battles, runs, wins, steals, monsters eaten, highest tier won)
  - a journey cleared
  - bosses defeated (all of a list)
  - roster size ≥ n
  - specific heroes recruited
  - abilities learned ≥ n
  - a solo late-game clear
  - a Terra & Memoria clear with a hero
- game-core:
  - `achievements()` (the enabled ones, by category and order) replaces `ACHIEVEMENTS`.
  - `achievementMet(a, profile)` replaces each definition's `check`.
  - `achievementProgress(a, profile)` gives the progress bars, from the condition: any count above one.
  - The legendary gear list re-reads when the tables change.
- Every place that listed achievements reads the table: the Achievements page, Play hub, Challenges, Items page, run-over screen, starting-gear requirements, and camp supply unlocks.
- A deleted achievement isn't listed or counted any more; players who earned it keep the id.
- Tests: the table loads in order, the conditions, progress, and awarding with legendary gear (310 pass).

### Notes
- Restart `pnpm dev` (schema and content loading changed). The achievements are already seeded in the dev database.

## [0.2.112] - 2026-10-18

### Changed
- **The Achievements page shows progress.**
  - A bar for everything earned at the top.
  - **Each category** (Story, Milestones, Bosses, Challenges, Legends) has a header with how many are earned ("3 / 5") and its own bar.
  - **Achievements that count toward a number** show a progress bar with "have / need": Veteran (battles won), Fellowship (roster), All Together Now (heroes unlocked), Studious and Scholar (abilities learned), Master Thief (steals), Gourmand (monsters eaten), Iron Will and Unbreakable (highest tier won), and Final Fantasy (superbosses, once it's no longer secret).
  - Earned ones show the pixel check; hidden secrets a padlock. The 🏆 / "·" glyphs are gone.
  - The page uses the hub's wider column, with room at the bottom.
- game-core: `AchievementDef.progress(profile)` → `{ have, need }`, for achievements with a metric.

## [0.2.111] - 2026-10-18

### Fixed
- **The Achievements page couldn't be navigated by keyboard / controller**: its cards weren't cursor stops, so there was nothing to move between and the page couldn't be scrolled that way. Every achievement card is now a cursor stop: the arrows and D-pad walk the grid category by category, and the page scrolls to keep the cursor in view.

## [0.2.110] - 2026-10-18

### Added
- **The paperdoll figure floats**: a gentle up-and-down drift, with its ground shadow narrowing and fading as it rises (`.ff-float`, `.ff-float-shadow`). On the camp character page and the in-run sheet.
- **The figure celebrates when you unlock or buy something** on the camp character page: a gear slot, a starting-gear tier, a start level or a training rank. It plays the hero's FFRK victory pose and hops, then goes back to idle after about two seconds. Each purchase restarts it.

## [0.2.109] - 2026-10-18

### Changed
- **Keyboard / controller: the embark page lands on Begin run** ("New run" when this journey's run is in progress) instead of the breadcrumbs' first neighbour. The last party is already picked, so one press sets off; the party slots and roster are a move away.

## [0.2.108] - 2026-10-18

### Added
- **The cursor can stay on the same control across a page change** (`?focus=` in the address). Navigating can pass the focused control's key (`stableFocusKey()` in `features/input/focus.tsx`, for controls given a `focusKey`), and the next page lands on that control if it has one.
  - **The character sheet's chevrons use it:** stepping Zidane → Vivi with ◂ / ▸ keeps the cursor on the chevron, so you can keep stepping instead of starting over on the first item.
- **`FocusItem defaultFocus`**: marks the control a page lands on when the address doesn't name one. One per page; pages without one start on their first item as before.
- The hub prefers, in order: the address's `focus`, the page's `defaultFocus` item, its first item.

## [0.2.107] - 2026-10-18

### Fixed
- **Keyboard / controller still started on the breadcrumbs' "Home"** (v0.2.106 didn't fix it).
  - **Cause:** the address changes as soon as you navigate, but the new page arrives a moment later. The cursor landed on the old page meanwhile, which marked the page as "landed" and made the breadcrumbs ordinary stops. When the old item disappeared, the cursor fell back to the page's first item: "Home".
  - **Fix:** a rule that doesn't depend on timing. A `skipOnLanding` item that gets the cursor *by code* passes it straight down to the content below. That covers arriving on a page, the cursor falling back after its item went away, and the first key press that places the cursor (nav.ts marks that one as a landing, so it still ticks). An arrow press from the content, or hovering it with the mouse, still reaches the breadcrumbs.
  - The page-change timing flag (`resetLanding`) is gone.

## [0.2.106] - 2026-10-18

### Fixed
- **Keyboard / controller: arriving on a camp page put the cursor on the breadcrumbs' "Home"** instead of the page's content. Breadcrumbs are now skipped when the cursor first lands on a page, both on arrival and on the first key press that places the cursor once a page's data has loaded. Once the cursor is on the page they're ordinary stops, and ↑ from the top of the content reaches them.

### Added
- **`FocusItem skipOnLanding`** (`features/input/focus.tsx`): an item that's never where the cursor first lands on a page.
  - Until the cursor lands on one of the page's other items, these are off the cursor's map.
  - The hub resets this on each new page (`resetLanding`).

## [0.2.105] - 2026-10-18

### Changed
- **Camp character page**:
  - No "← Back" button: the breadcrumbs above (Home › Party › …) go back. The in-run sheet, a dialog, keeps its ✕.
  - The top right shows the start level as **"Lvl. 5"** beside the CP.
  - The arrows either side of the name are chevrons, on the camp page and in runs.

## [0.2.104] - 2026-10-18

### Changed
- **The character sheet's right-hand window is inset half as much**: 2rem top and bottom (half the header's height) instead of the full header height. It's still centred vertically against the left window.

## [0.2.103] - 2026-10-18

### Fixed
- **The character sheet's right-hand window still had rounded left corners**: `.ff-window`'s own rounding won over the utility class. Its left corners are now forced square where it joins the left window.

### Changed
- **The right-hand window is centred vertically** against the left one: it's inset by the header's height at the bottom as well as the top.

## [0.2.102] - 2026-10-18

### Changed
- **The character sheet is two framed windows side by side** (camp's character page and the in-run sheet):
  - **Left: the header over the paperdoll.** The header holds the name, CP and Back / ✕.
  - **Right: the tabs and their panels**, in a window of its own. It starts level with the bottom of the left window's header and joins the left window's edge, with no rounded corners on its left side.
  - On narrow screens the two stack.
- **◂ ▸ beside the name** step to the previous / next recruited character, in roster order and wrapping, on the camp character page (`/party/:character`; the address changes and Back returns to the roster). In a run they step through the party, as LB / RB (Q / E) still do; this replaces the names-with-hints line in the header.
- **Start level is no longer in the camp sheet's header** (it's on the Training tab). The in-run sheet keeps its current level beside the name.

## [0.2.101] - 2026-10-18

### Fixed
- **The breadcrumbs looked bad**: tiny (the small-label style on top of small text), all capitals with wide letter-spacing, one washed-out colour, and faint "›" separators. They're restyled to match the game:
  - the menu's display font at a normal size, with the usual drop shadow, in normal case
  - FF9's pixel arrow between steps
  - links in pale blue that turn white on hover; the current page in yellow

## [0.2.100] - 2026-10-18

### Changed
- **Breadcrumbs start with "Home"** instead of "Camp" (Home › Story, Home › Party › Zidane…). It still goes to the Play hub.

## [0.2.99] - 2026-10-18

### Added
- **Breadcrumbs on the camp pages** (`features/camp/breadcrumbs.tsx`), in place of the small label above each title. Every step but the current page is a link back, with the back sound, and a cursor stop for keyboard / controller. "Camp" is the Play hub.
  - Story: **Camp › Story**
  - Embark: **Camp › Story › *the journey***. This replaces the "◂ Journeys" link.
  - Party: **Camp › Party**; a character's page: **Camp › Party › *their name***
  - Shops: **Camp › Supplies**, **Camp › Gear catalog**
  - Challenges: **Camp › Challenges**
- `PageTitle` takes `crumbs` instead of a `kicker`.

## [0.2.98] - 2026-10-18

### Fixed
- **Locked journeys showed an empty footer section.** Only journeys you can play have the footer ("Highest tier cleared" / "Not cleared yet", Choose). A locked card's last row stays empty, so the cards still line up.

## [0.2.97] - 2026-10-18

### Changed
- **Journey cards have a footer section**: "Highest tier cleared" / "Not cleared yet" and Choose sit in their own section at the bottom of the card. The window's border runs across it (a white line between dark ones, like the card's edge), the window's gradient starts over beneath it, and it reaches the card's inner edges.
- New **`.ff-panel-footer`** class, so any FF window or panel can have such a footer.

## [0.2.96] - 2026-10-18

### Changed
- **Journey cards line up row by row** (CSS subgrid, like the character cards): each card spans four shared rows, so matching lines sit at the same height in every card of a row and the cards match in height, however long each one's subtitle or boss names are.
  - The rows: title + subtitle, maps + final boss, the hero it recruits, the footer.
  - A journey that recruits nobody keeps an empty recruit row, so the footers ("Highest tier cleared", Choose) still line up.

## [0.2.95] - 2026-10-18

### Fixed
- **The recruit sprite on journey cards spilled out of its box.** It draws on a 96 px cell (3× its 32 px art) inside a 72 px box. Its box is now the full 96 × 96 cell, with the hero standing at the bottom centre, and the green check sits in the cell's corner.
- The "Clear to recruit" / "Joined: …" text beside it is centred vertically.

## [0.2.94] - 2026-10-18

### Changed
- **Journey cards show the hero they recruit much larger**: 72 px, up from 40.
  - Once the journey is cleared and the hero has joined, the **green check** sits over their sprite's corner.
  - Until then they're a silhouette, as before.
  - The "Clear to recruit" / "Joined: …" line beside them is a size larger too.

## [0.2.93] - 2026-10-18

### Fixed
- **Picking Skill made Zidane flee.** The battle menu ran a command straight away when it had only one usable ability, a shortcut meant for one-action commands like Steal and Jump. Early on, Zidane's Skill list holds only Flee (his Dagger teaches it), so choosing Skill fled the battle.
  - Commands now run straight away only when FF9 defines them as a single action.
  - List commands (Skill, Magic, Sword Art, Blue Magic…) always open their list, even with one entry.
  - The same applied to anyone whose list command had one usable ability.

## [0.2.92] - 2026-10-18

### Changed
- **The battle list's help footer is vertically centred**: a one-line description sits in the middle of the fixed-height footer instead of at its top. Long ones still fill it and are cut off as before.

## [0.2.91] - 2026-10-18

### Changed
- **Battle lists are FF9's two-column grids**: Item, Throw, and every ability list (Magic, Skill, Sword Art…). **Items and thrown weapons show their icon** beside the name, with the count on the right; abilities keep their MP cost there.
  - Keyboard / controller: ↑↓ move a row and ←→ a column, wrapping at the ends.
  - The highlighted entry scrolls into view in long lists.
  - The window widens to 30rem for a list (at most 45% of the screen) and goes back to its narrow width for the command list and targets.
- **A fixed-height help footer** under every list: one line of what the item does (e.g. "Restores 150 HP · one target") and FF9's description, cut off past two lines (three without an effect line). The menu no longer jumps in height as the cursor moves between long and short descriptions. Hover the footer for the whole text.

## [0.2.90] - 2026-10-18

### Changed
- **The battle menu opens right beside the party window**, at the bottom right, as in FF9 (and FF6 / FF7). The active character's commands now sit next to their name instead of across the screen, and the enemy list stays at the bottom left. The party window keeps its 34rem width and shrinks on narrow screens.

## [0.2.89] - 2026-10-18

### Changed
- **The battle's party window is at most 34rem wide**, at the bottom right like FF9's. On wide screens it used to stretch across the whole space beside the enemy list and battle menu, which put names far from their HP, MP and ATB gauges. The spare room now sits between the menus and the party window. On narrower screens it still shrinks to fit.

## [0.2.88] - 2026-10-18

Starting-gear upgrades, step 3: the chains are managed on the admin page.

### Added
- **Admin → Rewards & gear → Starter gear** tab.
  - Pick a character to see each slot's chain as icon tiles: the FF9 piece, then each tier.
  - Pick a tier to edit it, or **+** to add the next one. The editor has:
    - the item: only what that character can wear in that slot, cheapest first, with prices
    - gil (defaults to 3× the FF9 price), CP and minimum start level (defaults 5 / 10 / 20 CP and Lv 5 / 10 / 15 by tier)
    - a journey to have cleared and / or an achievement to have earned
    - enabled, notes
  - **Remove tier** works on a chain's last tier only, so tiers stay I, II, III with no gaps.
  - Saves go live at once, like the other tables, and **Export to seed files** includes `starter-upgrades.json`.
- API: `admin.saveStarterUpgrade` and `admin.deleteStarterUpgrade` (zod).
  - The server checks the character exists, the piece is that slot's kind and the character can wear it, the tier leaves no gap, and the journey / achievement exists.

## [0.2.87] - 2026-10-18

Starting-gear upgrades, step 2: the character page's Equipment tab replaces the "coming soon" stub.

### Changed
- **Equipment tab → Starting gear upgrades**: a row of item tiles for **all five slots**, with banked gil and the character's CP in the header.
  - Each row: the FF9 starting piece, then each tier, joined by arrows.
  - **Hover a tile** for the usual item popover (stats, what it changes for this character, abilities taught), headed by its tier and state:
    - "every run starts with this"
    - owned: "click to start with it instead"
    - the cost (gil · CP · start level)
    - each thing still blocking it ("Unlock Mage Masher first: win a run with one (drops in Alexandria…)", "Needs start Lv 10", "Needs 5 CP")
  - **Clicking**:
    - the next tier **buys it**, with the purchase chime, and it's worn from the next run;
    - an owned tier, or the FF9 piece, **starts runs with that one instead**, so you can go back to an earlier piece to keep learning its abilities;
    - a blocked tile buzzes.
  - **Borders**: yellow for the piece runs start with, green for owned, dashed for the next tier; a padlock marks tiers further on.
  - **Locked slots** stay in the list, dimmed. Their first tile doubles as **the slot's unlock** (orange, padlock, "Click to unlock it · 10 CP"), the same as the paperdoll's locked slot.
  - Every tile is a cursor stop (keyboard / controller).
- The paperdoll's equipment list notes "starting gear · upgrade tier n" for upgraded slots.

## [0.2.86] - 2026-10-18

Starting-gear upgrades, step 1 (`.plans/starter-upgrades.md`): the rules, the table and the seeded chains. The character page and the admin tab come next.

### Added
- **`starter_upgrade` table**, one row per tier of a character's upgrade chain for a slot. Each row holds the item, a **gil + CP cost**, a **minimum start level**, an optional journey or achievement requirement, and enabled / notes.
  - It sits in the reward tables: seeded from `packages/db/seed/rewards/starter-upgrades.json` (insert-missing-only), registered with the others, and covered by `db:seed:rewards --reset starter` / `--export`.
  - Migrations `starter_upgrades` and `starter_picks`.
- **The draft chains, 128 tiers**: tier I → II → III per slot for Zidane, Vivi, Garnet, Steiner, Freya, Quina, Eiko, Amarant, Beatrix and Blank. For example, Zidane's weapon goes Dagger → Mage Masher → Mythril Dagger → Butterfly Sword.
  - Every tier teaches something the character can learn, and none is legendary.
  - The defaults: gil = 3× the piece's FF9 price, CP 5 / 10 / 20, start level 5 / 10 / 15.
  - Generated by `gen-reward-seeds.ts starter`, which also checks that the character can wear each piece in its slot.
- **Rules (game-core)**:
  - `starterUpgradeState` lists every tier with what blocks it: the slot is locked, the previous tier isn't owned, **the item isn't unlocked for good** (catalog, won run, synthesis, achievement), the start level is too low, a journey or achievement is missing, not enough gil, not enough CP.
  - `starterBlockText` gives one line per reason ("Unlock the Head slot first", "Unlock Mage Masher first", "Needs start Lv 10").
  - `buyStarterUpgrade` spends banked gil and the character's CP and wears the new tier at once.
  - **`pickStarterTier`** chooses which owned tier a slot starts with, including the FF9 piece (0), so you can go back to an earlier piece and keep learning its abilities. It's free.
  - `starterGear` starts runs in the picked tier, and only in unlocked slots. Allowed during a run; it applies from the next one.
- **API**: `profile.buyStarterUpgrade`, `profile.pickStarterTier`.
- **`apps/server/scripts/probe-gear-lines.ts [character…] [--slot …]`**, a permanent inspector. For every slot of every character it lists each piece they can wear, weakest first, with price, stats, the abilities it teaches (★ = learnable by them), how it shows up in runs, and its synthesis recipe.
- Tests: the seeded chains, buying (gil, CP, the run starts in it), each block, locked slots, tier order and the end of a chain, and picking an earlier tier or the FF9 piece (306 pass).

### Notes
- Restart `pnpm dev` (schema changed). The new tiers are already seeded.

## [0.2.85] - 2026-10-18

### Changed
- **One list in the sidebar**: Home, Play, Items, Achievements, Settings, with no separator between Home / Play and the rest. The Admin section keeps its own divider.

## [0.2.84] - 2026-10-18

### Changed
- **The sidebar's game section is just Home and Play**: Story, Party, Supplies, Gear catalog and Challenges are reached from the Play hub's cards, the way a game's own menus work. **Play stays highlighted** on all of them, and during a run. The Practice / Items / Achievements / Settings group and the Admin section are unchanged.

## [0.2.83] - 2026-10-18

### Changed
- Title screen tagline: "**Two** worlds. One road. Start again — stronger." FF9 has two worlds, Gaia and Terra; "three worlds" was left over from the early three-world runs.

## [0.2.82] - 2026-10-18

### Fixed
- **The Items page ended flush with the bottom of the window**: scrolled all the way down, the last row of tiles sat against the edge. It now has 6rem of room below the last section.

## [0.2.81] - 2026-10-18

### Changed
- **The Items page renders much less work**:
  - **Tiles are memoized** (`ItemTile`): changing a filter, the icon size or hovering re-renders only the tiles whose props changed, not all 255. The roster used for gear comparisons is memoized too, so it no longer invalidates every tile on each render.
  - **Off-screen tiles skip layout and paint** (`content-visibility: auto`, with an intrinsic size so the scrollbar doesn't jump). They stay in the page, so the keyboard / controller cursor still reaches every item. Virtualizing would have removed them from the page.
  - **Search is deferred** (`useDeferredValue`): typing stays responsive and the grid catches up a beat later.
  - **Locked silhouettes use one CSS filter** (brightness) instead of two; the extra glow filter was costly to repaint on many tiles while scrolling.
  - **Unlock status is worked out once per profile** (`itemStatuses`): the playable areas are computed once, not per item.

## [0.2.80] - 2026-10-18

### Fixed
- **The Items page showed gear from maps you can't play yet as available**: dark and ninja gear, for example, only drop in the Echoes of the Past side journey's areas (Baron, World of Ruin), which open after Lindblum. A map-pool piece now counts only when one of its areas is on a journey you've unlocked; that's also the only way it can drop in a run.
  - The rest are **locked**, with a blue "Map" badge: "Drops in Baron, World of Ruin: unlock the journey "Echoes of the Past" first".
  - When some of a piece's areas are open, "Drops in …" lists just those.
  - Starting gear always counts.

## [0.2.79] - 2026-10-18

### Changed
- **The Items page is in sections**: Weapons, Head, Arm, Body, Accessories, Items, each under its own heading with a rule. Signed in, each heading shows how many of its items can turn up in your runs (e.g. "12 / 31"); signed out, how many there are. The filters (kind, In my runs / Locked, character, search) apply within the sections, and empty sections are left out.

## [0.2.78] - 2026-10-18

The Items page shows what you've unlocked: anything that can't turn up in your runs yet is a dark silhouette with a padlock and says how to get it. Icons default to 64 px.

### Changed
- **Unlock state per item** (signed in), from the gear-availability table read for your profile (`features/items/item-status.ts`):
  - **Can turn up in your runs**, shown normally:
    - gear in an area's map pool ("Drops in Alexandria, Evil Forest +3")
    - starting gear ("Start" badge)
    - gear you've unlocked: catalog, won runs, synthesis, achievements (green ✓)
    - consumables
  - **Locked**: a black silhouette of the icon with a padlock and the name dimmed.
    - Catalog gear ("Catalog" badge) gives its price and whether you've reached far enough for it, and "or synthesize it" when a recipe makes it.
    - Legendary gear (★) names the achievement and what it takes.
    - Gear in no map pool and not in the catalog says so.
  - **The popover** opens with that line (a padlock for locked items) above the item's details.
- **Filters**: **Everything / In my runs / Locked**, beside the kind, character and search filters, with "N of M can turn up in your runs" in the header. Signed out, everything shows normally, and the header suggests signing in to see unlocks.
- **Icon sizes**: 32 / 48 / **64 (default)** / 96 px, remembered in this browser; tiles widen to fit.
- The page is wider (up to 80rem).

## [0.2.77] - 2026-10-18

All admin pages live under `/admin/…`, and Practice joins them. The sidebar gets a Home item.

### Changed
- **Admin URLs**: `/admin/rewards`, **`/admin/practice`** (was `/battle`), **`/admin/dev`** (was `/dev`), **`/admin/effects`** (was `/effects`).
  - `/admin` itself goes to Rewards & gear.
  - One `admin` route segment guards them all: no admin role → Play, and the server checks too.
- **Practice is admin-only**, in the sidebar's Admin section (Rewards & gear, Practice, Dev tools, Effects). The title screen's and the header bar's practice links are gone.
- **Home** at the top of the sidebar goes to the title screen. **Play** gets a gamepad icon (the house is Home's).

## [0.2.76] - 2026-10-18

An **Admin** section in the hub's sidebar holds the admin pages, and the dev tools and effects gallery move into the hub layout.

### Changed
- **Sidebar**:
  - **Practice** sits with Items, Achievements and Settings.
  - A new **Admin** section, shown to admins only, under an orange "Admin" divider: **Rewards & gear**, **Dev tools**, and **Effects** (development servers only, since it needs the local FFRK library).
- **Dev tools (`/dev`) and the effects gallery (`/effects`) use the hub layout** instead of the header bar. The gallery fills the window with room for the menu button, without the shortcut stack.
- **One admin guard** for all three: a pathless `_hub/_member/_admin` layout sends anyone without the admin role to Play (and the server checks the role on every admin request). Routes: `_admin/admin/rewards`, `_admin/dev`, `_admin/effects`; the URLs are unchanged. The effects gallery now needs an admin account too.
- The header bar (now only on sign-in and the legacy camp) drops its Dev and Effects links.

## [0.2.75] - 2026-10-18

The practice battle is in the hub layout.

### Changed
- **Practice battle (`/battle`) uses the hub's sidebar layout** instead of the header bar, like the run.
  - It's in the sidebar as **Practice**, under Challenges.
  - It plays its own battle music (the hub doesn't override it), keeps the gil / shortcut stack off the field, and fills the window with an even margin. The menu button floats in the top-left corner, and the controls bar leaves room for it.
  - Open to anyone, signed in or not, as before; the title screen's practice links still land here.
  - Route `/_hub/battle` (was `/battle`); the URL is unchanged.
- The practice controls (world, encounter, party level, New fight) are cursor stops.
- The result line counts seconds at FF9's 15 ticks per second (it divided by 20).
- The old controls hint under the field is gone: the battle menu shows its buttons now.

## [0.2.74] - 2026-10-18

Statuses look the way FFRK draws them: the bubble icon over a unit's head (Confuse's dizzy stars, Poison's bubbles, Sleep, Silence…), looping auras (Haste, Slow, Reflect, Regen…), Freeze's ice, Trance, and Doom's countdown, all from FFRK's own battle assets.

### Added
- **`pnpm -F web ffrk:status`** (`scripts/fetch-ffrk-status.ts`) downloads FFRK's status assets from the Japanese server, in the same mirror as the ability effects:
  - `ab/character/common/status_eff.json`: one animation rig whose tagged sections are FFRK's looping status auras.
  - Every particle file, frame animation, image and sound those use.
  - The special rigs: Freeze, Trance, curse.
  - The balloon icons (`ab/battle/status_icon/<n>.png`).
  - How FFRK draws statuses was read from its battle client's `StatusAilmentsView`, and the asset paths from captured battle data. Documented in `.docs/ffrk-assets.md`.
- **Status looks in battle** (`features/battle/status-view.ts`, table in `features/effects/status-looks.ts`):
  - **Balloons** over the head, popping open and closed like FFRK's and taking turns every 0.75 s when several are up:
    - Confuse (dizzy stars), Berserk, Sleep, Stop, Silence, Blind, Poison / Venom.
    - Statuses FFRK never had get the closest icon: Zombie (skull), Virus (dark orb), Trouble (wavy).
  - **Auras** looping on the unit, taking turns every 1.5 s: Haste, Slow, Reflect, Regen, Auto-Life (Reraise's), Heat (soul fire).
  - **Protect and Shell**: FFRK pulses the body's colour for these, and so does this (gold for Protect, sea green for Shell, alternating when both are up).
  - **Freeze** plays FFRK's frozen rig, and **Trance** FFRK's trance aura, while they last.
  - **Doom's countdown** (and Gradual Petrify's, in grey) over the head, ticking down with the status.
  - A status an effect is still bringing appears when the effect hits, and the looks follow the unit when it steps forward. Units that are KO'd, jumping or hidden show none.
  - Blind, Mini, Sleep and Stone keep their FFRK sprite poses, Vanish its fade, Poison its tint.
- **Effect player**: `tag` plays (and loops) one tagged section of a rig. Only the emitters whose frame the section crosses start, and looping keeps them flowing (FFRK's semantics).
- The effects asset pack includes the status assets (repacked and uploaded).

## [0.2.73] - 2026-10-18

Battle items play FFRK effects, mapped the same way as spells and monster moves.

### Added
- **Item effects** (keys `i:<item id>` in the effect map; an item's battle action is minus its item id):
  - **Candidates** (`features/effects/item-candidates.ts`) for all 17 FF9 battle items, from FFRK's item / white-magic family (20xxx). For example, 20000 is the carele (ケアル) heal sprite; 20001 is FFRK's own Hi-Potion; 20004 is a light cure; 20005 / 20006 are water-drop cures; 20010 is a raise with a flying shot; 20301 is poisona (ポイゾナ); 20302 is FFRK's Eye Drops; and 20303 is stone art. Dead Pepper plays fire, and Ore a falling rock.
  - **`pnpm -F web effects:seed`** now covers battle items too and assigned all 17. Two more moves also matched FFRK names (679 assignments in all). Assignments made in the gallery are never overwritten.
  - **Defaults by what the item does** (`itemDefault`, from its FF9 item script) for anything unassigned: heals sparkle, Ether glows, Elixir bursts, Phoenix Down raises, status cures sparkle, Soft breaks stone.
  - **In battle**: using an item plays its effect, with the numbers waiting for the hit like spells. A fight preloads the effects of the items in the bag.
  - **Effects gallery**: "To map" lists the items under a new **Item** filter (beside Party / Enemy / Both), with what each plays now and its candidates.
- The effects asset pack is rebuilt and uploaded to R2 with the item effects.

## [0.2.72] - 2026-10-17

Targeted rewards, step 8 (first balance pass): rarer gear cards are actually better gear, and there's a sim report for tuning offers.

### Changed
- **Rarer gear cards reach higher areas' gear**. Rarity used to change little: the "next band" was the next area up, which in Disc 1 mostly stocks the same items. In the Evil Forest, a legendary boss card averaged a cheaper FF9 piece than a rare one.
  - Each rarity now has `bandSteps`: common 0, uncommon 1, rare 1, epic 2, **legendary 3** areas up, with its chance (`nextBand`: 0 / 10 / 25 / **60 / 100**%). The higher pool keeps the area's own gear too.
  - The admin page's Rarities tab edits both ("Higher band %", "Areas up").
  - Evil Forest boss cards now average FF9 prices of 359 (rare), 492 (epic) and 686 (legendary) gil, with Mythril Dagger / Gloves, Glass Armlet and Silver Gloves appearing; before: 362 / 360 / 324.

### Added
- **`pnpm sim rewards [--source boss] [--world 4] [--party zidane,vivi,steiner] [--level 8] [--n 200]`**: offers in aggregate. It shows card kinds, rarities, who the cards are for, average upgrade score and FF9 price of gear per rarity, and the most-offered gear.
- **`pnpm -F @ffix-roguelike/db db:seed:rewards --reset <table>`** reloads one reward table from its seed file, discarding its edits. Used here to load the new rarities into the dev database.

### Notes
- A 10-run solo-Zidane sim still stalls around the first journey: that's the open small-party balance question (Vivi from the start), not the reward cards.
- Restart `pnpm dev` (or save any rarity on the admin page) so the server re-reads the rarities.

## [0.2.71] - 2026-10-17

Targeted rewards, step 7: the management page for the reward and gear tables, **`/admin/rewards`**. For admins only; the sidebar shows them a "Rewards & gear" link.

### Added
- **Gear availability** tab: every gear piece (all 224).
  - Filters: search, status (map pool / catalog / legendary / disabled), "in the map pool of" an area.
  - Each row shows how the piece shows up (n areas, its catalog price, legendary, or **nowhere** in red).
  - The editor (with the item's FF9 price and who wears it):
    - enabled
    - legendary (achievements only)
    - each area's map pool, with a **boss only** toggle per area
    - in the gear catalog, with its price and the tier it appears from
    - notes
- **Boons** tab: every boon with its amounts per rarity.
  - The editor: name, description, stat, member / party, the amount per rarity (empty = never at that rarity), weight, from tier, which characters roll it more, enabled.
  - **New boon** and **Delete**.
- **Sources** tab: surprise / elite / treasure / semi-boss / boss. Each sets the number of cards, its guarantee (none / one gear / all gear), the lowest rarity, the upgrade threshold, the gil for skipping, the surprise chance, and the rarity and card-type weights.
- **Rarities** tab: name, colour (picker), AP surge, gil, supplies, next-band chance.
- **Roles** tab: per character, the weight of each stat change and of each ability the gear would teach.
- **Preview** tab: pick a source, an area, a party (up to four, all slots open) and a level, and see 8 rolled offers with each card's rarity colour (gear with its upgrade score, boons with their amounts). Change the seed for more.
- **Export to seed files** writes the tables into `packages/db/seed/rewards` so tuning can be committed (development servers only).
- Every save is validated (zod), written, and **live at once**: the server reloads the tables and the game's copy refreshes, so the next reward offer, drop pool and gear catalog use it.
- API: `admin.rewardTables`, `saveRarity`, `saveRole`, `saveSource`, `saveBoon`, `deleteBoon`, `saveGear`, `preview`, `exportSeeds`, all `adminProcedure`.
- Everything on the page is a cursor stop (keyboard / controller).

## [0.2.70] - 2026-10-17

Targeted rewards, steps 5–6: elites, treasure, the semi-boss and bosses offer **reward cards**, each for one character, saying exactly what it does. Taking one applies it at once, so there's no equipping afterwards. Bosses always offer real gear upgrades.

### Added
- **Reward cards** (game-core `rewards/cards.ts`, `rollOffer`), rolled from the reward tables:
  - **Gear upgrade**: a piece that's an upgrade for that character (`upgradeScore` above the source's threshold), from the area's map pool plus the gear you've unlocked. Rarer cards pick nearer the top of the list and may come from the next area's band. Taking it **equips it on them, bound to them**, and the piece it replaces goes to the bag. The card shows the stat changes, "Teaches …", and a warning when the old piece was still teaching something ("Stops learning Blizzara (24/50 AP)").
  - **Boon**: a named, run-long bonus (Thief's Vigor +3 Strength, Black Mage's Focus, Vital Spring +12% max HP…), on one member or the whole party (Moogle Blessing, Party Training).
    - **Level boons** (Burst of Growth) are real FF9 level-ups: growth pool, HP / MP and all.
    - Boons stack, count in every stat, and end with the run.
  - **AP surge**: AP toward an ability a member's gear is teaching ("+15 AP toward Fira (8 → 23/50)").
  - **Supplies** (Potions… Elixirs by tier) and **gil**.
- **Per source** (the `reward_source` table):
  - Elite: pick 1 of 3, leading with a gear upgrade.
  - Treasure: pick 1 of 2 (plus its gil).
  - Semi-boss / boss: 3 gear upgrades, rare or better. If nobody has an upgrade left, epic+ boons instead.
  - **Plain battles**: none, except a **surprise** pick of 2 on a lucky roll (3%): "A lucky find!".
- **Targeting**: cards spread across the party and lean toward whoever has the most room to improve; no two cards for the same member and slot or the same item.
- **Skip** pays a little gil (the source's skip gil × tier).
- **The reward screen** (`reward-cards.tsx`):
  - The cards side by side, each with the member's sprite, the rarity's colour (white / green / blue / purple / gold) on the frame and label, and the details above.
  - Cards are cursor stops (keyboard / controller: move, A takes), and taking one plays the purchase chime.
  - Skip shows its gil.
- **Boons on display**: a Boons panel on the character sheet's Stats tab (stacked by name: total and ×times, coloured by the best rarity), and a ★ count on the party sidebar's card (hover: each boon).
- `applyCard(run, card)`, `learning(build)`, `RunBoon` / `CharacterBuild.boons`, `boonTotal`. `RunState.rewardRerollsLeft` / `rewardBans` for later.
- `pnpm sim run` takes reward cards (the first gear upgrade, else the first card) and logs them.
- Tests: a boss offers three rare+ upgrades from the pool for several members; an elite leads with gear; no upgrades → epic+ boons; same seed → same offer; taking gear equips it, bound, old piece to the bag; a stat boon raises the stat and the run's end drops it; party and level boons; AP surge; skip pays gil (301 pass).

### Changed
- Treasure stages and the event that finds gear offer treasure cards instead of 3 loose items.
- Runs saved mid-reward keep their old pick-a-gear screen.

## [0.2.69] - 2026-10-17

Targeted rewards, step 4: judging whether a piece of gear is an upgrade for a character.

### Added
- **`upgradeScore(build, itemId)`** (game-core `rewards/upgrade.ts`): how good a piece of gear would be for this character in its slot. Null when they can't wear it, the slot is locked, or it's what they already wear.
  - **Stat value**: the real stat changes from equipping it (`gearChange`: full derived stats against what they wear now), each weighted by the character's role from the `reward_role` table (Vivi weighs Magic 4, Steiner Strength 4 and Defence 2.5…). A character with no role row weighs every stat 1.
  - **Ability value**: each unmastered ability the piece would start teaching, worth the role's ability weight (double for its preferred abilities). Mastered abilities count for nothing.
  - **Loss**: each unmastered ability the replaced piece was teaching that nothing else will, at 60% of its value, since the old piece goes to the bag and can be swapped back. It's listed with its AP progress (`stopsLearning`) for the card's warning.
  - Returns the parts, the change, `teaches` and `stopsLearning`.
- **`upgradesFor(build, itemIds, threshold)`**: the upgrades among a pool, best first, at or above a reward source's threshold.
- Tests: the stat value is the weighted real stat changes; a mage values Magic more than a fighter; an unmastered ability adds value and a mastered one doesn't; replacing a piece that's still teaching reports the ability and its AP; nothing for unwearable gear, a locked slot, or what's already worn; ordering and threshold (293 pass).

## [0.2.68] - 2026-10-17

Targeted rewards, step 3: the reward and gear-availability tables, in Postgres with committed seed files, and every gear piece accounted for in one table that the game now reads.

### Added
- **`gear_availability`**: one row per gear piece (all 224), saying how it can show up in runs.
  - Its map pools (areas where it drops without unlocking, with an optional boss-only flag), whether it's in the gear catalog and at what price and from which progression tier, legendary (achievements only), enabled, notes.
  - **The drop pools and the gear catalog now read it** (`baseGear`, `gearCatalog`; shops skip legendary gear by it).
  - The seed reproduces the old rules exactly (140 pieces in map pools = each area's FF9 shop stock, 66 catalog-only, 18 legendary), so nothing changes in game until the table is edited.
- **Reward tables** for the coming reward cards (first guesses, tuned later on the admin page):
  - `reward_rarity`: common / uncommon / rare / epic / legendary, in white, green, blue, purple and gold, with the AP surge, gil, supplies and next-band chance per rarity.
  - `reward_role`: what each of the 12 characters values in gear, as stat weights plus an ability weight.
  - `reward_source`: surprise / elite / treasure / semi-boss / boss.
    - Each sets the number of cards, the rarity and card-type weights, the upgrade threshold, the guarantee, the lowest rarity and the gil for skipping.
    - Elites: at least one gear upgrade. Semi-bosses and bosses: all upgrades, rare or better. Surprises: 3% after a plain battle.
  - `reward_boon`: 14 named boons (Thief's Vigor, Black Mage's Focus, Burst of Growth (level-ups), Moogle Blessing (party)…), each with amounts per rarity.
- **Profile fields** `rewardRerolls` / `rewardBans` (charges for later; unused).
- Migration `reward_tables`.
- **Seeding**: seed files in `packages/db/seed/rewards`. The server seeds them on boot, **inserting missing rows only**, so edits are never overwritten.
  - `pnpm -F @ffix-roguelike/db db:seed:rewards` does the same.
  - `--export` writes the database back into the seed files.
  - `bun packages/game-core/scripts/gen-reward-seeds.ts [--force]` writes the defaults.
- **Registry**: game-data `registerRewardTables` / `rewardTables()` / `gearAvailability(itemId)`.
  - The server loads the tables with the FF9 data (`ensureRewardContent`, `reloadRewardContent` for admin edits).
  - The web app via `content.rewards`, re-registered when it changes.
  - Tests and the sim from the seed files (`loadFf9Cache`).

### Changed
- `probe-gear.ts` reads the table: statuses now include disabled and "not in table" (a problem, like "nowhere"), boss-only counts per area, and each item's catalog tier and notes.

### Notes
- Restart `pnpm dev` (schema and server boot changed).

## [0.2.67] - 2026-10-17

Admin accounts, set up like ChannelGuide's: better-auth's admin plugin, an admin-only tRPC procedure, and a script to grant the role.

### Added
- **Roles** with better-auth's **`admin()` plugin** (`packages/auth`): built-in "admin" and "user" (the default). The user table gets `role`, `banned`, `banReason` and `banExpires`, and the session table `impersonatedBy` (migration `admin_plugin`).
- **`adminProcedure`** (`packages/api/src/index.ts`): signed in with the admin role, else FORBIDDEN. `isAdmin(session)` is beside it. The coming reward / gear tables admin page uses them.
- **`adminClient()`** in the web's auth client, so `session.user.role` is typed. `isAdminUser(user)` is for showing admin-only UI (the server checks too).
- **`apps/server/scripts/set-role.ts [email] [admin|user]`**, a proper script like the probes. With no arguments it lists every account and its role. With an email (or a prefix matching exactly one account) and a role, it sets it.
  - Run from apps/server: `bun scripts/set-role.ts <email> admin`.
  - James's account is admin.

### Changed
- **Dev tools are admins only** (and still never on a production server): the dev router uses `adminProcedure`, and the header's Dev link shows only to admins. The Dev page says how to get access.

### Notes
- Restart `pnpm dev` (auth plugin and schema changed). If the Dev link doesn't show, sign out and back in so the session picks up the role.

## [0.2.66] - 2026-10-17

First step of targeted rewards (`.plans/rewards.md`): the bag shows only what's in it, gear can be bound to one character, and synthesizing a piece unlocks it for good.

### Changed
- **The gear picker** (character sheet → Equipment) lists only what's in the bag. Gear another party member is wearing isn't offered any more, so you can't pull it off them from here.
- **The bag** (Gear tab) lists unequipped gear only. Each member's own gear is on their sheet.
- **Synthesizing a piece unlocks it into future runs straight away, won run or lost.** It's hard enough to make. Gear found (not synthesized) still unlocks only when the run is won. (`RunState.synthesized`, `RunOutcome.synthesized`, `applyRunOutcome`.)

### Added
- **Bound gear** (`GearInstance.boundTo`): gear found for one character can be equipped only by them. For the coming reward cards; nothing binds gear yet.
  - `equip` refuses anyone else ("That was found for Vivi").
  - Optimize gear skips it for the others.
  - Swapping never hands it to someone else.
  - The picker and bag mark it ("found for Vivi", with their portrait).
  - `canWearInstance(key, inst, slot)` in game-core.
- Tests: a synthesized piece is unlocked after a lost run, and found gear isn't; bound gear refuses another member, and optimize leaves it alone (287 pass).

## [0.2.65] - 2026-10-17

### Added
- **`apps/server/scripts/probe-gear.ts`**, a permanent read-only inspector like the other probes, for how every gear piece can show up in runs (the unlock model the targeted-rewards plan builds on). Run from apps/server: `bun scripts/probe-gear.ts [item|email …]`.
  - Every gear piece by how it can appear:
    - starter gear
    - map pool: an area's FF9 shop stock, which shows up without unlocking
    - catalog: buy at camp, then it joins the drop pools
    - legendary: achievements only
    - nowhere: a problem, and it exits 1
  - Each area's map-pool size and price band, and the catalog-only and legendary pieces by name.
  - Per item (a name or prefix: `silk`, `mythril`): kind, price, who equips it, whose starter it is, every area pool that has it, catalog price, and the recipe that makes it.
  - Per player (an email or prefix): their unlocked gear and the catalog they see now. It never creates a profile.
- Today: 224 pieces, 140 in map pools, 66 catalog-only, 18 legendary, none that can never appear.

## [0.2.64] - 2026-10-17

### Changed
- **Stages your route can't reach any more are faded out on the map**, with their roads. Everything still ahead of the party, however many rounds on, stays as it was; the stages you've played stay greyed as before. The rest are drawn at a third of their strength, dark and desaturated: stages the last choice cut off, and the untaken branches behind you. So the choices still open, and where they can lead, stand out. Where a road is shared with a live one, the live one wins.

## [0.2.63] - 2026-10-17

### Fixed
- **Coming back from looking around snapped the camera to the party**, which was jarring: walking (or View / B / A) restarted Phaser's camera follow, and starting a follow jumps straight to the target. The camera now eases back to the party over a moment (frame-rate independent, following it if it's already walking) and only then follows it again. Panning again while it's on its way back stops the return.

## [0.2.62] - 2026-10-17

### Fixed
- **The map's progress track and hints weren't centred**: they were centred on the part of the map left of the floating party, so they sat off to the left. They're centred on the whole map frame now, the same whether the party floats over the map or is docked beside it.

## [0.2.61] - 2026-10-17

Map shapes can be anything valid (any number of stages per round, a gauntlet of single stages), the map shows where you are ("1-3") on a progress track, and you can look around it with the mouse, the right stick or View.

### Added
- **Map progress** at the bottom of the overworld:
  - "1-3" means map 1, round 3: the round you're choosing now. "of 8" under it is the map's round count.
  - A track of the map's rounds. Rounds already played show the icon of the stage you took there (battle, elite, shop, Moogle…), in green. The round you're on pulses. Rounds ahead are dim, with an icon when the whole round is one kind (the Moogles, the boss castle).
  - Hover a pip for its round and stage.
- **Look around the map**:
  - **Mouse**: drag the map. A click without dragging still picks a stage.
  - **Controller**: the right stick pans at any time.
  - **Keyboard / D-pad**: **View (V)** turns on look mode, where the directions pan the camera; View, B or A brings the camera back to the party.
  - Walking always brings the camera back to the party, and the hint at the top of the map says how to look around and how to come back.
- **Map shapes per area**: `WorldDef.mapShape` (default `MAP_SHAPE`, 1-2-3-4-3-4-3-2-1).
  - `checkMapShape` enforces the rules: the start and the boss are one stage each, every round has at least one stage, and neighbouring rounds differ by at most one stage. A 4 sits only between 3s, 4s and 5s. A one-stage-per-round gauntlet ([1, 1, 1, 1, 1]) is a straight road.
  - `generateWorldMap` refuses an invalid shape.

### Changed
- What each stage is scales to the map's length: the first quarter of the rounds are plain fights (and a treasure / event at its end), Moogles are likelier in the middle round, and the semi-boss fortress (when an area has one) takes the middle round. For the default 9-round shape this is exactly what it was.
- The map's overlays (the walking hint at the top, the stage description and progress track at the bottom) stay in the part of the map the floating party doesn't cover.

### Verification
- game-core tests: shape rules, a gauntlet is a straight line, mixed shapes stay connected (285 pass).
- The headless layout check across 200 maps in four shapes: the default, a 5-stage middle, a gauntlet, and equal neighbouring rounds. No road crosses a stage or label, the roads mirror, forks branch in different directions, and every next stage can be walked to.

## [0.2.60] - 2026-10-17

Every overworld map has the same symmetrical shape, Pokelike-style: start → 2 → 3 → 4 → 3 → 4 → 3 → 2 → boss, a diamond lattice of stages joined by SMW-style roads that fork and merge evenly.

### Changed
- **Map generation** (game-core `run/map.ts`): a fixed column shape, `MAP_SHAPE = [1, 2, 3, 4, 3, 4, 3, 2, 1]`, for every map of every run. Only what each stage is (battle, shop, event…) is still random.
  - Each column's stages sit on lanes centred on the map's middle line, so the map mirrors top to bottom.
  - Each stage links to the stages one lane up and one lane down in the next column, so every path branches and merges the same way.
  - Any column can have any number of stages, 1 included. `generateWorldMap` takes the shape as an optional argument.
  - An area with a semi-boss still squeezes the middle column into one fortress, joined to its neighbours by nearest lane.
  - The column before the castle is still all Moogles: two of them now.
- **Map layout** (web `run/map/layout.ts`): lattice maps are laid out exactly, with no random wobble or scored routing.
  - Every link runs right from the stage, turns up or down one lane at the middle of the gap, then runs right into the next stage.
  - A stage's two exits fork in the middle of the gap, and two entrances merge there.
  - Walking is unchanged: the party stops at each fork, holding a direction rolls through, you can reverse, and Enter / A goes into a stage.
- Runs already in progress keep their current map (saved maps without the new flag use the old routing). Their next map uses the new shape.

### Verification
- New game-core tests: every map has exactly the shape, centred lanes, and links one lane apart, identical whatever the seed; odd shapes with single-stage columns stay fully connected. 285 pass.
- A headless check of 200 generated maps: no road crosses a stage or its label, the road network mirrors top to bottom, every fork's branches leave in different directions, and the walker reaches every next stage from every stage.

## [0.2.59] - 2026-10-17

### Fixed
- **Optimize gear sat at the very bottom of the party sidebar**, with an empty gap above it: the member list stretched to fill the sidebar's height. The list now takes only the room its cards need (each card still at most 13rem, and shrinking to fit a full party in a short window), so Optimize gear sits right under the last party member.

## [0.2.58] - 2026-10-17

The run's party floats over the game, with a toggle to dock it beside the game as before, and the floating tab bar at the bottom of the map is gone.

### Changed
- **The party sidebar floats over the game's right edge** by default, so the map / stage screen gets the whole frame. The toggle at the top-left of the sidebar (next to the area name) docks it back in its own column beside the game, the previous layout, and toggles it back. Your choice is remembered in this browser.
  - Stage screens (shops, rewards…) leave room on the right for the floating party.
  - The bag opens to the party's left when the party floats over the game, and at the right edge when it's docked.
- **No more Items / Gear / Run tabs floating at the bottom centre of the map.** The bag is a panel with those three tabs in its header (with LB / RB hints and close / B). It opens from the party sidebar's new **Bag** button or X.
- **Party · Bag · Menu buttons** under the party cards replace the hint line, each with its button hint (Y, X, Start). Party opens the first member's sheet; Menu opens the hub's sidebar.
- The map's stage description and walking hint sit at the bottom of the frame (they had room left for the old tabs): the description centred, the hint bottom-left, clear of the floating party.

## [0.2.57] - 2026-10-17

### Fixed
- **The run screen showed a code comment as text** at the top ("// Fills the window with an even 1rem margin…"). v0.2.55 wrapped the run's layout in a fragment, which put a `//` comment inside JSX, where it renders. It's a `{/* */}` comment now. No other `//` comment sits in JSX in the files changed recently.

## [0.2.56] - 2026-10-17

Dev servers get stable HTTPS names through portless instead of port numbers: the web app at **https://ffix.localhost** and the API at **https://api.ffix.localhost**.

### Added
- **[portless](https://portless.sh) 0.15.8** as a pinned root dev dependency (pnpm). It runs each dev server on a free port behind a local HTTPS proxy (HTTP/2, port 443) with its own trusted certificate authority.
- Set up the Turborepo way: each app's `dev` script is now `portless`, and the real command moved to `dev:app` (`vite dev`; `bun ../../scripts/dev-server.ts`). The names are under `"portless"` in each app's `package.json`: `ffix` for the web app; `api.ffix` for the server, with `proxy: true` because portless can't tell a Bun script is a server. `pnpm dev` at the root works as before through turbo. Portless sets `PORT` for both: Bun's server reads it, and Vite gets `--port` / `--host` injected.
- turbo passes `PORTLESS` / `PORTLESS_*` through to `dev`, so `PORTLESS=0 pnpm dev` skips the proxy (web :3001, API :3000).
- README: setup with `pnpm exec portless trust` (once per machine), the new URLs, `portless list` / `doctor` / `proxy stop`, and how to run without it.

### Changed
- Local env (not committed) points at the new names: server `BETTER_AUTH_URL=https://api.ffix.localhost`, `CORS_ORIGIN=https://ffix.localhost`; web `VITE_SERVER_URL=https://api.ffix.localhost`.

### Notes
- portless asks for Node 24+. This machine has Node 22.12: the CLI runs, but `portless doctor` reports Node as unsupported.
- First run: `pnpm exec portless trust` adds the portless CA to Windows' certificate store (Windows asks to confirm), then restart `pnpm dev`.

## [0.2.55] - 2026-10-17

The Phaser screens use Phaser's own input, and they no longer fight the menus for the controls. On a run: Y opens the party, X the bag, LB / RB flip between them, and B hands the controls back to the map.

### Changed
- **The overworld and battles read keyboard and controller through Phaser's own input**: its keyboard plugin and its gamepad plugin (`input.gamepad: true`), not key presses faked from the controller. `SceneInput` (`features/input/scene-input.ts`) turns both into the game's actions. It merges every connected pad (including hat-switch D-pads), repeats held directions for the battle menu's cursor, and ignores presses while typing in a text field.
- **One table of controls** (`features/input/actions.ts`): each action's keys, controller buttons and labels. Phaser screens read it natively; menus still get the controller as key presses (the poller sends each button as its action's key), as before.

  | | Keyboard | Controller |
  |---|---|---|
  | Move | ↑↓←→ / WASD | D-pad / left stick |
  | Confirm | Enter / Space | A |
  | Cancel | Escape / Backspace | B |
  | Bag; in battle, Auto | X | X |
  | Party; in battle, next ready character | C | Y |
  | Previous / next (members, bag tabs; in battle, target side / all) | Q (Tab) / E | LB / RB |
  | Battle speed | V | View |
  | Menu | M | Start |

- **Who has the controls is explicit** (`features/input/owner.ts`). This replaces pausing the menus whenever the map or a battle was mounted.
  - The map or a battle owns them while it's up.
  - Anything opened over it claims them for the menus and hands them back on close: the party sheet, the bag, the hub's menu (Start), and confirmation dialogs.
  - While a game screen has them, the menus' cursor is paused and the controller sends no key presses. While a menu has them, the scene ignores its input.
  - A button held across a hand-off doesn't press anything on the other side, and the press that closes a panel (Enter on ✕, Escape) never reaches the map.
- **Cancel closes what's on top**: Escape / Backspace / B close the open panel or dialog (the character sheet now closes on Escape too), and only go Back when nothing is open.
- The battle menu takes its presses from the battle scene instead of listening to the window.

### Added
- **Y (C) opens the party** on the map and the stage screens: the character sheet of the first member. **LB / RB (Q / E)** flip to the previous / next member (their names are in the sheet's header), and **Y or B** closes it.
- **X opens the bag** (the dock's Items panel). While it's open, **LB / RB** flip between Items, Gear and Run, and **X or B** closes it. The open panel has the cursor.
- **Start opens the hub's menu over the map or a battle** and takes the cursor into it; B or Start again returns to the game. A sidebar that was already out stays out.
- **Battle**: **X** toggles Auto, **View (V)** cycles the speed, **Start (M)** opens the menu.
- **Button hints** (`ButtonHint`): coloured A / B / X / Y rounds and LB / RB / Start / View pills after a controller press, keycaps after a key press. They're on the dock (X, then LB / RB), the bag's close (B), the party sidebar (Party Y · Bag X · Menu Start), the character sheet (LB / RB with the members' names), Auto and speed, the battle menu's side swap (LB) and All (RB), and the map's walking hint.
- **Abandon run** asks in an FF confirmation dialog instead of the browser's `confirm()`, so it works with the cursor.
- Settings → Controller lists the new buttons.

## [0.2.54] - 2026-10-16

### Fixed
- **The controller's A (and Enter / Space) sometimes needed two presses**, e.g. on Continue after a won battle. The cursor lands on the button while it's still disabled (the battle result is saving); the browser can't focus a disabled button, so the first press went to the page. Confirm now presses the control the cursor is on (`cursorTarget`: the browser's focus, else the item the navigation marked), for A, Enter and Space alike, so one press does it.

## [0.2.53] - 2026-10-16

Like Pokelike: a run in progress never blocks you. Camp stays open during a run, and starting another run wipes the current one (after asking).

### Changed
- **Camp is open during a run**: training, gear slots, start levels, support abilities, supplies and the gear catalog all work while a run is going (the API no longer refuses them). A run plays the snapshot of the party taken when it started, so these changes don't touch it; they apply from the next run.
- **A run's end merges onto your characters as they are now**: it adds what the run earned (AP, the higher per ability; FF9's growth pool; the record; Completion Points) and keeps everything set at camp meanwhile (start level, CP spent, training, slots, supports, equipment). Before, it wrote back the snapshot from the run's start, which would have undone camp changes made during it. New game-core test: training, a slot and supports changed mid-run survive the run's end, and its AP is added (283 pass).
- **Starting a run while one is going wipes the old one**: `run.start` takes `replace`; the old run ends as abandoned with nothing folded into the profile (no rewards, CP or gear). Without `replace`, the request is still refused, so a run is never lost by accident.
- **Embark page**:
  - On the journey you're already running: **Continue run** and **New run**.
  - On any other journey: **Begin run**, with a note that it ends the run in progress.
  - Either wipe asks first, in an **FF confirmation dialog** naming the run that will be lost (journey, map, gil).
- The hub's "changes wait until the run ends" notes are gone; the Continue banner says starting another run from Story wipes this one.

### Added
- **`ConfirmDialog`** (`components/confirm-dialog.tsx`): an FF window on shadcn's Dialog for destructive confirmations. The cursor starts on Cancel and stays inside; Escape / Backspace / B cancel.

## [0.2.52] - 2026-10-16

### Changed
- **On the run, the menu button floats inside the game frame's top-left corner**, over the map / battle, instead of needing a 4rem gutter. The run now has an even 1rem margin on all sides. Stage screens leave room at the top so the button doesn't cover their first line. Routes choose where the button sits (`staticData.menuButton`: "corner", the default, or "inset").

## [0.2.51] - 2026-10-16

### Changed
- **The game views have the FF window frame** like everything else: the overworld map / stage screens and battles get the white double border, rounding and drop shadow (`.ff-frame`), over a dark night-blue fill, instead of plain rounded black boxes.

## [0.2.50] - 2026-10-16

### Changed
- **The run's right margin is back to 1rem**: only the left needs 4rem, to clear the menu button.
- **No area banner on the overworld map**: the area, map number and journey are in the party sidebar.

## [0.2.49] - 2026-10-16

### Changed
- **The run uses the full height**: no 2.5rem strip at the top for the menu button (the 4rem side inset already clears it), just an even 1rem margin top and bottom, for the map, stage screens and battles. Routes choose whether the hub leaves that strip (`staticData.topInset`, default on).

## [0.2.48] - 2026-10-16

### Changed
- **The run's frames clear the menu button**: inset 4rem on both sides (the button ends 3.25rem from the left edge), symmetrical left and right; battles too.

## [0.2.47] - 2026-10-16

### Changed
- **The run's frames are inset like the other hub pages**: the map / stage frame and the party sidebar have a 1.5rem margin to the window's left and right edges (was 0.5rem) and a little more room between them; battles get the same margin.

## [0.2.46] - 2026-10-16

### Added
- **`pnpm check-fast`**, set up like ChannelGuide's: every workspace package has a `check-fast` script running **`bun check`** (Bun's built-in TypeScript 7 type checker, on every CPU core); the web app runs `vite build && bun check` (the build regenerates the route tree). A turbo `check-fast` task depends on `^check-fast`, so a dependency's errors invalidate its dependents' cached results. It's named `check-fast`, not `check`, because `bun check` runs a `check` script if one exists, which would recurse. All 9 packages pass in about 12 s (the type checks themselves are well under a second each). `pnpm check-types` (tsc) stays.

## [0.2.45] - 2026-10-16

### Fixed
- `pnpm check-types` failed in game-data: two help-text scripts referenced Node's types, which that package doesn't install. They run under Bun and now reference Bun's types. All 9 packages typecheck; game-core tests: 282 pass, 2 skip.

## [0.2.44] - 2026-10-16

### Fixed
- **The run screen froze the browser** (since v0.2.42): moving it into the hub layout nested its stage screen's cursor section inside the hub's page section, and both were keyed "page". A section with its own key as its parent sent the navigation library round that chain forever. The run's sections have their own keys now ("run-stage", "run-over"); arriving on a stage still puts the cursor on its first item.

## [0.2.43] - 2026-10-16

### Changed
- **The run's party sidebar is on the right**: the map / stage fills the left, next to the hub's own sliding sidebar, and the party sits on the right. The dock's panels (Items, Gear, Run) open beside it at the map's right edge.

## [0.2.42] - 2026-10-16

### Changed
- **The run screen uses the hub layout**: the dimmed title-screen backdrop instead of a black page, the slide-away sidebar (tuck it away for a bigger map) and the menu button. The header bar is gone from runs.
  - The run keeps its own music (each area's theme, the battle and boss themes): routes can declare no music (`staticData.music: null`), and the layout then leaves it alone.
  - The gil / CP chips and round shortcuts stay off the run screen so they don't sit on the map (`staticData.quickLinks: false`).
  - The map, stage screens and battles fill the window under the menu button's strip.
- Route: `/run` moved under the hub's sign-in guard (`_hub/_member/run`).

## [0.2.41] - 2026-10-16

Keyboard and controller navigation, step 3: the run screens, the header bar, practice battle, and dialogs.

### Added
- **Cursor stops throughout a run**:
  - **party sidebar**: Optimize gear, each member's Manage and quick-use items
  - **dock**: Items / Gear / Run tabs, close, use-on-member, Abandon run
  - **every stage screen**: reward picks, treasure, shop and synthesis items (every `ItemCard` is a cursor stop), selling, Moogle, events, Stiltzkin, Chocobo digs, world clear, Leave / Continue
  - the **in-run character sheet** and the **run-over** screen
- **Each stage's screen is the page's cursor section**: arriving on a reward, shop or event puts the cursor on its first item. (The overworld map and battles keep their own controls.)
- **Header bar** links (on runs, battles, Dev, the effects gallery) and the **practice battle**'s controls are cursor stops.
- **Dialogs keep the cursor inside** (the character sheet, `GameDialog`): it starts on the dialog's first item and can't wander to the page behind until the dialog closes.

### Changed
- **→ from the menu button goes into the page**, not across it to the shortcuts on the far right. The shortcuts are reached with → from the content's right edge.

## [0.2.40] - 2026-10-16

The battle menu has FF9's controls on keyboard and controller, with its sounds.

### Added
- **FF9's battle controls** (`battle/command-menu.tsx`):

  | | Keyboard | Controller |
  |---|---|---|
  | Move the cursor | ↑↓←→ or WASD | D-pad / left stick |
  | Confirm | Enter / Space | A |
  | Cancel / back | Escape / Backspace | B |
  | Swap the target side (enemies ⇄ party), FF9's L1 | Tab or Q | LB |
  | All / single targets, FF9's R1 | E | RB |
  | Next ready character, FF9's Triangle | C | Y |

  The "All" and side-swap options show their keys. The controller's shoulder and Y buttons arrive as Q / E / C.

### Fixed
- **The battle menu was silent on keyboard and controller** (its sounds came from mouse clicks). It now plays FF9's menu sounds itself: the tick on moving and confirming, the buzzer on something you can't pick (a disabled option, all / swap on a move that can't), and cancel on backing out.

### Changed
- Settings → Controller lists the battle buttons too.

## [0.2.39] - 2026-10-16

### Changed
- **Settings → Controller** suggests a full browser restart when no controller shows up (Chrome's controller support can get stuck in the background; ⋮ → Exit and reopen), and mentions Steam, which can hide controllers from browsers.

## [0.2.38] - 2026-10-16

### Fixed
- **Controllers didn't navigate, in menus or in the game.** The poller read only the first connected pad, and Windows often lists idle virtual pads (Steam Input, Xbox adapters…) ahead of the real one. It also stopped for good if a pad read as missing for a frame, waiting for a "connected" event that never came again. It now merges the input of every connected controller, keeps polling while any is connected, and restarts when the window regains focus.
- **D-pads on non-standard controllers** (DirectInput / generic pads report the D-pad as one "hat" axis, not buttons 12–15) now move the cursor too.

### Added
- **Settings → Controller**: what the browser reports, live.
  - It says when the page can't use controllers at all (not on localhost / https) or hasn't been shown one yet: browsers only reveal a controller after a button on it is pressed with the page focused.
  - For every connected pad: slot, name, layout, buttons pressed, axis values, and what the game reads from them (move / confirm / back / menu).
  - The browser console logs each controller as it connects.

### Notes
- Mapping: D-pad / left stick move, A (button 0) confirms, B (1) backs out, Start (9) opens the menu. In battles and on the overworld map they arrive as arrow / Enter / Escape key presses, which those screens already handle.

## [0.2.37] - 2026-10-16

### Fixed
- **WASD could land on the edge of the slid-away sidebar**: its links were off the cursor's map, but the sidebar section itself wasn't, so the cursor could land on the empty section. A disabled section is now off the map entirely.

## [0.2.36] - 2026-10-16

### Changed
- **← from the page goes to the menu button first**: from the content's left edge, ← lands on the menu button; ← again goes into the sidebar, only when it's out (a slid-away sidebar's links are off the cursor's map, so ← stops at the menu button). ↑ still reaches the menu button too.

## [0.2.35] - 2026-10-16

### Fixed
- **The menu button couldn't be reached again** (v0.2.34): it floats over the page's content, so for the cursor it was never "above" the content. Moving between the page's parts is now explicit (`FocusSection resolver`, Norigin's `nextFocusResolver`):
  - **↑** from the top of the content goes to the menu button; **↓** comes back.
  - **→** from the content's right edge, or from the menu button, goes to the round shortcuts. **↑/↓** move along them; **↓** past the last one, or **←**, returns to the content.
  - **←** from the content's left edge still reaches the sidebar.
  - Arriving on a page still lands on the content's first item.

## [0.2.34] - 2026-10-16

### Fixed
- **Arriving on a hub page put the cursor on the menu button** (since v0.2.33 the button sits in the page's cursor section, and it came first). The page's content is now its own section, preferred when the page is entered (`FocusSection preferredChild`): the cursor lands on the content's first item, and ↑ from the top still reaches the menu button and the shortcuts.

## [0.2.33] - 2026-10-16

The title screen and the Items page join the hub's sidebar layout, the currency and shortcuts are on every hub page, and the menu has a key.

### Changed
- **The title screen (`/`) and the Items page use the sidebar layout**, so the header bar is only on runs, battles, Dev, the effects gallery and sign-in. The sidebar's **"FFIX Roguelike" wordmark goes home** (the title screen).
  - Routes: the hub layout (`_hub`) is public; the title screen and Items sit in it directly, and the signed-in pages (Play, Story, Party, Shops, Challenges, Achievements, Settings) sit behind its sign-in guard (`_hub/_member`). Signed out, the sidebar shows **Sign in** where the player card goes.
- **The title screen is vertically centred** in the page area, with the backdrop at full strength (no dark strip at the top) and its own music.
- **Gil, CP and the round shortcuts (Items, Achievements, Settings) are on every hub page**, part of the layout, not just the Play hub. Signed in only.
- **Music and backdrop come from the route** (`staticData.music`, `staticData.backdropDim`): the title screen declares its own, and every other hub page is camp music on the dimmed backdrop.

### Added
- **Menu key**: **M**, or the controller's **Start**, opens or closes the sidebar and moves the cursor into it, or back to the page.
- **The menu button and the shortcuts are in the page's cursor section**, so ↑ from the top of any page reaches them (before, the cursor could barely get to the menu button).
- **Keyboard and controller on the title screen** (Play / Sign in, Practice battle) and the **Items page** (kind filters, character filter, search, icon sizes, and every item, with its popover).
- **Escape in a text field or dropdown lets go of it**, so the cursor and arrows take over again.
- Item popovers (Items page, gear catalog) are cursor stops.

### Fixed
- **Going from the title screen to Play didn't change the music**: the title asked for its music and the shell for camp's, and only the first request stuck. The shell now plays the current route's music.

## [0.2.32] - 2026-10-16

### Added
- **The hub's sidebar slides away**, like Pokelike's: a round menu button sits inset on the top-left of the page, always visible, and slides the sidebar out of view and back. The sidebar slides while its column narrows to nothing, so the page widens smoothly. Your choice is remembered in this browser.
  - The button is a cursor stop for the keyboard and controller. While the sidebar is away its links are off the cursor's map, so the cursor can't land on something hidden (`FocusSection disabled`), and the browser treats it as inert.
  - Pages leave a little room at the top for the button; the character page's height accounts for it.

## [0.2.31] - 2026-10-16

### Changed
- **Journey cards are clickable as a whole**, like the Party and Play hub cards, with the same lift on hover and the keyboard / controller cursor. The card is the link to its embark page; "Choose" is now a label on it. Locked journeys stay plain cards.

## [0.2.30] - 2026-10-16

### Fixed
- **Arriving on a page still ticked** (v0.2.29 silenced only the first quarter-second, and the Play hub places the cursor once its data has loaded, later than that). The tick now follows the cause, not a timer: Norigin passes the key event that moved the cursor, so a move made by a key (or the controller) ticks, and a placement by code (arriving on a page, the mouse hovering) has no event and is silent. The first arrow press on a page, which places the cursor, passes its event and ticks.

## [0.2.29] - 2026-10-16

### Fixed
- **Arriving on a page made an extra cursor tick**: the cursor is placed on the new page's first item for you (so the keys carry on), and that counted as a move. Placing it is now silent; moves you make still tick.

## [0.2.28] - 2026-10-16

### Changed
- **Backspace backs out like Escape**: it goes Back (with the cancel sound) when no dialog is open, and closes dialogs. In text fields it still deletes; the battle menu already used it to cancel.

## [0.2.27] - 2026-10-16

### Changed
- **Space works like Enter in every menu**: it presses the focused control, links included (browsers only press buttons with Space, so the hub cards and the sidebar did nothing), once, on release, and never scrolls the page. Text fields keep their spaces; the battle menu and the overworld already treated Space as Enter.

## [0.2.26] - 2026-10-16

Keyboard and controller navigation, step 2: every hub page.

### Added
- **Cursor stops on every hub page** (`FocusItem`):
  - **Story**: each journey's Choose.
  - **Embark**: the "Journeys" back link, the tier choices, the four party slots, Begin run, "continue it", and every roster card.
  - **Party**: every character card.
  - **Character page**: Back, the tabs, the paperdoll's slots (a locked slot shows its "Unlock · n CP" price when the cursor is on it, as on hover), the equipment list, the ability and support cards, the training buttons.
  - **Supplies**: each "+ gil".
  - **Gear catalog**: each Unlock.
  - **Settings**: the avatar buttons, the font choices, battle mode / speed / auto battle, and the volume sliders.
- **Sliders**: ←/→ adjust the volume, ↑/↓ move the cursor on (`FocusItem`'s new `onArrow`; the input layer lets a slider keep ←/→).

### Changed
- The paperdoll's locked slot shows the pixel padlock instead of 🔒.

### Notes
- The roster cards' and gear's hover popovers still open on mouse hover only; opening them for the keyboard cursor is next, with the run screens.

## [0.2.25] - 2026-10-16

Keyboard and controller navigation, step 1: the input layer, the hub's sidebar and the Play hub. The mouse works as before.

### Added
- **Spatial navigation** with **Norigin Spatial Navigation** (`@noriginmedia/norigin-spatial-navigation` 3.3.0) and our input layer (`features/input/nav.ts`):
  - **←↑→↓ / WASD** move the cursor to the nearest control in that direction. The first press on a page lands on its first item. The page doesn't scroll on arrows; the cursor scrolls what it lands on into view.
  - **Enter / Space** press the focused button or link (the browser's own handling, so nothing fires twice).
  - **Escape** backs out (the router's Back) when no dialog is open; dialogs close on their own Escape.
  - **Controller** (Gamepad API): D-pad / left stick move (repeating while held), **A** presses, **B** backs out. They're sent as arrow / Enter / Escape key events with real key codes, so battles, the overworld (Phaser) and the battle menu respond to a controller too.
  - **Mouse and keys mix**: hovering an item moves the cursor there, so the keys carry on from it (not while typing in a text field).
  - The cursor's **yellow ring**, or **FF9's glove** on menu options, shows only while navigating by keys (`<html data-input="keys|pointer">`); keyboard moves play the cursor tick.
- **`FocusItem`** and **`FocusSection`** (`features/input/focus.tsx`): wrap anything the cursor can land on, and groups of them. They wrap their child element (no extra DOM, so grids and subgrids are unaffected), and sections remember their last focused item.
- **Wired**:
  - **sidebar**: wordmark, every link, Legacy camp
  - **Play hub**: the round shortcuts, the Continue banner, every character in the cast line (each with its hover card), the four cards and the two shop cards
  - Each hub page is its own section, so arriving on a page puts the cursor on its first item.

### Changed
- **Screens with their own controls step aside**: while the overworld map or a battle is up, menu navigation is paused (`useNavPause`), so Phaser and the battle menu keep their arrow / WASD / Enter handling. Typing in a text field pauses it too, so WASD types.
- Dialog overlays are marked (`data-modal`), so Escape closes them instead of going Back.

## [0.2.24] - 2026-10-16

The gear catalog is laid out like the supply shop, and the item popover is reusable: the Items page uses it too.

### Changed
- **Gear catalog cards follow the supply shop's layout**: a grid of cards (two or three columns), each with the item's icon in a 64 px tile, its name and kind (Weapon, Head, Arm, Body, Accessory), its stats, FF9's description, who can wear it, and an action at the bottom right: **Unlock · price** (red price when you can't afford it) for what's for sale, a green **Unlocked** badge for what you have. Hovering a card still opens the full item popover.
- **Items page: hover (or Tab to) any item for the same popover** as the gear catalog: name and kind, stats or effect, FF9's description, abilities taught, who can use it, and, signed in, what it would change for each character on your roster. Replaces the click-to-pin card in the corner.

### Added
- **`ItemPopover`** (`features/items/item-popover.tsx`): hover an item element for its full card in an FF popover. Used by the gear catalog and the Items page. `KIND_LABEL` is exported from `run/item-info.tsx`.

## [0.2.23] - 2026-10-16

### Changed
- **Character cards line up across each row** on the Party page and the embark party picker. Each card spans five shared row tracks (CSS subgrid): name, stats, starter gear, gear slots, footer. Matching lines sit at the same height in every card of a row however long each is (e.g. a long starter-gear line), and every card is the same height.
- **Locked characters fill the same five rows**: silhouette and "???", empty stat cells, how to recruit them, "Joins your roster when recruited", and a padlock "Locked" footer, so they're as tall as the rest.
- `CharacterCard` takes `rows` (its lines only, for a subgrid cell); `CARD_GRID` / `CARD_CELL` in `camp/roster.tsx` set up the grid and the cells. The cast line's hover card keeps the stacked layout.

## [0.2.22] - 2026-10-16

Pixel-art icons instead of text characters in the hub, and a compact Cleared badge.

### Added
- **`PixelIcon`** (`components/pixel-icon.tsx`): 16×16 pixel-art glyphs from the Time Fantasy icon pack, drawn crisp at 16 or 32 px. `sprites:ui` now ships `check`, `cross`, `star` (gold), `lock` (gold padlock) and `arrow-up/down/left/right` next to the gloves. They load from the `ui` asset pack (repacked and uploaded).

### Changed
- **No more text glyphs in the hub**: ✓, 🔒, ★, ▸, ◂ and ▶ are pixel icons. Covers the Cleared badge, locked journeys, Choose / Begin run / Continue, the "◂ Journeys" back link, the ★ on characters who can spend CP (cast line, cards, Party card), Manage, Unlocked gear and done challenges.
- **The Cleared badge is compact and never wraps**: icon + "Cleared" on one line. `.ff-chip` doesn't wrap anywhere.

## [0.2.21] - 2026-10-16

### Changed
- **Journey cards show the highest tier cleared** instead of tier toggles: "Highest tier cleared: Normal", or "Not cleared yet". **Choose ▸** opens the embark page, where the tier is picked (Normal first, higher tiers there once open). The rules don't track a tier per journey yet, only that it was cleared, so a cleared journey reads as Normal until they do (`bestTierCleared` in `camp/story.tsx`).
- **The character page sits in the same centred column as the other hub pages** (`max-w-6xl`, same padding) instead of filling the whole width; the sheet fills the height between, with the dimmed title-screen backdrop showing around it.

## [0.2.20] - 2026-10-16

### Fixed
- **The "can't do that" buzzer played when opening Supplies or Gear during a run.** The hub cards were marked `aria-disabled` to show that purchases wait, and the buzzer plays on pressing anything disabled, while the link still went to the page. The cards are plain links again (they still say "During a run: look, but changes wait"); clicking one ticks.
- **The browser's Back made no sound.** v0.2.19 read the history index from the router's location state, which doesn't carry it. The router's own history works out Back / Forward / Go on popstate and announces it; the menu sounds now listen to that. Back (and a mouse's back button, or going back several steps) plays FF9's cancel, the same sound as "◂ Journeys", with the cursor tick held back. Forward plays no cancel.

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
