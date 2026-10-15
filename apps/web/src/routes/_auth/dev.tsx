import { createFileRoute } from "@tanstack/react-router";

import { DevPage } from "@/features/dev/dev-page";

export const Route = createFileRoute("/_auth/dev")({
  staticData: { breadcrumb: "Dev tools" },
  component: DevPage,
});
