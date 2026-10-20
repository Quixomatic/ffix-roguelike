/**
 * Umami: self-hosted, privacy-friendly analytics (ChannelGuide's instance and setup). Cookieless and no personal
 * data, so no consent banner is needed.
 *
 * Configured only through env (`VITE_UMAMI_SRC`, `VITE_UMAMI_WEBSITE_ID`) and loaded only by production builds with
 * both set, so local dev doesn't count against the real stats. The tracker follows the router's history changes
 * itself (pushState / replaceState), so pages need no pageview calls.
 */
import { ENV } from "@/env";

export function loadAnalytics() {
  const src = ENV.VITE_UMAMI_SRC;
  const websiteId = ENV.VITE_UMAMI_WEBSITE_ID;
  if (!import.meta.env.PROD || !src || !websiteId) return;
  // Loaded after the page, never blocking it (next/script's afterInteractive in ChannelGuide).
  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  script.dataset.websiteId = websiteId;
  document.head.appendChild(script);
}
