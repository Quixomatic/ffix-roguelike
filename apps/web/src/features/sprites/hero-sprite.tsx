import { useEffect, useState, type CSSProperties } from "react";

import { assetUrl } from "@/lib/assets";

import { HERO_CELL, heroSheet, type HeroAnim, type HeroSheet, type HeroVariant } from "./hero-sheets";
import { HERO_GRID, heroPixels, hex } from "./pixels";

/** Standing FFRK heroes are ~24px tall; the strip is drawn at the integer scale that fits `size`. */
const FIGURE_H = 24;

/**
 * A character's sprite: its FFRK frames (integer-scaled, pixelated, gently animated) when it has a strip, else
 * the crisp SVG pixel-art placeholder the Phaser scenes also fall back to.
 */
export function HeroSprite({
  heroKey,
  size = 64,
  className,
  ko,
  silhouette,
  anim = "idle",
  variant,
}: {
  heroKey: string;
  /** Rendered height in px. */
  size?: number;
  className?: string;
  /** Knocked out: lie down and grey out. */
  ko?: boolean;
  /** Locked character: a black silhouette. */
  silhouette?: boolean;
  /** Pose to loop (strip heroes only; `ko` wins). */
  anim?: HeroAnim;
  /** Status look (FFRK's Blind glasses / Mini sprites). */
  variant?: HeroVariant | null;
}) {
  const width = Math.round((size * HERO_GRID.w) / HERO_GRID.h);
  const sheet = heroSheet(heroKey);
  const filter = ko ? "grayscale(0.8) brightness(0.7)" : silhouette ? "brightness(0) drop-shadow(0 0 2px #8890c0)" : undefined;
  if (sheet) return <StripSprite sheet={sheet} size={size} width={width} className={className} anim={ko ? "ko" : anim} variant={variant} still={silhouette} filter={filter} />;
  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${HERO_GRID.w} ${HERO_GRID.h}`}
      shapeRendering="crispEdges"
      className={className}
      style={ko ? { transform: "rotate(90deg)", filter } : filter ? { filter } : undefined}
      aria-hidden
    >
      {heroPixels(heroKey).map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={hex(p.color)} />
      ))}
    </svg>
  );
}

function StripSprite({
  sheet,
  size,
  width,
  className,
  anim,
  variant,
  still,
  filter,
}: {
  sheet: HeroSheet;
  size: number;
  width: number;
  className?: string;
  anim: HeroAnim;
  variant?: HeroVariant | null;
  still?: boolean;
  filter?: string;
}) {
  const a = sheet.info.anims[anim];
  const frames = (variant && sheet.info.variants?.[variant]?.[anim]) || a.frames;
  const frame = useFrame(frames, a.frameRate, a.repeat, !still);
  const cell = HERO_CELL * Math.max(1, Math.floor(size / FIGURE_H));
  // Feet on the bottom edge, centred on whole pixels; wide poses (KO) may spill past the box sideways.
  const style: CSSProperties = {
    position: "absolute",
    left: Math.round((width - cell) / 2),
    bottom: 0,
    width: cell,
    height: cell,
    backgroundImage: `url(${assetUrl(sheet.url)})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${sheet.info.frames * cell}px ${cell}px`,
    backgroundPosition: `${-frame * cell}px 0`,
    imageRendering: "pixelated",
    filter,
  };
  return (
    <span className={className} style={{ position: "relative", display: "inline-block", flexShrink: 0, width, height: size }} aria-hidden>
      <span style={style} />
    </span>
  );
}

/** Steps through an animation's frames (looping ones start at a random frame so a line-up doesn't blink in sync). */
function useFrame(frames: number[], frameRate: number, repeat: number, play: boolean): number {
  const [i, setI] = useState(() => (play && repeat === -1 ? Math.floor(Math.random() * frames.length) : 0));
  useEffect(() => {
    setI((n) => (n < frames.length ? n : 0));
    if (!play || frames.length < 2) return;
    const id = setInterval(() => setI((n) => (repeat === -1 ? (n + 1) % frames.length : Math.min(n + 1, frames.length - 1))), 1000 / frameRate);
    return () => clearInterval(id);
  }, [frames, frameRate, repeat, play]);
  return frames[Math.min(i, frames.length - 1)] ?? 0;
}
