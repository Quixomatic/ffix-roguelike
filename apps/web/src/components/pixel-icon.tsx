import { assetUrl } from "@/lib/assets";

/** The UI glyphs shipped by `pnpm -F web sprites:ui` (Time Fantasy icon pack, 16×16): use these, not text characters. */
export type PixelIconName = "check" | "cross" | "star" | "lock" | "arrow-up" | "arrow-down" | "arrow-left" | "arrow-right";

/**
 * A 16×16 pixel-art icon from the UI set, drawn crisp at `size` px (keep it a multiple of 16 for clean pixels — 16
 * or 32). Decorative by default; pass `label` when the icon carries meaning on its own.
 */
export function PixelIcon({ name, size = 16, className = "", label }: { name: PixelIconName; size?: number; className?: string; label?: string }) {
  return (
    <img
      src={assetUrl(`sprites/ui/${name}.png`)}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={`inline-block shrink-0 [image-rendering:pixelated] ${className}`}
    />
  );
}
