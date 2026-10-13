/**
 * Placeholder pixel art shared by Phaser (battlefield, overworld) and React (menus, results, paperdoll), so
 * every screen shows the same character until the FFRK sheets replace it. Grid units; render at any scale.
 */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
}

export const HERO_COLORS: Record<string, [number, number]> = {
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

export const HERO_GRID = { w: 24, h: 32 };

const SKIN = 0xf3c9a0;
const EYE = 0x1a1a1a;
const BOOT = 0x3a2a1a;

/** The 24×32 chibi: hair, face, eyes, body, arms, legs. */
export function heroPixels(key: string): PixelRect[] {
  const [body, hair] = HERO_COLORS[key] ?? [0x888888, 0x444444];
  return [
    { x: 7, y: 1, w: 10, h: 4, color: hair },
    { x: 6, y: 4, w: 12, h: 9, color: SKIN },
    { x: 6, y: 4, w: 12, h: 3, color: hair },
    { x: 9, y: 8, w: 2, h: 2, color: EYE },
    { x: 13, y: 8, w: 2, h: 2, color: EYE },
    { x: 5, y: 13, w: 14, h: 10, color: body },
    { x: 3, y: 14, w: 3, h: 7, color: SKIN },
    { x: 18, y: 14, w: 3, h: 7, color: SKIN },
    { x: 7, y: 23, w: 4, h: 7, color: BOOT },
    { x: 13, y: 23, w: 4, h: 7, color: BOOT },
  ];
}

export const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
