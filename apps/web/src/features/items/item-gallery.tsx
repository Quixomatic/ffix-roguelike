import { rosterAtStart } from "@ffix-roguelike/game-core";
import { getCharacter, items, type ItemData } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

import { ItemIcon } from "./item-icon";
import { ItemPopover } from "./item-popover";

const KINDS = [
  { kind: "all", label: "All" },
  { kind: "weapon", label: "Weapons" },
  { kind: "head", label: "Head" },
  { kind: "wrist", label: "Arm" },
  { kind: "armor", label: "Body" },
  { kind: "accessory", label: "Accessories" },
  { kind: "item", label: "Items" },
] as const;

const CAST = ["zidane", "vivi", "garnet", "steiner", "freya", "quina", "eiko", "amarant", "beatrix", "blank"];

/** Every FF9 item with its icon; hover one for its full card (and, signed in, what it would change for your roster). */
export function ItemGallery() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("all");
  const [who, setWho] = useState("");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(32);
  // Signed in: the hovered item compares against your roster as they start a run.
  const { data: session } = authClient.useSession();
  const profile = useQuery({ ...trpc.profile.get.queryOptions(), enabled: !!session });
  const roster = profile.data ? rosterAtStart(profile.data) : undefined;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i: ItemData) => (kind === "all" || i.kind === kind) && (!who || i.equippableBy.includes(who)) && (!q || i.name.toLowerCase().includes(q)),
    );
  }, [kind, who, query]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4">
      <div className="ff-window flex flex-wrap items-center gap-3 p-3">
        <span className="ff-title text-lg">Items</span>
        <div className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <FocusItem key={k.kind}>
              <button className="ff-window px-2 py-0.5 text-sm data-[on=true]:text-yellow-200" data-on={kind === k.kind} onClick={() => setKind(k.kind)}>
                {k.label}
              </button>
            </FocusItem>
          ))}
        </div>
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
        <div className="flex gap-1 text-sm">
          {[16, 32, 48, 64].map((s) => (
            <FocusItem key={s}>
              <button className="ff-window px-2 py-0.5 data-[on=true]:text-yellow-200" data-on={size === s} onClick={() => setSize(s)}>
                {s}px
              </button>
            </FocusItem>
          ))}
        </div>
        <span className="ml-auto text-sm opacity-70">{shown.length} items</span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size + 40}px, 1fr))` }}>
        {shown.map((i) => (
          <ItemPopover key={i.id} itemId={i.id} party={roster}>
            {/* A button so keyboard focus (Tab) opens the popover too. */}
            <button type="button" data-sound="none" className="ff-window flex flex-col items-center gap-1 p-2 text-center hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300">
              <ItemIcon itemId={i.id} size={size} />
              <span className="w-full truncate text-xs">{i.name}</span>
            </button>
          </ItemPopover>
        ))}
      </div>
    </div>
  );
}
