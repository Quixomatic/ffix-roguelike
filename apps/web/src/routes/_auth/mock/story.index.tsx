import { createFileRoute } from "@tanstack/react-router";

import { StoryPage } from "@/features/mockup/story";

export const Route = createFileRoute("/_auth/mock/story/")({
  component: StoryPage,
});
