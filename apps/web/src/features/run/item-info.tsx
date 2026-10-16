import type { CharacterBuild } from "@ffix-roguelike/game-core";
import { abilityName, findItem, getCharacter, type ItemData } from "@ffix-roguelike/game-data";

import { PartyGearDeltas } from "@/features/gear/gear-delta";
import { ItemIcon } from "@/features/items/item-icon";

/** One-line stat summary for a piece of gear, e.g. "Atk 18 · Silence" or "Def 4 · Eva 7 · Str+1". */
export function gearSummary(item: ItemData): string {
  const parts: string[] = [];
  if (item.weapon) {
    parts.push(`Atk ${item.weapon.power}`);
    if (item.weapon.elements.length) parts.push(item.weapon.elements.join("/"));
    if (item.weapon.statuses.length) parts.push(item.weapon.statuses.join("/"));
  }
  if (item.armor) {
    const a = item.armor;
    if (a.defence) parts.push(`Def ${a.defence}`);
    if (a.evade) parts.push(`Eva ${a.evade}`);
    if (a.magicDefence) parts.push(`MDef ${a.magicDefence}`);
    if (a.magicEvade) parts.push(`MEva ${a.magicEvade}`);
  }
  const b = item.bonus;
  if (b) {
    if (b.speed) parts.push(`Spd+${b.speed}`);
    if (b.strength) parts.push(`Str+${b.strength}`);
    if (b.magic) parts.push(`Mag+${b.magic}`);
    if (b.spirit) parts.push(`Spr+${b.spirit}`);
    if (b.guardElement.length) parts.push(`Null ${b.guardElement.join("/")}`);
    if (b.absorbElement.length) parts.push(`Absorb ${b.absorbElement.join("/")}`);
    if (b.halfElement.length) parts.push(`Half ${b.halfElement.join("/")}`);
  }
  return parts.join(" · ");
}

/** "gradualPetrify" → "Gradual Petrify". */
export const statusName = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

const TARGET_TEXT: Record<string, string> = {
  singleAlly: "one ally",
  singleEnemy: "one enemy",
  singleAny: "one target",
  manyAlly: "one ally or all allies",
  manyEnemy: "one enemy or all enemies",
  manyAny: "one target or a whole side",
  allAlly: "all allies",
  allEnemy: "all enemies",
  everyone: "everyone",
  self: "yourself",
};

/**
 * What a consumable does, exactly, from the data the battle engine uses (its FF9 battle script, power, statuses,
 * targets) — e.g. "Restores 150 HP · one target", "Cures Silence · one target". Empty for gear.
 */
export function itemEffectText(item: ItemData): string {
  const fx = item.effect;
  if (!fx || item.kind !== "item") return "";
  const st = fx.statuses.map(statusName).join(", ");
  const what: Record<number, string> = {
    62: `Cures ${st || "Petrify"}; crumbles stone monsters`,
    69: `Restores ${15 * fx.power} HP`,
    70: `Restores ${15 * fx.power} MP`,
    71: "Fully restores HP and MP",
    72: "Revives a KO'd ally with a little HP",
    73: `Cures ${st}`,
    74: `Restores ${fx.power} × (number carried + 1) HP`,
    75: `Deals ${fx.power} × (number carried + 1) damage`,
    76: `Restores half of max HP and MP${st ? `; may cause ${st}` : ""}`,
    77: "Deals 9,999 damage",
  };
  const main = what[fx.scriptId] ?? (st ? `Inflicts ${st}` : "");
  const target = TARGET_TEXT[fx.targets];
  return [main, target].filter(Boolean).join(" · ");
}

/** FF9's own help line, with the words FF9 highlights (`{Word}`) in yellow. */
export function HelpText({ text, className = "" }: { text?: string; className?: string }) {
  if (!text) return null;
  const parts = text.split(/(\{[^}]+\})/);
  return (
    <span className={`block ${className}`}>
      {parts.map((p, i) =>
        p.startsWith("{") && p.endsWith("}") ? (
          <span key={i} className="text-yellow-200">
            {p.slice(1, -1)}
          </span>
        ) : (
          p
        ),
      )}
    </span>
  );
}

const KIND_LABEL: Record<string, string> = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory", item: "Item" };

/**
 * A gear/item card: name, stats, abilities taught, who can equip it. With `party`, gear also shows how it would
 * change each party member who can wear it (against what they wear now).
 */
export function ItemCard({
  itemId,
  footer,
  onClick,
  selected,
  party,
}: {
  itemId: number;
  footer?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  party?: CharacterBuild[];
}) {
  if (!findItem(itemId)) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      data-active={selected}
      className="ff-window flex w-full flex-col gap-1 p-3 text-left transition enabled:hover:brightness-125 data-[active=true]:outline data-[active=true]:outline-2 data-[active=true]:outline-yellow-300"
    >
      <ItemDetails itemId={itemId} party={party} />
      {footer}
    </button>
  );
}

/** Everything an item card says about an item (name, kind, effect or stats, FF9's help, abilities, who can use it,
 *  stat changes for the party) — for cards and hover popovers. */
export function ItemDetails({ itemId, party }: { itemId: number; party?: CharacterBuild[] }) {
  const item = findItem(itemId);
  if (!item) return null;
  const who = item.equippableBy.map((k) => getCharacter(k).name);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-lg">
          <ItemIcon itemId={itemId} size={32} />
          {item.name}
        </span>
        <span className="ff-title">{KIND_LABEL[item.kind] ?? item.kind}</span>
      </div>
      {item.kind === "item" ? (
        <div className="text-sm text-[#c8d0ff]">{itemEffectText(item) || "—"}</div>
      ) : (
        <div className="text-sm text-[#c8d0ff]">{gearSummary(item) || "—"}</div>
      )}
      <HelpText text={item.help} className="text-xs opacity-80" />
      {item.abilities.length > 0 && <div className="text-sm text-yellow-200">Teaches: {item.abilities.map(abilityName).join(", ")}</div>}
      {who.length > 0 && who.length < 12 && <div className="text-xs opacity-70">{who.join(", ")}</div>}
      {party && item.kind !== "item" && <PartyGearDeltas party={party} itemId={itemId} />}
    </>
  );
}

export const itemName = (id: number) => findItem(id)?.name ?? `#${id}`;
