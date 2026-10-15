/**
 * Sprite manifest. Every unit references a sprite key (`hero/zidane`, `enemy/goblin`, `boss/garland`).
 * Heroes with an FFRK strip load it under that key (`loadHeroSheets` in preload, `ensureHeroAnims` in create);
 * everything else gets a pixel-art stand-in from `ensurePlaceholder`, so real art drops in by registering a
 * texture with the same key — no game code changes.
 */
import type Phaser from "phaser";

import { HERO_CELL, heroSheetForSprite, weaponSprite, type HeroAnim, type HeroVariant } from "./hero-sheets";
import { HERO_GRID, heroPixels } from "./pixels";

const FAMILY_COLORS: Record<string, number> = {
  beast: 0x8a5a2e,
  bird: 0xc9b04a,
  bug: 0x4f8a3a,
  stone: 0x8a8a7a,
  undead: 0xd8d8c8,
  dragon: 0xb83a2e,
  devil: 0x6a3a8a,
  human: 0x5a7aa8,
  machine: 0x7a8a9a,
  amorphous: 0x4ab89a,
};

export interface PlaceholderOpts {
  family?: string;
  boss?: boolean;
}

/** Make sure a texture exists for `key`, drawing a stand-in if the real sheet isn't loaded. */
export function ensurePlaceholder(scene: Phaser.Scene, key: string, opts: PlaceholderOpts = {}): string {
  if (scene.textures.exists(key)) return key;
  const [kind, name = ""] = key.split("/");
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  if (kind === "hero") {
    // Drawn at 2× for crisp scaling.
    for (const p of heroPixels(name)) {
      g.fillStyle(p.color, 1);
      g.fillRect(p.x * 2, p.y * 2, p.w * 2, p.h * 2);
    }
    g.generateTexture(key, HERO_GRID.w * 2, HERO_GRID.h * 2);
  } else {
    const color = FAMILY_COLORS[opts.family ?? ""] ?? 0x8a6a9a;
    const size = opts.boss ? 128 : 72;
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(size / 2, size - 6, size * 0.8, 12);
    g.fillStyle(color, 1);
    if (opts.family === "bird") g.fillTriangle(size / 2, 6, 6, size - 14, size - 6, size - 14);
    else if (opts.family === "amorphous") g.fillEllipse(size / 2, size * 0.6, size * 0.9, size * 0.7);
    else g.fillRoundedRect(size * 0.1, size * 0.12, size * 0.8, size * 0.76, size * 0.18);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size * 0.36, size * 0.4, size * 0.08);
    g.fillCircle(size * 0.64, size * 0.4, size * 0.08);
    g.fillStyle(0x110000, 1);
    g.fillCircle(size * 0.34, size * 0.42, size * 0.04);
    g.fillCircle(size * 0.62, size * 0.42, size * 0.04);
    g.lineStyle(3, 0x000000, 0.5);
    g.strokeRoundedRect(size * 0.1, size * 0.12, size * 0.8, size * 0.76, size * 0.18);
    g.generateTexture(key, size, size);
  }
  g.destroy();
  return key;
}

/** Queue the FFRK strips for any `hero/<key>` sprite keys that have one (call from a scene's preload). */
export function loadHeroSheets(scene: Phaser.Scene, spriteKeys: Iterable<string>) {
  for (const key of new Set(spriteKeys)) {
    const sheet = heroSheetForSprite(key);
    if (sheet && !scene.textures.exists(key)) scene.load.spritesheet(key, sheet.url, { frameWidth: HERO_CELL, frameHeight: HERO_CELL });
    const weapon = sheet && weaponSprite(sheet.info.weapon);
    if (weapon && !scene.textures.exists(weapon.key)) scene.load.image(weapon.key, weapon.url);
  }
}

/** Animation key for a hero pose, optionally in a status look (Blind's glasses, Mini). */
export const heroAnimKey = (spriteKey: string, anim: HeroAnim, variant?: HeroVariant | null) =>
  variant ? `${spriteKey}:${variant}:${anim}` : `${spriteKey}:${anim}`;

/**
 * Register a hero's animations once its strip has loaded. False when the hero has no strip (or it failed to
 * load) — draw it with `ensurePlaceholder` instead. The strips face left, toward the enemies.
 */
export function ensureHeroAnims(scene: Phaser.Scene, spriteKey: string): boolean {
  const sheet = heroSheetForSprite(spriteKey);
  // A placeholder generated under the same key is a single frame, not a strip.
  if (!sheet || !scene.textures.exists(spriteKey) || scene.textures.get(spriteKey).frameTotal < sheet.info.frames) return false;
  for (const [anim, a] of Object.entries(sheet.info.anims)) {
    const key = heroAnimKey(spriteKey, anim as HeroAnim);
    if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(spriteKey, { frames: a.frames }), frameRate: a.frameRate, repeat: a.repeat });
    // The same pose in each status look (same timing, the variant's frames).
    for (const [variant, byAnim] of Object.entries(sheet.info.variants ?? {})) {
      const vkey = heroAnimKey(spriteKey, anim as HeroAnim, variant as HeroVariant);
      const frames = byAnim[anim as HeroAnim];
      if (frames && !scene.anims.exists(vkey)) scene.anims.create({ key: vkey, frames: scene.anims.generateFrameNumbers(spriteKey, { frames }), frameRate: a.frameRate, repeat: a.repeat });
    }
  }
  return true;
}

const THEMES: Record<string, [number, number, number]> = {
  grassland: [0x7ec0ee, 0x4f9a3a, 0x2f6a24],
  castle: [0x3a3f6a, 0x6a6a7a, 0x3a3a44],
  ruin: [0x6a2a2a, 0x7a5a3a, 0x3a2a1a],
  forest: [0x2a4a3a, 0x2f6a2a, 0x1a3a1a],
  ice: [0x9ac8e8, 0xc8e0f0, 0x7aa0c0],
  cave: [0x2a2420, 0x5a4a3a, 0x2a2018],
  marsh: [0x6a8a7a, 0x5a7a4a, 0x2a4a3a],
};

export function drawBattleBackground(scene: Phaser.Scene, theme: string, w: number, h: number) {
  const [sky, ground, deep] = THEMES[theme] ?? THEMES.grassland!;
  const g = scene.add.graphics();
  g.fillGradientStyle(sky, sky, ground, ground, 1);
  g.fillRect(0, 0, w, h * 0.55);
  g.fillGradientStyle(ground, ground, deep, deep, 1);
  g.fillRect(0, h * 0.55, w, h * 0.45);
  g.lineStyle(2, 0x000000, 0.15);
  for (let i = 0; i < 6; i++) g.lineBetween(0, h * 0.55 + i * i * 6, w, h * 0.55 + i * i * 6);
  g.setDepth(-10);
  return g;
}
