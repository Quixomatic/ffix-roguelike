import { abilityName, findItem, type EquipSlot } from "@ffix-roguelike/game-data";

import type { ReactNode } from "react";

import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { gearSummary } from "@/features/run/item-info";

export interface PaperdollSlot {
  slot: EquipSlot;
  itemId: number | null;
  /** Can't be used (e.g. no gear slots bought yet). */
  locked?: boolean;
  /** Small caption under the tile, e.g. "free" or "found". */
  note?: string;
  noteTone?: "muted" | "warn";
}

const SLOT_META: Record<EquipSlot, { label: string; glyph: string }> = {
  head: { label: "Head", glyph: "⛑" },
  armor: { label: "Body", glyph: "🛡" },
  wrist: { label: "Arm", glyph: "✋" },
  weapon: { label: "Weapon", glyph: "⚔" },
  accessory: { label: "Accessory", glyph: "💍" },
};

const LEFT: EquipSlot[] = ["head", "armor", "wrist"];
const RIGHT: EquipSlot[] = ["weapon", "accessory"];

/**
 * WoW-style character panel: the sprite in the middle, equipment tiles around it. Hover a tile for its stats;
 * click to pick gear for that slot (the picker renders below via `picker`).
 */
export function Paperdoll({
  heroKey,
  name,
  subtitle,
  slots,
  selected,
  onSelect,
  picker,
  footer,
}: {
  heroKey: string;
  name: string;
  subtitle?: ReactNode;
  slots: PaperdollSlot[];
  selected: EquipSlot | null;
  onSelect(slot: EquipSlot | null): void;
  picker?: ReactNode;
  footer?: ReactNode;
}) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const tile = (slot: EquipSlot) => {
    const s = bySlot.get(slot) ?? { slot, itemId: null };
    return <SlotTile key={slot} data={s} active={selected === slot} onClick={() => onSelect(selected === slot ? null : slot)} />;
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-end gap-3">{LEFT.map(tile)}</div>
        <div className="flex flex-col items-center gap-2">
          <div className="relative flex h-56 w-44 items-end justify-center rounded-lg bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.18),transparent_70%)]">
            <div className="absolute bottom-3 h-3 w-24 rounded-[50%] bg-black/40" />
            <HeroSprite heroKey={heroKey} size={192} className="relative drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]" />
          </div>
          <div className="text-center">
            <div className="text-xl">{name}</div>
            {subtitle && <div className="ff-title">{subtitle}</div>}
          </div>
        </div>
        <div className="flex flex-col items-start gap-3">
          {RIGHT.map(tile)}
          {footer}
        </div>
      </div>
      {selected && picker}
    </div>
  );
}

function SlotTile({ data, active, onClick }: { data: PaperdollSlot; active: boolean; onClick(): void }) {
  const meta = SLOT_META[data.slot];
  const item = data.itemId != null ? findItem(data.itemId) : undefined;
  return (
    <div className="group relative">
      <button
        className="ff-window flex w-48 items-center gap-2 p-1.5 text-left transition enabled:hover:brightness-125 disabled:opacity-45 data-[active=true]:outline data-[active=true]:outline-2 data-[active=true]:outline-yellow-300"
        data-active={active}
        disabled={data.locked}
        onClick={onClick}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded border text-2xl ${
            item ? "border-yellow-200/60 bg-[#0c1238]" : "border-white/20 bg-black/30 opacity-60"
          }`}
        >
          {data.locked ? "🔒" : item ? <ItemIcon itemId={item.id} size={32} /> : meta.glyph}
        </span>
        <span className="min-w-0">
          <span className="ff-title block text-[0.7rem]">{meta.label}</span>
          <span className="block truncate text-sm">{item ? item.name : data.locked ? "Locked" : "Empty"}</span>
          {data.note && <span className={`block text-[0.65rem] ${data.noteTone === "warn" ? "text-orange-300" : "opacity-60"}`}>{data.note}</span>}
        </span>
      </button>
      {item && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-60 -translate-x-1/2 group-hover:block">
          <div className="ff-window p-2 text-sm">
            <div className="text-base">{item.name}</div>
            <div className="text-[#c8d0ff]">{gearSummary(item) || "—"}</div>
            {item.abilities.length > 0 && <div className="text-yellow-200">Teaches: {item.abilities.map(abilityName).join(", ")}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/** A list of gear choices for the selected slot (shared picker look). */
export function GearPicker({
  title,
  options,
  onPick,
  onRemove,
  empty,
}: {
  title: string;
  options: { key: string | number; itemId: number; caption?: ReactNode }[];
  onPick(key: string | number): void;
  onRemove?: () => void;
  empty: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded bg-black/25 p-2">
      <div className="ff-title">{title}</div>
      <div className="grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2">
        {onRemove && (
          <button className="ff-option text-left" onClick={onRemove}>
            (Remove)
          </button>
        )}
        {options.map((o) => {
          const item = findItem(o.itemId)!;
          return (
            <button key={o.key} className="ff-option text-left" onClick={() => onPick(o.key)}>
              <div className="flex items-center gap-1.5">
                <ItemIcon itemId={item.id} size={16} />
                {item.name} {o.caption}
              </div>
              <div className="text-xs text-[#c8d0ff]">{gearSummary(item)}</div>
              {item.abilities.length > 0 && <div className="text-xs text-yellow-200">{item.abilities.map(abilityName).join(", ")}</div>}
            </button>
          );
        })}
      </div>
      {!options.length && <div className="text-sm opacity-60">{empty}</div>}
    </div>
  );
}
