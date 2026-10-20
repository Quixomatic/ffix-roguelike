#!/usr/bin/env bun
/**
 * import-memoria — convert Memoria's exported FF9 CSV tables into seed data for the ff9_* tables.
 *
 *   pnpm -F @ffix-roguelike/game-data import:memoria [path/to/StreamingAssets/Data]
 *
 * Source defaults to the Steam install (override with the first arg or FF9_DATA_DIR). Output goes to
 * packages/db/seed/ff9/*.json (committed), which the server loads into Postgres — the game never needs the FF9
 * install at runtime.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ELEMENTS,
  STATUSES,
  type AbilityRef,
  type ActionData,
  type ArmorData,
  type CharacterData,
  type CommandData,
  type Element,
  type Equipment,
  type ItemData,
  type ItemEffectData,
  type ItemKind,
  type LevelRow,
  type ShopData,
  type SynthesisRecipe,
  type StatBonus,
  type Status,
  type StatusInfo,
  type SupportAbilityData,
  type TargetType,
  type WeaponData,
} from "../src/types";
import { attachHelp } from "./help-text";

const HERE = dirname(fileURLToPath(import.meta.url));
// Seed data for the ff9_* tables (the server upserts it on startup when it changes).
const OUT = join(HERE, "..", "..", "db", "seed", "ff9");
const DATA =
  process.argv[2] ??
  process.env.FF9_DATA_DIR ??
  "C:/Program Files (x86)/Steam/steamapps/common/FINAL FANTASY IX/StreamingAssets/Data";

if (!existsSync(DATA)) {
  console.error(`FF9 data dir not found: ${DATA}\nPass the Memoria StreamingAssets/Data path as the first argument.`);
  process.exit(1);
}

// ── CSV parsing ──────────────────────────────────────────────────────────────
// Memoria files mix UTF-8 and Windows-1252 bytes line by line, so decode each line separately.
const utf8 = new TextDecoder("utf-8", { fatal: true });
const cp1252 = new TextDecoder("windows-1252");

function decodeLine(bytes: Uint8Array): string {
  try {
    return utf8.decode(bytes);
  } catch {
    return cp1252.decode(bytes);
  }
}

function readLines(rel: string, dir = DATA): string[] {
  const buf = readFileSync(join(dir, rel));
  const lines: string[] = [];
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) {
      lines.push(decodeLine(buf.subarray(start, i)).replace(/\r$/, "").replace(/^\uFEFF/, ""));
      start = i + 1;
    }
  }
  return lines;
}

const tidy = (s: string) => s.replace(/[\u2018\u2019]/g, "'").trim();

/** Data rows (comment lines skipped), each split on `;` with the trailing `# comment` field split off. */
function rows(rel: string, dir = DATA): { cells: string[]; comment: string }[] {
  const out: { cells: string[]; comment: string }[] = [];
  for (const line of readLines(rel, dir)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const cells = line.split(";").map(tidy);
    let comment = "";
    const hashAt = cells.findIndex((c) => c.startsWith("#"));
    if (hashAt >= 0) {
      comment = cells[hashAt]!.replace(/^#\s*/, "");
      cells.length = hashAt;
    }
    out.push({ cells, comment: tidy(comment) });
  }
  return out;
}

const int = (s: string | undefined) => {
  const n = Number.parseInt(s ?? "", 10);
  return Number.isNaN(n) ? 0 : n;
};

function elementsOf(mask: number): Element[] {
  return ELEMENTS.filter((_, i) => mask & (1 << i));
}

/** `Regen(18), Death(8)` → ["regen", "death"]. */
function statusList(s: string): Status[] {
  return [...s.matchAll(/\((\d+)\)/g)].map((m) => STATUSES[int(m[1])]).filter((x): x is Status => !!x);
}

function statusMask(mask: number): Status[] {
  return STATUSES.filter((_, i) => Number((BigInt(mask) >> BigInt(i)) & 1n) === 1);
}

const TARGETS: TargetType[] = [
  "singleAny",
  "singleAlly",
  "singleEnemy",
  "manyAny",
  "manyAlly",
  "manyEnemy",
  "all",
  "allAlly",
  "allEnemy",
  "random",
  "randomAlly",
  "randomEnemy",
  "everyone",
  "self",
  "automatic",
];
/** `ManyAny(3)` or `3` → "manyAny". */
const target = (s: string): TargetType => TARGETS[int(s.match(/\((\d+)\)/)?.[1] ?? s)] ?? "singleAny";

// ── statuses ─────────────────────────────────────────────────────────────────
const statuses: StatusInfo[] = rows("Battle/StatusData.csv")
  .filter((r) => int(r.cells[1]) < STATUSES.length)
  .map((r) => ({
    id: int(r.cells[1]),
    key: STATUSES[int(r.cells[1])]!,
    name: r.cells[0]!,
    tick: int(r.cells[3]),
    duration: int(r.cells[4]),
    clearOnApply: statusList(r.cells[5] ?? ""),
    immunityProvided: statusList(r.cells[6] ?? ""),
  }));

const statusSets = new Map<number, Status[]>();
for (const r of rows("Battle/StatusSets.csv")) statusSets.set(int(r.cells[1]), statusList(r.cells[2] ?? ""));

// ── actions (active abilities, spells, enemy-usable skills) ──────────────────
const toAction = (r: { cells: string[] }, sets: Map<number, Status[]>): ActionData => {
  const c = r.cells;
  return {
    id: int(c[1]),
    name: c[0]!,
    targets: target(c[3]!),
    defaultAlly: c[4] === "1",
    forDead: c[5] === "1",
    scriptId: int(c[10]),
    power: int(c[11]),
    elements: elementsOf(int(c[12])),
    rate: int(c[13]),
    category: int(c[14]),
    statuses: sets.get(int(c[15])) ?? [],
    mp: int(c[16]),
    type: int(c[17]),
    vfx: int(c[8]),
  };
};
const actions: ActionData[] = rows("Battle/Actions.csv").map((r) => toAction(r, statusSets));
const actionById = new Map(actions.map((a) => [a.id, a]));

const supportAbilities: SupportAbilityData[] = rows("Characters/Abilities/AbilityGems.csv").map((r) => ({
  id: int(r.cells[1]),
  name: r.cells[0]!,
  gems: int(r.cells[2]),
}));

// ── leveling ─────────────────────────────────────────────────────────────────
const leveling: LevelRow[] = rows("Characters/Leveling.csv").map((r, i) => ({
  level: i + 1,
  exp: int(r.cells[0]),
  hpBonus: int(r.cells[1]),
  mpBonus: int(r.cells[2]),
}));

// ── items ────────────────────────────────────────────────────────────────────
const armors = new Map<number, ArmorData>();
for (const r of rows("Items/Armors.csv")) {
  armors.set(int(r.cells[1]), {
    defence: int(r.cells[2]),
    evade: int(r.cells[3]),
    magicDefence: int(r.cells[4]),
    magicEvade: int(r.cells[5]),
  });
}

const bonuses = new Map<number, StatBonus>();
for (const r of rows("Items/Stats.csv")) {
  const c = r.cells;
  bonuses.set(int(c[1]), {
    speed: int(c[2]),
    strength: int(c[3]),
    magic: int(c[4]),
    spirit: int(c[5]),
    attackElement: elementsOf(int(c[6])),
    guardElement: elementsOf(int(c[7])),
    absorbElement: elementsOf(int(c[8])),
    halfElement: elementsOf(int(c[9])),
    weakElement: elementsOf(int(c[10])),
  });
}
const isEmptyBonus = (b: StatBonus) =>
  !b.speed &&
  !b.strength &&
  !b.magic &&
  !b.spirit &&
  [b.attackElement, b.guardElement, b.absorbElement, b.halfElement, b.weakElement].every((e) => !e.length);

const weapons = new Map<number, WeaponData>();
for (const r of rows("Items/Weapons.csv")) {
  const c = r.cells;
  const category = int(c[2]);
  weapons.set(int(c[1]), {
    power: int(c[6]),
    scriptId: int(c[5]),
    elements: elementsOf(int(c[7])),
    statuses: statusSets.get(int(c[3])) ?? [],
    statusRate: int(c[8]),
    category,
    longRange: (category & 2) !== 0,
  });
}

const effects = new Map<number, ItemEffectData>();
for (const r of rows("Items/ItemEffects.csv")) {
  const c = r.cells;
  effects.set(int(c[0]), {
    targets: target(c[1]!),
    forDead: c[5] === "1",
    scriptId: int(c[7]),
    power: int(c[8]),
    rate: int(c[9]),
    elements: elementsOf(int(c[10])),
    statuses: statusMask(Number(c[11] ?? 0)),
  });
}

const EQUIP_COLS = ["Zidane", "Vivi", "Garnet", "Steiner", "Freya", "Quina", "Eiko", "Amarant", "Cinna", "Marcus", "Blank", "Beatrix"];
const KIND_COLS: ItemKind[] = ["weapon", "wrist", "head", "armor", "accessory", "item", "gem"];

const items: ItemData[] = [];
for (const r of rows("Items/Items.csv")) {
  const c = r.cells;
  const name = r.comment.replace(/^\d+\s*-\s*/, "");
  if (!name || /^open\b|^none$/i.test(name)) continue;
  const flags = c.slice(11, 18).map((x) => x === "1");
  const kindIdx = flags.findIndex(Boolean);
  if (kindIdx < 0) continue;
  const kind = KIND_COLS[kindIdx]!;
  const bonus = bonuses.get(int(c[9]));
  const abilities = (c[10] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is AbilityRef => /^(AA|SA):\d+$/.test(s));
  items.push({
    id: int(c[0]),
    name,
    kind,
    price: int(c[4]),
    quality: Number.parseFloat(c[8] ?? "0") || 0,
    abilities,
    equippableBy: EQUIP_COLS.filter((_, i) => c[20 + i] === "1").map((n) => n.toLowerCase()),
    bonus: bonus && !isEmptyBonus(bonus) ? bonus : null,
    weapon: kind === "weapon" ? (weapons.get(int(c[1])) ?? null) : null,
    armor: int(c[2]) >= 0 ? (armors.get(int(c[2])) ?? null) : null,
    effect: int(c[3]) >= 0 ? (effects.get(int(c[3])) ?? null) : null,
  });
}

// ── synthesis + shops ────────────────────────────────────────────────────────
const list = (cell: string | undefined) =>
  (cell ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(int);

const synthesis: SynthesisRecipe[] = rows("Items/Synthesis.csv").map((r) => ({
  id: int(r.cells[1]),
  shops: list(r.cells[2]),
  price: int(r.cells[3]),
  result: int(r.cells[4]),
  ingredients: list(r.cells[5]),
}));

const shops: ShopData[] = rows("Items/ShopItems.csv")
  .map((r) => ({ id: int(r.cells[1]), name: r.comment.replace(/^Shop \d+\s*/, "").trim(), items: list(r.cells[2]) }))
  .filter((s) => s.items.length && s.name);

// ── characters ───────────────────────────────────────────────────────────────
const commands = new Map<number, CommandData>();
for (const r of rows("Characters/Commands.csv")) {
  const c = r.cells;
  const list = (c[3] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(int);
  const type = int(c[1]);
  // Type 2 (Item) / 3 (Throw) list item ids, not actions — the battle UI handles those itself.
  const actionIds = type >= 2 ? [] : list.length ? list : int(c[2]) ? [int(c[2])] : [];
  commands.set(int(c[0]), { id: int(c[0]), name: r.comment || `Command ${c[0]}`, actionIds });
}
const commandSets = new Map<number, number[]>();
for (const r of rows("Characters/CommandSets.csv")) commandSets.set(int(r.cells[0]), r.cells.slice(1).map(int));

const defaultEquip = new Map<number, Equipment>();
for (const r of rows("Characters/DefaultEquipment.csv")) {
  const v = (s: string | undefined) => (int(s) >= 0 ? int(s) : null);
  defaultEquip.set(int(r.cells[1]), {
    weapon: v(r.cells[2]),
    head: v(r.cells[3]),
    wrist: v(r.cells[4]),
    armor: v(r.cells[5]),
    accessory: v(r.cells[6]),
  });
}

const params = new Map<number, string[]>();
for (const r of rows("Characters/CharacterParameters.csv")) params.set(int(r.cells[0]), r.cells);

const ABILITY_FILES: Record<string, string> = {
  zidane: "Zidane",
  vivi: "Vivi",
  garnet: "Garnet",
  steiner: "Steiner",
  freya: "Freya",
  quina: "Quina",
  eiko: "Eiko",
  amarant: "Amarant",
  cinna: "Cinna1",
  marcus: "Marcus1",
  blank: "Blank1",
  beatrix: "Beatrix1",
};

const cmd = (id: number | undefined): CommandData => commands.get(id ?? 0) ?? { id: 0, name: "None", actionIds: [] };

const characters: CharacterData[] = rows("Characters/BaseStats.csv").map((r) => {
  const id = int(r.cells[1]);
  const name = r.cells[0]!;
  const key = name.toLowerCase();
  const p = params.get(id) ?? [];
  const set = commandSets.get(int(p[4])) ?? [];
  const abilities = rows(`Characters/Abilities/${ABILITY_FILES[key]}.csv`)
    .map((a) => ({ ref: a.cells[0] as AbilityRef, ap: int(a.cells[1]) }))
    .filter((a) => /^(AA|SA):\d+$/.test(a.ref) && a.ap > 0);
  return {
    id,
    key,
    name,
    base: {
      speed: int(r.cells[2]),
      strength: int(r.cells[3]),
      magic: int(r.cells[4]),
      spirit: int(r.cells[5]),
      gems: int(r.cells[6]),
    },
    backRow: p[1] === "0",
    category: int(p[3]),
    commands: [cmd(set[2]), cmd(set[3])],
    trance: [cmd(set[8]), cmd(set[9])],
    abilities,
    defaultEquipment: defaultEquip.get(int(p[5])) ?? { weapon: null, head: null, wrist: null, armor: null, accessory: null },
  };
});

// ── characters from mods ─────────────────────────────────────────────────────
// Kits for the late joiners FF9 itself leaves as guests, from Memoria mods installed beside the game (their folders
// sit in the FF9 root, next to StreamingAssets):
//   - Kuja: the Playable Character Pack (stats, commands, abilities, default gear; its custom actions).
//   - Beatrix: Alternate Fantasy's ability list (FF9's own actions, so her base Seiken / White Magic commands carry it).
//   - Marcus: neither mod gives him a kit, so ours: Steal plus Steiner's Sword Art, learned from the swords he shares
//     with Steiner (his FF9 data already lets him wear them).
// Custom mod actions are numbered from 10000; the engine reads 2000+ as monster attacks, so they're renumbered to
// 1000+ (MOD_ACTION_BASE). Abilities no item the character can wear teaches are innate (always usable).
const FF9_ROOT = join(DATA, "..", "..");
const PCP = join(FF9_ROOT, "PlayableCharacterPack", "StreamingAssets", "Data");
const AF = join(FF9_ROOT, "AlternateFantasy", "StreamingAssets", "Data");
const MOD_ACTION_BASE = 1000;
const modAction = (id: number) => (id >= 10000 ? MOD_ACTION_BASE + (id - 10000) : id);
const modRef = (ref: string): AbilityRef => {
  const [kind, n] = ref.split(":");
  return `${kind}:${kind === "AA" ? modAction(int(n)) : int(n)}` as AbilityRef;
};
const supportIds = new Set(supportAbilities.map((s) => s.id));
/** A kit's ability list (`AA:n;AP` rows): known actions / supports only, mod actions renumbered. */
const kitAbilities = (rel: string, dir: string) =>
  rows(rel, dir)
    .map((a) => ({ ref: modRef(a.cells[0] ?? ""), ap: int(a.cells[1]) }))
    .filter((a) => /^(AA|SA):\d+$/.test(a.ref) && a.ap > 0)
    .filter((a) => (a.ref.startsWith("SA:") ? supportIds.has(int(a.ref.slice(3))) : true));
/**
 * A mod kit's innate abilities: those none of the items this character can wear teaches, and (as in FF9) any action
 * its commands offer that isn't on its learnable list at all (Kuja's Trance spells: Ultima, Quarter…).
 */
const innateOf = (key: string, abilities: { ref: AbilityRef }[], commandSets: CommandData[]): AbilityRef[] => {
  const taught = new Set(items.filter((i) => i.equippableBy.includes(key)).flatMap((i) => i.abilities));
  const listed = new Set(abilities.map((a) => a.ref));
  const unlisted = commandSets.flatMap((c) => (c.actionIds.length > 1 ? c.actionIds : [])).map((id) => `AA:${id}` as AbilityRef).filter((ref) => !listed.has(ref));
  return [...new Set([...abilities.map((a) => a.ref).filter((ref) => !taught.has(ref)), ...unlisted])];
};

if (existsSync(PCP)) {
  // Kuja wears mage gear (Vivi's and Garnet's: his default kit is Vivi's, and Garnet's gear teaches the summons).
  for (const i of items) if ((i.equippableBy.includes("vivi") || i.equippableBy.includes("garnet")) && !i.equippableBy.includes("kuja")) i.equippableBy.push("kuja");
  const pcpSets = new Map<number, Status[]>();
  for (const r of rows("Battle/StatusSets.csv", PCP)) pcpSets.set(int(r.cells[1]), statusList(r.cells[2] ?? ""));
  const pcpActions = new Map(rows("Battle/Actions.csv", PCP).map((r) => [int(r.cells[1]), r]));
  const pcpCommands = new Map(rows("Characters/Commands.csv", PCP).map((r) => [int(r.cells[0]), r]));
  /** A mod command, its custom actions brought in (renumbered) the first time they're used. */
  const pcpCommand = (id: number): CommandData => {
    const r = pcpCommands.get(id);
    if (!r) return cmd(id);
    const ids = list(r.cells[3]).length ? list(r.cells[3]) : int(r.cells[2]) ? [int(r.cells[2])] : [];
    for (const a of ids) {
      if (a < 10000 || actionById.has(modAction(a))) continue;
      const row = pcpActions.get(a);
      if (!row) continue;
      const action = { ...toAction(row, pcpSets), id: modAction(a) };
      actions.push(action);
      actionById.set(action.id, action);
    }
    // Kuja's Summon is FF9's Summon (Garnet's command 16), so the engine treats it as one.
    const name = r.comment || `Command ${id}`;
    return { id: name === "Summon" ? 16 : id, name, actionIds: ids.map(modAction) };
  };
  const kujaStats = rows("Characters/BaseStats.csv", PCP).find((r) => r.cells[0] === "Kuja");
  const kujaParams = rows("Characters/CharacterParameters.csv", PCP).find((r) => r.cells[0] === "12")?.cells;
  if (kujaStats && kujaParams) {
    const setId = int(kujaParams[4]);
    // The pack's command sets are short: Regular 1; Regular 2; Trance 1; Trance 2.
    const set = rows("Characters/CommandSets.csv", PCP).find((r) => int(r.cells[0]) === setId)?.cells.slice(1).map(int) ?? [];
    const equip = rows("Characters/DefaultEquipment.csv", PCP).find((r) => int(r.cells[1]) === int(kujaParams[5]))?.cells;
    const v = (s: string | undefined) => (int(s) >= 0 ? int(s) : null);
    const abilities = kitAbilities(`Characters/Abilities/${setId}.csv`, PCP);
    const commands: [CommandData, CommandData] = [pcpCommand(set[0]!), pcpCommand(set[1]!)];
    const trance: [CommandData, CommandData] = [pcpCommand(set[2]!), pcpCommand(set[3]!)];
    characters.push({
      id: 12,
      key: "kuja",
      name: "Kuja",
      base: { speed: int(kujaStats.cells[2]), strength: int(kujaStats.cells[3]), magic: int(kujaStats.cells[4]), spirit: int(kujaStats.cells[5]), gems: int(kujaStats.cells[6]) },
      backRow: kujaParams[1] === "0",
      category: int(kujaParams[3]),
      commands,
      trance,
      abilities,
      innate: innateOf("kuja", abilities, [...commands, ...trance]),
      defaultEquipment: equip
        ? { weapon: v(equip[2]), head: v(equip[3]), wrist: v(equip[4]), armor: v(equip[5]), accessory: v(equip[6]) }
        : { weapon: null, head: null, wrist: null, armor: null, accessory: null },
    });
  }
} else console.warn(`! Playable Character Pack not found (${PCP}): Kuja is left out`);

if (existsSync(AF)) {
  const beatrix = characters.find((c) => c.key === "beatrix");
  if (beatrix) {
    beatrix.abilities = kitAbilities("Characters/Abilities/Beatrix1.csv", AF);
    beatrix.innate = innateOf("beatrix", beatrix.abilities, [...beatrix.commands, ...beatrix.trance]);
  }
} else console.warn(`! Alternate Fantasy not found (${AF}): Beatrix keeps FF9's empty ability list`);

// Marcus (ours): Steal + Sword Art, Steiner's arts at Steiner's AP costs, only those a sword Marcus can wear teaches
// (nothing innate: the arts only Steiner's best swords teach stay his).
{
  const marcus = characters.find((c) => c.key === "marcus");
  const steiner = characters.find((c) => c.key === "steiner");
  if (marcus && steiner) {
    const taught = new Set(items.filter((i) => i.equippableBy.includes("marcus")).flatMap((i) => i.abilities));
    const arts = steiner.abilities.filter((a) => a.ref.startsWith("AA:") && taught.has(a.ref) && (steiner.commands.find((c) => c.name === "Swd Art")?.actionIds ?? []).includes(int(a.ref.slice(3))));
    const swordArt: CommandData = { id: 30, name: "Swd Art", actionIds: arts.map((a) => int(a.ref.slice(3))) };
    marcus.commands = [cmd(2), swordArt];
    marcus.trance = [cmd(2), swordArt];
    marcus.abilities = arts;
  }
}

// Sanity: every learnable active ability must exist.
for (const ch of characters) {
  for (const a of ch.abilities) {
    if (a.ref.startsWith("AA:") && !actionById.has(int(a.ref.slice(3)))) console.warn(`! ${ch.name}: unknown ${a.ref}`);
  }
}

// ── write ────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const write = (name: string, data: unknown) => {
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`  ✓ ${name}.json (${Array.isArray(data) ? data.length : 1})`);
};
console.log(`Importing Memoria data from ${DATA}`);
// FF9's own help lines (extract-help-text.py), when extracted.
attachHelp(OUT, { items, actions, supports: supportAbilities });
write("statuses", statuses);
write("actions", actions);
write("support-abilities", supportAbilities);
write("leveling", leveling);
write("items", items);
write("characters", characters);
write("synthesis", synthesis);
write("shops", shops);
