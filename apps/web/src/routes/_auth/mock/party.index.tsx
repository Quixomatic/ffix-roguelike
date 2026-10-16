import { createFileRoute } from "@tanstack/react-router";

import { PartyPage } from "@/features/mockup/pages";

export const Route = createFileRoute("/_auth/mock/party/")({
  component: PartyPage,
});
