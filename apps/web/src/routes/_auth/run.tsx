import { createFileRoute } from "@tanstack/react-router";

import { RunScreen } from "@/features/run/run-screen";

export const Route = createFileRoute("/_auth/run")({
  staticData: { breadcrumb: "Run" },
  component: RunScreen,
});
