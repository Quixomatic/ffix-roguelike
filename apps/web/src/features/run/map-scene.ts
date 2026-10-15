/**
 * Super Mario World–style overworld: stages connected by dotted paths, the party walking between them.
 * Reads the run's WorldMap; clicking a reachable stage asks React to move there.
 */
import type { MapNode, NodeKind, WorldMap } from "@ffix-roguelike/game-core";
import Phaser from "phaser";

import { ensureHeroAnims, ensurePlaceholder, heroAnimKey, loadHeroSheets } from "@/features/sprites/sprites";

export const MAP_W = 960;
export const MAP_H = 540;

export interface MapBridge {
  map: WorldMap;
  position: string;
  visited: string[];
  leader: string;
  theme: string;
  onSelect(nodeId: string): void;
  onHover(node: MapNode | null): void;
  /** Set by the scene: animate the party walking to a node. */
  walkTo?: (nodeId: string) => void;
}

const NODE_STYLE: Record<NodeKind, { color: number; glyph: string; size: number }> = {
  start: { color: 0xffffff, glyph: "★", size: 16 },
  battle: { color: 0xd8483a, glyph: "⚔", size: 18 },
  elite: { color: 0x8a3ad8, glyph: "☠", size: 20 },
  semiboss: { color: 0xb8302a, glyph: "♛", size: 24 },
  treasure: { color: 0xe8c040, glyph: "◆", size: 17 },
  shop: { color: 0x3ab868, glyph: "$", size: 17 },
  synth: { color: 0xd88a3a, glyph: "⚒", size: 17 },
  stiltzkin: { color: 0xf0a0c8, glyph: "♪", size: 17 },
  chocobo: { color: 0xf0d040, glyph: "✦", size: 17 },
  moogle: { color: 0xf080b0, glyph: "✿", size: 18 },
  event: { color: 0x3a8ad8, glyph: "?", size: 17 },
  boss: { color: 0x202020, glyph: "♜", size: 28 },
};

/** Short always-visible labels under each stage (the React overlay shows the longer description on hover). */
const NODE_LABEL: Record<NodeKind, string> = {
  start: "Start",
  battle: "Battle",
  elite: "Elite",
  semiboss: "Fortress",
  treasure: "Treasure",
  shop: "Shop",
  synth: "Synth",
  stiltzkin: "Stiltzkin",
  chocobo: "Chocobo",
  moogle: "Moogle",
  event: "???",
  boss: "BOSS",
};

const THEME_COLORS: Record<string, { ground: number; dark: number; path: number; accent: number }> = {
  grassland: { ground: 0x5aa83a, dark: 0x3d7a28, path: 0xe0c890, accent: 0x7ec0ee },
  castle: { ground: 0x6a7a8a, dark: 0x4a5462, path: 0xc8c0a8, accent: 0x3a3f6a },
  ruin: { ground: 0x8a6a3a, dark: 0x5a4224, path: 0xd8b880, accent: 0x6a2a2a },
  forest: { ground: 0x2f6a2a, dark: 0x1c4a1c, path: 0xc8b070, accent: 0x3a5a3a },
  ice: { ground: 0xbcd8e8, dark: 0x8ab0c8, path: 0x6a8aa8, accent: 0x4a6a9a },
  cave: { ground: 0x5a4a3a, dark: 0x3a2e24, path: 0xb89a6a, accent: 0x2a2a3a },
  marsh: { ground: 0x5a7a4a, dark: 0x3a5a3a, path: 0xc8b890, accent: 0x4a8a8a },
};

const toPx = (n: { x: number; y: number }) => ({ x: (n.x / 100) * MAP_W, y: 60 + (n.y / 100) * (MAP_H - 120) });

