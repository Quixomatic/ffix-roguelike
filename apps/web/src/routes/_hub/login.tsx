import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginPage } from "@/features/auth/login-page";
import { getSessionRetrying } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";

/**
 * Sign in / create an account, in the hub's layout (the title screen's backdrop and music). `?redirect=` is where a
 * sign-in guard sent you from; signed in already (or once signed in), you go there, else home.
 */
export const Route = createFileRoute("/_hub/login")({
  staticData: { music: "title", backdropDim: 0.2, quickLinks: false },
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await getSessionRetrying();
    if (session.data) throw redirect({ href: safeRedirect(search.redirect) ?? "/" });
  },
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect: dest } = Route.useSearch();
  return <LoginPage redirect={dest} />;
}
