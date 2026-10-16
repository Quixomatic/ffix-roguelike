import { campSupplyCatalog, gearCatalog, rosterAtStart, starterKit, supplyRank, supplyRankCost, type Profile } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { GameDialog } from "@/components/game-dialog";
import { ItemIcon } from "@/features/items/item-icon";
import { uiSound } from "@/features/audio/ui-sounds";
import { HelpText, ItemCard, itemEffectText } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

export type Shop = "supplies" | "catalog";

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
        <ShopButton shop="supplies" title="Supplies" hint="Start every run with more Potions, Phoenix Downs…" onClick={() => setOpen("supplies")} />
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
  return (
    <GameDialog title={shop === "supplies" ? "Supplies" : "Gear catalog"} headerRight={<span className="text-lg">{profile.gil} gil</span>} onClose={onClose}>
      <ShopContents shop={shop} profile={profile} />
    </GameDialog>
  );
}

/** A camp shop's contents (what its dialog shows): the supply ranks, or the gear catalog — usable on a page too. */
export function ShopContents({ shop, profile }: { shop: Shop; profile: Profile }) {
  const qc = useQueryClient();
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  // FF9's shop purchase chime when a buy goes through.
  const purchase = { ...opts, onSuccess: () => (uiSound("purchase"), opts.onSuccess()) };
  const buyRank = useMutation(trpc.profile.buySupplyRank.mutationOptions(purchase));
  const unlock = useMutation(trpc.profile.unlockGear.mutationOptions(purchase));
  const stock = shop === "supplies" ? [] : gearCatalog(profile);
  const busy = buyRank.isPending || unlock.isPending;
  // Gear unlocks compare against how each character starts a run.
  const roster = rosterAtStart(profile);
  return (
    <>
      <div className="mb-3 text-sm opacity-75">
        {shop === "catalog"
          ? "Unlocking gear adds it to future runs' drops, shops and treasure for its world. Reach further worlds to see more."
          : "Each rank adds one more of that item to what every run starts with. Story clears and other achievements unlock more supplies."}
      </div>
      {shop === "supplies" ? (
        <SupplyRows profile={profile} busy={busy} onBuy={(itemId) => buyRank.mutate({ itemId })} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((e) => (
            <ItemCard
              key={e.itemId}
              itemId={e.itemId}
              party={roster}
              onClick={profile.gil >= e.price && !busy ? () => unlock.mutate({ itemId: e.itemId }) : undefined}
              footer={
                <div className="flex justify-between text-sm">
                  <span className="opacity-70">Unlock</span>
                  <span className={profile.gil >= e.price ? "" : "text-red-300"}>{e.price} gil</span>
                </div>
              }
            />
          ))}
          {!stock.length && <div className="text-sm opacity-60">Nothing here yet — reach further worlds.</div>}
        </div>
      )}
    </>
  );
}

/**
 * Supply ranks as a grid of cards: the item's icon tile, how many every run starts with, its effect, its rank boxes,
 * and "+ gil" for the next rank (each costs far more than the item does in a run).
 */
function SupplyRows({ profile, busy, onBuy }: { profile: Profile; busy: boolean; onBuy(itemId: number): void }) {
  const kit = new Map(starterKit().map((k) => [k.itemId, k.count]));
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {campSupplyCatalog(profile).map((e) => {
        const item = findItem(e.itemId)!;
        const rank = supplyRank(profile, e.itemId);
        const cost = supplyRankCost(profile, e.itemId);
        const base = kit.get(e.itemId) ?? 0;
        const canBuy = cost != null && profile.gil >= cost && !busy;
        if (!e.unlocked)
          return (
            <div key={e.itemId} className="grid grid-cols-[4rem_1fr] gap-3 rounded-lg border-2 border-dashed border-white/15 bg-black/30 p-3 opacity-70">
              <span className="flex h-16 w-16 items-center justify-center rounded-md border-2 border-white/20 bg-black/40 grayscale">
                <ItemIcon itemId={e.itemId} size={48} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-lg">{item.name}</span>
                <span className="text-xs text-[#c8d0ff]">{itemEffectText(item)}</span>
                <span className="mt-auto text-sm">
                  🔒 Unlock: <span className="text-yellow-200">{e.unlockedBy?.name ?? "—"}</span>
                  {e.unlockedBy && <span className="opacity-70"> — {e.unlockedBy.description}</span>}
                </span>
              </div>
            </div>
          );
        return (
          <div key={e.itemId} className="grid grid-cols-[4rem_1fr] gap-3 rounded-lg border-2 border-white/15 bg-[#0c1238]/80 p-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-md border-2 border-yellow-200/50 bg-black/40">
              <ItemIcon itemId={e.itemId} size={48} />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-lg">{item.name}</span>
                <span className="shrink-0 text-sm tabular-nums" title={`Every run starts with ${base + rank}`}>
                  <span className="text-xl text-yellow-200">×{base + rank}</span> <span className="opacity-70">per run</span>
                </span>
              </div>
              <div className="text-xs">
                <span className="block text-[#c8d0ff]">{itemEffectText(item)}</span>
                <HelpText text={item.help} className="opacity-70" />
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="flex items-center gap-[3px]" title={`${rank} of ${e.max} extra`}>
                  {Array.from({ length: e.max }, (_, i) => (
                    <span key={i} className={`h-4 w-2.5 rounded-[2px] border ${i < rank ? "border-yellow-200 bg-yellow-300" : "border-white/25 bg-black/30"}`} />
                  ))}
                  <span className="ml-1.5 text-xs tabular-nums opacity-70">
                    {rank}/{e.max}
                  </span>
                </span>
                <button
                  className="rounded border border-yellow-200/50 px-2.5 py-0.5 text-sm text-yellow-200 enabled:hover:bg-yellow-300/10 disabled:opacity-40"
                  disabled={!canBuy}
                  onClick={() => onBuy(e.itemId)}
                  title={cost == null ? "Maxed" : `One more ${item.name} in every run`}
                >
                  {cost == null ? "Max" : <span className={profile.gil >= cost ? "" : "text-red-300"}>+ {cost.toLocaleString()} gil</span>}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
