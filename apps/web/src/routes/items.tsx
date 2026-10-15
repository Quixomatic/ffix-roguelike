import { createFileRoute } from "@tanstack/react-router";

import { ItemGallery } from "@/features/items/item-gallery";

export const Route = createFileRoute("/items")({
  staticData: { breadcrumb: "Items" },
  component: ItemGallery,
});
