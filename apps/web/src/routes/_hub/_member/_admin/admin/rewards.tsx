import { createFileRoute } from "@tanstack/react-router";

import { RewardsAdminPage } from "@/features/admin/rewards-admin";

/** Admin: the reward and gear-availability tables. */
export const Route = createFileRoute("/_hub/_member/_admin/admin/rewards")({
  staticData: { breadcrumb: "Rewards & gear" },
  component: RewardsAdminPage,
});
