import type { ReactNode } from "react";

import { FocusItem, FocusSection } from "@/features/input/focus";
import { useInputOwner } from "@/features/input/owner";

/**
 * A full-screen FF-style window over the page (like the character sheet): fixed header with the title, optional
 * header content and a close button; the body scrolls. Escape or clicking outside closes it.
 */
export function GameDialog({ title, headerRight, onClose, children }: { title: ReactNode; headerRight?: ReactNode; onClose(): void; children: ReactNode }) {
  // Has the controls while open; Escape / Backspace / B close it (input/nav.ts routes cancel to the top claim).
  useInputOwner("menu", { onCancel: onClose });
  // The cursor starts inside and stays there until it closes.
  return (
    <FocusSection boundary autoFocus>
    <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="ff-window flex max-h-[90vh] w-[95vw] max-w-[1200px] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
          <div className="ff-display text-2xl">{title}</div>
          <div className="flex items-center gap-4">
            {headerRight}
            <FocusItem>
              <button className="text-xl" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </FocusItem>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
    </FocusSection>
  );
}
