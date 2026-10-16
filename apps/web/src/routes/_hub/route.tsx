import { createFileRoute } from "@tanstack/react-router";

import { HubShell } from "@/features/camp/shell";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Page title for breadcrumbs. */
    breadcrumb?: string;
    /** "sidebar": the hub's sidebar shell replaces the header bar (set on the hub layout). */
    shell?: "sidebar";
    /** Hub pages: the music slot to play (default "camp"). */
    music?: "title" | "camp";
    /** Hub pages: how dark the backdrop is (0–1; default 0.55). */
    backdropDim?: number;
  }
}

/** The hub: Play, Story, Party, Shops, Challenges, Achievements and Settings, in the sidebar shell. */
export const Route = createFileRoute("/_hub")({
  staticData: { shell: "sidebar" },
  component: HubShell,
});
