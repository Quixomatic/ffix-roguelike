import { createFileRoute } from "@tanstack/react-router";

import { ShopPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_auth/_hub/shops/supplies")({
  component: () => <ShopPage shop="supplies" />,
});
