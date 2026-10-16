import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/features/settings/settings-page";

export const Route = createFileRoute("/_auth/_hub/settings")({
  staticData: { breadcrumb: "Settings" },
  component: SettingsPage,
});
