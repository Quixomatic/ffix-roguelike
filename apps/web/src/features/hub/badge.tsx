import { BADGE_COUNT } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";

import { assetFetch, assetUrl } from "@/lib/assets";

/** The badge atlas (`pnpm -F web sprites:badges`): badge n in cell n − 1, CELL px cells, COLS per row. */
const CELL = 48;
const COLS = 32;
const ROWS = Math.ceil(BADGE_COUNT / COLS);

/**
 * An achievement badge by number, drawn from the atlas at a whole-number `scale` (crisp pixels). `view` is how much of
 * its cell shows (badges are 7–48 px, centred; 40 fits all but the widest pairs). Locked: dimmed and greyed.
 */
export function Badge({ id, scale = 2, view = 40, locked = false, className = "" }: { id: number; scale?: number; view?: number; locked?: boolean; className?: string }) {
  const i = id - 1;
  const inset = (CELL - view) / 2;
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${locked ? "opacity-40 grayscale" : ""} ${className}`}
      style={{
        width: view * scale,
        height: view * scale,
        backgroundImage: `url(${assetUrl("sprites/badges/badges.png")})`,
        backgroundSize: `${COLS * CELL * scale}px ${ROWS * CELL * scale}px`,
        backgroundPosition: `-${((i % COLS) * CELL + inset) * scale}px -${(Math.floor(i / COLS) * CELL + inset) * scale}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

export interface BadgeInfo {
  id: number;
  w: number;
  h: number;
  name?: string;
  tags?: string[];
  frame?: "round" | "square" | "plain" | "pair";
}

/** The badge catalog (names and search tags per badge), for the admin picker. */
export function useBadgeCatalog() {
  return useQuery({
    queryKey: ["badge-catalog"],
    staleTime: Infinity,
    queryFn: async () => ((await (await assetFetch("sprites/badges/badges.json")).json()) as { badges: BadgeInfo[] }).badges,
  });
}
