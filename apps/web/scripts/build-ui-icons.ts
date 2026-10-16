#!/usr/bin/env bun
/// <reference types="node" />
/**
 * build-ui-icons — UI icons from the Time Fantasy icon pack (`.docs/assets/finalbossblues`, git-ignored; the license
 * allows use but not redistribution, so only the icons used here ship) → `public/sprites/ui/<name>.png` (16×16).
 *
 *   bun scripts/build-ui-icons.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHEET = join(HERE, "..", "..", "..", ".docs", "assets", "finalbossblues", "icons_8.13.20", "fullcolor", "icons_full_16.png");
const OUT = join(HERE, "..", "public", "sprites", "ui");

/** name → [row, column] on the 16-column sheet. */
const ICONS: Record<string, [number, number]> = {
  "hand-down": [5, 3], // battle target cursor: a glove pointing down at the target
  "hand-right": [1, 0], // menu cursor glove
  // Small glyphs (white, row 4) — instead of text characters in the UI (components/pixel-icon.tsx).
  "arrow-up": [4, 0],
  "arrow-down": [4, 1],
  "arrow-right": [4, 2],
  "arrow-left": [4, 3],
  check: [4, 9],
  cross: [4, 10],
  star: [14, 13], // gold
  lock: [2, 6], // gold padlock
};

const sheet = PNG.sync.read(readFileSync(SHEET));
mkdirSync(OUT, { recursive: true });
for (const [name, [row, col]] of Object.entries(ICONS)) {
  const out = new PNG({ width: 16, height: 16 });
  PNG.bitblt(sheet, out, col * 16, row * 16, 16, 16, 0, 0);
  writeFileSync(join(OUT, `${name}.png`), PNG.sync.write(out));
}
console.log(`✓ ${Object.keys(ICONS).length} UI icons → ${OUT}`);
