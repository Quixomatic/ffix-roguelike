import { createFileRoute } from "@tanstack/react-router";

import { StatsPage } from "@/features/hub/stats-page";

export const Route = createFileRoute("/_hub/_member/stats")({
  staticData: { breadcrumb: "Stats" },
  component: StatsPage,
});
