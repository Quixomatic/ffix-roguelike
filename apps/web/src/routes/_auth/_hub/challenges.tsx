import { createFileRoute } from "@tanstack/react-router";

import { ChallengesPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_auth/_hub/challenges")({
  component: ChallengesPage,
});
