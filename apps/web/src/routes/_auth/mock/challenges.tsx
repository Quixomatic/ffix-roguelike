import { createFileRoute } from "@tanstack/react-router";

import { ChallengesPage } from "@/features/mockup/pages";

export const Route = createFileRoute("/_auth/mock/challenges")({
  component: ChallengesPage,
});
