import { createFileRoute } from "@tanstack/react-router";

import { ShopsPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_auth/_hub/shops")({
  component: ShopsPage,
});
