/**
 * The battlefield: draws units and animates engine events. Game logic lives in game-core's BattleEngine —
 * this scene only reads state and plays effects; clicks on units are reported back for targeting.
 */
import { isShownUnit, type BattleEvent, type BattleState, type BattleUnit } from "@ffix-roguelike/game-core";
import { bestiary, findItem } from "@ffix-roguelike/game-data";
import Phaser from "phaser";

import { playActionEffect, preloadEffects } from "@/features/effects/battle-effects";
import type { Action } from "@/features/input/actions";
import { PHASER_INPUT, SceneInput } from "@/features/input/scene-input";
import { preloadStatusLooks, StatusView } from "./status-view";
import { HERO_CELL, heroSheetForSprite, weaponSprite, type HeroAnim, type HeroRigFrame, type HeroVariant } from "@/features/sprites/hero-sheets";
import { enemyAnimKey, ensureEnemyAnims, loadEnemySheets, type EnemyAnim, type EnemySpriteInfo } from "@/features/sprites/enemy-sprites";
import { drawBattleBackground, ensureHeroAnims, ensurePlaceholder, heroAnimKey, loadHeroSheets } from "@/features/sprites/sprites";
import { assetUrl } from "@/lib/assets";

/** Texture key of the target glove (public/sprites/ui/hand-down.png, from the Time Fantasy icon pack). */
const HAND = "ui-hand-down";

/** The reference layout size: unit positions are designed at 960×540 and scaled to the real canvas. */
export const BATTLE_W = 960;
export const BATTLE_H = 540;

