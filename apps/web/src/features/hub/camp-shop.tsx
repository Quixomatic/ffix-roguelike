import { campSupplyStock, gearCatalog, rosterAtStart, type Profile } from "@ffix-roguelike/game-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { GameDialog } from "@/components/game-dialog";
import { ItemIcon } from "@/features/items/item-icon";
import { ItemCard } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

type Shop = "supplies" | "catalog";

/** Potion and a Mythril Sword: the big buttons' icons. */
const SHOP_ICON: Record<Shop, number> = { supplies: 236, catalog: 22 };

/**
 * The camp's two shops (banked gil), as two big buttons that each open a dialog. Supplies are consumables packed into
 * your next run; the gear catalog *unlocks* gear into future runs' drop pools (loot, shops and treasure for its world).
 */
export function CampShops({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState<Shop | null>(null);
  const unlocked = (profile.gearUnlocked ?? []).length;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <ShopButton shop="supplies" title="Supplies" hint="Potions, Phoenix Downs… packed into your next run" onClick={() => setOpen("supplies")} />
        <ShopButton shop="catalog" title="Gear catalog" hint={`Unlock gear into future runs · ${unlocked} unlocked so far`} onClick={() => setOpen("catalog")} />
      </div>
      {open && <ShopDialog shop={open} profile={profile} onClose={() => setOpen(null)} />}
    </>
  );
}

function ShopButton({ shop, title, hint, onClick }: { shop: Shop; title: string; hint: string; onClick(): void }) {
  return (
    <button className="ff-window flex items-center gap-4 p-4 text-left transition hover:brightness-125" onClick={onClick}>
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border-2 border-yellow-200/50 bg-black/40">
        <ItemIcon itemId={SHOP_ICON[shop]} size={48} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="ff-display text-2xl">{title}</span>
        <span className="text-sm opacity-75">{hint}</span>
      </span>
    </button>
  );
}

function ShopDialog({ shop, profile, onClose }: { shop: Shop; profile: Profile; onClose(): void }) {
  const qc = useQueryClient();
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const buySupply = useMutation(trpc.profile.buySupply.mutationOptions(opts));
  const unlock = useMutation(trpc.profile.unlockGear.mutationOptions(opts));
  const stock = shop === "supplies" ? campSupplyStock(profile) : gearCatalog(profile);
  const busy = buySupply.isPending || unlock.isPending;
  // Gear unlocks compare against how each character starts a run.
  const roster = rosterAtStart(profile);
  return (
    <GameDialog title={shop === "supplies" ? "Supplies" : "Gear catalog"} headerRight={<span className="text-lg">{profile.gil} gil</span>} onClose={onClose}>
      <div className="mb-3 text-sm opacity-75">
        {shop === "catalog"
          ? "Unlocking gear adds it to future runs' drops, shops and treasure for its world. Reach further worlds to see more."
          : "Supplies are packed into your next run on top of the starter kit, and used up there."}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stock.map((e) => (
          <ItemCard
            key={e.itemId}
            itemId={e.itemId}
            party={shop === "catalog" ? roster : undefined}
            onClick={profile.gil >= e.price && !busy ? () => (shop === "supplies" ? buySupply.mutate({ itemId: e.itemId }) : unlock.mutate({ itemId: e.itemId })) : undefined}
            footer={
              <div className="flex justify-between text-sm">
                <span className="opacity-70">{shop === "supplies" && profile.stash[e.itemId] ? `packed ×${profile.stash[e.itemId]}` : shop === "catalog" ? "Unlock" : ""}</span>
                <span className={profile.gil >= e.price ? "" : "text-red-300"}>{e.price} gil</span>
              </div>
            }
          />
        ))}
        {!stock.length && <div className="text-sm opacity-60">Nothing here yet — reach further worlds.</div>}
      </div>
    </GameDialog>
  );
}
