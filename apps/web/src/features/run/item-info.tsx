import { abilityName, findItem, getCharacter, type ItemData } from "@ffix-roguelike/game-data";

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

const KIND_LABEL: Record<string, string> = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory", item: "Item" };

export function ItemCard({ itemId, footer, onClick, selected }: { itemId: number; footer?: React.ReactNode; onClick?: () => void; selected?: boolean }) {
  const item = findItem(itemId);
  if (!item) return null;
  const who = item.equippableBy.map((k) => getCharacter(k).name);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      data-active={selected}
      className="ff-window flex w-full flex-col gap-1 p-3 text-left transition enabled:hover:brightness-125 data-[active=true]:outline data-[active=true]:outline-2 data-[active=true]:outline-yellow-300"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-lg">
          <ItemIcon itemId={itemId} size={32} />
          {item.name}
        </span>
        <span className="ff-title">{KIND_LABEL[item.kind] ?? item.kind}</span>
      </div>
      <div className="text-sm text-[#c8d0ff]">{gearSummary(item) || "—"}</div>
      {item.abilities.length > 0 && <div className="text-sm text-yellow-200">Teaches: {item.abilities.map(abilityName).join(", ")}</div>}
      {who.length > 0 && who.length < 12 && <div className="text-xs opacity-70">{who.join(", ")}</div>}
      {footer}
    </button>
  );
}

export const itemName = (id: number) => findItem(id)?.name ?? `#${id}`;