export interface BattleBridge {
  getState(): BattleState;
  theme: string;
  onUnitClick(id: string): void;
  /** Set by the scene; the React side pushes engine events through it. */
  play?: (events: BattleEvent[]) => void;
  /** Units currently highlighted as possible targets (yellow markers). */
  highlighted: Set<string>;
  /** The target(s) the menu is aiming at right now (the pointing glove): one unit, or all of them for "All". */
  aimed: Set<string>;
  /** Hovering a unit on the field aims at it (set by the battle view while choosing a target). */
  onUnitHover?: (id: string) => void;
  activeId: string | null;
  /** Battle speed (×1/×2/×4): effects play this much faster. */
  speed: number;
  /**
   * Set by the scene: when (Date.now() ms) each unit's incoming effect lands, and when the last one does. Until then
   * the menus show the unit as it was before the action (the engine has already applied the result).
   */
  impactAt: Map<string, number>;
  settleAt: number;
  /** Set by the battle view: the battle's controls (keyboard + controller through Phaser's input) as actions. */
  onAction?: (action: Action) => void;
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
  /** Until this scene time the unit keeps looking alive/unhurt: an effect is still on its way to hit it. */
  impactAt?: number;
  /** ATB fill shown while an effect is on its way (the engine zeroes a fallen unit's gauge at once). */
  lastAtb?: number;
  /** Showing a single status pose (stone/sleep): the next animation must restart. */
  still?: boolean;
  cursor: Phaser.GameObjects.Text;
  /** FF9-style pointing glove over the unit being aimed at. */
  hand: Phaser.GameObjects.Image;
  /** ATB gauge under the unit (enemies too, so you can see who's about to act). */
  gauge: Phaser.GameObjects.Graphics;
  /** Monster drawn from an FFRK sheet (idle/attack/damage/dead, white hit-flash cell). */
  ffrk?: EnemySpriteInfo;
  /** FFRK's status looks on this unit: balloon, aura, special rigs, Doom's countdown. */
  status: StatusView;
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
    const units = this.bridge.getState().units;
    loadHeroSheets(this, units.filter((u) => u.side === "party").map((u) => u.sprite));
    this.load.image(HAND, assetUrl("sprites/ui/hand-down.png"));
    preloadStatusLooks(this);
    loadEnemySheets(this, units.filter((u) => u.side === "enemy").map((u) => u.sprite));
  }

  create() {
    // The battle's controls: Phaser's keyboard and gamepad plugins, as actions for the battle menu (React). Held
    // directions repeat, like a menu cursor. Only while the battle has the controls (see owner.ts).
    new SceneInput(this, { repeat: true }).on((a) => this.bridge.onAction?.(a));
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

    this.preloadActionEffects(state);
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
      v.sprite.setPosition(v.home.x, v.home.y).setScale(v.animated ? this.heroScale : v.ffrk ? this.enemyScale() : v.baseScale * this.k);
      v.top = v.animated ? (HERO_CELL / 2 - HERO_HEADROOM) * this.heroScale : v.sprite.displayHeight / 2;
      v.cursor.setPosition(v.home.x, v.home.y - v.top - 18);
      v.hand.setScale(this.handScale()).setPosition(v.home.x, v.home.y - v.top - 18);
      v.rig?.weapon.setScale(this.heroScale);
      v.rig?.arm.setScale(this.heroScale);
    }
  }

  /** The target glove replaces the ▼ marker, a little bigger: 24 px (32 px on very large canvases). */
  private handScale() {
    return this.k >= 1.6 ? 2 : 1.5;
  }

  /** Monsters share the heroes' whole-number pixel scale (FFRK's size ratios); a crowd steps down one. */
  private enemyScale() {
    const crowd = [...this.views.values()].filter((v) => v.ffrk).length > 3;
    return Math.max(1, this.heroScale - (crowd ? 1 : 0));
  }

  private addUnit(u: BattleUnit, x: number, y: number, scale: number) {
    const animated = u.side === "party" && ensureHeroAnims(this, u.sprite);
    const ffrk = u.side === "enemy" ? ensureEnemyAnims(this, u.sprite) : null;
    const key = animated ? u.sprite : ffrk ? ffrk.texture : ensurePlaceholder(this, u.sprite, { family: u.family, boss: u.boss });
    const baseScale = u.side === "party" ? scale : u.boss ? 1.6 : 1.3;
    const sprite = this.add.sprite(x, y, key, 0).setScale(animated ? this.heroScale : ffrk ? this.heroScale : baseScale);
    // FFRK monsters already face the party; the placeholders are drawn facing left.
    if (u.side === "enemy" && !ffrk) sprite.setFlipX(true);
    if (animated) sprite.play(heroAnimKey(u.sprite, "idle"));
    if (ffrk) sprite.play(enemyAnimKey(ffrk.info, "idle"));
    sprite
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.bridge.onUnitClick(u.id))
      .on("pointerover", () => this.bridge.onUnitHover?.(u.id));
    const top = animated ? (HERO_CELL / 2 - HERO_HEADROOM) * this.heroScale : sprite.displayHeight / 2;
    const cursor = this.add
      .text(x, y - top - 18, "▼", { fontFamily: "monospace", fontSize: "20px", color: "#ffffff" })
      .setOrigin(0.5)
      .setStroke("#000000", 4)
      .setVisible(false);
    const gauge = this.add.graphics().setDepth(20);
    const hand = this.add.image(x, y - top - 18, HAND).setOrigin(0.5, 0.5).setScale(this.handScale()).setDepth(40).setVisible(false);
    const status = new StatusView(this, 30);
    this.views.set(u.id, { ref: { x, y }, baseScale, sprite, home: { x, y }, top, animated, holdUntil: 0, cursor, hand, gauge, status, ffrk: ffrk?.info, rig: animated ? this.addRig(u.sprite, sprite) : undefined });
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
    // Mini's tiny sprites swing nothing (the weapon is drawn for full-size poses only).
    const frame = anim?.key.endsWith(":attack") && !anim.key.includes(":mini:") && v.sprite.visible ? rig.frames[(v.sprite.anims.currentFrame?.index ?? 1) - 1] : null;
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
    // Hold the gauge where it was while an effect is still on its way (the engine already zeroed a fallen unit's).
    const incoming = this.time.now < (v.impactAt ?? 0);
    if (!incoming) v.lastAtb = Math.min(1, u.atb / u.atbMax);
    const pct = v.lastAtb ?? 0;
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
      // The engine has already applied the action; until its effect lands the unit still looks as it did.
      const down = (u.hp <= 0 || u.statuses.death !== undefined) && this.time.now >= (v.impactAt ?? 0);
      const stone = u.statuses.petrify !== undefined;
      const shown = isShownUnit(u);
      if (u.side === "enemy") {
        v.sprite.setAlpha(!shown && !down ? 0 : down || u.removed ? Math.max(0, v.sprite.alpha - 0.03) : u.statuses.vanish ? 0.35 : 1);
        if (v.ffrk) this.monsterPose(v, u, down);
      }
      else if (v.animated) {
        v.sprite.setAlpha(u.statuses.jump ? 0 : u.statuses.vanish ? 0.35 : 1);
        this.pose(v, u, state);
      } else v.sprite.setAngle(down ? 90 : 0).setAlpha(down ? 0.6 : u.statuses.jump ? 0 : u.statuses.vanish ? 0.35 : 1);
      if (stone && !(v.animated && heroSheetForSprite(u.sprite)?.info.poses.stone != null)) v.sprite.setTint(0x888888);
      else if (u.statuses.trance) v.sprite.setTint(0xff99cc);
      else if (u.statuses.poison || u.statuses.venom) v.sprite.setTint(0xaaddaa);
      else if (u.statuses.protect || u.statuses.shell) {
        // FFRK shows Protect and Shell as a colour pulsing on the body (its status_eff colour-change node): gold for
        // Protect, sea green for Shell, taking turns when both are up.
        const shell = !!u.statuses.shell && (!u.statuses.protect || Math.floor(time / 1500) % 2 === 1);
        const pulse = (Math.sin(time / 260) + 1) / 2;
        const to = shell ? [0x7f, 0xf0, 0xc8] : [0xff, 0xd2, 0x7a];
        const mix = (c: number) => Math.round(255 + (c - 255) * pulse * 0.7);
        v.sprite.setTint(Phaser.Display.Color.GetColor(mix(to[0]!), mix(to[1]!), mix(to[2]!)));
      } else v.sprite.clearTint();
      const targeted = this.bridge.highlighted.has(u.id);
      const aimed = this.bridge.aimed.has(u.id) && shown;
      // Yellow markers: every valid target; the glove points at the one(s) being aimed at.
      v.cursor.setVisible((targeted && !aimed) || (!targeted && this.bridge.activeId === u.id));
      v.cursor.setColor(targeted ? "#ffe066" : "#ffffff");
      v.cursor.y = v.home.y - v.top - 18 + Math.sin(time / 120) * 3;
      v.hand.setVisible(aimed);
      if (aimed) v.hand.y = v.cursor.y;
      // Idle bob for living units (animated heroes breathe on their own).
      if (!v.animated && !down && !stone && !u.statuses.stop && (v.ffrk?.anims.idle?.frames.length ?? 1) <= 1) v.sprite.y = v.home.y + Math.sin(time / 300 + v.home.x) * 2;
      this.syncRig(v);
      this.drawGauge(v, u, time, down || stone || !shown);
      // Status looks follow the unit (stepping forward too); a status an effect is still bringing waits for the hit.
      if (this.time.now >= (v.impactAt ?? 0))
        v.status.update(u.statuses, { x: v.sprite.x, y: v.home.y, top: v.top, scale: this.heroScale, facing: u.side === "party" ? 1 : -1 }, time, down || !shown || !!u.removed || u.statuses.jump !== undefined);
    }
  }

  /** The pose a hero rests in when no one-shot is holding: KO, victory, guard, turn ready, chanting, Low HP. */
  private restingPose(u: BattleUnit, state: BattleState): HeroAnim {
    // An effect is still on its way: keep standing until it hits (the engine already applied the result).
    const incoming = this.time.now < (this.views.get(u.id)?.impactAt ?? 0);
    if (incoming) return state.ready.includes(u.id) || this.bridge.activeId === u.id ? "ready" : "idle";
    if (u.hp <= 0 || u.statuses.death !== undefined) return "ko";
    if (state.outcome === "victory") return "victory";
    if (u.statuses.defend) return "defend";
    if (state.queue.some((q) => q.command.actorId === u.id && q.command.kind === "ability")) return "chant";
    if (state.ready.includes(u.id) || this.bridge.activeId === u.id || u.busyCommand) return "ready";
    // FF9's Low HP: under a sixth of max HP.
    if (u.statuses.lowHp !== undefined || u.hp < u.maxHp / 6) return "dying";
    return "idle";
  }

  /** FFRK's status looks: Mini's small sprites, Blind's glasses. */
  private variantOf(u: BattleUnit): HeroVariant | null {
    if (u.statuses.mini !== undefined) return "mini";
    if (u.statuses.blind !== undefined) return "blind";
    return null;
  }

  private pose(v: UnitView, u: BattleUnit, state: BattleState) {
    // Petrify and Sleep have their own single FFRK poses (stone statue, asleep) when the KO pose isn't showing.
    const poses = heroSheetForSprite(u.sprite)?.info.poses;
    const still = u.hp > 0 && u.statuses.death === undefined ? (u.statuses.petrify !== undefined ? poses?.stone : u.statuses.sleep !== undefined ? poses?.sleep : undefined) : undefined;
    if (still != null) {
      v.sprite.anims.stop();
      v.sprite.setFrame(still);
      v.still = true;
      return;
    }
    const wasStill = v.still;
    v.still = false;
    const frozen = u.statuses.petrify || u.statuses.stop || u.statuses.freeze || u.statuses.sleep;
    if (frozen) {
      if (v.sprite.anims.isPlaying) v.sprite.anims.pause();
      return;
    }
    if (v.sprite.anims.isPaused) v.sprite.anims.resume();
    if (this.time.now < v.holdUntil && !wasStill) return;
    const key = heroAnimKey(u.sprite, this.restingPose(u, state), this.variantOf(u));
    if (wasStill || v.sprite.anims.currentAnim?.key !== key) v.sprite.play(key);
  }

  /** FFRK monsters: freeze on Stop/Petrify/Freeze/Sleep, fall on KO, otherwise idle once a one-shot ends. */
  private monsterPose(v: UnitView, u: BattleUnit, down: boolean) {
    const info = v.ffrk!;
    const frozen = u.statuses.petrify || u.statuses.stop || u.statuses.freeze || u.statuses.sleep;
    if (frozen && !down) {
      if (v.sprite.anims.isPlaying) v.sprite.anims.pause();
      return;
    }
    if (v.sprite.anims.isPaused) v.sprite.anims.resume();
    const want: EnemyAnim = down && info.anims.dead ? "dead" : "idle";
    if (down && v.sprite.anims.currentAnim?.key === enemyAnimKey(info, "dead")) return;
    if (!down && this.time.now < v.holdUntil) return;
    if (v.sprite.anims.currentAnim?.key !== enemyAnimKey(info, want)) v.sprite.play(enemyAnimKey(info, want));
  }

  /** A one-shot on an FFRK monster: its own attack/damage animation, or the white hit flash. */
  private actMonster(v: UnitView, what: string) {
    const info = v.ffrk!;
    const anim: EnemyAnim | null = what === "attack" || what === "ability" || what === "throw" ? "attack" : what === "damage" ? "damage" : null;
    if (!anim) return;
    const a = info.anims[anim];
    if (a) {
      v.sprite.play(enemyAnimKey(info, anim));
      v.holdUntil = this.time.now + (a.frames.length / a.fps) * 1000;
    } else if (anim === "damage" && info.white != null) {
      v.sprite.anims.stop();
      v.sprite.setFrame(info.white);
      v.holdUntil = this.time.now + 120;
      this.time.delayedCall(120, () => v.sprite.anims.currentAnim && v.sprite.play(enemyAnimKey(info, "idle")));
    }
  }

  /** Play a one-shot pose on a hero or FFRK monster (no-op for placeholders and the fallen). */
  private act(id: string, what: string) {
    const v = this.views.get(id);
    const p = ACTION_POSE[what];
    const u = this.bridge.getState().units.find((x) => x.id === id);
    if (v?.ffrk && u && u.hp > 0) return this.actMonster(v, what);
    if (!v?.animated || !p || !u || u.hp <= 0) return;
    v.sprite.play(heroAnimKey(u.sprite, p.anim, this.variantOf(u)));
    v.holdUntil = this.time.now + p.ms;
  }

  /** Load the FFRK effects of every move this fight can see: party commands, monster AI rules, the FF9 scene's attacks. */
  private preloadActionEffects(state: BattleState) {
    const ids = new Set<number>([176, 1000]);
    for (const u of state.units) {
      for (const c of u.commands ?? []) c.actionIds.forEach((id) => ids.add(id));
      for (const r of u.ai ?? []) ids.add(r.actionId);
    }
    const scene = state.scene ? bestiary.scenes.find((s) => s.id === state.scene) : undefined;
    for (const uid of scene?.attacks ?? []) if (uid >= 0) ids.add(2000 + uid);
    // Items in the bag (an item's battle action id is minus its item id).
    for (const c of state.inventory ?? []) if (c.count > 0) ids.add(-c.itemId);
    preloadEffects(
      this,
      ids,
      state.units.filter((u) => u.side === "party").map((u) => u.sprite),
    );
  }

  /** Engine results that belong to an action's impact (shown when its effect's hit lands). */
  private static readonly IMPACT = new Set<BattleEvent["type"]>(["damage", "heal", "miss", "guard", "statusOn", "revive", "steal", "ko"]);

  private playEvents(events: BattleEvent[]) {
    let popupIndex = 0;
    /** ms until the current action's effect hits (0 = no effect: show results at once). */
    let impact = 0;
    for (const ev of events) {
      if (ev.type === "actionStart") {
        impact = this.startEffect(ev);
        if (impact > 0) {
          const wall = Date.now() + impact;
          this.bridge.settleAt = Math.max(this.bridge.settleAt, wall);
          for (const id of ev.targetIds) {
            const v = this.views.get(id);
            if (v) v.impactAt = Math.max(v.impactAt ?? 0, this.time.now + impact);
            this.bridge.impactAt.set(id, Math.max(this.bridge.impactAt.get(id) ?? 0, wall));
          }
        }
      }
      const index = popupIndex++;
      if (impact > 0 && BattleScene.IMPACT.has(ev.type)) this.time.delayedCall(impact, () => this.playEvent(ev, index));
      else this.playEvent(ev, index);
    }
  }

  /** Play the FFRK effect for an action; returns the ms until its hit lands (0 when there's none). */
  private startEffect(ev: Extract<BattleEvent, { type: "actionStart" }>): number {
    const from = this.views.get(ev.actorId);
    if (!from) return 0;
    const to = ev.targetIds.map((id) => this.views.get(id)).filter((v): v is UnitView => !!v);
    return (
      playActionEffect(this, ev.actionId, {
        from: { x: from.home.x, y: from.home.y },
        to: to.map((v) => ({ x: v.home.x, y: v.home.y })),
        scale: this.heroScale,
        speed: this.bridge.speed,
      }, this.bridge.getState().units.find((u) => u.id === ev.actorId)?.sprite) ?? 0
    );
  }

  private playEvent(ev: BattleEvent, popupIndex: number) {
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
        this.popup(ev.targetId, ev.amount === 0 ? "0" : String(ev.amount), ev.mp ? "#c58cff" : ev.crit ? "#ffd84a" : "#ffffff", popupIndex, ev.crit);
        if (!ev.mp && ev.amount > 0) {
          this.shake(ev.targetId);
          this.act(ev.targetId, "damage");
        }
        break;
      case "heal":
        this.popup(ev.targetId, String(ev.amount), ev.mp ? "#9ad0ff" : "#7dff8a", popupIndex);
        break;
      case "miss":
        this.popup(ev.targetId, "Miss", "#dddddd", popupIndex);
        this.act(ev.targetId, "miss");
        break;
      case "guard":
        this.popup(ev.targetId, "Guard", "#bbbbff", popupIndex);
        break;
      case "statusOn":
        if (ev.status !== "defend" && ev.status !== "trance" && ev.status !== "lowHp" && ev.status !== "jump") this.popup(ev.targetId, ev.status.toUpperCase(), "#ffb3e6", popupIndex, false, 14);
        break;
      case "revive": {
        this.popup(ev.targetId, "Revived", "#7dff8a", popupIndex);
        const v = this.views.get(ev.targetId);
        if (v) v.holdUntil = 0;
        break;
      }
      case "tranceStart":
        this.popup(ev.unitId, "TRANCE!", "#ff66cc", popupIndex, true);
        this.cameras.main.flash(250, 255, 120, 200);
        break;
      case "steal":
        // Over the target, when the steal lands: what was taken, or that it failed (the banner says why).
        if (ev.itemId != null) this.popup(ev.targetId, `Stole ${findItem(ev.itemId)?.name ?? "it"}!`, "#ffe066", popupIndex, false, 20);
        else this.popup(ev.targetId, "Miss", "#dddddd", popupIndex);
        break;
      case "ko": {
        const v = this.views.get(ev.targetId);
        if (v) this.tweens.add({ targets: v.sprite, tint: 0xff0000, duration: 80, yoyo: true });
        break;
      }
    }
  }

  private shake(id: string) {
    const v = this.views.get(id);
    if (!v) return;
    if (!v.ffrk) v.sprite.setTint(0xffffff);
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
    ...PHASER_INPUT,
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add("battle", BattleScene, true, { bridge });
      },
    },
  });
}
