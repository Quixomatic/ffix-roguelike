/**
 * The battlefield: draws units and animates engine events. Game logic lives in game-core's BattleEngine —
 * this scene only reads state and plays effects; clicks on units are reported back for targeting.
 */
import { isShownUnit, type BattleEvent, type BattleState, type BattleUnit } from "@ffix-roguelike/game-core";
import Phaser from "phaser";

import { HERO_CELL, heroSheetForSprite, weaponSprite, type HeroAnim, type HeroRigFrame } from "@/features/sprites/hero-sheets";
import { drawBattleBackground, ensureHeroAnims, ensurePlaceholder, heroAnimKey, loadHeroSheets } from "@/features/sprites/sprites";

/** The reference layout size: unit positions are designed at 960×540 and scaled to the real canvas. */
export const BATTLE_W = 960;
export const BATTLE_H = 540;

export interface BattleBridge {
  getState(): BattleState;
  theme: string;
  onUnitClick(id: string): void;
  /** Set by the scene; the React side pushes engine events through it. */
  play?: (events: BattleEvent[]) => void;
  /** Units currently highlighted as possible targets. */
  highlighted: Set<string>;
  activeId: string | null;
}

interface UnitView {
  /** Party slot (0–3) — party members are laid out as a column in real pixels, not stretched. */
  partySlot?: number;
  backRow?: boolean;
  /** Where the unit stands in the 960×540 reference layout (scaled to the canvas in `layout`). */
  ref: { x: number; y: number };
  /** Placeholder scale at the reference size. */
  baseScale: number;
  sprite: Phaser.GameObjects.Sprite;
  home: { x: number; y: number };
  /** Centre to the top of the figure (where the cursor hangs). */
  top: number;
  /** Party member drawn from an FFRK strip: plays poses instead of the placeholder's tilt and bob. */
  animated: boolean;
  /** A one-shot pose (attack, hurt…) holds until this scene time. */
  holdUntil: number;
  cursor: Phaser.GameObjects.Text;
  /** ATB gauge under the unit (enemies too, so you can see who's about to act). */
  gauge: Phaser.GameObjects.Graphics;
  /** FFRK-style weapon rig: the weapon drawn between the body and the arm piece during attack frames. */
  rig?: { frames: (HeroRigFrame | null)[]; weapon: Phaser.GameObjects.Image; grip: [number, number]; arm: Phaser.GameObjects.Sprite };
}

const GAUGE_W = 56;
const GAUGE_H = 6;
/** FFRK strips are tiny (≈16×24); hero scale is an integer (crisp pixels) picked from the canvas height. */
const heroScaleFor = (h: number) => Phaser.Math.Clamp(Math.floor((3 * h) / BATTLE_H), 2, 5);
/** Empty cell rows above a standing hero's head. */
const HERO_HEADROOM = 8;

/** One-shot hero poses by command kind (or "damage"/"miss"), and how long each holds before the resting pose (ms). */
const ACTION_POSE: Record<string, { anim: HeroAnim; ms: number }> = {
  attack: { anim: "attack", ms: 650 },
  throw: { anim: "attack", ms: 650 },
  ability: { anim: "cast", ms: 900 },
  item: { anim: "item", ms: 700 },
  defend: { anim: "defend", ms: 500 },
  change: { anim: "ready", ms: 400 },
  flee: { anim: "ready", ms: 400 },
  damage: { anim: "hurt", ms: 450 },
  miss: { anim: "evade", ms: 400 },
};

export class BattleScene extends Phaser.Scene {
  private bridge!: BattleBridge;
  private views = new Map<string, UnitView>();
  private background?: Phaser.GameObjects.Graphics;
  /** Canvas size relative to the 960×540 reference, and the current integer hero scale. */
  private k = 1;
  private heroScale = 3;

  constructor() {
    super("battle");
  }

  init(data: { bridge: BattleBridge }) {
    this.bridge = data.bridge;
    this.views.clear();
  }

