#!/usr/bin/env bun
/**
 * disasm — print an FF9 battle script (.eb) as readable text.
 *
 *   bun scripts/disasm.ts <file.eb>       disassemble a raw script file
 *   bun scripts/disasm.ts <SCENE_ID>      disassemble a scene from the local FF9 cache (game-data/.cache/ff9)
 */
import { existsSync, readFileSync } from "node:fs";

import { loadBattleScriptCache } from "@ffix-roguelike/game-data/cache";

import { disassemble } from "../src/battle/ai/disasm";

const target = process.argv[2];
if (!target) {
  console.error("usage: bun scripts/disasm.ts <file.eb | SCENE_ID>");
  process.exit(1);
}
let bytes: Uint8Array;
if (existsSync(target)) bytes = new Uint8Array(readFileSync(target));
else {
  const b64 = loadBattleScriptCache()[target.toUpperCase()];
  if (!b64) throw new Error(`No script for scene ${target} in the FF9 cache`);
  bytes = new Uint8Array(Buffer.from(b64, "base64"));
}
console.log(disassemble(bytes, target));
