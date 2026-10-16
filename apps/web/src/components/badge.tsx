import type { ReactNode } from "react";

/**
 * Badge colours: `neutral` is the subtle default; the others are muted tints (dark tinted background, light text)
 * matching what they report — `good` (green), `bad` (red), `highlight` (yellow, e.g. abilities gained), `info`.
 */
export type BadgeTone = "neutral" | "good" | "bad" | "highlight" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-white/10 text-white",
  good: "bg-green-900/50 text-green-300",
  bad: "bg-red-900/50 text-red-300",
  highlight: "bg-yellow-900/40 text-yellow-200",
  info: "bg-indigo-900/50 text-indigo-200",
};

/** A small inline label (chip). */
export function Badge({ tone = "neutral", className = "", title, children }: { tone?: BadgeTone; className?: string; title?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-xs leading-tight ${TONES[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
}
