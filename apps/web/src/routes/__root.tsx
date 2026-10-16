import { Toaster } from "@ffix-roguelike/ui/components/sonner";
import { registerBestiary, registerGameData } from "@ffix-roguelike/game-data";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import Header from "@/components/header";
import { AssetGate } from "@/components/asset-gate";
import { SettingsSync } from "@/features/settings/use-settings";
import { ThemeProvider } from "@/components/theme-provider";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  // FF9's game tables and bestiary (served from the DB) must be registered before any game screen renders.
  loader: async ({ context }) => {
    const ff9 = await context.queryClient.ensureQueryData(context.trpc.content.ff9.queryOptions(undefined, { staleTime: Infinity }));
    registerGameData(ff9.game);
    registerBestiary(ff9.bestiary);
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

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className="grid grid-rows-[auto_1fr] h-svh">
          <Header />
          <SettingsSync />
          <AssetGate>
            <Outlet />
          </AssetGate>
        </div>
        <Toaster richColors />
      </ThemeProvider>
    </>
  );
}
