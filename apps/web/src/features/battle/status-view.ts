/**
 * One unit's status looks on the battlefield, FFRK's way (see effects/status-looks.ts): the balloon over its head
 * (statuses taking turns every 0.75 s, popping open and closed), the aura looping on it (every 1.5 s), the special
 * rigs (Freeze's ice), Trance's burst going in and out, and Doom's countdown. Driven each frame from the unit's statuses.
 */
import type { StatusTimer } from "@ffix-roguelike/game-core";
import type { Status } from "@ffix-roguelike/game-data";
import Phaser from "phaser";

import { FfrkEffectPlayer, loadEffect, type EffectAsset } from "@/features/effects/ffrk-effect";
import { AURA, AURA_INTERVAL, BALLOON, BALLOON_INTERVAL, balloonPath, BURST, COUNTDOWN, SPECIAL, STATUS_EFF_RIG } from "@/features/effects/status-looks";
import { assetUrl } from "@/lib/assets";

const BALLOON_ORDER = Object.keys(BALLOON) as Status[];
const AURA_ORDER = Object.keys(AURA) as Status[];
const balloonKey = (n: number) => `status-balloon:${n}`;

/** Queue the balloon icons (call from the scene's preload). */
export function preloadStatusLooks(scene: Phaser.Scene) {
  for (const n of new Set(Object.values(BALLOON))) scene.load.image(balloonKey(n!), assetUrl(`effects/${balloonPath(n!)}`));
}

/** Where a unit is: its centre, how far up its head is, its pixel scale, and which way its back is (+1 = right). */
export interface UnitAnchor {
  x: number;
  y: number;
  top: number;
  scale: number;
  /** The side behind the unit: +1 for the party (they face left, toward the enemies), -1 for enemies. */
  facing?: 1 | -1;
}

/** The balloon's height in the units' art pixels (the icons are 64 px; heroes are drawn on 32-px cells). */
const BALLOON_ART = 13;
/** How far behind the head it sits, and how far above it, in art pixels. */
const BALLOON_BEHIND = 7;
const BALLOON_GAP = 1;
/** Scale for a balloon icon so it's BALLOON_ART art pixels tall at this unit's pixel scale. */
const balloonScale = (at: UnitAnchor) => (BALLOON_ART * at.scale) / 64;

