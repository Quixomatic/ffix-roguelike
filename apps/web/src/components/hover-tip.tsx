import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A hover tooltip rendered at the page level (portal), so scrolling/overflow-hidden containers can't clip it.
 * Shows below the anchor (above if there's no room), centred on it and kept inside the window.
 */
export function HoverTip({ tip, children, className, width = 240 }: { tip: ReactNode | null; children: ReactNode; className?: string; width?: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const a = anchor.current.getBoundingClientRect();
    const h = box.current?.offsetHeight ?? 0;
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, a.left + a.width / 2 - width / 2));
    const below = a.bottom + 4;
    const top = below + h + margin > window.innerHeight ? Math.max(margin, a.top - h - 4) : below;
    setPos({ left, top });
  }, [open, width]);

  return (
    <div ref={anchor} className={className} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open &&
        tip != null &&
        createPortal(
          <div
            ref={box}
            className="pointer-events-none fixed z-[100]"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width, visibility: pos ? "visible" : "hidden" }}
          >
            {tip}
          </div>,
          document.body,
        )}
    </div>
  );
}
