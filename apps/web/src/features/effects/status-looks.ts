/**
 * How each FF9 status looks on the battlefield, FFRK's way (its client's scenes/battle/view/StatusAilmentsView;
 * assets from `scripts/fetch-ffrk-status.ts`):
 *
 * - **Balloons** — a bubble icon over the unit's head (`ab/battle/status_icon/<n>.png`, n = FFRK status id − 199).
 *   Several statuses take turns, 0.75 s each (FFRK's BALLOON_INTERVAL).
 * - **Auras** — looping effects on the unit, the tagged sections of `ab/character/common/status_eff.json`
 *   (FFRK's AURA_TAG). Several take turns, 1.5 s each (FFRK's INTERVAL).
 * - **Specials** — rigs of their own that play while the status lasts (Freeze's ice, Trance).
 * - **Countdowns** — Doom's (and Gradual Petrify's) number over the head, FFRK's death_num.
 *
 * FF9 statuses FFRK never had get the closest FFRK art (Heat → soul fire, Zombie → skull, Virus → dark orb,
 * Trouble → the wavy bubble). Blind, Mini, Sleep and Stone change the sprite itself (hero sheets), Vanish fades it.
 * Pure data (no Phaser), so the asset packer can list the files.
 */
import type { Status } from "@ffix-roguelike/game-data";

export const STATUS_EFF_RIG = "ab/character/common/status_eff.json";
export const STATUS_SPECIAL_RIGS = {
  freeze: "ab/character/common/special/status_eff_frozen.json",
  trance: "ab/character/common/special/status_eff_trance.json",
} as const;

export const balloonPath = (n: number) => `ab/battle/status_icon/${n}.png`;

/** Balloon icon per status (FFRK: Poison 1, Silence 2, Paralysis 3, Confuse 4, Stop 7, Blind 11, Sleep 12, Berserk 16). In the order they take turns. */
export const BALLOON: Partial<Record<Status, number>> = {
  confuse: 4,
  berserk: 16,
  sleep: 12,
  stop: 7,
  silence: 2,
  blind: 11,
  poison: 1,
  venom: 1,
  zombie: 24,
  virus: 25,
  trouble: 26,
};

/**
 * Aura tag (in STATUS_EFF_RIG) per status, in the order they take turns. Protect and Shell have no particles in FFRK
 * (their tags drive a colour change on the body), so the battle scene pulses the sprite's colour for those.
 */
export const AURA: Partial<Record<Status, string>> = {
  haste: "eff_light_haste",
  slow: "eff_light_slow",
  reflect: "eff_light_reflect",
  regen: "eff_light_regene",
  autoLife: "eff_light_reraise",
  heat: "eff_soulfire",
};

/** Statuses with their own looping rig. */
export const SPECIAL: Partial<Record<Status, string>> = {
  freeze: STATUS_SPECIAL_RIGS.freeze,
  trance: STATUS_SPECIAL_RIGS.trance,
};

/** Statuses that count down over the head (the counter on the status timer). */
export const COUNTDOWN: Partial<Record<Status, string>> = { doom: "#ff6a6a", gradualPetrify: "#c8c8d0" };

/** FFRK's timings. */
export const BALLOON_INTERVAL = 750;
export const AURA_INTERVAL = 1500;

/** Every file the status looks use (for the asset pack). */
export function statusLookPaths(): string[] {
  return [STATUS_EFF_RIG, ...Object.values(STATUS_SPECIAL_RIGS), ...[...new Set(Object.values(BALLOON))].map((n) => balloonPath(n!))];
}
