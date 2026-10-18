/**
 * Inspector: each character's gear, slot by slot, in order of strength — the raw material for planning starting-gear
 * upgrade chains (`.plans/starter-upgrades.md`). A permanent tool.
 *
 * For every character (or the ones named) and every slot it prints the FF9 starting piece, then every piece they can
 * wear in that slot, weakest first (weapons by attack power, armour by defence + magic defence + evades, accessories by
 * price), each with:
 *   - its FF9 price and stats (power / def·eva·mdef·meva, stat bonuses, elements)
 *   - the abilities it teaches (★ = this character can learn it)
 *   - how it shows up in runs: the first area whose map pool has it (journey order), catalog price + tier, legendary,
 *     disabled — from the `gear_availability` table
 *   - the synthesis recipe that makes it, if any
 *
 * READ-ONLY. Run from apps/server: bun scripts/probe-gear-lines.ts [character …] [--slot weapon|head|wrist|armor|accessory]
 */
import "varlock/auto-load";

import { effectivePrice, isGear, JOURNEYS, WORLDS } from "@ffix-roguelike/game-core";
import { abilityName, characters, gearAvailability, items, synthesis, type EquipSlot, type ItemData } from "@ffix-roguelike/game-data";

import { ensureFf9Content, ensureRewardContent } from "../../../packages/api/src/services/content";
import { db } from "../src/services";

const c = {
  h: (s: string) => `\n\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  y: (s: string) => `\x1b[33m${s}\x1b[0m`,
  g: (s: string) => `\x1b[32m${s}\x1b[0m`,
};
const SLOTS: EquipSlot[] = ["weapon", "head", "wrist", "armor", "accessory"];

const args = process.argv.slice(2);
const slotArg = args.includes("--slot") ? (args[args.indexOf("--slot") + 1] as EquipSlot) : null;
const names = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--slot").map((a) => a.toLowerCase());

await ensureFf9Content(db);
await ensureRewardContent(db);

// Journey order of the areas (story first, then side journeys), for "first drops in".
const areaOrder = [...new Set(JOURNEYS.flatMap((j) => j.areas))];
const areaName = (id: string) => WORLDS.find((w) => w.id === id)?.name ?? id;
const made = new Map(synthesis.map((r) => [r.result, r]));
const itemName = (id: number) => items.find((x) => x.id === id)?.name ?? `#${id}`;

const strength = (i: ItemData) =>
  i.weapon ? i.weapon.power : i.armor ? i.armor.defence + i.armor.magicDefence + (i.armor.evade + i.armor.magicEvade) / 2 : effectivePrice(i);

function stats(i: ItemData): string {
  const parts: string[] = [];
  if (i.weapon) parts.push(`pow ${i.weapon.power}`);
  if (i.armor) parts.push(`def ${i.armor.defence}/${i.armor.evade} mdef ${i.armor.magicDefence}/${i.armor.magicEvade}`);
  const b = i.bonus;
  if (b) {
    for (const [k, v] of [
      ["spd", b.speed],
      ["str", b.strength],
      ["mag", b.magic],
      ["spr", b.spirit],
    ] as const)
      if (v) parts.push(`${k}+${v}`);
    if (b.attackElement.length) parts.push(`atk:${b.attackElement.join("/")}`);
    if (b.absorbElement.length) parts.push(`absorb:${b.absorbElement.join("/")}`);
    if (b.guardElement.length) parts.push(`null:${b.guardElement.join("/")}`);
    if (b.halfElement.length) parts.push(`half:${b.halfElement.join("/")}`);
  }
  if (i.weapon?.statuses.length) parts.push(`adds ${i.weapon.statuses.join("/")}`);
  return parts.join(" ");
}

function source(i: ItemData): string {
  const a = gearAvailability(i.id);
  if (!a) return "not in table";
  if (!a.enabled) return "disabled";
  if (a.legendary) return c.y("legendary");
  const pools = a.mapPools.map((p) => p.area).sort((x, y) => areaOrder.indexOf(x) - areaOrder.indexOf(y));
  const out: string[] = [];
  if (pools.length) out.push(`drops from ${areaName(pools[0]!)}${pools.length > 1 ? ` (+${pools.length - 1})` : ""}`);
  if (a.catalog && a.catalogPrice != null) out.push(`catalog ${a.catalogPrice} t${a.catalogFromTier}`);
  return out.join(" · ") || "nowhere";
}

for (const ch of characters) {
  if (names.length && !names.some((n) => ch.key.startsWith(n) || ch.name.toLowerCase().startsWith(n))) continue;
  const learnable = new Set(ch.abilities.map((a) => a.ref));
  console.log(c.h(`══ ${ch.name} (${ch.key}) ══`));
  for (const slot of SLOTS) {
    if (slotArg && slot !== slotArg) continue;
    const starter = ch.defaultEquipment[slot];
    const list = items
      .filter((i) => isGear(i) && i.kind === slot && i.equippableBy.includes(ch.key))
      .sort((a, b) => strength(a) - strength(b) || effectivePrice(a) - effectivePrice(b));
    console.log(c.h(`  ${slot} — starter: ${starter != null ? itemName(starter) : "none"} · ${list.length} pieces`));
    for (const i of list) {
      const teaches = i.abilities.map((r) => (learnable.has(r) ? c.g(`★${abilityName(r)}`) : c.dim(abilityName(r)))).join(", ");
      const r = made.get(i.id);
      const mark = i.id === starter ? c.y("▶") : " ";
      console.log(
        `  ${mark} ${i.name.padEnd(18)} ${String(effectivePrice(i)).padStart(6)}g  ${stats(i).padEnd(34)} ${source(i)}${teaches ? `  ${teaches}` : ""}${r ? c.dim(`  [synth: ${r.ingredients.map(itemName).join("+")}]`) : ""}`,
      );
    }
  }
}

await db.$disconnect();
