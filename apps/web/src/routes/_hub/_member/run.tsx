import { createFileRoute } from "@tanstack/react-router";

import { RunScreen } from "@/features/run/run-screen";

export const Route = createFileRoute("/_hub/_member/run")({
  // The run plays its own music (area / battle themes) and keeps the map clear of the currency / shortcut stack.
  // …and floats the menu button inside the game frame's corner, so it needs no gutter of its own.
  staticData: { breadcrumb: "Run", music: null, quickLinks: false, topInset: false, menuButton: "inset", settingsButton: true, ad: "page" },
  component: RunScreen,
});
