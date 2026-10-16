import { effectivePrice, gearCatalog, rosterAtStart, type Profile } from "@ffix-roguelike/game-core";
import { findItem, getCharacter, type ItemData } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PixelIcon } from "@/components/pixel-icon";
import { uiSound } from "@/features/audio/ui-sounds";
import { ItemIcon } from "@/features/items/item-icon";
import { ItemPopover } from "@/features/items/item-popover";
import { gearSummary, HelpText, KIND_LABEL } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

/**
 * The gear catalog, laid out like the supply shop: a grid of cards, each with the item's icon in a square tile, its
 * name and kind, stats, FF9's description and who can wear it, and an action row — "Unlock · price" for what's for sale
 * now, an "Unlocked" badge for what you already have. Hovering a card shows the full item card, with what it would
 * change for each character.
 */
export function GearCatalogGrid({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const unlock = useMutation(
    trpc.profile.unlockGear.mutationOptions({
      onSuccess: () => {
        uiSound("purchase");
        void qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const forSale = gearCatalog(profile);
  const owned = [...new Set(profile.gearUnlocked ?? [])]
    .map((id) => findItem(id))
    .filter((i): i is NonNullable<typeof i> => !!i)
    .sort((a, b) => effectivePrice(a) - effectivePrice(b) || a.name.localeCompare(b.name));
  const roster = rosterAtStart(profile);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm opacity-75">Unlocking gear adds it to future runs' drops, shops and treasure for its world. Reach further worlds to see more.</div>
      <Section title={`For sale (${forSale.length})`}>
        {forSale.map((e) => {
          const item = findItem(e.itemId)!;
          const afford = profile.gil >= e.price;
          return (
            <GearCard key={e.itemId} item={item} roster={roster}>
              <FocusItem>
                <button
                  className="rounded border border-yellow-200/50 px-2.5 py-0.5 text-sm text-yellow-200 enabled:hover:bg-yellow-300/10 disabled:opacity-40"
                  disabled={!afford || unlock.isPending}
                  onClick={() => unlock.mutate({ itemId: e.itemId })}
                  title={`Add ${item.name} to future runs`}
                >
                  Unlock · <span className={afford ? "" : "text-red-300"}>{e.price.toLocaleString()} gil</span>
                </button>
              </FocusItem>
            </GearCard>
          );
        })}
        {!forSale.length && <Empty>Nothing new for sale — reach further worlds.</Empty>}
      </Section>
      <Section title={`Unlocked (${owned.length})`}>
        {owned.map((item) => (
          <GearCard key={item.id} item={item} roster={roster} owned>
            <span className="inline-flex items-center gap-1 rounded border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-sm text-emerald-300">
              <PixelIcon name="check" /> Unlocked
            </span>
          </GearCard>
        ))}
        {!owned.length && <Empty>None yet — unlock some above, win a run, or earn achievements.</Empty>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="ff-title text-base">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full text-sm opacity-60">{children}</div>;
}

/** Who can wear it, short: everyone, or the names. */
function wearers(item: ItemData): string {
  const who = item.equippableBy.map((k) => getCharacter(k).name);
  return who.length >= 12 || !who.length ? "Anyone" : who.join(", ");
}

/** One catalog card (the supply card's layout); the full item card on hover. `children` is the action (bottom right). */
function GearCard({ item, roster, owned, children }: { item: ItemData; roster: ReturnType<typeof rosterAtStart>; owned?: boolean; children: React.ReactNode }) {
  return (
    <ItemPopover itemId={item.id} party={roster}>
      <div className={`grid grid-cols-[4rem_1fr] gap-3 rounded-lg border-2 p-3 ${owned ? "border-emerald-300/25 bg-[#0c1238]/60" : "border-white/15 bg-[#0c1238]/80"}`}>
        <span className={`flex h-16 w-16 items-center justify-center rounded-md border-2 bg-black/40 ${owned ? "border-emerald-300/40" : "border-yellow-200/50"}`}>
          <ItemIcon itemId={item.id} size={48} />
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-lg">{item.name}</span>
            <span className="ff-title shrink-0">{KIND_LABEL[item.kind] ?? item.kind}</span>
          </div>
          <div className="text-xs">
            <span className="block text-[#c8d0ff]">{gearSummary(item) || "—"}</span>
            <HelpText text={item.help} className="line-clamp-2 opacity-70" />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <span className="truncate text-xs opacity-70" title={wearers(item)}>
              {wearers(item)}
            </span>
            <span className="shrink-0">{children}</span>
          </div>
        </div>
      </div>
    </ItemPopover>
  );
}
