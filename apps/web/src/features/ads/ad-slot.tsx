/**
 * Ads (Google AdSense; `.plans/ads.md`). One 300×250 unit, never on the home page: bottom-right on hub pages
 * (`AdCorner` in the shell), and at the bottom of the party sidebar during runs.
 *
 * - **Config:** `VITE_ADS_ENABLED` (must be true; unset or false turns every ad and placeholder off), `VITE_ADSENSE_CLIENT`
 *   (ca-pub-…) and `VITE_ADSENSE_SLOT`. No AdSense id = no real ads.
 * - **Loading:** adsbygoogle.js loads when the first slot mounts, at the next idle moment, so the landing page (which
 *   shows none) never pays for it, and its startup work never lands on the first frame of a page.
 * - **Refresh:** none. AdSense forbids reloading ads on a timer; a slot shows a new ad when it mounts fresh, i.e. when
 *   the player opens another page or moves on to the next map (the run remounts it per map with `key`).
 * - **Switches** (remembered for the tab): `?noads` hides ads (perf comparisons); `?adpreview=1` / `=0` shows or hides
 *   a placeholder box where ads go. Development builds without an AdSense id show the placeholder by default.
 */
import { useEffect, useRef, useState } from "react";

import { ENV } from "@/env";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const CLIENT = ENV.VITE_ADSENSE_CLIENT;
const SLOT = ENV.VITE_ADSENSE_SLOT;
export const AD_WIDTH = 300;
export const AD_HEIGHT = 250;

/** A URL switch, remembered for this tab (sessionStorage) once seen. */
function tabSwitch(name: string, fallback: boolean): boolean {
  const key = `ff-${name}`;
  try {
    const params = new URLSearchParams(location.search);
    if (params.has(name)) sessionStorage.setItem(key, params.get(name) === "0" ? "0" : "1");
    const v = sessionStorage.getItem(key);
    return v == null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

/** What a slot renders: a real ad, the preview placeholder, or nothing. */
function adMode(): "ad" | "preview" | "none" {
  if (ENV.VITE_ADS_ENABLED !== true || tabSwitch("noads", false)) return "none";
  if (tabSwitch("adpreview", import.meta.env.DEV && !CLIENT)) return "preview";
  return CLIENT && SLOT ? "ad" : "none";
}

let scriptAdded = false;
function loadAdSense() {
  if (scriptAdded || !CLIENT) return;
  scriptAdded = true;
  const add = () => {
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
    document.head.appendChild(s);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(add, { timeout: 1500 });
  else setTimeout(add, 0);
}

/** Whether ads (or their placeholders) show at all, for layouts that reserve room for them. */
export function adsShown(): boolean {
  return adMode() !== "none";
}

/** Ad heights for a 300-wide space, largest first (the IAB 300×250, 300×100 and 300×50). */
const FIT_HEIGHTS = [250, 100, 50];

/**
 * An ad in whatever room is left: it takes only the leftover height of its flex column (never squeezing what's above
 * it) and shows the largest ad that fits, or none. A new size, or a new `adKey`, mounts a fresh ad.
 */
export function FitAdSlot({ adKey, className = "" }: { adKey: string | number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const shown = adsShown();
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setHeight(FIT_HEIGHTS.find((h) => h <= el.clientHeight) ?? null);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);
  if (!shown) return null;
  return (
    <div ref={box} className={`relative min-h-0 flex-1 ${className}`}>
      {height && <AdSlot key={`${adKey}-${height}`} height={height} className="absolute bottom-0 right-0" />}
    </div>
  );
}

/** One ad, 300×250 unless told otherwise. Mount it fresh (a new `key`) for a new ad. */
export function AdSlot({ className = "", width = AD_WIDTH, height = AD_HEIGHT }: { className?: string; width?: number; height?: number }) {
  const mode = adMode();
  const ins = useRef<HTMLModElement>(null);
  useEffect(() => {
    if (mode !== "ad" || !ins.current || ins.current.dataset.adsbygoogleStatus) return;
    loadAdSense();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Blocked or not ready: the slot stays empty.
    }
  }, [mode]);
  if (mode === "none") return null;
  return (
    <div className={`shrink-0 overflow-hidden ${className}`} style={{ width, height }} aria-label="Advertisement">
      {mode === "ad" ? (
        <ins
          ref={ins}
          className="adsbygoogle"
          style={{ display: "inline-block", width, height }}
          data-ad-client={CLIENT}
          data-ad-slot={SLOT}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 border-2 border-dashed border-white/40 bg-black/50 text-xs text-white/70">
          <span className="ff-title">Ad</span>
          <span>
            {width}×{height}
          </span>
        </div>
      )}
    </div>
  );
}
