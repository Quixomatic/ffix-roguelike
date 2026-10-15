import { rosterAtStart } from "@ffix-roguelike/game-core";
import { getCharacter, items, type ItemData } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { ItemCard } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

import { ItemIcon } from "./item-icon";

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

/** Every FF9 item with its icon and stats — a browser for checking art and data (like the practice battle). */
export function ItemGallery() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("all");
  const [who, setWho] = useState("");
  const [query, setQuery] = useState("");
  const [size, setSize] = useState(32);
  const [selected, setSelected] = useState<number | null>(null);
  // Signed in: the selected item compares against your roster as they start a run.
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
            <button key={k.kind} className="ff-window px-2 py-0.5 text-sm data-[on=true]:text-yellow-200" data-on={kind === k.kind} onClick={() => setKind(k.kind)}>
              {k.label}
            </button>
          ))}
        </div>
        <select className="ff-window px-2 py-0.5 text-sm" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Anyone</option>
          {CAST.map((k) => (
            <option key={k} value={k}>
              {getCharacter(k).name}
            </option>
          ))}
        </select>
        <input className="ff-window px-2 py-0.5 text-sm" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-1 text-sm">
          {[16, 32, 48, 64].map((s) => (
            <button key={s} className="ff-window px-2 py-0.5 data-[on=true]:text-yellow-200" data-on={size === s} onClick={() => setSize(s)}>
              {s}px
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm opacity-70">{shown.length} items</span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size + 40}px, 1fr))` }}>
        {shown.map((i) => (
          <button
            key={i.id}
            title={i.name}
            className="ff-window flex flex-col items-center gap-1 p-2 text-center data-[on=true]:outline data-[on=true]:outline-2 data-[on=true]:outline-yellow-300"
            data-on={selected === i.id}
            onClick={() => setSelected(selected === i.id ? null : i.id)}
          >
            <ItemIcon itemId={i.id} size={size} />
            <span className="w-full truncate text-xs">{i.name}</span>
          </button>
        ))}
      </div>

      {selected != null && (
        <div className="fixed bottom-4 right-4 w-80 drop-shadow-lg">
          <ItemCard itemId={selected} party={roster} onClick={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
