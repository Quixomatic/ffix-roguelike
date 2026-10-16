import type { ReactNode } from "react";

/** Badge colours: `neutral` is the subtle default; the others are fully coloured to match what they report. */
export type BadgeTone = "neutral" | "gain" | "loss" | "info" | "warn";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-white/10 text-white",
  gain: "bg-green-600/80 text-white",
  loss: "bg-red-600/80 text-white",
  info: "bg-indigo-500/80 text-white",
  warn: "bg-amber-500/85 text-black",
};

/** A small inline label (chip). */
export function Badge({ tone = "neutral", className = "", title, children }: { tone?: BadgeTone; className?: string; title?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-px text-xs leading-tight ${TONES[tone]} ${className}`} title={title}>
      {children}
    </span>
  );
}