export class StatusView {
  private balloon: Phaser.GameObjects.Image;
  private balloonNo: number | null = null;
  private balloonIdx = 0;
  private balloonAt = 0;
  private aura: FfrkEffectPlayer | null = null;
  private auraTag: string | null = null;
  private auraIdx = 0;
  private auraAt = 0;
  private specials = new Map<string, FfrkEffectPlayer>();
  /** Special rigs being loaded. */
  private loading = new Set<string>();
  private countdown: Phaser.GameObjects.Text;
  private destroyed = false;
  /** BURST statuses the unit had last frame, and their one-shot rigs still playing (they follow the unit). */
  private bursting = new Set<Status>();
  private bursts = new Set<FfrkEffectPlayer>();

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
  ) {
    this.balloon = scene.add.image(0, 0, "__DEFAULT").setVisible(false).setDepth(depth + 2);
    this.countdown = scene.add
      .text(0, 0, "", { fontFamily: '"Pixelify Sans", monospace', fontSize: "18px", color: "#ff6a6a", fontStyle: "bold" })
      .setOrigin(0.5, 1)
      .setStroke("#000000", 5)
      .setDepth(depth + 3)
      .setVisible(false);
  }

  /** Update from the unit's statuses (`hidden`: KO'd, gone or not drawn — show nothing). */
  update(statuses: Partial<Record<Status, StatusTimer>>, at: UnitAnchor, time: number, hidden: boolean) {
    if (this.destroyed) return;
    const has = (s: Status) => !hidden && statuses[s] !== undefined;
    this.updateBalloon(BALLOON_ORDER.filter(has), at, time);
    this.updateAura(AURA_ORDER.filter(has), at, time);
    this.updateSpecials((Object.keys(SPECIAL) as Status[]).filter(has), at);
    this.updateBursts(statuses, at, hidden);
    const count = (Object.keys(COUNTDOWN) as Status[]).find((s) => has(s) && statuses[s]?.counter != null);
    if (count) {
      this.countdown
        .setText(String(statuses[count]!.counter))
        .setColor(COUNTDOWN[count]!)
        .setScale(Math.max(0.6, at.scale / 3))
        .setPosition(at.x, at.y - at.top - (this.balloon.visible ? BALLOON_ART + BALLOON_GAP + 3 : 3) * at.scale)
        .setVisible(true);
    } else this.countdown.setVisible(false);
  }

  private updateBalloon(active: Status[], at: UnitAnchor, time: number) {
    if (!active.length) {
      if (this.balloonNo != null) {
        // FFRK's status_close: shrink away.
        this.balloonNo = null;
        this.scene.tweens.add({ targets: this.balloon, scale: 0, duration: 120, onComplete: () => this.balloonNo == null && this.balloon.setVisible(false) });
      }
      return;
    }
    if (time - this.balloonAt >= BALLOON_INTERVAL) {
      this.balloonIdx++;
      this.balloonAt = time;
    }
    const n = BALLOON[active[this.balloonIdx % active.length]!]!;
    const size = balloonScale(at);
    // Just above the head and a little behind it (the bubble's tail points down toward the head), bobbing gently.
    this.balloon.setPosition(at.x + (at.facing ?? 1) * BALLOON_BEHIND * at.scale, at.y - at.top - BALLOON_GAP * at.scale + Math.sin(time / 250) * at.scale * 0.4);
    if (n !== this.balloonNo) {
      const opening = this.balloonNo == null;
      this.balloonNo = n;
      if (!this.scene.textures.exists(balloonKey(n))) return;
      this.balloon.setTexture(balloonKey(n)).setVisible(true).setOrigin(0.5, 1);
      // FFRK's status_open pops the bubble in; swapping icons gives it a little bounce.
      this.scene.tweens.killTweensOf(this.balloon);
      this.balloon.setScale(opening ? 0 : size * 0.8);
      this.scene.tweens.add({ targets: this.balloon, scale: size, duration: opening ? 180 : 90, ease: "Back.easeOut" });
    }
  }

  private updateAura(active: Status[], at: UnitAnchor, time: number) {
    if (time - this.auraAt >= AURA_INTERVAL) {
      this.auraIdx++;
      this.auraAt = time;
    }
    const tag = active.length ? AURA[active[this.auraIdx % active.length]!]! : null;
    if (tag !== this.auraTag) {
      this.auraTag = tag;
      this.aura?.destroy();
      this.aura = null;
      if (tag) this.start(STATUS_EFF_RIG, tag, at, (p) => (this.auraTag === tag ? (this.aura = p) : p.destroy()));
    }
    this.aura?.container.setPosition(at.x, at.y).setScale(at.scale);
  }

  private updateSpecials(active: Status[], at: UnitAnchor) {
    const want = new Set(active.map((s) => SPECIAL[s]!));
    for (const [rig, p] of this.specials) {
      if (want.has(rig)) continue;
      p.destroy();
      this.specials.delete(rig);
    }
    for (const rig of this.loading) if (!want.has(rig)) this.loading.delete(rig);
    for (const rig of want) {
      if (this.specials.has(rig) || this.loading.has(rig)) continue;
      this.loading.add(rig);
      this.start(rig, undefined, at, (p) => {
        // Still wanted when it finished loading?
        if (!this.loading.delete(rig)) return p.destroy();
        this.specials.set(rig, p);
      });
    }
    for (const p of this.specials.values()) p.container.setPosition(at.x, at.y).setScale(at.scale);
  }

  /** Play a BURST status's rig once as it begins and once as it ends (not when the unit is KO'd or gone). */
  private updateBursts(statuses: Partial<Record<Status, StatusTimer>>, at: UnitAnchor, hidden: boolean) {
    for (const s of Object.keys(BURST) as Status[]) {
      const on = statuses[s] !== undefined;
      if (on === this.bursting.has(s)) continue;
      if (on) this.bursting.add(s);
      else this.bursting.delete(s);
      if (hidden) continue;
      const b = BURST[s]!;
      void loadEffect(this.scene, b.rig).then((asset) => {
        if (!asset || this.destroyed || !this.scene.sys.isActive()) return;
        const p: FfrkEffectPlayer = new FfrkEffectPlayer(this.scene, asset, { x: at.x, y: at.y, scale: at.scale, tag: on ? b.on : b.off, depth: this.depth + 1, onDone: () => this.bursts.delete(p) });
        this.bursts.add(p);
      });
    }
    for (const p of this.bursts) p.container.setPosition(at.x, at.y).setScale(at.scale);
  }

  /** Load a rig and loop it (a tag of it, or the whole rig) on the unit. */
  private start(rig: string, tag: string | undefined, at: UnitAnchor, ready: (p: FfrkEffectPlayer) => void) {
    void loadEffect(this.scene, rig).then((asset: EffectAsset | null) => {
      if (!asset || this.destroyed || !this.scene.sys.isActive()) return;
      ready(new FfrkEffectPlayer(this.scene, asset, { x: at.x, y: at.y, scale: at.scale, loop: true, mute: true, tag, depth: this.depth + 1 }));
    });
  }

  destroy() {
    this.destroyed = true;
    this.aura?.destroy();
    for (const p of this.specials.values()) p.destroy();
    for (const p of this.bursts) p.destroy();
    this.balloon.destroy();
    this.countdown.destroy();
  }
}
