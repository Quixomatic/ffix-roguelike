import { createFileRoute, redirect } from "@tanstack/react-router";

/** /admin on its own: the first admin page. */
export const Route = createFileRoute("/_hub/_member/admin/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/rewards" });
  },
});
