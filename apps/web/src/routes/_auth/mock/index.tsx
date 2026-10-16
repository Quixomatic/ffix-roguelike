import { createFileRoute } from "@tanstack/react-router";

import { PlayHub } from "@/features/mockup/play-hub";

export const Route = createFileRoute("/_auth/mock/")({
  component: PlayHub,
});
