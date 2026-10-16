import { createFileRoute } from "@tanstack/react-router";

import { HubShell } from "@/features/camp/shell";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** Page title for breadcrumbs. */
    breadcrumb?: string;
    /** "sidebar": the hub's sidebar shell replaces the header bar (set on the hub layout). */
    shell?: "sidebar";
    /** Hub pages: the music slot to play (default "camp"); null: none — the page plays its own (the run). */
    music?: "title" | "camp" | null;
    /** Hub pages: show the gil / CP chips and round shortcuts (default true). */
    quickLinks?: boolean;
    /** Hub pages: leave a strip at the top for the menu button (default true; false when the page clears it sideways). */
    topInset?: boolean;
    /** Hub pages: how dark the backdrop is (0–1; default 0.55). */
    backdropDim?: number;
  }
}

/** The hub: Play, Story, Party, Shops, Challenges, Achievements and Settings, in the sidebar shell. */
export const Route = createFileRoute("/_hub")({
  staticData: { shell: "sidebar" },
  component: HubShell,
});
