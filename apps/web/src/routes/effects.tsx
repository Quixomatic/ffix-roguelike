import { createFileRoute } from "@tanstack/react-router";

import { EffectsGallery } from "@/features/effects/effects-gallery";

export const Route = createFileRoute("/effects")({
  staticData: { breadcrumb: "Effects" },
  component: EffectsGallery,
});
