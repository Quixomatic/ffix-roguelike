import { createFileRoute } from "@tanstack/react-router";

import { StoryPage } from "@/features/camp/story";

export const Route = createFileRoute("/_hub/_member/story/")({
  component: StoryPage,
});
