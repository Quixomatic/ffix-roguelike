import { campShopStock, campSupplyStock, type Profile } from "@ffix-roguelike/game-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ItemCard } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

type Tab = "gear" | "supplies";

/**
 * Camp shop (banked gil): gear for your stash from the FF9 shops of every world you've reached, and supplies —
 * consumables packed into your next run.
 */
export function CampShop({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab | null>(null);
  const buy = useMutation(
    trpc.profile.buyGear.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
      onError: (e) => toast.error(e.message),
    }),
  );
  const stock = tab === "supplies" ? campSupplyStock(profile) : tab === "gear" ? campShopStock(profile) : [];
  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between">
        <div className="ff-title">Shop — {profile.gil} gil banked</div>
        <div className="flex gap-1 text-sm">
          {(["gear", "supplies"] as Tab[]).map((t) => (
            <button key={t} className="ff-option capitalize" data-active={tab === t} onClick={() => setTab(tab === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs opacity-70">
        {tab === "supplies"
          ? "Supplies are packed into your next run on top of the starter kit, and used up there."
          : "Gear goes to your stash — equip it into a character's gear slots before a run."}
      </div>
      {tab && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((e) => (
            <ItemCard
              key={e.itemId}
              itemId={e.itemId}
              onClick={profile.gil >= e.price && !buy.isPending ? () => buy.mutate({ itemId: e.itemId }) : undefined}
              footer={
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">{profile.stash[e.itemId] ? `own ×${profile.stash[e.itemId]}` : ""}</span>
                  <span className={profile.gil >= e.price ? "" : "text-red-300"}>{e.price} gil</span>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
