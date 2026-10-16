import { createFileRoute } from "@tanstack/react-router";

import { PartyPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_hub/_member/party/")({
  component: PartyPage,
});
