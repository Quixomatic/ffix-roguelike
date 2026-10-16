import type { ReactNode } from "react";

/**
 * The title screen's backdrop — a deep-blue radial sky with drifting "memoria" motes fading toward the bottom — for
 * any page. It's drawn behind the children (its own stacking context), so content needs no z-index; the container
 * fills at least the page area (`min-h-full`) and grows with long pages. `className` styles the container (layout).
 * `dim` (0–1) darkens it — a black veil over the sky and motes — for pages full of windows, where the full-strength
 * blue tints everything (the title screen uses 0, camp ~0.6).
 */
export function MemoriaBackdrop({ className = "", dim = 0, children }: { className?: string; dim?: number; children: ReactNode }) {
  return (
    <div className={`relative isolate min-h-full ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a3a8a_0%,#0b0f2e_60%,#05060f_100%)]">
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        {dim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: Math.min(1, dim) }} />}
      </div>
      {children}
    </div>
  );
}
