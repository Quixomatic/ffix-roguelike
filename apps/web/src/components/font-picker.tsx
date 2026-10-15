import { useEffect, useState } from "react";

/** Menu fonts to choose from (CSS in index.css; the saved choice is applied before first paint in index.html). */
const FONTS = [
  { id: "rounded", label: "Rounded" }, // Nunito text, pixel headings
  { id: "classic", label: "Classic pixel" }, // Pixelify Sans everywhere (the original look)
  { id: "pixel", label: "Retro JRPG" }, // DotGothic16 text, pixel headings
  { id: "storybook", label: "Storybook" }, // Alegreya Sans text, Cinzel headings
] as const;

/** Header dropdown to switch the menu font (per browser). */
export function FontPicker() {
  const [font, setFont] = useState(() => document.documentElement.dataset.font ?? "rounded");
  useEffect(() => {
    document.documentElement.dataset.font = font;
    try {
      localStorage.setItem("ff-font", font);
    } catch {
      // private mode / blocked storage: the choice just won't persist
    }
  }, [font]);
  return (
    <select
      aria-label="Menu font"
      title="Menu font"
      className="rounded border border-white/30 bg-[#141b52] px-1.5 py-0.5 text-sm text-white"
      value={font}
      onChange={(e) => setFont(e.target.value)}
    >
      {FONTS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
