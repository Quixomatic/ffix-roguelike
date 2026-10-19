import { createFileRoute } from "@tanstack/react-router";

import { RelicsPage } from "@/features/hub/relics-page";

export const Route = createFileRoute("/_hub/_member/relics")({
  staticData: { breadcrumb: "Relics" },
  component: RelicsPage,
});
