import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PracticeBattle } from "@/features/battle/practice-battle";

const searchSchema = z.object({
  world: z.number().int().min(0).max(2).catch(0),
  level: z.number().int().min(1).max(99).catch(5),
  encounter: z.number().int().min(0).catch(0),
});

export const Route = createFileRoute("/battle")({
  validateSearch: searchSchema,
  staticData: { breadcrumb: "Practice Battle" },
  component: BattleRoute,
});

function BattleRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <PracticeBattle {...search} onChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })} />;
}
