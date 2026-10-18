import { createFileRoute } from "@tanstack/react-router";

import { MetricsAdminPage } from "@/features/admin/metrics-admin";

/** Admin: metrics across players — leaderboards and any player's stats. */
export const Route = createFileRoute("/_hub/_member/admin/metrics")({
  staticData: { breadcrumb: "Metrics" },
  component: MetricsAdminPage,
});
