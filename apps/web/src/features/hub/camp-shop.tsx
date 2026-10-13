import { campShopStock, type Profile } from "@ffix-roguelike/game-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ItemCard } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

/** Camp shop: buy gear for your stash with banked gil, from the FF9 shops of every world you've reached. */
export function CampShop({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const buy = useMutation(
    trpc.profile.buyGear.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
      onError: (e) => toast.error(e.message),
    }),
  );
  const stock = campShopStock(profile);
  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between">
        <div className="ff-title">Shop — {profile.gil} gil banked</div>
        <button className="text-sm opacity-80 hover:opacity-100" onClick={() => setOpen(!open)}>
          {open ? "Hide" : `Browse ${stock.length} items`}
        </button>
      </div>
      <div className="text-xs opacity-70">Gear bought here goes to your stash — equip it into a character's gear slots before a run.</div>
      {open && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((e) => (
            <ItemCard
              key={e.itemId}
              itemId={e.itemId}
              onClick={profile.gil >= e.price && !buy.isPending ? () => buy.mutate({ itemId: e.itemId }) : undefined}
              footer={<div className={`text-right text-sm ${profile.gil >= e.price ? "" : "text-red-300"}`}>{e.price} gil</div>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
