import { effectivePrice, gearCatalog, rosterAtStart, type Profile } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ffix-roguelike/ui/components/hover-card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PixelIcon } from "@/components/pixel-icon";
import { uiSound } from "@/features/audio/ui-sounds";
import { ItemIcon } from "@/features/items/item-icon";
import { ItemDetails } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

/**
 * The gear catalog as a grid of icon tiles: what you can unlock now (price; click to unlock), then what's
 * already unlocked. Hovering a tile shows the item's full card — stats, FF9's help, abilities, who can wear it and
 * what it would change for each character.
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
          const afford = profile.gil >= e.price;
          return (
            <Tile key={e.itemId} itemId={e.itemId} roster={roster}>
              <button
                type="button"
                disabled={!afford || unlock.isPending}
                onClick={() => unlock.mutate({ itemId: e.itemId })}
                className="flex w-full flex-col items-center gap-1 rounded border border-white/25 bg-black/25 p-2 text-center transition enabled:hover:border-yellow-300/70 enabled:hover:bg-black/35"
              >
                <ItemIcon itemId={e.itemId} size={40} />
                <span className="line-clamp-2 text-xs leading-tight">{findItem(e.itemId)?.name}</span>
                <span className={`text-xs tabular-nums ${afford ? "text-yellow-200" : "text-red-300"}`}>{e.price.toLocaleString()} gil</span>
              </button>
            </Tile>
          );
        })}
        {!forSale.length && <Empty>Nothing new for sale — reach further worlds.</Empty>}
      </Section>
      <Section title={`Unlocked (${owned.length})`}>
        {owned.map((i) => (
          <Tile key={i.id} itemId={i.id} roster={roster}>
            <div className="flex w-full flex-col items-center gap-1 rounded border border-emerald-300/40 bg-emerald-400/10 p-2 text-center">
              <ItemIcon itemId={i.id} size={40} />
              <span className="line-clamp-2 text-xs leading-tight">{i.name}</span>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <PixelIcon name="check" /> Unlocked
              </span>
            </div>
          </Tile>
        ))}
        {!owned.length && <Empty>None yet — buy some above, win a run, or earn achievements.</Empty>}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="ff-title text-base">{title}</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="col-span-full text-sm opacity-60">{children}</div>;
}

/** A tile with the item's full card on hover. */
function Tile({ itemId, roster, children }: { itemId: number; roster: ReturnType<typeof rosterAtStart>; children: React.ReactElement }) {
  return (
    <HoverCard>
      <HoverCardTrigger delay={200} closeDelay={50} render={children} />
      <HoverCardContent side="right" align="start" sideOffset={8} className="theme-ff ff-panel flex w-80 flex-col gap-1 rounded-md p-3 text-sm">
        <ItemDetails itemId={itemId} party={roster} />
      </HoverCardContent>
    </HoverCard>
  );
}
