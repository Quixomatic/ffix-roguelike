import { createFileRoute } from "@tanstack/react-router";

import { Camp } from "@/features/hub/camp";

export const Route = createFileRoute("/_auth/play")({
  staticData: { breadcrumb: "Camp" },
  component: Camp,
});
