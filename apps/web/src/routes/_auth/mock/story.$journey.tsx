import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EmbarkPage } from "@/features/mockup/story";

export const Route = createFileRoute("/_auth/mock/story/$journey")({
  validateSearch: z.object({ tier: z.number().int().min(0).catch(0) }),
  component: function Embark() {
    const { journey } = Route.useParams();
    const { tier } = Route.useSearch();
    return <EmbarkPage journeyId={journey} tier={tier} />;
  },
});
