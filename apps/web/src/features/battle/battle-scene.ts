/**
 * The battlefield: draws units and animates engine events. Game logic lives in game-core's BattleEngine —
 * this scene only reads state and plays effects; clicks on units are reported back for targeting.
 */
import { ATB_MAX, type BattleEvent, type BattleState, type BattleUnit } from "@ffix-roguelike/game-core";
import Phaser from "phaser";

import { drawBattleBackground, ensurePlaceholder } from "@/features/sprites/sprites";

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
  sprite: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  cursor: Phaser.GameObjects.Text;
  /** ATB gauge under the unit (enemies too, so you can see who's about to act). */
  gauge: Phaser.GameObjects.Graphics;
}

const GAUGE_W = 56;
const GAUGE_H = 6;

export class BattleScene extends Phaser.Scene {
  private bridge!: BattleBridge;
  private views = new Map<string, UnitView>();

  constructor() {
    super("battle");
  }

  init(data: { bridge: BattleBridge }) {
    this.bridge = data.bridge;
    this.views.clear();
  }

  create() {
    drawBattleBackground(this, this.bridge.theme, BATTLE_W, BATTLE_H);
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
    });

    this.bridge.play = (events) => this.playEvents(events);
  }

  private addUnit(u: BattleUnit, x: number, y: number, scale: number) {
    const key = ensurePlaceholder(this, u.sprite, { family: u.family, boss: u.boss });
    const sprite = this.add.image(x, y, key).setScale(u.side === "party" ? scale : u.boss ? 1.6 : 1.3);
    if (u.side === "enemy") sprite.setFlipX(true);
    sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.bridge.onUnitClick(u.id));
    const cursor = this.add
      .text(x, y - sprite.displayHeight / 2 - 18, "▼", { fontFamily: "monospace", fontSize: "20px", color: "#ffffff" })
      .setOrigin(0.5)
      .setStroke("#000000", 4)
      .setVisible(false);
    const gauge = this.add.graphics().setDepth(20);
    this.views.set(u.id, { sprite, home: { x, y }, cursor, gauge });
  }

  private drawGauge(v: UnitView, u: BattleUnit, time: number, down: boolean) {
    const g = v.gauge;
    g.clear();
    if (down) return;
    const x = v.home.x - GAUGE_W / 2;
    const y = v.home.y + v.sprite.displayHeight / 2 + 4;
    const pct = Math.min(1, u.atb / ATB_MAX);
    const frozen = u.statuses.stop || u.statuses.sleep || u.statuses.petrify || u.statuses.freeze;
    g.fillStyle(0x000000, 0.65);
    g.fillRect(x - 1, y - 1, GAUGE_W + 2, GAUGE_H + 2);
    let color = u.side === "party" ? 0xffe066 : 0xff8a3a;
    // Enemies about to act flash red; full gauges glow white.
    if (pct >= 1) color = 0xffffff;
    else if (u.side === "enemy" && pct > 0.8) color = Math.sin(time / 80) > 0 ? 0xff3030 : 0xff8a3a;
    if (frozen) color = 0x8888aa;
    g.fillStyle(color, 1);
    g.fillRect(x, y, GAUGE_W * pct, GAUGE_H);
  }

  update(time: number) {
    const state = this.bridge.getState();
    for (const u of state.units) {
      const v = this.views.get(u.id);
      if (!v) continue;
      const down = u.hp <= 0 || u.statuses.death !== undefined;
      const stone = u.statuses.petrify !== undefined;
      if (u.side === "enemy") v.sprite.setAlpha(down ? Math.max(0, v.sprite.alpha - 0.03) : 1);
      else v.sprite.setAngle(down ? 90 : 0).setAlpha(down ? 0.6 : 1);
      if (stone) v.sprite.setTint(0x888888);
      else if (u.statuses.trance) v.sprite.setTint(0xff99cc);
      else if (u.statuses.poison || u.statuses.venom) v.sprite.setTint(0xaaddaa);
      else v.sprite.clearTint();
      const targeted = this.bridge.highlighted.has(u.id);
      v.cursor.setVisible(targeted || this.bridge.activeId === u.id);
      v.cursor.setColor(targeted ? "#ffe066" : "#ffffff");
      v.cursor.y = v.home.y - v.sprite.displayHeight / 2 - 18 + Math.sin(time / 120) * 3;
      // Idle bob for living units.
      if (!down && !stone && !u.statuses.stop) v.sprite.y = v.home.y + Math.sin(time / 300 + v.home.x) * 2;
      this.drawGauge(v, u, time, down || stone);
    }
  }

  private playEvents(events: BattleEvent[]) {
    let popupIndex = 0;
    for (const ev of events) {
      switch (ev.type) {
        case "actionStart": {
          const v = this.views.get(ev.actorId);
          if (!v) break;
          const dir = this.bridge.getState().units.find((u) => u.id === ev.actorId)?.side === "party" ? -1 : 1;
          this.tweens.add({ targets: v.sprite, x: v.home.x + dir * 40, duration: 140, yoyo: true, ease: "Quad.easeOut" });
          break;
        }
        case "damage":
          this.popup(ev.targetId, ev.amount === 0 ? "0" : String(ev.amount), ev.mp ? "#c58cff" : ev.crit ? "#ffd84a" : "#ffffff", popupIndex++, ev.crit);
          if (!ev.mp && ev.amount > 0) this.shake(ev.targetId);
          break;
        case "heal":
          this.popup(ev.targetId, String(ev.amount), ev.mp ? "#9ad0ff" : "#7dff8a", popupIndex++);
          break;
        case "miss":
          this.popup(ev.targetId, "Miss", "#dddddd", popupIndex++);
          break;
        case "statusOn":
          if (ev.status !== "defend" && ev.status !== "trance") this.popup(ev.targetId, ev.status.toUpperCase(), "#ffb3e6", popupIndex++, false, 14);
          break;
        case "revive":
          this.popup(ev.targetId, "Revived", "#7dff8a", popupIndex++);
          break;
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
        fontSize: `${big ? size + 8 : size}px`,
        color,
      })
      .setOrigin(0.5)
      .setStroke("#000000", 5)
      .setDepth(100);
    this.tweens.add({ targets: t, y: t.y - 46, duration: 300, ease: "Back.easeOut" });
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
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add("battle", BattleScene, true, { bridge });
      },
    },
  });
}
