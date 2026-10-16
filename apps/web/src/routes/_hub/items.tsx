import { createFileRoute } from "@tanstack/react-router";

import { ItemGallery } from "@/features/items/item-gallery";

export const Route = createFileRoute("/_hub/items")({
  staticData: { breadcrumb: "Items" },
  component: ItemGallery,
});
