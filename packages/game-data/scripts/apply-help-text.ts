#!/usr/bin/env bun
/// <reference types="node" />
/**
 * apply-help-text — add FF9's help lines (`db/seed/ff9/help-text.json`) to the committed seed tables (items,
 * actions, support abilities) without a full re-import. `import:memoria` does the same on every import.
 *
 *   python scripts/extract-help-text.py && bun scripts/apply-help-text.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { attachHelp } from "./help-text";

const SEED = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "seed", "ff9");
const read = (n: string) => JSON.parse(readFileSync(join(SEED, `${n}.json`), "utf8")) as { id: number; help?: string }[];
const items = read("items");
const actions = read("actions");
const supports = read("support-abilities");
if (!attachHelp(SEED, { items, actions, supports })) throw new Error("no help-text.json — run extract-help-text.py first");
for (const [n, rows] of [["items", items], ["actions", actions], ["support-abilities", supports]] as const) writeFileSync(join(SEED, `${n}.json`), `${JSON.stringify(rows, null, 1)}\n`);
console.log(`✓ help on ${items.filter((r) => r.help).length} items, ${actions.filter((r) => r.help).length} abilities, ${supports.filter((r) => r.help).length} support abilities`);
