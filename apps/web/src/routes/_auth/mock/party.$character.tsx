import { createFileRoute } from "@tanstack/react-router";

import { CharacterPage } from "@/features/mockup/pages";

export const Route = createFileRoute("/_auth/mock/party/$character")({
  component: function Character() {
    const { character } = Route.useParams();
    return <CharacterPage characterKey={character} />;
  },
});
