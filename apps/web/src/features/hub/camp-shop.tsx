import { campSupplyStock, gearCatalog, type Profile } from "@ffix-roguelike/game-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ItemCard } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

type Tab = "supplies" | "catalog";

/**
 * Camp shop (banked gil). Supplies are consumables packed into your next run. The gear catalog *unlocks* gear
 * into future runs' drop pools — it can then show up as loot, in shops and in treasure for its world.
 */
export function CampShop({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab | null>(null);
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const buySupply = useMutation(trpc.profile.buySupply.mutationOptions(opts));
  const unlock = useMutation(trpc.profile.unlockGear.mutationOptions(opts));
  const stock = tab === "supplies" ? campSupplyStock(profile) : tab === "catalog" ? gearCatalog(profile) : [];
  const busy = buySupply.isPending || unlock.isPending;
  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between">
        <div className="ff-title">Shop — {profile.gil} gil banked</div>
        <div className="flex gap-1 text-sm">
          <button className="ff-option" data-active={tab === "supplies"} onClick={() => setTab(tab === "supplies" ? null : "supplies")}>
            Supplies
          </button>
          <button className="ff-option" data-active={tab === "catalog"} onClick={() => setTab(tab === "catalog" ? null : "catalog")}>
            Gear catalog
          </button>
        </div>
      </div>
      <div className="text-xs opacity-70">
        {tab === "catalog"
          ? "Unlocking gear adds it to future runs' drops, shops and treasure for its world. Reach further worlds to see more."
          : tab === "supplies"
            ? "Supplies are packed into your next run on top of the starter kit, and used up there."
            : `${(profile.gearUnlocked ?? []).length} pieces of gear unlocked so far.`}
      </div>
      {tab && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((e) => (
            <ItemCard
              key={e.itemId}
              itemId={e.itemId}
              onClick={
                profile.gil >= e.price && !busy
                  ? () => (tab === "supplies" ? buySupply.mutate({ itemId: e.itemId }) : unlock.mutate({ itemId: e.itemId }))
                  : undefined
              }
              footer={
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">{tab === "supplies" && profile.stash[e.itemId] ? `packed ×${profile.stash[e.itemId]}` : tab === "catalog" ? "Unlock" : ""}</span>
                  <span className={profile.gil >= e.price ? "" : "text-red-300"}>{e.price} gil</span>
                </div>
              }
            />
          ))}
          {!stock.length && <div className="text-sm opacity-60">Nothing here yet — reach further worlds.</div>}
        </div>
      )}
    </div>
  );
}
