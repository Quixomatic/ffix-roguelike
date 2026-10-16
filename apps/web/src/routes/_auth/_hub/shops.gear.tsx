import { createFileRoute } from "@tanstack/react-router";

import { ShopPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_auth/_hub/shops/gear")({
  component: () => <ShopPage shop="gear" />,
});
