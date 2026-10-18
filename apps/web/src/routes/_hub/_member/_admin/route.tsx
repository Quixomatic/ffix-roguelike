import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { isAdminUser } from "@/lib/auth-client";

/**
 * Admin pages (better-auth's admin role): the reward / gear tables, dev tools, the effects gallery. Anyone else goes
 * to Play. The server checks the role on every admin request too.
 */
export const Route = createFileRoute("/_hub/_member/_admin")({
  component: Outlet,
  beforeLoad: ({ context }) => {
    if (!isAdminUser(context.session.data?.user)) throw redirect({ to: "/play" });
  },
});
