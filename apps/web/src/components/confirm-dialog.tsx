import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@ffix-roguelike/ui/components/dialog";
import type { ReactNode } from "react";

import { FocusItem, FocusSection } from "@/features/input/focus";

/**
 * An FF window asking to confirm something destructive (wiping a run…). The cursor starts on Cancel and stays inside;
 * Escape / Backspace / B cancel. `onConfirm` runs on the confirm button; the dialog closes itself either way.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="theme-ff ff-panel max-w-md rounded-md p-5 text-base sm:max-w-md">
        {open && (
          <FocusSection boundary autoFocus>
            <div className="flex flex-col gap-3">
              <DialogTitle className="ff-display text-2xl">{title}</DialogTitle>
              <DialogDescription render={<div />} className="text-sm text-[#c8d0ff]">
                {children}
              </DialogDescription>
              <div className="mt-2 flex justify-end gap-2">
                <FocusItem>
                  <button type="button" data-sound="cancel" className="ff-panel ff-lift px-4 py-1.5" onClick={() => onOpenChange(false)}>
                    Cancel
                  </button>
                </FocusItem>
                <FocusItem>
                  <button
                    type="button"
                    className="ff-panel ff-lift border-red-300/80 px-4 py-1.5 text-red-200"
                    onClick={() => {
                      onOpenChange(false);
                      onConfirm();
                    }}
                  >
                    {confirmLabel}
                  </button>
                </FocusItem>
              </div>
            </div>
          </FocusSection>
        )}
      </DialogContent>
    </Dialog>
  );
}
