import { rosterAtStart, type Profile } from "@ffix-roguelike/game-core";
import { getCharacter, items, type ItemData } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PixelIcon } from "@/components/pixel-icon";
import { FocusItem } from "@/features/input/focus";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import { ItemIcon } from "./item-icon";
import { ItemPopover } from "./item-popover";
import { itemStatus, type ItemStatus } from "./item-status";

const KINDS = [
  { kind: "all", label: "All" },
  { kind: "weapon", label: "Weapons" },
  { kind: "head", label: "Head" },
  { kind: "wrist", label: "Arm" },
  { kind: "armor", label: "Body" },
  { kind: "accessory", label: "Accessories" },
  { kind: "item", label: "Items" },
] as const;

const SHOWING = [
  { id: "all", label: "Everything" },
  { id: "open", label: "In my runs" },
  { id: "locked", label: "Locked" },
] as const;

const CAST = ["zidane", "vivi", "garnet", "steiner", "freya", "quina", "eiko", "amarant", "beatrix", "blank"];
const SIZES = [32, 48, 64, 96];
const SIZE_KEY = "ffix-items-size";

/** The tile's corner badge: how it turns up, or how to unlock it. */
const BADGE: Record<ItemStatus["kind"], { text: string; className: string } | null> = {
  consumable: null,
  pool: null,
  starter: { text: "Start", className: "bg-sky-900/80 text-sky-100" },
  unlocked: { text: "✓", className: "bg-emerald-800/90 text-emerald-100" },
  catalog: { text: "Catalog", className: "bg-black/70 text-yellow-200" },
  legendary: { text: "★", className: "bg-black/70 text-yellow-300" },
  nowhere: null,
};

/**
 * Every FF9 item with its icon, and — signed in — whether it can turn up in your runs: gear that drops in an area's map
 * pool, starting gear and gear you've unlocked show normally; catalog-only and legendary gear you haven't unlocked yet
 * are dark silhouettes with a padlock, saying how to get them. Hover (or move the cursor onto) one for its full card.
 */
export function ItemGallery() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("all");
  const [showing, setShowing] = useState<(typeof SHOWING)[number]["id"]>("all");
  const [who, setWho] = useState("");
  const [query, setQuery] = useState("");
  const [size, setSizeState] = useState(() => {
    try {
      return Number(localStorage.getItem(SIZE_KEY)) || 64;
    } catch {
      return 64;
    }
  });
  const setSize = (s: number) => {
    setSizeState(s);
    try {
      localStorage.setItem(SIZE_KEY, String(s));
    } catch {
      /* not remembered */
    }
  };
  // Signed in: unlock state, and the hovered item compares against your roster as they start a run.
  const { data: session } = authClient.useSession();
  const profile = useQuery({ ...trpc.profile.get.queryOptions(), enabled: !!session });
  const p = (profile.data ?? null) as Profile | null;
  const roster = p ? rosterAtStart(p) : undefined;

  const statuses = useMemo(() => new Map(items.map((i) => [i.id, itemStatus(i, p)])), [p]);
  const ofKind = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i: ItemData) => (kind === "all" || i.kind === kind) && (!who || i.equippableBy.includes(who)) && (!q || i.name.toLowerCase().includes(q)));
  }, [kind, who, query]);
  const shown = ofKind.filter((i) => showing === "all" || statuses.get(i.id)!.open === (showing === "open"));
  const open = ofKind.filter((i) => statuses.get(i.id)!.open).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3 p-4">
      <div className="ff-window flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="ff-display text-2xl">Items</span>
          <span className="text-sm opacity-80">
            {session ? (
              <>
                <span className="text-yellow-200">{open}</span> of {ofKind.length} can turn up in your runs
              </>
            ) : (
              `${ofKind.length} items · sign in to see what you've unlocked`
            )}
          </span>
          <div className="ml-auto flex gap-1 text-sm">
            {SIZES.map((s) => (
              <FocusItem key={s}>
                <button className="ff-window px-2 py-0.5 data-[on=true]:text-yellow-200" data-on={size === s} onClick={() => setSize(s)}>
                  {s}px
                </button>
              </FocusItem>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {KINDS.map((k) => (
              <FocusItem key={k.kind}>
                <button className="ff-window px-2 py-0.5 text-sm data-[on=true]:text-yellow-200" data-on={kind === k.kind} onClick={() => setKind(k.kind)}>
                  {k.label}
                </button>
              </FocusItem>
            ))}
          </div>
          {session && (
            <div className="flex gap-1">
              {SHOWING.map((s) => (
                <FocusItem key={s.id}>
                  <button className="ff-window px-2 py-0.5 text-sm data-[on=true]:text-yellow-200" data-on={showing === s.id} onClick={() => setShowing(s.id)}>
                    {s.label}
                  </button>
                </FocusItem>
              ))}
            </div>
          )}
          <FocusItem>
            <select className="ff-window px-2 py-0.5 text-sm" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Anyone</option>
              {CAST.map((k) => (
                <option key={k} value={k}>
                  {getCharacter(k).name}
                </option>
              ))}
            </select>
          </FocusItem>
          <FocusItem>
            <input className="ff-window px-2 py-0.5 text-sm" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </FocusItem>
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(88, size + 32)}px, 1fr))` }}>
        {shown.map((i) => {
          const st = statuses.get(i.id)!;
          // Signed out, nothing reads as locked: unlocks are per player.
          const locked = !!session && !st.open;
          const badge = session ? BADGE[st.kind] : null;
          return (
            <ItemPopover
              key={i.id}
              itemId={i.id}
              party={roster}
              extra={
                session ? (
                  <div className={`flex items-center gap-1.5 text-xs ${st.open ? "text-emerald-200" : "text-orange-200"}`}>
                    {!st.open && <PixelIcon name="lock" size={16} />}
                    {st.label}
                  </div>
                ) : undefined
              }
            >
              <button
                type="button"
                data-sound="none"
                className={`ff-window relative flex flex-col items-center gap-1 p-2 text-center hover:brightness-125 ${locked ? "opacity-80" : ""}`}
              >
                <span className={`flex items-center justify-center ${locked ? "[filter:brightness(0)_drop-shadow(0_0_1px_rgba(255,255,255,0.35))] opacity-70" : ""}`} style={{ width: size, height: size }}>
                  <ItemIcon itemId={i.id} size={size} />
                </span>
                {locked && <PixelIcon name="lock" size={16} className="absolute right-1.5 top-1.5" />}
                {badge && !locked && <span className={`absolute right-1 top-1 rounded px-1 text-[0.6rem] ${badge.className}`}>{badge.text}</span>}
                {badge && locked && <span className={`absolute left-1 top-1 rounded px-1 text-[0.6rem] ${badge.className}`}>{badge.text}</span>}
                <span className={`w-full truncate text-xs ${locked ? "opacity-60" : ""}`}>{i.name}</span>
              </button>
            </ItemPopover>
          );
        })}
      </div>
      {!shown.length && <div className="ff-window p-4 text-center opacity-70">Nothing matches.</div>}
    </div>
  );
}
