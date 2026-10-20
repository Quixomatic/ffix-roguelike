import { createFileRoute } from "@tanstack/react-router";

import { ProfilePage } from "@/features/hub/profile-page";

export const Route = createFileRoute("/_hub/_member/profile")({
  staticData: { breadcrumb: "Profile" },
  component: ProfilePage,
});
