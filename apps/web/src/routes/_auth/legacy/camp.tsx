import { createFileRoute } from "@tanstack/react-router";

import { Camp } from "@/features/hub/camp";

/** The original single-page camp, kept for reference while the new hub (/play) grows. */
export const Route = createFileRoute("/_auth/legacy/camp")({
  component: Camp,
});
