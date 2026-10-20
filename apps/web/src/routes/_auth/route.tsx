import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getSessionRetrying } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async ({ location }) => {
    const session = await getSessionRetrying();
    // Back to this page once signed in.
    if (!session.data) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { session };
  },
});

function AuthLayout() {
  return <Outlet />;
}
