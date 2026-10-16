import { Toaster } from "@ffix-roguelike/ui/components/sonner";
import { registerBestiary, registerGameData } from "@ffix-roguelike/game-data";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import Header from "@/components/header";
import { AssetGate } from "@/components/asset-gate";
import { UiSounds } from "@/features/audio/ui-sounds";
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
        {/* App shell: the header stays put; <main> is the one scroll area. Its single row is at least the full height
            (pages stretch to fill it, whether or not they set h-full) and grows with taller pages, which then scroll. */}
        <div className="grid h-svh grid-rows-[auto_minmax(0,1fr)]">
          <Header />
          <SettingsSync />
          <main id="main" data-scroll-restoration-id="main" className="grid min-h-0 grid-rows-[minmax(100%,max-content)] overflow-y-auto">
            <AssetGate>
              <UiSounds />
              <Outlet />
            </AssetGate>
          </main>
        </div>
        <Toaster richColors />
      </ThemeProvider>
    </>
  );
}
