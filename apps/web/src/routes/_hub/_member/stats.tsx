import { createFileRoute, redirect } from "@tanstack/react-router";

/** The stats live on the Profile page now; old links land there. */
export const Route = createFileRoute("/_hub/_member/stats")({
  beforeLoad: () => {
    throw redirect({ to: "/profile" });
  },
});
