import { createFileRoute } from "@tanstack/react-router";

import { EffectsGallery } from "@/features/effects/effects-gallery";

/** Admin (development servers): the FFRK effects gallery. Full height, no shortcut stack; room for the menu button on top. */
export const Route = createFileRoute("/_hub/_member/admin/effects")({
  staticData: { breadcrumb: "Effects", quickLinks: false, topInset: false, ad: false },
  component: () => (
    <div className="h-svh pt-12">
      <EffectsGallery />
    </div>
  ),
});
