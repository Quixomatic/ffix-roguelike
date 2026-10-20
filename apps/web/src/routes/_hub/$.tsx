import { createFileRoute } from "@tanstack/react-router";

import { NotFoundPage } from "@/features/hub/not-found";

/** Any address no other route matches: the 404 page, in the hub's layout (not the old header bar). */
export const Route = createFileRoute("/_hub/$")({
  component: NotFoundPage,
});
