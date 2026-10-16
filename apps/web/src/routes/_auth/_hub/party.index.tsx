import { createFileRoute } from "@tanstack/react-router";

import { PartyPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_auth/_hub/party/")({
  component: PartyPage,
});
