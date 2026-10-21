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
    /** Hub pages: where the menu button sits — "corner" (default) or "inset", floating inside a game frame's corner. */
    menuButton?: "corner" | "inset";
    /** Hub pages: how dark the backdrop is (0–1; default 0.55). */
    backdropDim?: number;
    /** Hub pages: the floating ⚙ (Settings dialog) under the menu button (the run; elsewhere Settings is in the sidebar). */
    settingsButton?: boolean;
    /** Hub pages: where the ad sits — "corner" (default, bottom-right), "page" (the page places its own, like the
     *  run's party sidebar) or false (none: the landing page, sign-in, full-window admin tools). */
    ad?: "corner" | "page" | false;
  }
}

/** The hub: Play, Story, Party, Shops, Challenges, Achievements and Settings, in the sidebar shell. */
export const Route = createFileRoute("/_hub")({
  staticData: { shell: "sidebar" },
  component: HubShell,
});
