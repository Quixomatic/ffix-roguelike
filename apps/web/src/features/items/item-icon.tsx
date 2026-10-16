import { assetUrl } from "@/lib/assets";
import { ITEM_ICON_CELL, ITEM_ICON_COLS, ITEM_ICON_INDEX, ITEM_ICON_ROWS } from "./item-icons.gen";

/**
 * An item's pixel-art icon (Time Fantasy icons, packed by scripts/build-item-icons.ts into /sprites/items.png).
 * `size` should be a multiple of 16 so the pixels stay crisp. Items without an icon render nothing.
 */
export function ItemIcon({ itemId, size = 32, className = "" }: { itemId: number; size?: number; className?: string }) {
  const cell = ITEM_ICON_INDEX[itemId];
  if (cell == null) return null;
  const scale = size / ITEM_ICON_CELL;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${assetUrl("sprites/items.png")})`,
        backgroundSize: `${ITEM_ICON_COLS * ITEM_ICON_CELL * scale}px ${ITEM_ICON_ROWS * ITEM_ICON_CELL * scale}px`,
        backgroundPosition: `-${(cell % ITEM_ICON_COLS) * size}px -${Math.floor(cell / ITEM_ICON_COLS) * size}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}
