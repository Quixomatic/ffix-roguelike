import { gearChange, type CharacterBuild } from "@ffix-roguelike/game-core";
import { abilityName, findItem, type EquipSlot } from "@ffix-roguelike/game-data";

import type { ReactNode } from "react";

import { DeltaChips } from "@/features/gear/gear-delta";
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

/** Where each slot sits around the figure (WoW-style): head above, body/arm left, weapon right, accessory at the feet. */
const PLACE: Record<EquipSlot, string> = {
  head: "col-start-2 row-start-1",
  armor: "col-start-1 row-start-2",
  wrist: "col-start-1 row-start-3",
  weapon: "col-start-3 row-start-2 row-span-2",
  accessory: "col-start-2 row-start-4",
};

const ORDER: EquipSlot[] = ["weapon", "head", "wrist", "armor", "accessory"];

/**
 * WoW-style character panel: the sprite in the middle with its equipment slots around it, and a readable list of
 * what's equipped below. Hover a slot for its stats; click a slot (or a list row) to pick gear for it — the picker
 * renders below via `picker`.
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
  const get = (slot: EquipSlot) => bySlot.get(slot) ?? { slot, itemId: null };
  const toggle = (slot: EquipSlot) => onSelect(selected === slot ? null : slot);
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <div className="ff-display text-2xl">{name}</div>
        {subtitle && <div className="ff-title">{subtitle}</div>}
      </div>

      <div className="mx-auto grid grid-cols-[4.5rem_11rem_4.5rem] grid-rows-[auto_5rem_5rem_auto] place-items-center gap-x-2 gap-y-1">
        <div className="col-start-2 row-span-2 row-start-2 flex h-full w-full items-end justify-center rounded-lg bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.18),transparent_70%)]">
          <div className="relative flex flex-col items-center">
            <HeroSprite heroKey={heroKey} size={160} className="relative drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]" />
            <div className="-mt-3 h-3 w-24 rounded-[50%] bg-black/40" />
          </div>
        </div>
        {ORDER.map((slot) => (
          <SlotTile key={slot} data={get(slot)} active={selected === slot} onClick={() => toggle(slot)} className={PLACE[slot]} />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {ORDER.map((slot) => (
          <EquipRow key={slot} data={get(slot)} active={selected === slot} onClick={() => toggle(slot)} />
        ))}
      </div>
      {footer}
      {selected && picker}
    </div>
  );
}

/** A square slot around the figure: the item's icon, its slot name under it, stats on hover. */
function SlotTile({ data, active, onClick, className }: { data: PaperdollSlot; active: boolean; onClick(): void; className: string }) {
  const meta = SLOT_META[data.slot];
  const item = data.itemId != null ? findItem(data.itemId) : undefined;
  return (
    <div className={`group relative flex flex-col items-center gap-0.5 ${className}`}>
      <button
        className={`flex h-16 w-16 items-center justify-center rounded-md border-2 text-2xl transition enabled:hover:brightness-125 disabled:opacity-45 data-[active=true]:border-yellow-300 data-[active=true]:shadow-[0_0_8px_rgba(255,224,102,0.7)] ${
          item ? "border-yellow-200/60 bg-[#0c1238]" : "border-white/25 bg-black/30"
        }`}
        data-active={active}
        disabled={data.locked}
        onClick={onClick}
        title={item ? undefined : meta.label}
      >
        {data.locked ? "🔒" : item ? <ItemIcon itemId={item.id} size={48} /> : <span className="opacity-50">{meta.glyph}</span>}
      </button>
      <span className="ff-title text-[0.7rem]">{meta.label}</span>
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

/** One line of the equipment list: slot, icon, name, stats, note. */
function EquipRow({ data, active, onClick }: { data: PaperdollSlot; active: boolean; onClick(): void }) {
  const meta = SLOT_META[data.slot];
  const item = data.itemId != null ? findItem(data.itemId) : undefined;
  return (
    <button
      className="grid grid-cols-[4.5rem_1.25rem_1fr] items-center gap-2 rounded px-2 py-1 text-left text-sm transition enabled:hover:bg-white/10 disabled:opacity-45 data-[active=true]:bg-white/15"
      data-active={active}
      disabled={data.locked}
      onClick={onClick}
    >
      <span className="ff-title">{meta.label}</span>
      <span className="flex justify-center">{item ? <ItemIcon itemId={item.id} size={16} /> : null}</span>
      <span className="min-w-0">
        <span className="block truncate">
          {item ? item.name : data.locked ? "Locked" : <span className="opacity-60">Empty</span>}
          {data.note && <span className={`ml-2 text-xs ${data.noteTone === "warn" ? "text-orange-300" : "opacity-60"}`}>{data.note}</span>}
        </span>
        {item && <span className="block truncate text-xs text-[#c8d0ff]">{gearSummary(item) || "—"}</span>}
      </span>
    </button>
  );
}

function PickerDelta({ build, itemId }: { build: CharacterBuild; itemId: number }) {
  const change = gearChange(build, itemId);
  return change ? (
    <div className="mt-0.5">
      <DeltaChips change={change} />
    </div>
  ) : null;
}

/** A list of gear choices for the selected slot (shared picker look). With `compare`, each shows its stat changes. */
export function GearPicker({
  title,
  options,
  onPick,
  onRemove,
  empty,
  compare,
}: {
  title: string;
  options: { key: string | number; itemId: number; caption?: ReactNode }[];
  onPick(key: string | number): void;
  onRemove?: () => void;
  empty: ReactNode;
  compare?: CharacterBuild;
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
              {compare ? (
                <PickerDelta build={compare} itemId={item.id} />
              ) : (
                item.abilities.length > 0 && <div className="text-xs text-yellow-200">{item.abilities.map(abilityName).join(", ")}</div>
              )}
            </button>
          );
        })}
      </div>
      {!options.length && <div className="text-sm opacity-60">{empty}</div>}
    </div>
  );
}
