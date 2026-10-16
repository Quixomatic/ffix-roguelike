import { createFileRoute } from "@tanstack/react-router";

import { AchievementsPage } from "@/features/hub/achievements-page";

export const Route = createFileRoute("/_hub/_member/achievements")({
  staticData: { breadcrumb: "Achievements" },
  component: AchievementsPage,
});
