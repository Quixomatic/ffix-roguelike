import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getSessionRetrying } from "@/lib/auth-client";

/** The hub's pages for signed-in players (Play, Story, Party…); signed out, they go to sign in. */
export const Route = createFileRoute("/_hub/_member")({
  component: Outlet,
  beforeLoad: async () => {
    const session = await getSessionRetrying();
    if (!session.data) throw redirect({ to: "/login" });
    return { session };
  },
});
