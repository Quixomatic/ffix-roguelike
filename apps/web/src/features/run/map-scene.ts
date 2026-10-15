/**
 * Super Mario World–style overworld: stages on a tile grid joined by orthogonal beaded roads, the party walking
 * them with the camera zoomed in and following. Layout/routing is pure data from `./map/layout` (derived from
 * the run's WorldMap, which stays untouched); this scene only draws it and handles input.
 */
import type { MapNode, NodeKind, WorldMap } from "@ffix-roguelike/game-core";
import Phaser from "phaser";

import { ensureHeroAnims, ensurePlaceholder, heroAnimKey, loadHeroSheets } from "@/features/sprites/sprites";

import { buildMapLayout, COL_STEP, TILE, type EdgeRoute, type MapLayout, type TilePoint } from "./map/layout";

export interface MapBridge {
  map: WorldMap;
  position: string;
  visited: string[];
  leader: string;
  theme: string;
  onSelect(nodeId: string): void;
  onHover(node: MapNode | null): void;
  /** Set by the scene: walk the party to a node along its road; returns how long the walk takes (ms). */
  walkTo?: (nodeId: string) => number;
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

/** Stages drawn as buildings (SMW's houses/switch palaces) rather than level dots. */
const HOUSE_KINDS = new Set<NodeKind>(["shop", "synth", "stiltzkin", "chocobo", "moogle"]);

const THEME_COLORS: Record<string, { ground: number; dark: number; path: number; accent: number }> = {
  grassland: { ground: 0x5aa83a, dark: 0x3d7a28, path: 0xe0c890, accent: 0x7ec0ee },
  castle: { ground: 0x6a7a8a, dark: 0x4a5462, path: 0xc8c0a8, accent: 0x3a3f6a },
  ruin: { ground: 0x8a6a3a, dark: 0x5a4224, path: 0xd8b880, accent: 0x6a2a2a },
  forest: { ground: 0x2f6a2a, dark: 0x1c4a1c, path: 0xc8b070, accent: 0x3a5a3a },
  ice: { ground: 0xbcd8e8, dark: 0x8ab0c8, path: 0x6a8aa8, accent: 0x4a6a9a },
  cave: { ground: 0x5a4a3a, dark: 0x3a2e24, path: 0xb89a6a, accent: 0x2a2a3a },
  marsh: { ground: 0x5a7a4a, dark: 0x3a5a3a, path: 0xc8b890, accent: 0x4a8a8a },
};

const OPEN_PATH = 0xfff2a8;
const WALKED_PATH = 0x8a6a3a;
/** World px per second the party walks. */
const WALK_SPEED = 150;
/** Roughly how many stage columns fit across the view (sets the zoom). */
const VISIBLE_COLUMNS = 4.5;
/** Party sprite feet sit a little below the stage centre. */
const PARTY_LIFT = 11;

const TEXT_RES = 4;
/** Text is rendered at TEXT_RES× then scaled by the zoom; smooth filtering keeps it legible under pixelArt. */
const smooth = <T extends Phaser.GameObjects.Text>(t: T): T => {
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
};
const center = (p: TilePoint) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 });

export class MapScene extends Phaser.Scene {
  private bridge!: MapBridge;
  private layout!: MapLayout;
  private party!: Phaser.GameObjects.Container;
  private partySprite!: Phaser.GameObjects.Sprite;
  private bob?: Phaser.Tweens.Tween;
  private animated = false;
  private walking = false;
  private cursor?: Phaser.GameObjects.Text;
  private selected: string | null = null;
  private reachable: MapNode[] = [];

  constructor() {
    super("map");
  }

  init(data: { bridge: MapBridge }) {
    this.bridge = data.bridge;
    this.walking = false;
    this.selected = null;
  }

  preload() {
    loadHeroSheets(this, [`hero/${this.bridge.leader}`]);
  }

