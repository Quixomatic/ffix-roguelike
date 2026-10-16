import { createFileRoute } from "@tanstack/react-router";

import { MockShell } from "@/features/mockup/shell";

/** Mockup of the new hub layout (sidebar shell + hub pages) — side by side with the current camp at /play. */
export const Route = createFileRoute("/_auth/mock")({
  component: MockShell,
});
