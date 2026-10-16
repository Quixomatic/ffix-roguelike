import { createFileRoute } from "@tanstack/react-router";

import { TitleScreen } from "@/features/hub/title-screen";

export const Route = createFileRoute("/_hub/")({
  // The title screen: its own music, and the backdrop at full strength.
  staticData: { music: "title", backdropDim: 0 },
  component: TitleScreen,
});
