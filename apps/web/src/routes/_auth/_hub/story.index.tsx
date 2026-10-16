import { createFileRoute } from "@tanstack/react-router";

import { StoryPage } from "@/features/camp/story";

export const Route = createFileRoute("/_auth/_hub/story/")({
  component: StoryPage,
});
