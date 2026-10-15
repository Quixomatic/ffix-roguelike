/**
 * The FFRK hero strips (sliced by scripts/slice-hero-sprites.ts into public/sprites/heroes). Framework-free so
 * both the Phaser scenes and the React HeroSprite read the same frames. Heroes without a strip return
 * null and keep the pixel-art placeholder.
 */
import { HERO_CELL, HERO_SHEETS, WEAPON_GRIPS, type HeroAnim, type HeroRigFrame, type HeroSheetInfo } from "./hero-sheets.gen";

export { HERO_CELL, type HeroAnim, type HeroRigFrame };

/** Keys that share another hero's strip. */
const ALIASES: Record<string, string> = { dagger: "garnet" };

export interface HeroSheet {
  key: string;
  url: string;
  info: HeroSheetInfo;
}

export function heroSheet(heroKey: string): HeroSheet | null {
  const key = ALIASES[heroKey] ?? heroKey;
  const info = HERO_SHEETS[key];
  return info ? { key, url: `${import.meta.env.BASE_URL}sprites/heroes/${key}.png`, info } : null;
}

/** A weapon sprite (FFRK equip/weapon id): texture key, URL and grip point in its 32×32 cell. */
export function weaponSprite(id: number): { key: string; url: string; grip: [number, number] } | null {
  const grip = WEAPON_GRIPS[id];
  return grip ? { key: `weapon/${id}`, url: `${import.meta.env.BASE_URL}sprites/weapons/${id}.png`, grip } : null;
}

/** The hero strip behind a unit sprite key (`hero/zidane`), if any. */
export function heroSheetForSprite(spriteKey: string): HeroSheet | null {
  const [kind, name = ""] = spriteKey.split("/");
  return kind === "hero" ? heroSheet(name) : null;
}
