#!/usr/bin/env bun
/**
 * Name FF9's sound effects from where Memoria's source plays them. FF9's sound table (SoundEffectMetaData.txt) has no
 * descriptive names, but Memoria (the open-source FF9 engine, cloned into .refs/memoria) plays them by number:
 * `FF9Sfx.FF9SFX_Play(103)` in the menus, `SoundLib.PlaySoundEffect(…)`, `FF9Snd.ff9snd_sndeffect_play(…)`. Each call
 * with a literal number says what the sound is for: the file (AbilityUI = the ability menu) and the method around it
 * (OnKeyConfirm, OnItemUse…).
 *
 * Writes .docs/assets/FF9/se/names.json (index → every place it's played) and copies each identified sound from the
 * dump (`python scripts/list-ff9-sfx.py --dump` first) to .docs/assets/FF9/se/all/0-identified/<index>_<where>.ogg,
 * so they can be auditioned by name. Prints the list.
 *
 * Usage (from apps/web): bun scripts/name-ff9-sfx.ts
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const MEMORIA = join(ROOT, ".refs", "memoria");
const SE = join(ROOT, ".docs", "assets", "FF9", "se");
const DUMP = join(SE, "all");
const OUT = join(DUMP, "0-identified");

if (!existsSync(MEMORIA)) {
  console.error("✗ .refs/memoria is missing: git clone --depth 1 https://github.com/Albeoris/Memoria.git .refs/memoria");
  process.exit(1);
}

/** Calls that play a sound effect by number (the first argument). */
const CALL = /\b(FF9Sfx\.FF9SFX_Play\w*|SoundLib\.PlaySoundEffect|SoundLib\.PlaySfxSound|FF9Snd\.ff9snd_sndeffect_play)\(\s*(\d+)\b/g;
/** A C# method signature line (the enclosing method of a call). */
const METHOD = /^\s*(?:(?:public|private|protected|internal|static|override|virtual|unsafe|async)\s+)+[\w<>[\],.? ]+\s+(\w+)\s*\(/;

interface Use {
  file: string;
  line: number;
  method: string;
  code: string;
}
const uses = new Map<number, Use[]>();

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== ".git") walk(p);
    } else if (name.endsWith(".cs")) scan(p);
  }
}

function scan(path: string) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  let method = "";
  lines.forEach((text, i) => {
    const m = METHOD.exec(text);
    if (m) method = m[1]!;
    for (const c of text.matchAll(CALL)) {
      const index = Number(c[2]);
      const list = uses.get(index) ?? [];
      list.push({ file: relative(MEMORIA, path).replaceAll("\\", "/"), line: i + 1, method, code: text.trim() });
      uses.set(index, list);
    }
  });
}

walk(MEMORIA);

/** A short label for a sound: the files and methods that play it ("AbilityUI.OnKeyConfirm+3"). */
function label(list: Use[]): string {
  const places = [...new Set(list.map((u) => `${u.file.split("/").pop()!.replace(/\.cs$/, "")}.${u.method || "?"}`))];
  return places.length > 1 ? `${places[0]}+${places.length - 1}` : places[0]!;
}

const sorted = [...uses.entries()].sort(([a], [b]) => a - b);
writeFileSync(join(SE, "names.json"), `${JSON.stringify(Object.fromEntries(sorted.map(([i, l]) => [i, { label: label(l), uses: l }])), null, 1)}\n`);

// Copy each identified sound out of the dump, named by where it's played.
const dumped = new Map<number, string>();
const find = (dir: string) => {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "0-identified") find(p);
    } else if (/^\d{5}_/.test(name)) dumped.set(Number(name.slice(0, 5)), p);
  }
};
find(DUMP);
mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const [index, list] of sorted) {
  const src = dumped.get(index);
  console.log(`${String(index).padStart(5)}  ${String(list.length).padStart(3)}×  ${label(list)}${src ? "" : "  (not in the dump)"}`);
  if (!src) continue;
  copyFileSync(src, join(OUT, `${String(index).padStart(5, "0")}_${label(list).replace(/[^\w.+-]/g, "_")}.ogg`));
  copied++;
}
console.log(`\n${sorted.length} sounds played by number in Memoria's source; ${copied} copied to ${OUT}`);
console.log(`names.json: ${join(SE, "names.json")}`);
