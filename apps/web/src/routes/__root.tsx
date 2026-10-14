import { Toaster } from "@ffix-roguelike/ui/components/sonner";
import { registerBestiary } from "@ffix-roguelike/game-data";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  // FF9 monsters, attacks and battle scenes (served from the DB) must be registered before any game screen renders.
  loader: async ({ context }) => {
    registerBestiary(await context.queryClient.ensureQueryData(context.trpc.content.bestiary.queryOptions(undefined, { staleTime: Infinity })));
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
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