  preload() {
    loadHeroSheets(this, this.bridge.getState().units.filter((u) => u.side === "party").map((u) => u.sprite));
  }

  create() {
    const state = this.bridge.getState();
    const enemies = state.units.filter((u) => u.side === "enemy");
    const party = state.units.filter((u) => u.side === "party");

    enemies.forEach((u, i) => {
      const cols = enemies.length > 3 ? 2 : 1;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rows = Math.ceil(enemies.length / cols);
      const x = 200 + col * 150 + (row % 2) * 40;
      const y = 190 + (row - (rows - 1) / 2) * 100 + (u.boss ? 10 : 0);
      this.addUnit(u, x, y, 2);
    });
    party.forEach((u, i) => {
      const x = 690 + i * 30 + (u.backRow ? 60 : 0);
      const y = 95 + i * 66;
      this.addUnit(u, x, y, 1.6);
      const v = this.views.get(u.id)!;
      v.partySlot = i;
      v.backRow = u.backRow;
    });

    this.bridge.play = (events) => this.playEvents(events);
    // Fill the space we're given: lay out for the current size, and again whenever it changes.
    this.layout(this.scale.width, this.scale.height);
    this.scale.on("resize", (size: Phaser.Structs.Size) => this.layout(size.width, size.height));
  }

  /** Fit the battlefield to a canvas of w×h: background, unit positions and sizes. */
  private layout(w: number, h: number) {
    this.cameras.main.setSize(w, h);
    this.k = Math.min(w / BATTLE_W, h / BATTLE_H);
    this.heroScale = heroScaleFor(h);
    this.background?.destroy();
    this.background = drawBattleBackground(this, this.bridge.theme, w, h);
    // The party: an FF-style column on the right — spaced by sprite size, a slight step right per member, kept in
    // the upper part of the field (the menus cover the bottom).
    const partyViews = [...this.views.values()].filter((v) => v.partySlot != null);
    const spacing = HERO_CELL * this.heroScale * 0.8;
    const top = Math.max(spacing * 0.6, h * 0.36 - (spacing * (partyViews.length - 1)) / 2);
    for (const v of this.views.values()) {
      v.home =
        v.partySlot != null
          ? { x: w * 0.74 + v.partySlot * 8 * this.k + (v.backRow ? 36 * this.k : 0), y: top + v.partySlot * spacing }
          : { x: (v.ref.x / BATTLE_W) * w, y: (v.ref.y / BATTLE_H) * h };
      this.tweens.killTweensOf(v.sprite);
      v.sprite.setPosition(v.home.x, v.home.y).setScale(v.animated ? this.heroScale : v.baseScale * this.k);
      v.top = v.animated ? (HERO_CELL / 2 - HERO_HEADROOM) * this.heroScale : v.sprite.displayHeight / 2;
      v.cursor.setPosition(v.home.x, v.home.y - v.top - 18);
      v.rig?.weapon.setScale(this.heroScale);
      v.rig?.arm.setScale(this.heroScale);
    }
  }

