import type { CharacterBuild } from "@ffix-roguelike/game-core";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ffix-roguelike/ui/components/hover-card";
import type { ReactElement } from "react";

import { ItemDetails } from "@/features/run/item-info";

/**
 * Hover an item to see its full card in an FF popover: name and kind, stats or effect, FF9's description, abilities
 * taught, who can use it, and — given `party` — what it would change for each character. `children` is the element
 * to hover (rendered as is: a tile, a card, a button).
 */
export function ItemPopover({
  itemId,
  party,
  side = "right",
  children,
}: {
  itemId: number;
  party?: CharacterBuild[];
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger delay={250} closeDelay={50} render={children} />
      <HoverCardContent side={side} align="start" sideOffset={8} className="theme-ff ff-panel flex w-80 flex-col gap-1 rounded-md p-3 text-sm">
        <ItemDetails itemId={itemId} party={party} />
      </HoverCardContent>
    </HoverCard>
  );
}