  create() {
    const b = this.bridge;
    const theme = THEME_COLORS[b.theme] ?? THEME_COLORS.grassland!;
    this.layout = buildMapLayout(b.map);
    const L = this.layout;
    const worldW = L.cols * TILE;
    const worldH = L.rows * TILE;

    const byId = new Map(b.map.nodes.map((n) => [n.id, n]));
    const here = byId.get(b.position)!;
    const reachableIds = new Set(here?.next ?? []);
    this.reachable = here ? here.next.map((id) => byId.get(id)!).filter(Boolean) : [];
    const visited = new Set(b.visited);

    this.drawGround(theme, worldW, worldH);
    this.drawRoads(theme, visited, reachableIds);

    for (const n of b.map.nodes) this.drawStage(n, visited, reachableIds);

    // The party: the lead's FFRK strip (feet on the stage), or the placeholder.
    const start = center(L.nodes.get(b.position)!);
    const spriteKey = `hero/${b.leader}`;
    this.animated = ensureHeroAnims(this, spriteKey);
    const key = this.animated ? spriteKey : ensurePlaceholder(this, spriteKey);
    this.party = this.add.container(start.x, start.y).setDepth(10);
    const shadow = this.add.ellipse(0, 4, 14, 5, 0x000000, 0.3);
    this.partySprite = this.add.sprite(0, -PARTY_LIFT, key).setScale(this.animated ? 1 : 0.45);
    this.party.add([shadow, this.partySprite]);
    if (this.animated) this.partySprite.play(heroAnimKey(spriteKey, "idle"));
    this.startBob();

    // Keyboard cursor over the selected next stage.
    this.cursor = smooth(this.add
      .text(0, 0, "▼", { fontFamily: "serif", fontSize: "10px", color: "#fff2a8", resolution: TEXT_RES })
      .setOrigin(0.5, 1)
      .setStroke("#000000", 3)
      .setDepth(20)
      .setVisible(false));
    this.tweens.add({ targets: this.cursor, y: "-=3", duration: 350, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // Camera: zoomed in, clamped to the map, following the party; starts centred on it.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.setBackgroundColor(theme.dark);
    this.fitCamera(this.scale.gameSize.width, this.scale.gameSize.height);
    cam.centerOn(this.party.x, this.party.y);
    cam.startFollow(this.party, false, 0.12, 0.12);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));

    this.input.keyboard?.on("keydown", this.onKey, this);

    b.walkTo = (nodeId) => this.walk(nodeId, spriteKey);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Drawing

  private drawGround(theme: { ground: number; dark: number }, w: number, h: number) {
    const g = this.add.graphics();
    g.fillStyle(theme.ground, 1);
    g.fillRect(0, 0, w, h);
    // Faint tile checker so the grid (and the movement) reads.
    g.fillStyle(theme.dark, 0.12);
    for (let y = 0; y < this.layout.rows; y++) for (let x = (y % 2); x < this.layout.cols; x += 2) g.fillRect(x * TILE, y * TILE, TILE, TILE);
  }

  /** Beaded SMW roads: a bead every half tile along each route; shared stretches are drawn once. */
  private drawRoads(theme: { path: number; dark: number }, visited: Set<string>, reachable: Set<string>) {
    const L = this.layout;
    const nodeCentres = [...L.nodes.values()].map(center);
    // 0 plain, 1 walked, 2 open from here — the highest wins where roads share beads.
    const beads = new Map<string, { x: number; y: number; state: number }>();
    for (const r of L.routes) {
      const state = r.from === this.bridge.position && reachable.has(r.to) ? 2 : visited.has(r.from) && visited.has(r.to) ? 1 : 0;
      for (let i = 0; i < r.tiles.length - 1; i++) {
        const a = center(r.tiles[i]!);
        const c = center(r.tiles[i + 1]!);
        for (const t of [0, 0.5]) {
          const x = a.x + (c.x - a.x) * t;
          const y = a.y + (c.y - a.y) * t;
          if (nodeCentres.some((p) => Math.abs(p.x - x) < 7 && Math.abs(p.y - y) < 7)) continue;
          const k = `${x},${y}`;
          const prev = beads.get(k);
          if (!prev || prev.state < state) beads.set(k, { x, y, state });
        }
      }
    }
    const g = this.add.graphics();
    for (const bd of beads.values()) {
      g.fillStyle(0x000000, 0.35);
      g.fillRect(bd.x - 2, bd.y - 1, 4, 4);
    }
    for (const bd of beads.values()) {
      g.fillStyle(bd.state === 2 ? OPEN_PATH : bd.state === 1 ? WALKED_PATH : theme.path, 1);
      g.fillRect(bd.x - 2, bd.y - 2, 4, 4);
    }
    // The open roads shimmer so the choices stand out.
    const open = [...beads.values()].filter((bd) => bd.state === 2);
    if (open.length) {
      const glow = this.add.graphics();
      glow.fillStyle(0xffffff, 1);
      for (const bd of open) glow.fillRect(bd.x - 1, bd.y - 1, 2, 2);
      this.tweens.add({ targets: glow, alpha: 0.1, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private drawStage(n: MapNode, visited: Set<string>, reachable: Set<string>) {
    const b = this.bridge;
    const p = center(this.layout.nodes.get(n.id)!);
    const style = NODE_STYLE[n.kind];
    const done = visited.has(n.id) && n.id !== b.position;
    const can = reachable.has(n.id);
    const fill = done ? Phaser.Display.Color.ValueToColor(style.color).darken(35).desaturate(60).color : style.color;

    if (can) {
      const pulse = this.add.circle(p.x, p.y, n.kind === "boss" ? 16 : 9).setStrokeStyle(2, OPEN_PATH, 0.9).setDepth(1);
      this.tweens.add({ targets: pulse, scale: 1.5, alpha: 0, duration: 900, repeat: -1 });
    }

    const g = this.add.graphics().setDepth(2);
    let glyphY = p.y;
    let labelY = p.y + 8;
    if (n.kind === "boss") {
      this.drawCastle(g, p.x, p.y, done);
      glyphY = p.y - 6;
      labelY = p.y + 10;
    } else if (n.kind === "semiboss") {
      // Fortress: a squat tower with battlements.
      g.fillStyle(0x000000, 0.3).fillEllipse(p.x, p.y + 7, 18, 5);
      g.fillStyle(0x3a3a44, 1).fillRect(p.x - 8, p.y - 9, 16, 16);
      g.fillStyle(fill, 1).fillRect(p.x - 7, p.y - 8, 14, 14);
      g.fillStyle(0x3a3a44, 1);
      for (const dx of [-7, -2, 3]) g.fillRect(p.x + dx, p.y - 11, 4, 3);
      glyphY = p.y - 1;
    } else if (HOUSE_KINDS.has(n.kind)) {
      // House: a roofed tile.
      g.fillStyle(0x000000, 0.3).fillEllipse(p.x, p.y + 7, 16, 4);
      g.fillStyle(0x1a1a1a, 1).fillRect(p.x - 7, p.y - 3, 14, 10);
      g.fillStyle(fill, 1).fillRect(p.x - 6, p.y - 2, 12, 8);
      g.fillStyle(0x1a1a1a, 1).fillTriangle(p.x - 9, p.y - 2, p.x + 9, p.y - 2, p.x, p.y - 10);
      g.fillStyle(Phaser.Display.Color.ValueToColor(fill).darken(25).color, 1).fillTriangle(p.x - 7, p.y - 3, p.x + 7, p.y - 3, p.x, p.y - 8);
      glyphY = p.y + 2;
    } else {
      // Level dot.
      const r = n.kind === "start" ? 5 : n.kind === "elite" ? 7 : 6;
      g.fillStyle(0x000000, 0.35).fillEllipse(p.x, p.y + 4, r * 2 + 2, 5);
      g.fillStyle(0x1a1a1a, 1).fillCircle(p.x, p.y, r + 1.5);
      g.fillStyle(fill, 1).fillCircle(p.x, p.y, r);
      g.fillStyle(0xffffff, done ? 0.15 : 0.45).fillCircle(p.x - r * 0.35, p.y - r * 0.35, r * 0.35);
    }

    const glyph = smooth(this.add
      .text(p.x, glyphY, style.glyph, { fontFamily: "serif", fontSize: n.kind === "boss" ? "11px" : "9px", color: "#ffffff", resolution: TEXT_RES })
      .setOrigin(0.5)
      .setStroke("#000000", 2)
      .setDepth(3));
    if (done) glyph.setAlpha(0.6);
    const label = smooth(this.add
      .text(p.x, labelY, NODE_LABEL[n.kind], {
        fontFamily: "\"Pixelify Sans\", monospace",
        fontSize: n.kind === "boss" ? "8px" : "7px",
        color: can ? "#fff2a8" : "#ffffff",
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 0)
      .setStroke("#000000", 3)
      .setDepth(5));
    if (done) label.setAlpha(0.55);

    const hit = this.add.circle(p.x, p.y, n.kind === "boss" ? 16 : 11, 0xffffff, 0.001).setDepth(6).setInteractive({ useHandCursor: can });
    hit.on("pointerover", () => b.onHover(n));
    hit.on("pointerout", () => b.onHover(this.selected ? (this.reachable.find((r) => r.id === this.selected) ?? null) : null));
    if (can) hit.on("pointerdown", () => this.go(n.id));
  }

  /** 2×2-tile castle standing on the boss stage. */
  private drawCastle(g: Phaser.GameObjects.Graphics, x: number, y: number, done: boolean) {
    const wall = done ? 0x5a5a5a : 0x7a7a8a;
    const roof = done ? 0x6a4a4a : 0xb83a2e;
    g.fillStyle(0x000000, 0.3).fillEllipse(x, y + 8, 36, 7);
    g.fillStyle(0x1a1a1a, 1).fillRect(x - 13, y - 13, 26, 21);
    g.fillStyle(wall, 1).fillRect(x - 12, y - 12, 24, 19);
    for (const tx of [x - 16, x + 9]) {
      g.fillStyle(0x1a1a1a, 1).fillRect(tx - 1, y - 19, 9, 27);
      g.fillStyle(wall, 1).fillRect(tx, y - 18, 7, 25);
      g.fillStyle(roof, 1).fillTriangle(tx - 2, y - 18, tx + 9, y - 18, tx + 3.5, y - 27);
    }
    g.fillStyle(0x1a1a1a, 1).fillRect(x - 4, y - 1, 8, 8);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Camera

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.fitCamera(size.width, size.height);
  }

  /** Zoom so ~VISIBLE_COLUMNS stage columns fit across, never so far out that the map stops filling the view. */
  private fitCamera(w: number, h: number) {
    const L = this.layout;
    const byWidth = w / (VISIBLE_COLUMNS * COL_STEP * TILE);
    const zoom = Math.max(Phaser.Math.Clamp(byWidth, 1.5, 3.5), h / (L.rows * TILE), w / (L.cols * TILE));
    this.cameras.main.setZoom(zoom);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Input

  private onKey(ev: KeyboardEvent) {
    if (this.walking || !this.reachable.length) return;
    // Leave keys alone while the player is typing or using a control elsewhere on the page.
    const target = ev.target as HTMLElement | null;
    if (target?.closest?.("input, textarea, select, button, a, [contenteditable='true'], [role='dialog']")) return;
    const k = ev.key.toLowerCase();
    const dir = k === "arrowup" || k === "w" ? "up" : k === "arrowdown" || k === "s" ? "down" : k === "arrowright" || k === "d" ? "right" : k === "arrowleft" || k === "a" ? "left" : null;
    if (dir) {
      ev.preventDefault();
      this.moveSelection(dir);
      return;
    }
    if ((k === "enter" || k === " ") && this.selected) {
      ev.preventDefault();
      this.go(this.selected);
    }
  }

  /** Arrow keys pick among the next stages: up/down step through them by height, right picks the straightest. */
  private moveSelection(dir: "up" | "down" | "left" | "right") {
    const L = this.layout;
    const here = L.nodes.get(this.bridge.position)!;
    const sorted = [...this.reachable].sort((a, b) => L.nodes.get(a.id)!.y - L.nodes.get(b.id)!.y);
    const cur = sorted.findIndex((n) => n.id === this.selected);
    let next: MapNode | undefined;
    if (dir === "left") next = undefined;
    else if (dir === "right" || cur < 0) {
      next =
        dir === "up" ? sorted[0]
        : dir === "down" ? sorted[sorted.length - 1]
        : [...sorted].sort((a, b) => Math.abs(L.nodes.get(a.id)!.y - here.y) - Math.abs(L.nodes.get(b.id)!.y - here.y))[0];
    } else next = sorted[Phaser.Math.Clamp(cur + (dir === "up" ? -1 : 1), 0, sorted.length - 1)];
    this.select(next?.id ?? null);
  }

  private select(id: string | null) {
    this.selected = id;
    const node = id ? this.reachable.find((n) => n.id === id) : undefined;
    if (node && this.cursor) {
      const p = center(this.layout.nodes.get(node.id)!);
      this.tweens.killTweensOf(this.cursor);
      this.cursor.setPosition(p.x, p.y - (node.kind === "boss" ? 26 : 10)).setVisible(true);
      this.tweens.add({ targets: this.cursor, y: "-=3", duration: 350, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else this.cursor?.setVisible(false);
    this.bridge.onHover(node ?? null);
  }

  private go(id: string) {
    if (this.walking) return;
    this.bridge.onSelect(id);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Walking

  private startBob() {
    this.bob?.remove();
    this.partySprite.y = -PARTY_LIFT;
    this.bob = this.tweens.add({ targets: this.partySprite, y: -PARTY_LIFT - 2, duration: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private walk(nodeId: string, spriteKey: string): number {
    const L = this.layout;
    const route: EdgeRoute | undefined = L.route(this.bridge.position, nodeId);
    const target = L.nodes.get(nodeId);
    if (!target) return 0;
    const points = (route?.corners ?? [L.nodes.get(this.bridge.position)!, target]).map(center);
    this.walking = true;
    this.cursor?.setVisible(false);
    this.bob?.remove();
    this.partySprite.y = -PARTY_LIFT;
    if (this.animated) this.partySprite.play(heroAnimKey(spriteKey, "walk"));

    let total = 0;
    const steps = points.slice(1).map((p, i) => {
      const from = points[i]!;
      const duration = (Math.abs(p.x - from.x) + Math.abs(p.y - from.y)) / WALK_SPEED * 1000;
      total += duration;
      return { p, from, duration };
    });
    const run = (i: number) => {
      const step = steps[i];
      if (!step) {
        if (this.animated) this.partySprite.play(heroAnimKey(spriteKey, "idle"));
        this.startBob();
        return;
      }
      // The strips face left; mirror when heading right. Up/down keep the last facing.
      if (step.p.x !== step.from.x) this.partySprite.setFlipX(step.p.x > step.from.x);
      this.tweens.add({ targets: this.party, x: step.p.x, y: step.p.y, duration: step.duration, ease: "Linear", onComplete: () => run(i + 1) });
    };
    run(0);
    return Math.round(total);
  }
}

export function createMapGame(parent: HTMLElement, bridge: MapBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || 960,
    height: parent.clientHeight || 540,
    pixelArt: true,
    backgroundColor: "#000000",
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add("map", MapScene, true, { bridge });
      },
    },
  });
}
