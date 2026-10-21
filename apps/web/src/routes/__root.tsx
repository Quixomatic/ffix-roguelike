import { Toaster } from "@ffix-roguelike/ui/components/sonner";
import { registerBestiary, registerGameData, registerRewardTables } from "@ffix-roguelike/game-data";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { HeadContent, Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router";

import Header from "@/components/header";
import { AssetGate } from "@/components/asset-gate";
import { UiSounds } from "@/features/audio/ui-sounds";
import { NavRoot } from "@/features/input/nav";
import { SettingsSync } from "@/features/settings/use-settings";
import { ThemeProvider } from "@/components/theme-provider";
import { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  // FF9's game tables and bestiary, and the reward / gear-availability tables (served from the DB), must be
  // registered before any game screen renders.
  loader: async ({ context }) => {
    const [ff9, rewards] = await Promise.all([
      context.queryClient.ensureQueryData(context.trpc.content.ff9.queryOptions(undefined, { staleTime: Infinity })),
      context.queryClient.ensureQueryData(context.trpc.content.rewards.queryOptions(undefined, { staleTime: REWARDS_STALE })),
    ]);
    registerGameData(ff9.game);
    registerBestiary(ff9.bestiary);
    registerRewardTables(rewards);
  },
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "ffix-roguelike",
      },
      {
        name: "description",
        content: "ffix-roguelike is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

/** The reward tables can change (admins edit them): re-fetched after a while, and re-registered when they do. */
const REWARDS_STALE = 5 * 60_000;

function RewardTablesSync() {
  const rewards = useQuery(trpc.content.rewards.queryOptions(undefined, { staleTime: REWARDS_STALE }));
  useEffect(() => {
    if (rewards.data) registerRewardTables(rewards.data);
  }, [rewards.data]);
  return null;
}

function RootComponent() {
  // The hub's layout (sidebar shell) brings its own navigation instead of the header bar.
  const shell = useRouterState({ select: (s) => s.matches.some((m) => m.staticData?.shell === "sidebar") }) ? "sidebar" : "header";
  return (
    <>
      <HeadContent />
      <RewardTablesSync />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        {/* App shell: the header stays put; <main> is the one scroll area. Its single row is at least the full height
            (pages stretch to fill it, whether or not they set h-full) and grows with taller pages, which then scroll. */}
        <div className={`grid h-svh ${shell === "header" ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]"}`}>
          {shell === "header" && <Header />}
          <SettingsSync />
          <main id="main" data-scroll-restoration-id="main" className="grid min-h-0 grid-rows-[minmax(100%,max-content)] overflow-y-auto">
            <AssetGate>
              <UiSounds />
            <NavRoot />
              <Outlet />
            </AssetGate>
          </main>
        </div>
        {/* Top-centre: the bottom-right is the ad's (and the run's party), the top-right the round shortcuts. */}
        <Toaster richColors position="top-center" />
      </ThemeProvider>
    </>
  );
}
