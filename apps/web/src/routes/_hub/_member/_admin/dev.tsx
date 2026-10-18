import { createFileRoute } from "@tanstack/react-router";

import { DevPage } from "@/features/dev/dev-page";

/** Admin: roster unlocks, Completion Points and banked gil on your own profile (refused on production servers). */
export const Route = createFileRoute("/_hub/_member/_admin/dev")({
  staticData: { breadcrumb: "Dev tools" },
  component: DevPage,
});
