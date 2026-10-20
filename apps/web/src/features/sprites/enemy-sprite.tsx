import { useEffect, useState } from "react";

import { assetUrl } from "@/lib/assets";

import { enemySpriteFor, type EnemyAnim } from "./enemy-sprites";
import { ENEMY_SPRITES } from "./enemy-sprites.gen";

/**
 * A monster's FFRK sheet playing one of its animations (idle by default) outside Phaser: the sheet as a CSS background,
 * stepped frame by frame at the sheet's own rate, scaled with crisp pixels so its longer side is `size` px.
 * `spriteKey` is a unit's sprite key (`boss/<name>`, `enemy/<name>`) or a bare sheet name.
 */
export function EnemySprite({ spriteKey, size = 96, anim = "idle", className }: { spriteKey: string; size?: number; anim?: EnemyAnim; className?: string }) {
  const info = enemySpriteFor(spriteKey.includes("/") ? spriteKey : `enemy/${spriteKey}`);
  const url = info ? assetUrl(info.url) : null;
  // The sheet's size (for its columns), read once it loads.
  const [sheet, setSheet] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState(0);
  const a = info?.anims[anim] ?? info?.anims.idle;

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => setSheet({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  useEffect(() => {
    if (!a || a.frames.length < 2) return;
    let i = 0;
    const t = setInterval(() => {
      i = a.repeat ? (i + 1) % a.frames.length : Math.min(i + 1, a.frames.length - 1);
      setFrame(i);
    }, 1000 / a.fps);
    return () => clearInterval(t);
  }, [a]);

  if (!info || !url || !sheet || !a) return <span className={className} style={{ width: size, height: size, display: "inline-block" }} />;
  const scale = size / Math.max(info.w, info.h);
  const cols = Math.max(1, Math.floor(sheet.w / info.w));
  const cell = a.frames[frame] ?? a.frames[0] ?? 0;
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: Math.round(info.w * scale),
        height: Math.round(info.h * scale),
        backgroundImage: `url(${url})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheet.w * scale}px ${sheet.h * scale}px`,
        backgroundPosition: `${-(cell % cols) * info.w * scale}px ${-Math.floor(cell / cols) * info.h * scale}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

/** FF9's own bosses with an animated idle (FFRK boss rigs baked into sheets): the Play hub's Challenges card. */
export const ANIMATED_FF9_BOSSES = Object.entries(ENEMY_SPRITES)
  .filter(([, s]) => s.src.includes("(FF9)") && (s.anims.idle?.frames.length ?? 0) > 1)
  .map(([name]) => name);
