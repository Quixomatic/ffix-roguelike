import { createFileRoute } from "@tanstack/react-router";

import { PlayHub } from "@/features/camp/play-hub";

export const Route = createFileRoute("/_auth/_hub/play")({
  component: PlayHub,
});
