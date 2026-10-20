import { createFileRoute } from "@tanstack/react-router";

import { ItemGallery } from "@/features/items/item-gallery";

/** The Items page, signed in only (behind the hub's member guard). */
export const Route = createFileRoute("/_hub/_member/items")({
  staticData: { breadcrumb: "Items" },
  component: ItemGallery,
});
