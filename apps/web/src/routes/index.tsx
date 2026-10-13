import { createFileRoute } from "@tanstack/react-router";

import { TitleScreen } from "@/features/hub/title-screen";

export const Route = createFileRoute("/")({
  component: TitleScreen,
});
