import { createFileRoute } from "@tanstack/react-router";

import { RunScreen } from "@/features/run/run-screen";

export const Route = createFileRoute("/_hub/_member/run")({
  // The run plays its own music (area / battle themes) and keeps the map clear of the currency / shortcut stack.
  staticData: { breadcrumb: "Run", music: null, quickLinks: false, topInset: false },
  component: RunScreen,
});
