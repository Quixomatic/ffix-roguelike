import { gearChange, type CharacterBuild } from "@ffix-roguelike/game-core";
import { abilityName, findItem, type EquipSlot } from "@ffix-roguelike/game-data";

import { useEffect, useState, type ReactNode } from "react";

import { HoverTip } from "@/components/hover-tip";
import { PixelIcon } from "@/components/pixel-icon";
import { DeltaChips } from "@/features/gear/gear-delta";
import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { gearSummary } from "@/features/run/item-info";
import { FocusItem } from "@/features/input/focus";

export interface PaperdollSlot {
  slot: EquipSlot;
  itemId: number | null;
  /** Can't be used (e.g. no gear slots bought yet). */
  locked?: boolean;
  /** Small caption under the tile, e.g. "free" or "found". */
  note?: string;
  noteTone?: "muted" | "warn";
}

export const SLOT_META: Record<EquipSlot, { label: string; glyph: string }> = {
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

export const SLOT_ORDER: EquipSlot[] = ["weapon", "head", "wrist", "armor", "accessory"];

const slotMap = (slots: PaperdollSlot[]) => {
  const by = new Map(slots.map((s) => [s.slot, s]));
  return (slot: EquipSlot): PaperdollSlot => by.get(slot) ?? { slot, itemId: null };
};

/**
 * The WoW-style figure: the hero's sprite with equipment slots around it. Hover a slot for its stats; click it to
 * select it (the sheet shows that slot's gear choices).
 */
export function DollFigure({
  heroKey,
  slots,
  selected,
  onSelect,
  variant,
  unlock,
  cheer = 0,
}: {
  heroKey: string;
  slots: PaperdollSlot[];
  selected: EquipSlot | null;
  onSelect(slot: EquipSlot): void;
  variant?: "blind" | "mini" | null;
  /** Locked slots become "Unlock · cost" buttons (camp): the next slot's CP cost, whether it's affordable, and the action. */
  unlock?: { cost: number | null; affordable: boolean; busy?: boolean; onUnlock(slot: EquipSlot): void };
  /** Bump it to celebrate (something was just unlocked or bought): the victory pose and a hop, for a moment. */
  cheer?: number;
}) {
  const get = slotMap(slots);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!cheer) return;
    setCelebrating(true);
    const t = setTimeout(() => setCelebrating(false), 1800);
    return () => clearTimeout(t);
  }, [cheer]);
  return (
    <div className="mx-auto grid w-full max-w-[22rem] grid-cols-[4.5rem_1fr_4.5rem] grid-rows-[auto_6.75rem_6.75rem_auto] place-items-center gap-x-2 gap-y-2 px-1">
      <div className="col-start-2 row-span-2 row-start-2 flex h-full w-full items-end justify-center rounded-lg bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.18),transparent_70%)]">
        <div className="relative flex flex-col items-center">
          {/* Floats gently; a celebration hops (keyed, so each one restarts it). */}
          <div className="ff-float">
            <div key={celebrating ? `cheer-${cheer}` : "idle"} className={celebrating ? "ff-hop" : ""}>
              <HeroSprite heroKey={heroKey} size={168} variant={variant} anim={celebrating ? "victory" : "idle"} className="relative drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]" />
            </div>
          </div>
          <div className="ff-float-shadow -mt-3 h-3 w-24 rounded-[50%] bg-black/40" />
        </div>
      </div>
      {SLOT_ORDER.map((slot) => (
        <SlotTile key={slot} data={get(slot)} active={selected === slot} onClick={() => onSelect(slot)} className={PLACE[slot]} unlock={unlock} />
      ))}
    </div>
  );
}

/** A square slot around the figure: the item's icon, its slot name under it, stats on hover. */
function SlotTile({
  data,
  active,
  onClick,
  className,
  unlock,
}: {
  data: PaperdollSlot;
  active: boolean;
  onClick(): void;
  className: string;
  unlock?: { cost: number | null; affordable: boolean; busy?: boolean; onUnlock(slot: EquipSlot): void };
}) {
  const meta = SLOT_META[data.slot];
  const item = data.itemId != null ? findItem(data.itemId) : undefined;
  if (data.locked && unlock && unlock.cost != null) {
    const can = unlock.affordable && !unlock.busy;
    return (
      <div className={`group relative flex flex-col items-center gap-0.5 ${className}`}>
        <FocusItem>
          <button
            className={`flex h-16 w-16 flex-col items-center justify-center rounded-md border-2 border-dashed text-2xl transition ${
              can ? "border-yellow-200/50 bg-black/30 hover:border-yellow-300 hover:bg-yellow-300/10" : "border-white/25 bg-black/30 opacity-60"
            }`}
            disabled={!can}
            onClick={() => unlock.onUnlock(data.slot)}
            title={can ? `Unlock the ${meta.label} slot for ${unlock.cost} CP` : `Unlocking needs ${unlock.cost} CP`}
          >
            {/* Hover or the keyboard cursor reveals the price. */}
            <span className="group-hover:hidden group-data-[focused=true]:hidden">
              <PixelIcon name="lock" size={32} />
            </span>
            <span className={`hidden text-xs leading-tight group-hover:block group-data-[focused=true]:block ${can ? "text-yellow-200" : "text-red-300"}`}>
              Unlock
              <br />
              {unlock.cost} CP
            </span>
          </button>
        </FocusItem>
        <span className="ff-title text-[0.7rem]">{meta.label}</span>
      </div>
    );
  }
  const tip = item ? (
    <div className="ff-window p-2 text-sm">
      <div className="text-base">{item.name}</div>
      <div className="text-[#c8d0ff]">{gearSummary(item) || "—"}</div>
      {item.abilities.length > 0 && <div className="text-yellow-200">Teaches: {item.abilities.map(abilityName).join(", ")}</div>}
    </div>
  ) : null;
  return (
    <HoverTip tip={tip} className={`flex flex-col items-center gap-0.5 ${className}`}>
      <FocusItem>
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
      </FocusItem>
      <span className="ff-title text-[0.7rem]">{meta.label}</span>
    </HoverTip>
  );
}