export class MapScene extends Phaser.Scene {
  private bridge!: MapBridge;
  private party!: Phaser.GameObjects.Sprite;
  private pulses: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super("map");
  }

  init(data: { bridge: MapBridge }) {
    this.bridge = data.bridge;
    this.pulses = [];
  }

  preload() {
    loadHeroSheets(this, [`hero/${this.bridge.leader}`]);
  }

  create() {
    const b = this.bridge;
    const theme = THEME_COLORS[b.theme] ?? THEME_COLORS.grassland!;
    this.drawTerrain(theme);

    const byId = new Map(b.map.nodes.map((n) => [n.id, n]));
    const reachable = new Set(byId.get(b.position)?.next ?? []);
    const visited = new Set(b.visited);

    // Paths first so nodes sit on top.
    const paths = this.add.graphics();
    for (const n of b.map.nodes) {
      for (const id of n.next) {
        const m = byId.get(id)!;
        const a = toPx(n);
        const c = toPx(m);
        const walked = visited.has(n.id) && visited.has(m.id);
        const open = n.id === b.position && reachable.has(m.id);
        paths.fillStyle(walked ? 0x8a6a3a : open ? 0xfff2a8 : theme.path, walked ? 0.9 : 1);
        const steps = Math.max(4, Math.round(Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y) / 14));
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          // A gentle S-curve so paths wind like SMW's.
          const x = Phaser.Math.Linear(a.x, c.x, t);
          const y = Phaser.Math.Linear(a.y, c.y, t) + Math.sin(t * Math.PI) * (c.y === a.y ? 10 : 0);
          paths.fillCircle(x, y, 3.5);
        }
      }
    }

    for (const n of b.map.nodes) {
      const p = toPx(n);
      const style = NODE_STYLE[n.kind];
      const done = visited.has(n.id) && n.id !== b.position;
      const can = reachable.has(n.id);
      if (can) {
        const pulse = this.add.circle(p.x, p.y, style.size + 8, 0xfff2a8, 0.5);
        this.tweens.add({ targets: pulse, scale: 1.35, alpha: 0, duration: 900, repeat: -1 });
        this.pulses.push(pulse);
      }
      if (n.kind === "boss") this.drawCastle(p.x, p.y);
      else {
        this.add.circle(p.x, p.y + 4, style.size, 0x000000, 0.3);
        this.add.circle(p.x, p.y, style.size, done ? 0x9a9a9a : style.color).setStrokeStyle(3, 0xffffff);
      }
      const glyph = this.add
        .text(p.x, p.y + (n.kind === "boss" ? -4 : 0), style.glyph, { fontFamily: "serif", fontSize: `${style.size + 2}px`, color: "#ffffff" })
        .setOrigin(0.5)
        .setStroke("#000000", 3);
      if (done) glyph.setAlpha(0.6);
      const label = this.add
        .text(p.x, p.y + style.size + (n.kind === "boss" ? 30 : 9), NODE_LABEL[n.kind], {
          fontFamily: "\"Pixelify Sans\", monospace",
          fontSize: n.kind === "boss" ? "16px" : "13px",
          color: can ? "#fff2a8" : "#ffffff",
        })
        .setOrigin(0.5, 0)
        .setStroke("#000000", 4)
        .setDepth(5);
      if (done) label.setAlpha(0.55);
      const hit = this.add.circle(p.x, p.y, style.size + 10, 0xffffff, 0.001).setInteractive({ useHandCursor: can });
      hit.on("pointerover", () => b.onHover(n));
      hit.on("pointerout", () => b.onHover(null));
      if (can) hit.on("pointerdown", () => b.onSelect(n.id));
    }

    const here = toPx(byId.get(b.position)!);
    // The lead character walks the map: its FFRK strip at 2× (feet on the node), or the placeholder.
    const spriteKey = `hero/${b.leader}`;
    const animated = ensureHeroAnims(this, spriteKey);
    const key = animated ? spriteKey : ensurePlaceholder(this, spriteKey);
    this.party = this.add.sprite(here.x, here.y - 26, key).setScale(animated ? 2 : 0.9).setDepth(10);
    if (animated) this.party.play(heroAnimKey(spriteKey, "idle"));
    this.tweens.add({ targets: this.party, y: here.y - 30, duration: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    b.walkTo = (nodeId) => {
      const target = byId.get(nodeId);
      if (!target) return;
      const t = toPx(target);
      this.tweens.killTweensOf(this.party);
      if (animated) {
        // The strips face left; mirror when heading right.
        this.party.setFlipX(t.x > this.party.x).play(heroAnimKey(spriteKey, "walk"));
      }
      this.tweens.add({
        targets: this.party,
        x: t.x,
        y: t.y - 26,
        duration: 450,
        ease: "Quad.easeInOut",
        onComplete: () => {
          if (animated) this.party.play(heroAnimKey(spriteKey, "idle"));
        },
      });
    };
  }

  private drawTerrain(theme: { ground: number; dark: number; accent: number }) {
    const g = this.add.graphics();
    g.fillStyle(theme.ground, 1);
    g.fillRect(0, 0, MAP_W, MAP_H);
    // Checker tiles + scattered hills/trees for an SNES overworld feel (deterministic layout).
    g.fillStyle(theme.dark, 0.25);
    for (let x = 0; x < MAP_W; x += 32) for (let y = 0; y < MAP_H; y += 32) if (((x + y) / 32) % 2 === 0) g.fillRect(x, y, 32, 32);
    const rand = new Phaser.Math.RandomDataGenerator([this.bridge.map.world.toString()]);
    for (let i = 0; i < 28; i++) {
      const x = rand.between(0, MAP_W);
      const y = rand.between(0, MAP_H);
      if (rand.frac() < 0.5) {
        g.fillStyle(theme.dark, 0.9);
        g.fillEllipse(x, y, 70, 40);
        g.fillStyle(theme.ground, 1);
        g.fillEllipse(x - 6, y - 6, 50, 26);
      } else {
        g.fillStyle(0x2a5a1a, 1);
        g.fillCircle(x, y, 12);
        g.fillStyle(0x5a3a1a, 1);
        g.fillRect(x - 3, y + 8, 6, 10);
      }
    }
    g.fillStyle(theme.accent, 0.8);
    g.fillRect(0, MAP_H - 26, MAP_W, 26);
  }

  private drawCastle(x: number, y: number) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, y + 26, 70, 14);
    g.fillStyle(0x6a6a7a, 1);
    g.fillRect(x - 30, y - 22, 60, 46);
    g.fillRect(x - 36, y - 34, 16, 58);
    g.fillRect(x + 20, y - 34, 16, 58);
    g.fillStyle(0xb83a2e, 1);
    g.fillTriangle(x - 38, y - 34, x - 18, y - 34, x - 28, y - 52);
    g.fillTriangle(x + 18, y - 34, x + 38, y - 34, x + 28, y - 52);
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(x - 8, y + 4, 16, 20);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRect(x - 30, y - 22, 60, 46);
  }
}

export function createMapGame(parent: HTMLElement, bridge: MapBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: MAP_W,
    height: MAP_H,
    pixelArt: true,
    backgroundColor: "#000000",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add("map", MapScene, true, { bridge });
      },
    },
  });
}
