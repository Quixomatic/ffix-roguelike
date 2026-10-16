/**
 * Monster sprites from FFRK (built by `scripts/build-enemy-sprites.ts` from `scripts/enemy-sprite-map.ts`).
 * A unit's sprite key (`enemy/<name>` or `boss/<name>`) looks up its sheet by name; monsters without one keep the
 * placeholder. Sheets are grids of equal cells; bosses carry FFRK's own idle/attack/damage/dead animations,
 * regular enemies a single pose plus a white (hit flash) cell.
 */
import type Phaser from "phaser";

import { ENEMY_SPRITES } from "./enemy-sprites.gen";

export type EnemyAnim = "idle" | "attack" | "damage" | "dead";

export interface EnemySpriteInfo {
  url: string;
  w: number;
  h: number;
  originX: number;
  originY: number;
  anims: Partial<Record<EnemyAnim, { frames: number[]; fps: number; repeat: boolean }>>;
  white?: number;
  thunder?: number;
  /** Where the art comes from (shown in the bestiary). */
  src: string;
}

export const enemySpriteFor = (spriteKey: string): EnemySpriteInfo | undefined => ENEMY_SPRITES[spriteKey.split("/")[1] ?? ""];

/** Phaser texture key for a monster's sheet (shared by every monster using the same sheet). */
const textureKey = (info: EnemySpriteInfo) => `ffrk:${info.url}`;

/** Queue the sheets for these sprite keys (call from a scene's preload). */
export function loadEnemySheets(scene: Phaser.Scene, spriteKeys: Iterable<string>) {
  for (const key of new Set(spriteKeys)) {
    const info = enemySpriteFor(key);
    if (info && !scene.textures.exists(textureKey(info))) scene.load.spritesheet(textureKey(info), info.url, { frameWidth: info.w, frameHeight: info.h });
  }
}

export const enemyAnimKey = (info: EnemySpriteInfo, anim: EnemyAnim) => `${textureKey(info)}:${anim}`;

/** Register a monster's animations once its sheet has loaded; returns its texture key, or null to use a placeholder. */
export function ensureEnemyAnims(scene: Phaser.Scene, spriteKey: string): { texture: string; info: EnemySpriteInfo } | null {
  const info = enemySpriteFor(spriteKey);
  if (!info || !scene.textures.exists(textureKey(info))) return null;
  for (const [anim, a] of Object.entries(info.anims)) {
    const key = enemyAnimKey(info, anim as EnemyAnim);
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(textureKey(info), { frames: a.frames }), frameRate: a.fps, repeat: a.repeat ? -1 : 0 });
  }
  return { texture: textureKey(info), info };
}
