/**
 * Sprite manifest. Every unit references a sprite key (`hero/zidane`, `enemy/goblin`, `boss/garland`).
 * Until the FFRK sheets are imported, `ensurePlaceholder` draws a pixel-art stand-in for each key, so real
 * art can drop in later by registering a texture with the same key — no game code changes.
 */
import type Phaser from "phaser";

const HERO_COLORS: Record<string, [number, number]> = {
  zidane: [0x3b6fd8, 0xf2c14e], // blue vest, blond
  vivi: [0x2a4fa0, 0xe8d26a], // blue coat, straw hat
  garnet: [0xe08a2c, 0x2b1d14], // orange jumpsuit, dark hair
  steiner: [0x9aa3ad, 0x5a5f66], // plate armour
  freya: [0xa8323a, 0xc9c2b8], // red coat, grey
  quina: [0xd9a6b8, 0x5d8a3a], // pink, green
  eiko: [0xf0e6d8, 0x6b4bb0], // white, purple hair
  amarant: [0x2f8f6b, 0xd94a3a], // green, red hair
  beatrix: [0x6e4a2e, 0xd8d0c0],
  blank: [0x7a5a3a, 0xc94f2f],
  marcus: [0x4a6a8a, 0x2e2e2e],
  cinna: [0x8a7a5a, 0x7a3a2a],
};

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
    const [body, hair] = HERO_COLORS[name] ?? [0x888888, 0x444444];
    // 24×32 chibi: hair, face, body, legs — drawn at 2× for crisp scaling.
    const px = (x: number, y: number, w: number, h: number, c: number) => {
      g.fillStyle(c, 1);
      g.fillRect(x * 2, y * 2, w * 2, h * 2);
    };
    px(7, 1, 10, 4, hair);
    px(6, 4, 12, 9, 0xf3c9a0);
    px(6, 4, 12, 3, hair);
    px(9, 8, 2, 2, 0x1a1a1a);
    px(13, 8, 2, 2, 0x1a1a1a);
    px(5, 13, 14, 10, body);
    px(3, 14, 3, 7, 0xf3c9a0);
    px(18, 14, 3, 7, 0xf3c9a0);
    px(7, 23, 4, 7, 0x3a2a1a);
    px(13, 23, 4, 7, 0x3a2a1a);
    g.generateTexture(key, 48, 64);
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

const THEMES: Record<string, [number, number, number]> = {
  grassland: [0x7ec0ee, 0x4f9a3a, 0x2f6a24],
  castle: [0x3a3f6a, 0x6a6a7a, 0x3a3a44],
  ruin: [0x6a2a2a, 0x7a5a3a, 0x3a2a1a],
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
