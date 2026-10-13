import { HERO_GRID, heroPixels, hex } from "./pixels";

/** A character's sprite as crisp SVG pixel art (same art the Phaser scenes draw). */
export function HeroSprite({
  heroKey,
  size = 64,
  className,
  ko,
}: {
  heroKey: string;
  /** Rendered height in px. */
  size?: number;
  className?: string;
  /** Knocked out: lie down and grey out. */
  ko?: boolean;
}) {
  const width = (size * HERO_GRID.w) / HERO_GRID.h;
  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${HERO_GRID.w} ${HERO_GRID.h}`}
      shapeRendering="crispEdges"
      className={className}
      style={ko ? { transform: "rotate(90deg)", filter: "grayscale(0.8) brightness(0.7)" } : undefined}
      aria-hidden
    >
      {heroPixels(heroKey).map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={hex(p.color)} />
      ))}
    </svg>
  );
}
