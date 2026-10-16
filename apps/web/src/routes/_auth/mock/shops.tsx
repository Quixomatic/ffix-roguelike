import { createFileRoute } from "@tanstack/react-router";

import { ShopsPage } from "@/features/mockup/pages";

export const Route = createFileRoute("/_auth/mock/shops")({
  component: ShopsPage,
});