/** What's equipped, one readable row per slot (icon, name, stats, notes); click a row to select that slot. */
export function EquipmentList({ slots, selected, onSelect }: { slots: PaperdollSlot[]; selected: EquipSlot | null; onSelect(slot: EquipSlot): void }) {
  const get = slotMap(slots);
  return (
    <div className="flex flex-col gap-1">
      {SLOT_ORDER.map((slot) => {
        const data = get(slot);
        const meta = SLOT_META[slot];
        const item = data.itemId != null ? findItem(data.itemId) : undefined;
        return (
          <FocusItem key={slot}>
            <button
              className="grid grid-cols-[5rem_2rem_1fr] items-center gap-2 rounded px-2 py-1.5 text-left transition enabled:hover:bg-white/10 disabled:opacity-45 data-[active=true]:bg-white/15 data-[active=true]:outline data-[active=true]:outline-1 data-[active=true]:outline-yellow-300/70"
              data-active={selected === slot}
              disabled={data.locked}
              onClick={() => onSelect(slot)}
            >
              <span className="ff-title">{meta.label}</span>
              <span className="flex justify-center">{item ? <ItemIcon itemId={item.id} size={32} /> : null}</span>
              <span className="min-w-0">
                <span className="block truncate">
                  {item ? item.name : data.locked ? "Locked" : <span className="opacity-60">Empty</span>}
                  {data.note && <span className={`ml-2 text-xs ${data.noteTone === "warn" ? "text-orange-300" : "opacity-60"}`}>{data.note}</span>}
                </span>
                {item && <span className="block truncate text-xs text-[#c8d0ff]">{gearSummary(item) || "—"}</span>}
                {item && item.abilities.length > 0 && <span className="block truncate text-xs text-yellow-200">Teaches: {item.abilities.map(abilityName).join(", ")}</span>}
              </span>
            </button>
          </FocusItem>
        );
      })}
    </div>
  );
}

function PickerDelta({ build, itemId }: { build: CharacterBuild; itemId: number }) {
  const change = gearChange(build, itemId);
  return change ? (
    <span className="mt-0.5 block">
      <DeltaChips change={change} />
    </span>
  ) : null;
}

/** A gear choice card: square icon tile on the left, details on the right (shared by the picker's items and Remove). */
function GearCard({ icon, children, onClick, tone = "item" }: { icon: ReactNode; children: ReactNode; onClick(): void; tone?: "item" | "remove" }) {
  return (
    <FocusItem>
      <button
        className={`group grid min-h-[5.5rem] grid-cols-[4rem_1fr] items-start gap-3 rounded-lg border-2 p-2 text-left transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 ${
          tone === "remove" ? "border-red-400/30 bg-black/30 hover:border-red-300/70" : "border-white/15 bg-[#0c1238]/80 hover:border-yellow-300/70"
        }`}
        onClick={onClick}
      >
        <span className={`flex h-16 w-16 items-center justify-center rounded-md border-2 ${tone === "remove" ? "border-red-400/40 bg-black/40" : "border-yellow-200/50 bg-black/40 group-hover:border-yellow-300"}`}>
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-1">{children}</span>
      </button>
    </FocusItem>
  );
}

/** "No item" symbol for the Remove card: the empty slot, crossed out. */
function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9 text-red-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

/**
 * Gear choices for the selected slot: a grid of cards — the item's icon in a square tile, then its name, stats and
 * (with `compare`) what equipping it would change. "Remove" is a card of the same size.
 */
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
    <div className="flex flex-col gap-2 rounded bg-black/25 p-3">
      <div className="ff-title">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {onRemove && (
          <GearCard icon={<RemoveIcon />} onClick={onRemove} tone="remove">
            <span className="text-base text-red-200">Remove</span>
            <span className="text-xs opacity-70">Leave this slot empty</span>
          </GearCard>
        )}
        {options.map((o) => {
          const item = findItem(o.itemId)!;
          return (
            <GearCard key={o.key} icon={<ItemIcon itemId={item.id} size={48} />} onClick={() => onPick(o.key)}>
              <span className="truncate text-base">
                {item.name} <span className="text-sm">{o.caption}</span>
              </span>
              <span className="text-xs text-[#c8d0ff]">{gearSummary(item) || "—"}</span>
              {compare ? <PickerDelta build={compare} itemId={item.id} /> : item.abilities.length > 0 && <span className="text-xs text-yellow-200">Teaches: {item.abilities.map(abilityName).join(", ")}</span>}
            </GearCard>
          );
        })}
      </div>
      {!options.length && <div className="text-sm opacity-60">{empty}</div>}
    </div>
  );
}