  private addUnit(u: BattleUnit, x: number, y: number, scale: number) {
    const animated = u.side === "party" && ensureHeroAnims(this, u.sprite);
    const key = animated ? u.sprite : ensurePlaceholder(this, u.sprite, { family: u.family, boss: u.boss });
    const baseScale = u.side === "party" ? scale : u.boss ? 1.6 : 1.3;
    const sprite = this.add.sprite(x, y, key).setScale(animated ? this.heroScale : baseScale);
    if (u.side === "enemy") sprite.setFlipX(true);
    if (animated) sprite.play(heroAnimKey(u.sprite, "idle"));
    sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.bridge.onUnitClick(u.id));
    const top = animated ? (HERO_CELL / 2 - HERO_HEADROOM) * this.heroScale : sprite.displayHeight / 2;
    const cursor = this.add
      .text(x, y - top - 18, "▼", { fontFamily: "monospace", fontSize: "20px", color: "#ffffff" })
      .setOrigin(0.5)
      .setStroke("#000000", 4)
      .setVisible(false);
    const gauge = this.add.graphics().setDepth(20);
    this.views.set(u.id, { ref: { x, y }, baseScale, sprite, home: { x, y }, top, animated, holdUntil: 0, cursor, gauge, rig: animated ? this.addRig(u.sprite, sprite) : undefined });
  }

  /** The weapon and arm-piece layers for a hero strip (hidden until an attack frame needs them). */
  private addRig(spriteKey: string, body: Phaser.GameObjects.Sprite): UnitView["rig"] {
    const sheet = heroSheetForSprite(spriteKey);
    const w = sheet && weaponSprite(sheet.info.weapon);
    if (!sheet || !w || !this.textures.exists(w.key)) return undefined;
    const weapon = this.add.image(0, 0, w.key).setScale(this.heroScale).setOrigin(w.grip[0] / HERO_CELL, w.grip[1] / HERO_CELL).setDepth(body.depth + 1).setVisible(false);
    const arm = this.add.sprite(0, 0, spriteKey).setScale(this.heroScale).setDepth(body.depth + 2).setVisible(false);
    return { frames: sheet.info.rig, weapon, grip: w.grip, arm };
  }

  /** Show the weapon in the hero's hand on attack frames: body → weapon (grip on the hand, angled) → arm piece. */
  private syncRig(v: UnitView) {
    const rig = v.rig;
    if (!rig) return;
    const anim = v.sprite.anims.currentAnim;
    const frame = anim?.key.endsWith(":attack") && v.sprite.visible ? rig.frames[(v.sprite.anims.currentFrame?.index ?? 1) - 1] : null;
    rig.weapon.setVisible(!!frame);
    rig.arm.setVisible(!!frame);
    if (!frame) return;
    const s = v.sprite;
    rig.weapon
      .setPosition(s.x + (frame.hand[0] - HERO_CELL / 2) * this.heroScale, s.y + (frame.hand[1] - HERO_CELL / 2) * this.heroScale)
      .setAngle(frame.angle)
      .setAlpha(s.alpha);
    rig.arm.setPosition(s.x, s.y).setFrame(frame.arm).setAlpha(s.alpha);
    if (s.isTinted) {
      rig.weapon.setTint(s.tintTopLeft);
      rig.arm.setTint(s.tintTopLeft);
    } else {
      rig.weapon.clearTint();
      rig.arm.clearTint();
    }
  }

  private drawGauge(v: UnitView, u: BattleUnit, time: number, down: boolean) {
    const g = v.gauge;
    g.clear();
    if (down) return;
    const gw = GAUGE_W * Math.max(1, this.k);
    const gh = GAUGE_H * Math.max(1, this.k);
    const x = v.home.x - gw / 2;
    const y = v.home.y + v.sprite.displayHeight / 2 + 4;
    const pct = Math.min(1, u.atb / u.atbMax);
    const frozen = u.statuses.stop || u.statuses.sleep || u.statuses.petrify || u.statuses.freeze;
    g.fillStyle(0x000000, 0.65);
    g.fillRect(x - 1, y - 1, gw + 2, gh + 2);
    let color = u.side === "party" ? 0xffe066 : 0xff8a3a;
    // Enemies about to act flash red; full gauges glow white.
    if (pct >= 1) color = 0xffffff;
    else if (u.side === "enemy" && pct > 0.8) color = Math.sin(time / 80) > 0 ? 0xff3030 : 0xff8a3a;
    if (frozen) color = 0x8888aa;
    g.fillStyle(color, 1);
    g.fillRect(x, y, gw * pct, gh);
  }

  update(time: number) {
    const state = this.bridge.getState();
    // Change Row moves a party member back/forward.
    if (state.units.some((u) => this.views.get(u.id)?.partySlot != null && !!this.views.get(u.id)!.backRow !== !!u.backRow)) {
      for (const u of state.units) {
        const v = this.views.get(u.id);
        if (v?.partySlot != null) v.backRow = u.backRow;
      }
      this.layout(this.scale.width, this.scale.height);
    }
    for (const u of state.units) {
      const v = this.views.get(u.id);
      if (!v) continue;
      const down = u.hp <= 0 || u.statuses.death !== undefined;
      const stone = u.statuses.petrify !== undefined;
      const shown = isShownUnit(u);
      if (u.side === "enemy") v.sprite.setAlpha(!shown && !down ? 0 : down || u.removed ? Math.max(0, v.sprite.alpha - 0.03) : u.statuses.vanish ? 0.35 : 1);
      else if (v.animated) {
        v.sprite.setAlpha(u.statuses.jump ? 0 : u.statuses.vanish ? 0.35 : 1);
        this.pose(v, u, state);
      } else v.sprite.setAngle(down ? 90 : 0).setAlpha(down ? 0.6 : u.statuses.jump ? 0 : u.statuses.vanish ? 0.35 : 1);
      if (stone) v.sprite.setTint(0x888888);
      else if (u.statuses.trance) v.sprite.setTint(0xff99cc);
      else if (u.statuses.poison || u.statuses.venom) v.sprite.setTint(0xaaddaa);
      else v.sprite.clearTint();
      const targeted = this.bridge.highlighted.has(u.id);
      v.cursor.setVisible(targeted || this.bridge.activeId === u.id);
      v.cursor.setColor(targeted ? "#ffe066" : "#ffffff");
      v.cursor.y = v.home.y - v.top - 18 + Math.sin(time / 120) * 3;
      // Idle bob for living units (animated heroes breathe on their own).
      if (!v.animated && !down && !stone && !u.statuses.stop) v.sprite.y = v.home.y + Math.sin(time / 300 + v.home.x) * 2;
      this.syncRig(v);
      this.drawGauge(v, u, time, down || stone || !shown);
    }
  }

  /** The pose a hero rests in when no one-shot is holding: KO, victory, guard, turn ready, chanting, Low HP. */
  private restingPose(u: BattleUnit, state: BattleState): HeroAnim {
    if (u.hp <= 0 || u.statuses.death !== undefined) return "ko";
    if (state.outcome === "victory") return "victory";
    if (u.statuses.defend) return "defend";
    if (state.queue.some((q) => q.command.actorId === u.id && q.command.kind === "ability")) return "chant";
    if (state.ready.includes(u.id) || this.bridge.activeId === u.id || u.busyCommand) return "ready";
    // FF9's Low HP: under a sixth of max HP.
    if (u.statuses.lowHp !== undefined || u.hp < u.maxHp / 6) return "dying";
    return "idle";
  }

  private pose(v: UnitView, u: BattleUnit, state: BattleState) {
    const frozen = u.statuses.petrify || u.statuses.stop || u.statuses.freeze || u.statuses.sleep;
    if (frozen) {
      if (v.sprite.anims.isPlaying) v.sprite.anims.pause();
      return;
    }
    if (v.sprite.anims.isPaused) v.sprite.anims.resume();
    if (this.time.now < v.holdUntil) return;
    const key = heroAnimKey(u.sprite, this.restingPose(u, state));
    if (v.sprite.anims.currentAnim?.key !== key) v.sprite.play(key);
  }

  /** Play a one-shot pose on a hero (no-op for enemies, placeholders and the fallen). */
  private act(id: string, what: string) {
    const v = this.views.get(id);
    const p = ACTION_POSE[what];
    const u = this.bridge.getState().units.find((x) => x.id === id);
    if (!v?.animated || !p || !u || u.hp <= 0) return;
    v.sprite.play(heroAnimKey(u.sprite, p.anim));
    v.holdUntil = this.time.now + p.ms;
  }

  private playEvents(events: BattleEvent[]) {
    let popupIndex = 0;
    for (const ev of events) {
      switch (ev.type) {
        case "actionStart": {
          const v = this.views.get(ev.actorId);
          if (!v) break;
          const dir = this.bridge.getState().units.find((u) => u.id === ev.actorId)?.side === "party" ? -1 : 1;
          this.act(ev.actorId, ev.kind);
          this.tweens.add({ targets: v.sprite, x: v.home.x + dir * 40 * this.k, duration: 140, yoyo: true, ease: "Quad.easeOut" });
          break;
        }
        case "damage":
          this.popup(ev.targetId, ev.amount === 0 ? "0" : String(ev.amount), ev.mp ? "#c58cff" : ev.crit ? "#ffd84a" : "#ffffff", popupIndex++, ev.crit);
          if (!ev.mp && ev.amount > 0) {
            this.shake(ev.targetId);
            this.act(ev.targetId, "damage");
          }
          break;
        case "heal":
          this.popup(ev.targetId, String(ev.amount), ev.mp ? "#9ad0ff" : "#7dff8a", popupIndex++);
          break;
        case "miss":
          this.popup(ev.targetId, "Miss", "#dddddd", popupIndex++);
          this.act(ev.targetId, "miss");
          break;
        case "guard":
          this.popup(ev.targetId, "Guard", "#bbbbff", popupIndex++);
          break;
        case "statusOn":
          if (ev.status !== "defend" && ev.status !== "trance" && ev.status !== "lowHp" && ev.status !== "jump") this.popup(ev.targetId, ev.status.toUpperCase(), "#ffb3e6", popupIndex++, false, 14);
          break;
        case "revive": {
          this.popup(ev.targetId, "Revived", "#7dff8a", popupIndex++);
          const v = this.views.get(ev.targetId);
          if (v) v.holdUntil = 0;
          break;
        }
        case "tranceStart":
          this.popup(ev.unitId, "TRANCE!", "#ff66cc", popupIndex++, true);
          this.cameras.main.flash(250, 255, 120, 200);
          break;
        case "steal":
          if (ev.itemId != null) this.popup(ev.actorId, "Stole!", "#ffe066", popupIndex++);
          break;
        case "ko": {
          const v = this.views.get(ev.targetId);
          if (v) this.tweens.add({ targets: v.sprite, tint: 0xff0000, duration: 80, yoyo: true });
          break;
        }
      }
    }
  }

  private shake(id: string) {
    const v = this.views.get(id);
    if (!v) return;
    v.sprite.setTint(0xffffff);
    this.tweens.add({ targets: v.sprite, x: v.home.x + 6, duration: 40, yoyo: true, repeat: 2, onComplete: () => (v.sprite.x = v.home.x) });
  }

  private popup(id: string, text: string, color: string, index: number, big = false, size = 26) {
    const v = this.views.get(id);
    if (!v) return;
    const t = this.add
      .text(v.home.x + (index % 2) * 10, v.home.y - 10 - (index % 3) * 6, text, {
        fontFamily: '"Pixelify Sans", monospace',
        fontSize: `${Math.round((big ? size + 8 : size) * Math.max(1, this.k))}px`,
        color,
      })
      .setOrigin(0.5)
      .setStroke("#000000", 5)
      .setDepth(100);
    this.tweens.add({ targets: t, y: t.y - 46 * this.k, duration: 300, ease: "Back.easeOut" });
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 300, onComplete: () => t.destroy() });
  }
}

export function createBattleGame(parent: HTMLElement, bridge: BattleBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BATTLE_W,
    height: BATTLE_H,
    pixelArt: true,
    backgroundColor: "#000000",
    // Fill the host element; the scene lays itself out for the real size (see BattleScene.layout).
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add("battle", BattleScene, true, { bridge });
      },
    },
  });
}
