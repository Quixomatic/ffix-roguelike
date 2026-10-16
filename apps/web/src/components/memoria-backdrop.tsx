import type { ReactNode } from "react";

/**
 * The title screen's backdrop — a deep-blue radial sky with drifting "memoria" motes fading toward the bottom — for
 * any page. It's drawn behind the children (its own stacking context), so content needs no z-index; the container
 * fills at least the page area (`min-h-full`) and grows with long pages. `className` styles the container (layout).
 */
export function MemoriaBackdrop({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`relative isolate min-h-full ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a3a8a_0%,#0b0f2e_60%,#05060f_100%)]">
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>
      {children}
    </div>
  );
}
