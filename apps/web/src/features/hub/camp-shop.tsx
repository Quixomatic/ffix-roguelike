import { campSupplyStock, gearCatalog, rosterAtStart, starterKit, SUPPLY_MAX, supplyRank, supplyRankCost, type Profile } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { GameDialog } from "@/components/game-dialog";
import { ItemIcon } from "@/features/items/item-icon";
import { TrainRow } from "@/features/gear/character-panels";
import { HelpText, ItemCard, itemEffectText } from "@/features/run/item-info";
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
  const qc = useQueryClient();
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const buyRank = useMutation(trpc.profile.buySupplyRank.mutationOptions(opts));
  const unlock = useMutation(trpc.profile.unlockGear.mutationOptions(opts));
  const stock = shop === "supplies" ? campSupplyStock(profile) : gearCatalog(profile);
  const busy = buyRank.isPending || unlock.isPending;
  // Gear unlocks compare against how each character starts a run.
  const roster = rosterAtStart(profile);
  return (
    <GameDialog title={shop === "supplies" ? "Supplies" : "Gear catalog"} headerRight={<span className="text-lg">{profile.gil} gil</span>} onClose={onClose}>
      <div className="mb-3 text-sm opacity-75">
        {shop === "catalog"
          ? "Unlocking gear adds it to future runs' drops, shops and treasure for its world. Reach further worlds to see more."
          : `Each rank adds one more of that item to what every run starts with (up to ${SUPPLY_MAX} extra). Reach further worlds to stock more.`}
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
    </GameDialog>
  );
}

/**
 * Supply ranks, like training: per item, its rank boxes, how many every run starts with, and "+ gil" for the next
 * rank (each costs far more than the item does in a run).
 */
function SupplyRows({ profile, busy, onBuy }: { profile: Profile; busy: boolean; onBuy(itemId: number): void }) {
  const kit = new Map(starterKit().map((k) => [k.itemId, k.count]));
  return (
    <div className="flex flex-col gap-3">
      {campSupplyStock(profile).map((e) => {
        const item = findItem(e.itemId)!;
        const rank = supplyRank(profile, e.itemId);
        const cost = supplyRankCost(profile, e.itemId);
        const base = kit.get(e.itemId) ?? 0;
        return (
          <div key={e.itemId} className="rounded border border-white/10 bg-black/25 p-2">
            <TrainRow
              label={
                <span className="flex items-center gap-2 normal-case">
                  <ItemIcon itemId={e.itemId} size={32} />
                  <span className="text-base">{item.name}</span>
                </span>
              }
              labelWidth="12rem"
              hint={itemEffectText(item)}
              rank={rank}
              max={SUPPLY_MAX}
              value={<span title={`Every run starts with ${base + rank}`}>×{base + rank}</span>}
              cost={cost ?? 0}
              canBuy={cost != null && profile.gil >= cost && !busy}
              onBuy={() => onBuy(e.itemId)}
              unit="gil"
            />
            <div className="mt-1 pl-[2.75rem] text-xs">
              <span className="text-[#c8d0ff]">{itemEffectText(item)}</span>
              <HelpText text={item.help} className="opacity-70" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
