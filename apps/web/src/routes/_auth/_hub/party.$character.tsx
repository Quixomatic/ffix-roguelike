import { createFileRoute } from "@tanstack/react-router";

import { CharacterPage } from "@/features/camp/pages";

export const Route = createFileRoute("/_auth/_hub/party/$character")({
  component: function Character() {
    const { character } = Route.useParams();
    return <CharacterPage characterKey={character} />;
  },
});
