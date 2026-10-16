/**
 * FF9's own menu sounds (extracted from the game: `scripts/extract-ff9-sfx.py`), at the sound-effect volume.
 * FF9's menus play one tick both for moving the cursor and for selecting (FF9SFX 103), 101 to back out, 102 when
 * something can't be done, 1045 for a shop purchase, 682 for help.
 *
 * `useUiSounds()` (mounted once, in the app root) plays them for the whole app:
 * - **cursor** whenever a menu option (`.ff-option`) becomes the highlighted one — keyboard or mouse, every menu;
 * - **cursor** on clicking a button or link;
 * - **cancel** on Escape, and on close / back buttons (`aria-label="Close"`);
 * - **buzzer** on pressing a disabled button (can't afford, sold out, not allowed) — browsers send no click there;
 * - an element can ask for another sound with `data-sound="purchase|buzzer|cancel|help|none"`.
 * Purchases play `uiSound("purchase")` when the buy succeeds.
 */
import { useEffect } from "react";

import { playSfx, warmSfx } from "./music";

export const UI_SOUNDS = ["cursor", "cancel", "buzzer", "purchase", "help"] as const;
export type UiSound = (typeof UI_SOUNDS)[number];

const url = (s: UiSound) => `sfx/ui/${s}.ogg`;
const last = new Map<UiSound, number>();

/** Play a menu sound. The same sound twice within a moment plays once (a click that also moves the cursor). */
export function uiSound(s: UiSound) {
  const now = performance.now();
  if (now - (last.get(s) ?? -Infinity) < 60) return;
  last.set(s, now);
  playSfx(url(s));
}

const isSound = (v: string | undefined): v is UiSound | "none" => v === "none" || (UI_SOUNDS as readonly string[]).includes(v ?? "");

/** Mounts `useUiSounds` (inside the asset gate, so the sound pack is loaded). */
export function UiSounds() {
  useUiSounds();
  return null;
}

export function useUiSounds() {
  useEffect(() => {
    warmSfx(UI_SOUNDS.map(url));

    // The highlighted option changed (FF9's cursor tick).
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (el.dataset.active === "true" && r.oldValue !== "true" && el.classList.contains("ff-option")) {
          uiSound("cursor");
          return;
        }
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-active"], attributeOldValue: true });

    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-sound], button, a, [role=button], .ff-option");
      if (!el) return;
      const own = el.closest<HTMLElement>("[data-sound]")?.dataset.sound;
      if (isSound(own)) return own !== "none" && uiSound(own);
      if (el.getAttribute("aria-label") === "Close") return uiSound("cancel");
      uiSound("cursor");
    };
    // Disabled buttons get no click event, but they do get pointer events.
    const onPointerUp = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("button:disabled, [aria-disabled=true]");
      if (!el || el.closest<HTMLElement>("[data-sound]")?.dataset.sound === "none") return;
      uiSound("buzzer");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select")) return;
      uiSound("cancel");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);
}
