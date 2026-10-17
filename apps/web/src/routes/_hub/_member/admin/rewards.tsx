import { createFileRoute, redirect } from "@tanstack/react-router";

import { RewardsAdminPage } from "@/features/admin/rewards-admin";
import { isAdminUser } from "@/lib/auth-client";

/** Admin: the reward and gear-availability tables. Admins only (the server checks too). */
export const Route = createFileRoute("/_hub/_member/admin/rewards")({
  staticData: { breadcrumb: "Rewards & gear" },
  beforeLoad: ({ context }) => {
    if (!isAdminUser(context.session.data?.user)) throw redirect({ to: "/play" });
  },
  component: RewardsAdminPage,
});
