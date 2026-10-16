import { createFileRoute } from "@tanstack/react-router";

import { PlayHub } from "@/features/camp/play-hub";

export const Route = createFileRoute("/_hub/_member/play")({
  component: PlayHub,
});
