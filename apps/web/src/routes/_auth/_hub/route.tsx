import { createFileRoute } from "@tanstack/react-router";

import { HubShell } from "@/features/camp/shell";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Page title for breadcrumbs. */
    breadcrumb?: string;
    /** "sidebar": the hub's sidebar shell replaces the header bar (set on the hub layout). */
    shell?: "sidebar";
  }
}

/** The hub: Play, Story, Party, Shops, Challenges, Achievements and Settings, in the sidebar shell. */
export const Route = createFileRoute("/_auth/_hub")({
  staticData: { shell: "sidebar" },
  component: HubShell,
});
