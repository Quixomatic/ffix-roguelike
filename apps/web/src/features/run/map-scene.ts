/**
 * Super Mario World–style overworld: stages on a tile grid joined by orthogonal beaded roads, the party walking
 * them with the camera zoomed in and following. Layout/routing is pure data from `./map/layout` (derived from
 * the run's WorldMap, which stays untouched); this scene only draws it and handles input.
 */
import type { MapNode, NodeKind, WorldMap } from "@ffix-roguelike/game-core";
import Phaser from "phaser";

import type { Action } from "@/features/input/actions";
import { PHASER_INPUT, SceneInput } from "@/features/input/scene-input";
import { gameFontFamily } from "@/features/settings/fonts";
import { enemyAnimKey, ensureEnemyAnims, loadEnemySheets } from "@/features/sprites/enemy-sprites";
import { ensureHeroAnims, ensurePlaceholder, heroAnimKey, loadHeroSheets } from "@/features/sprites/sprites";

import { assetUrl } from "@/lib/assets";

import { buildMapLayout, TILE, type Dir, type MapLayout, type TilePoint } from "./map/layout";
import { Walker } from "./map/navigation";
import { buildTerrain } from "./map/terrain";
import { OBJECT_COLUMNS, OVERWORLD_TILE, STAGE_SPRITES, TILESET_MARGIN, TILESET_SPACING } from "./map/tileset-catalog";

/** Texture keys of the overworld tilesets (sprites/overworld/terrain.png, objects.png; the `overworld` asset pack). */
const TERRAIN_KEY = "overworld-terrain";
const OBJECTS_KEY = "overworld-objects";

export interface MapBridge {
  map: WorldMap;
  position: string;
  visited: string[];
  leader: string;
  theme: string;
  /**
   * Figures drawn over stages (stage id → enemy-sheet sprite keys, at most two; overworld.tsx): battle / elite stages'
   * monsters, and the Moogle, Stiltzkin and Chocobo stages' own characters. Stages without one show their picture.
   */
  previews?: Record<string, string[]>;
  /** The party entered a next stage (Enter/Space/click on the stage it stands on, or a click from afar): commit the move. */
  onSelect(nodeId: string): void;
  onHover(node: MapNode | null): void;
  /** True while a server move is in flight: the map ignores input. */
  isBusy(): boolean;
  /** Buttons the map doesn't use itself (Y party, X bag, Start menu…), for the run screen. */
  onAction?(action: Action): void;
  /** The camera left the party to look around (true), or came back to it (false). */
  onLook?(looking: boolean): void;
  /**
   * Screen pixels on the map's right covered by something floating over it (the party sidebar): the camera centres the
   * party in what shows (the map itself runs on past the castle, so it can scroll clear of the sidebar).
   */
  insetRight?(): number;
}

/** Each kind of stage's marker colour. */
const NODE_COLOR: Record<NodeKind, number> = {
  start: 0xf0f0f0,
  battle: 0xd8483a,
  elite: 0x8a3ad8,
  semiboss: 0xd8702a,
  treasure: 0xe8c040,
  shop: 0x3ab868,
  synth: 0xd88a3a,
  stiltzkin: 0xf0a0c8,
  chocobo: 0xf0d040,
  moogle: 0xf080b0,
  event: 0x3a8ad8,
  boss: 0xb02020,
};

/** How tall (world px) the figures over a stage stand, whatever their sheet: a little over a tile. */
const MONSTER_HEIGHT = 20;
/** Each sheet frame's figure box (`MapScene.figureBounds`), measured once per page. */
const FIGURE_BOUNDS = new Map<string, { x: number; y: number; w: number; h: number } | null>();

/** How far (world px) above its marker's top edge a stage's badge or figure stands. */
const FIGURE_GAP = 3;

/** The achievement badge atlas (features/hub/badge.tsx: 48 px cells, badge n at frame n − 1; the `badges` pack). */
const BADGES_KEY = "badges";
const BADGE_CELL = 48;
/**
 * A stage's badge's size (world px, its longer side): a little under a tile. The badges draw 15–20 px at 1× (measured:
 * #997 20×20, #989 17×20, #442 18×10…), which stood far too big over the 12 px markers; ½ was too small.
 */
const BADGE_SIZE = 14;
/**
 * The badge standing over each of these stages (badge numbers, from scripts/badge-catalog.json), all plain ones so
 * they match. Each is scaled to BADGE_SIZE by what it actually draws, standing FIGURE_GAP above the marker.
 */
const STAGE_BADGES: Partial<Record<NodeKind, number>> = {
  battle: 997, // Crossed swords over shield
  elite: 254, // horned demon head
  shop: 989, // Dollar money bag
  synth: 442, // iron anvil
  treasure: 210, // treasure chest
};

/** Marker sizes (px, even so they centre exactly on a tile's centre): the usual dot, and the bosses'. */
const MARKER = { w: 12, h: 10 };
const MARKER_BIG = { w: 16, h: 12 };

/**
 * An SMW-style level dot, pixel by pixel (no anti-aliased circles, so it stays crisp at every zoom), centred on (cx,
 * cy): a dark outline, a lighter top, a darker bottom, and a soft shadow under it.
 */
function drawMarker(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: { w: number; h: number }, color: number) {
  const { w, h } = size;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 <= 1;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const base = Phaser.Display.Color.ValueToColor(color);
  const light = base.clone().lighten(25).color;
  const dark = base.clone().darken(25).color;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      g.fillStyle(0x000000, 0.3).fillRect(left + x, top + y + 2, 1, 1);
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      g.fillStyle(edge ? 0x141414 : y < h * 0.4 ? light : y >= h - 3 ? dark : color, 1).fillRect(left + x, top + y, 1, 1);
    }
}

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

const OPEN_PATH = 0xfff2a8;
const WALKED_PATH = 0x8a6a3a;
/** World px per second the party walks. */
const WALK_SPEED = 150;
/**
 * Camera zoom, in whole steps (pixel-art tiles stay crisp): 2× unless the player picks another, from ZOOM_MIN to
 * ZOOM_MAX (wheel, − / +, LT / RT). The pick is remembered on this device. The view never zooms out past where the
 * map would stop filling it.
 */
const ZOOM_DEFAULT = 2;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STORAGE = "ffix-map-zoom";
/** Wheel travel (deltaY) per zoom step, so a trackpad's stream of small deltas doesn't race through the steps. */
const WHEEL_STEP = 100;

function loadZoom(): number {
  try {
    const v = Number(localStorage.getItem(ZOOM_STORAGE));
    return Number.isInteger(v) && v >= ZOOM_MIN && v <= ZOOM_MAX ? v : ZOOM_DEFAULT;
  } catch {
    return ZOOM_DEFAULT;
  }
}

function saveZoom(zoom: number) {
  try {
    localStorage.setItem(ZOOM_STORAGE, String(zoom));
  } catch {
    // Storage blocked (private window…): the pick lasts until the map is rebuilt.
  }
}
/** Looking around: screen pixels per second. */
const PAN_SPEED = 700;
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
  private walker!: Walker;
  private controls!: SceneInput;
  /** Look mode (View / V): the directions pan the camera instead of walking. */
  private looking = false;
  /** The camera isn't following the party (look mode, the right stick, or a mouse drag moved it). */
  private panned = false;
  /** A mouse drag in progress (from where, and the camera's scroll then), and whether it has moved yet. */
  private drag: { x: number; y: number; scrollX: number; scrollY: number } | null = null;
  private dragged = false;
  /** Easing back to the party after looking around (Phaser's startFollow would jump there). */
  private returning = false;
  /** Stages the route taken can't reach any more (drawn faded). */
  private cutOff = new Set<string>();
  private hints: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private walkingNow = false;
  private lastHeading: Dir | null = null;
  private spriteKey = "";
  /** Tilemap layers for stage pictures: on the grid (odd widths) and half a tile left (even widths). */
  private objectLayers?: { odd: Phaser.Tilemaps.TilemapLayer; even: Phaser.Tilemaps.TilemapLayer };
  /** The zoom the player picked (ZOOM_MIN–ZOOM_MAX); the camera uses it unless the view needs more to stay filled. */
  private zoomPick = ZOOM_DEFAULT;
  /** Wheel travel not yet turned into a zoom step. */
  private wheel = 0;

  constructor() {
    super("map");
  }

  init(data: { bridge: MapBridge }) {
    this.bridge = data.bridge;
    this.objectLayers = undefined;
    this.hints = [];
    this.walkingNow = false;
    this.lastHeading = null;
    this.looking = false;
    this.panned = false;
    this.drag = null;
    this.dragged = false;
    this.returning = false;
    this.zoomPick = loadZoom();
    this.wheel = 0;
  }

  preload() {
    loadHeroSheets(this, [`hero/${this.bridge.leader}`]);
    loadEnemySheets(this, Object.values(this.bridge.previews ?? {}).flat());
    if (!this.textures.exists(BADGES_KEY)) this.load.spritesheet(BADGES_KEY, assetUrl("sprites/badges/badges.png"), { frameWidth: BADGE_CELL, frameHeight: BADGE_CELL });
    if (!this.textures.exists(TERRAIN_KEY)) this.load.image(TERRAIN_KEY, assetUrl("sprites/overworld/terrain.png"));
    if (!this.textures.exists(OBJECTS_KEY)) this.load.image(OBJECTS_KEY, assetUrl("sprites/overworld/objects.png"));
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
    const visited = new Set(b.visited);
    // Everything still ahead of the party (any number of rounds on). The rest of the stages not yet played are cut off
    // by the route taken, and drawn faded, with their roads.
    const ahead = new Set<string>();
    const queue = [...(here?.next ?? [])];
    while (queue.length) {
      const id = queue.shift()!;
      if (ahead.has(id)) continue;
      ahead.add(id);
      queue.push(...(byId.get(id)?.next ?? []));
    }
    this.cutOff = new Set(b.map.nodes.filter((n) => !ahead.has(n.id) && !visited.has(n.id) && n.id !== b.position).map((n) => n.id));

    if (!this.drawTerrain(b.theme)) this.drawGround(theme, worldW, worldH);
    this.drawRoads(theme, visited, reachableIds);

    for (const n of b.map.nodes) this.drawStage(n, visited, reachableIds);

    // The party: the lead's FFRK strip (feet on the stage), or the placeholder.
    const start = center(L.nodes.get(b.position)!);
    const spriteKey = (this.spriteKey = `hero/${b.leader}`);
    this.animated = ensureHeroAnims(this, spriteKey);
    const key = this.animated ? spriteKey : ensurePlaceholder(this, spriteKey);
    this.party = this.add.container(start.x, start.y).setDepth(10);
    const shadow = this.add.ellipse(0, 4, 14, 5, 0x000000, 0.3);
    this.partySprite = this.add.sprite(0, -PARTY_LIFT, key).setScale(this.animated ? 1 : 0.45);
    this.party.add([shadow, this.partySprite]);
    if (this.animated) this.partySprite.play(heroAnimKey(spriteKey, "idle"));
    this.startBob();

    this.walker = new Walker(L.nodes.get(b.position)!, L.branchesFrom(b.position));
    this.showHints();

    // Camera: zoomed in, clamped to the map, following the party; starts centred on it.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.setBackgroundColor(theme.dark);
    this.fitCamera(this.scale.gameSize.width, this.scale.gameSize.height);
    cam.centerOn(this.party.x - cam.followOffset.x, this.party.y);
    cam.startFollow(this.party, false, 0.12, 0.12);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));

    // Keyboard and controller through Phaser's own input (only while the map has the controls — see owner.ts): held
    // directions are polled each frame, presses come as actions.
    this.controls = new SceneInput(this);
    this.controls.on(this.onAction.bind(this));

    // Drag the map with the mouse to look around (a click without moving still picks a stage).
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.drag = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      this.dragged = false;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (!this.dragged && Math.hypot(p.x - d.x, p.y - d.y) < 6) return;
      if (!this.dragged) {
        this.dragged = true;
        this.detachCamera();
      }
      cam.setScroll(d.scrollX - (p.x - d.x) / cam.zoom, d.scrollY - (p.y - d.y) / cam.zoom);
    });
    // Runs after the stages' own pointerup, so a drag that ends on a stage doesn't pick it.
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.drag = null;
      this.dragged = false;
    });
    // The wheel zooms a step at a time, toward the pointer while looking around.
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.wheel += dy;
      if (Math.abs(this.wheel) < WHEEL_STEP) return;
      const step = this.wheel < 0 ? 1 : -1;
      this.wheel = 0;
      this.zoomBy(step, p);
    });
  }

  // ---------------------------------------------------------------------------------------------------------
  // Looking around

  /** Stop following the party (the camera stays where it is, clamped to the map). */
  private detachCamera() {
    this.returning = false;
    if (this.panned) return;
    this.panned = true;
    this.cameras.main.stopFollow();
    this.bridge.onLook?.(true);
  }

  /** Back to the party, and out of look mode: the camera eases over (`easeBack`), then follows it again. */
  private recenter() {
    this.looking = false;
    if (this.panned) {
      this.panned = false;
      this.returning = true;
    }
    this.bridge.onLook?.(false);
  }

  /** One frame of easing back to the party (it may be walking meanwhile); follows it again once there. */
  private easeBack(delta: number) {
    const cam = this.cameras.main;
    // Where following would put the camera (the follow offset centres the party beside a floating sidebar).
    const tx = cam.clampX(this.party.x - cam.followOffset.x - cam.width * cam.originX);
    const ty = cam.clampY(this.party.y - cam.height * cam.originY);
    const dx = tx - cam.scrollX;
    const dy = ty - cam.scrollY;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      this.returning = false;
      cam.startFollow(this.party, false, 0.12, 0.12);
      return;
    }
    // Frame-rate independent ease, a little quicker than following.
    const k = 1 - Math.pow(1 - 0.14, delta / (1000 / 60));
    cam.setScroll(cam.scrollX + dx * k, cam.scrollY + dy * k);
  }

  /** Pan the camera by screen pixels. */
  private pan(dx: number, dy: number) {
    const cam = this.cameras.main;
    cam.setScroll(cam.scrollX + dx / cam.zoom, cam.scrollY + dy / cam.zoom);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Drawing

  /**
   * The terrain as a Phaser tilemap (the overworld tileset, map/tileset-catalog.ts): one blank map the layout's size,
   * with a layer per depth (ground, water, scenery), all from the one extruded terrain tileset, filled from
   * map/terrain.ts. The road beads, stages and the party draw on top. False if the tileset isn't loaded (then the plain ground).
   */
  private drawTerrain(theme: string): boolean {
    if (!this.textures.exists(TERRAIN_KEY)) return false;
    const L = this.layout;
    const layers = buildTerrain(L, theme, this.bridge.map.nodes.map((n) => n.id).join("|"));
    const map = this.make.tilemap({ width: L.cols, height: L.rows, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage("terrain", TERRAIN_KEY, OVERWORLD_TILE, OVERWORLD_TILE, TILESET_MARGIN, TILESET_SPACING);
    if (!tiles) return false;
    (["ground", "water", "scenery"] as const).forEach((name, depth) => {
      const layer = map.createBlankLayer(name, tiles, 0, 0, L.cols, L.rows)?.setDepth(-3 + depth);
      layer?.putTilesAt(layers[name], 0, 0);
    });
    // Stage pictures (placeStageSprite): odd-width ones on the grid, even-width ones half a tile left, so either centres
    // over its stage. Above the scenery, below the roads' beads and the markers.
    const objects = this.textures.exists(OBJECTS_KEY) ? map.addTilesetImage("objects", OBJECTS_KEY, OVERWORLD_TILE, OVERWORLD_TILE, TILESET_MARGIN, TILESET_SPACING) : null;
    if (objects) {
      const odd = map.createBlankLayer("objects", objects, 0, 0, L.cols, L.rows);
      const even = map.createBlankLayer("objects-half", objects, -TILE / 2, 0, L.cols, L.rows);
      if (odd && even) this.objectLayers = { odd: odd.setDepth(-0.5), even: even.setDepth(-0.5) };
    }
    return true;
  }

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
    // −1 cut off, 0 plain, 1 walked, 2 open from here — the highest wins where roads share beads.
    const beads = new Map<string, { x: number; y: number; state: number }>();
    for (const r of L.routes) {
      const cut = this.cutOff.has(r.from) || this.cutOff.has(r.to) || (visited.has(r.from) && r.from !== this.bridge.position && !visited.has(r.to));
      const state = r.from === this.bridge.position && reachable.has(r.to) ? 2 : visited.has(r.from) && visited.has(r.to) ? 1 : cut ? -1 : 0;
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
      g.fillStyle(0x000000, bd.state < 0 ? 0.12 : 0.35);
      g.fillRect(bd.x - 2, bd.y - 1, 4, 4);
    }
    for (const bd of beads.values()) {
      g.fillStyle(bd.state === 2 ? OPEN_PATH : bd.state === 1 ? WALKED_PATH : theme.path, bd.state < 0 ? 0.3 : 1);
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
    const color = NODE_COLOR[n.kind];
    const done = visited.has(n.id) && n.id !== b.position;
    const can = reachable.has(n.id);
    /** Not reachable any more from the route taken. */
    const cut = this.cutOff.has(n.id);
    const fill = done ? Phaser.Display.Color.ValueToColor(color).darken(35).desaturate(60).color : cut ? Phaser.Display.Color.ValueToColor(color).darken(45).desaturate(85).color : color;
    const size = n.kind === "boss" || n.kind === "semiboss" ? MARKER_BIG : MARKER;

    if (can) {
      // A ring the marker's shape, swelling out from it.
      const pulse = this.add.ellipse(p.x, p.y, size.w + 4, size.h + 4).setStrokeStyle(2, OPEN_PATH, 0.9).setDepth(1);
      this.tweens.add({ targets: pulse, scale: 1.6, alpha: 0, duration: 900, repeat: -1 });
    }

    // The stage itself: an SMW-style pixel dot on the road (where the party stands), centred on its tile and coloured by
    // kind and state; what's there stands just above it (monsters for battles, else the object sheet's picture).
    const g = this.add.graphics().setDepth(2);
    drawMarker(g, p.x, p.y, size, fill);
    const labelY = p.y + size.h / 2 + 1;
    const alpha = cut ? 0.35 : done ? 0.6 : 1;
    const badge = STAGE_BADGES[n.kind];
    // Badges and figures stand clear of the marker, a few px above its top edge.
    const standY = p.y - size.h / 2 - FIGURE_GAP;
    if (badge && this.textures.exists(BADGES_KEY)) this.placeBadge(p.x, standY, badge, alpha);
    else if (this.bridge.previews?.[n.id]?.length) this.placeMonsters(p.x, standY, this.bridge.previews[n.id]!, alpha);
    else this.placeStageSprite(n, alpha);

    const label = smooth(this.add
      .text(p.x, labelY, NODE_LABEL[n.kind], {
        fontFamily: gameFontFamily(),
        fontSize: n.kind === "boss" ? "8px" : "7px",
        color: can ? "#fff2a8" : "#ffffff",
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 0)
      .setStroke("#000000", 3)
      .setDepth(5));
    if (done) label.setAlpha(0.55);
    // Cut off: faded right back, so the stages still ahead stand out.
    if (cut) for (const o of [g, label]) o.setAlpha(0.35);

    const hit = this.add.circle(p.x, p.y, n.kind === "boss" ? 16 : 11, 0xffffff, 0.001).setDepth(6).setInteractive({ useHandCursor: can });
    hit.on("pointerover", () => b.onHover(n));
    hit.on("pointerout", () => b.onHover(null));
    if (can) hit.on("pointerup", () => !this.dragged && this.clickStage(n.id));
  }

  /**
   * A stage's badge (`STAGE_BADGES`), its bottom at `y` (above the marker) and centred on `x`, by what the badge
   * actually draws, its longer side scaled to BADGE_SIZE.
   */
  private placeBadge(x: number, y: number, badge: number, alpha: number) {
    const frame = badge - 1;
    const box = this.figureBounds(BADGES_KEY, frame) ?? { x: 0, y: 0, w: BADGE_CELL, h: BADGE_CELL };
    this.add
      .image(x, y, BADGES_KEY, frame)
      .setOrigin((box.x + box.w / 2) / BADGE_CELL, (box.y + box.h) / BADGE_CELL)
      .setScale(BADGE_SIZE / Math.max(box.w, box.h))
      .setDepth(1.4)
      .setAlpha(alpha);
  }

  /**
   * The figures a stage shows (`MapBridge.previews`; at most two), like the party on the Play page's Party card: the
   * same height whatever their sheet (scaled by what they actually draw, `figureBounds`), side by side and overlapping
   * on one baseline (`baseline`, above the marker) centred on `cx`, the first facing left and the second right.
   */
  private placeMonsters(cx: number, baseline: number, keys: string[], alpha: number) {
    const figures = keys.flatMap((key) => {
      const ffrk = ensureEnemyAnims(this, key);
      const box = ffrk && this.figureBounds(ffrk.texture, 0);
      if (!ffrk || !box) return [];
      const scale = Math.min(1, MONSTER_HEIGHT / box.h);
      return [{ ...ffrk, box, scale, width: box.w * scale }];
    });
    figures.forEach((f, i) => {
      // Overlap by a third of each figure's width (one figure stands centred).
      const x = figures.length > 1 ? (i === 0 ? cx - f.width * 0.33 : cx + f.width * 0.33) : cx;
      // FFRK monsters face right: the first turns to face left.
      const flip = figures.length > 1 && i === 0;
      this.add
        .sprite(Math.round(x), baseline, f.texture, 0)
        .setOrigin(flip ? 1 - (f.box.x + f.box.w / 2) / f.info.w : (f.box.x + f.box.w / 2) / f.info.w, (f.box.y + f.box.h) / f.info.h)
        .setFlipX(flip)
        .setScale(f.scale)
        .setDepth(1.4 + i * 0.05)
        .setAlpha(alpha)
        .play({ key: enemyAnimKey(f.info, "idle"), startFrame: i * 3 });
    });
  }

  /** What a sheet's frame actually draws (its opaque pixels' box, in frame px), measured once per frame. */
  private figureBounds(texture: string, frameIndex: number): { x: number; y: number; w: number; h: number } | null {
    const id = `${texture}#${frameIndex}`;
    const cached = FIGURE_BOUNDS.get(id);
    if (cached !== undefined) return cached;
    const frame = this.textures.getFrame(texture, frameIndex);
    const source = frame?.source.image as CanvasImageSource | undefined;
    let box: { x: number; y: number; w: number; h: number } | null = null;
    if (frame && source) {
      const { cutX, cutY, cutWidth: w, cutHeight: h } = frame;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(source, cutX, cutY, w, h, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3]! > 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
      if (maxX >= 0) box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    FIGURE_BOUNDS.set(id, box);
    return box;
  }

  /**
   * What's at a stage, standing just above its marker: its object-sheet picture (map/tileset-catalog.ts
   * `STAGE_SPRITES`), tile by tile on the object layers, centred over the marker (an even-width picture goes on the
   * layer shifted half a tile). `alpha`: faded for stages done or cut off.
   */
  private placeStageSprite(n: MapNode, alpha: number) {
    const sprite = STAGE_SPRITES[n.kind];
    const at = this.layout.nodes.get(n.id);
    if (!sprite || !at || !this.objectLayers) return;
    const layer = sprite.w % 2 ? this.objectLayers.odd : this.objectLayers.even;
    const left = at.x - Math.floor(sprite.w / 2) + (sprite.w % 2 ? 0 : 1);
    for (let dy = 0; dy < sprite.h; dy++)
      for (let dx = 0; dx < sprite.w; dx++) {
        const tile = layer.putTileAt((sprite.row + dy) * OBJECT_COLUMNS + sprite.col + dx, left + dx, at.y - sprite.h + dy);
        if (tile) tile.alpha = alpha;
      }
  }

  // ---------------------------------------------------------------------------------------------------------
  // Camera

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.fitCamera(size.width, size.height);
  }

  /** The least whole-number zoom at which the map fills a w × h view. */
  private fillZoom(w: number, h: number) {
    const L = this.layout;
    return Math.max(1, Math.ceil(h / (L.rows * TILE)), Math.ceil(w / (L.cols * TILE)));
  }

  /**
   * Zoom in (+1) or out (−1) a step and remember it on this device. While the camera follows the party it stays on the
   * party; while looking around, the wheel zooms toward the pointer (keys and triggers about the view's centre).
   */
  private zoomBy(step: number, pointer?: Phaser.Input.Pointer) {
    const cam = this.cameras.main;
    const { width: w, height: h } = this.scale.gameSize;
    const from = cam.zoom;
    const pick = Phaser.Math.Clamp(Math.max(this.zoomPick, this.fillZoom(w, h)) + step, ZOOM_MIN, ZOOM_MAX);
    if (pick === this.zoomPick && Math.max(pick, this.fillZoom(w, h)) === from) return;
    this.zoomPick = pick;
    saveZoom(pick);
    this.fitCamera(w, h);
    const to = cam.zoom;
    if (to === from || !pointer || !this.panned) return;
    // Keep the world point under the pointer where it is (the camera zooms about its centre).
    const anchor = (scroll: number, size: number, at: number) => scroll + size / 2 + (at - size / 2) / from - size / 2 - (at - size / 2) / to;
    cam.setScroll(anchor(cam.scrollX, cam.width, pointer.x), anchor(cam.scrollY, cam.height, pointer.y));
  }

  /**
   * The player's zoom (2× by default; `zoomBy`), or more when the view needs it to stay filled. Whole numbers only, so
   * the pixel-art tiles stay crisp. The map runs well past the castle (layout `MARGIN_END`), so with the party sidebar
   * floating over the right edge the castle can still scroll clear of it; the party is centred in the part of the view
   * that shows.
   */
  private fitCamera(w: number, h: number) {
    const L = this.layout;
    const cam = this.cameras.main;
    const zoom = Math.max(this.zoomPick, this.fillZoom(w, h));
    cam.setZoom(zoom);
    cam.setRoundPixels(true);
    const inset = Math.max(0, Math.min(w * 0.6, this.bridge.insetRight?.() ?? 0));
    cam.setBounds(0, 0, L.cols * TILE, L.rows * TILE);
    cam.setFollowOffset(-inset / (2 * zoom), 0);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Input + walking (SMW-style: see ./map/navigation)

  private locked() {
    return this.walker.arrived !== null || this.bridge.isBusy();
  }

  /** The direction held (keyboard or controller); none in look mode (the directions pan then). */
  private heldDir(): Dir | null {
    if (this.looking) return null;
    const c = this.controls;
    if (c.isDown("left")) return "left";
    if (c.isDown("right")) return "right";
    if (c.isDown("up")) return "up";
    if (c.isDown("down")) return "down";
    return null;
  }

  private onAction(a: Action) {
    // View (V): look around — the directions pan the camera; View again, B or A comes back to the party.
    if (a === "select") return this.looking ? this.recenter() : ((this.looking = true), this.detachCamera(), this.bridge.onLook?.(true));
    // LT / RT (− / +): zoom out / in, walking or looking.
    if (a === "l2" || a === "r2") return this.zoomBy(a === "r2" ? 1 : -1);
    if (this.looking) {
      if (a === "cancel" || a === "confirm") this.recenter();
      else if (a === "triangle" || a === "x" || a === "menu") this.bridge.onAction?.(a);
      return;
    }
    if (a === "up" || a === "down" || a === "left" || a === "right") {
      // Fresh presses can turn the party around mid-road; held ones only start/continue walking (in update).
      if (!this.locked() && this.walker.press(a)) this.afterMoveChange();
    } else if (a === "confirm") {
      // Enter / Space / A enters the stage the party is standing on.
      if (this.locked()) return;
      const id = this.walker.confirm();
      if (id) this.commit(id);
    } else this.bridge.onAction?.(a);
  }

  private clickStage(id: string) {
    if (this.locked()) return;
    // Clicking the stage the party stands on enters it; clicking another reachable stage walks there and enters.
    if (this.walker.standing === id) {
      const entered = this.walker.confirm();
      if (entered) this.commit(entered);
      return;
    }
    if (this.walker.goTo(id)) this.afterMoveChange();
  }

  /** Enter a stage: tell React (server move), and recover if the move never lands. */
  private commit(id: string) {
    this.placeParty();
    this.setWalking(false);
    this.showHints();
    this.bridge.onSelect(id);
    // If the move never lands (server error), let the player try again from the stage they left.
    this.time.delayedCall(6000, () => {
      if (!this.scene.isActive()) return;
      this.walker = new Walker(this.walker.start, this.walker.roots);
      this.placeParty();
      this.showHints();
    });
  }

  update(_time: number, delta: number) {
    if (!this.walker) return;
    // Looking around: the directions (look mode) or the right stick (any time) pan the camera.
    const speed = (PAN_SPEED * delta) / 1000;
    if (this.looking) {
      const c = this.controls;
      this.pan((Number(c.isDown("right")) - Number(c.isDown("left"))) * speed, (Number(c.isDown("down")) - Number(c.isDown("up"))) * speed);
    }
    const stick = this.controls.rightStick();
    if (stick.x || stick.y) {
      this.detachCamera();
      this.pan(stick.x * speed, stick.y * speed);
    }
    if (this.returning) this.easeBack(delta);
    const w = this.walker;
    if (!this.locked()) {
      const held = this.heldDir();
      if (!w.moving && held && w.press(held)) this.afterMoveChange();
      const arrived = w.update((WALK_SPEED / TILE) * (delta / 1000), held);
      const heading = w.heading();
      if (heading && heading !== this.lastHeading && w.moving) {
        this.lastHeading = heading;
        // The strips face left; mirror when heading right. Up/down keep the last facing.
        if (heading === "right" || heading === "left") this.partySprite.setFlipX(heading === "right");
      }
      if (arrived) {
        this.commit(arrived);
        return;
      }
      if (!w.moving && this.walkingNow) {
        this.setWalking(false);
        this.showHints();
      }
    }
    this.placeParty();
  }

  /** Called whenever a press/click changed what the walker is doing. */
  private afterMoveChange() {
    if (this.walker.moving) {
      // Walking brings the camera back to the party.
      if (this.panned) this.recenter();
      this.setWalking(true);
      this.showHints();
    }
  }

  private placeParty() {
    const p = this.walker.position();
    this.party.setPosition(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2);
  }

  private setWalking(on: boolean) {
    if (this.walkingNow === on) return;
    this.walkingNow = on;
    this.lastHeading = null;
    if (on) {
      this.bob?.remove();
      this.partySprite.y = -PARTY_LIFT;
      if (this.animated) this.partySprite.play(heroAnimKey(this.spriteKey, "walk"));
    } else {
      if (this.animated) this.partySprite.play(heroAnimKey(this.spriteKey, "idle"));
      this.startBob();
    }
  }

  private startBob() {
    this.bob?.remove();
    this.partySprite.y = -PARTY_LIFT;
    this.bob = this.tweens.add({ targets: this.partySprite, y: -PARTY_LIFT - 2, duration: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** Little arrows on the roads you can take from where the party rests (plus a dim one for the way back). */
  private showHints() {
    for (const h of this.hints) {
      this.tweens.killTweensOf(h);
      h.destroy();
    }
    this.hints = [];
    if (this.walker.moving || this.walker.arrived) return;
    const here = this.walker.position();
    const add = (dir: Dir, alpha: number) => {
      const v = DIR_VEC[dir];
      const x = (here.x + v.x * 0.95) * TILE + TILE / 2;
      const y = (here.y + v.y * 0.95) * TILE + TILE / 2;
      const g = this.add.graphics({ x, y }).setDepth(12).setAlpha(alpha);
      g.fillStyle(0x000000, 1).fillTriangle(-4.5, -3.5, 4.5, -3.5, 0, 4.5);
      g.fillStyle(OPEN_PATH, 1).fillTriangle(-3, -2.5, 3, -2.5, 0, 2.5);
      g.setAngle({ down: 0, left: 90, up: 180, right: 270 }[dir]);
      this.tweens.add({ targets: g, x: x + v.x * 2, y: y + v.y * 2, duration: 380, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.hints.push(g);
    };
    for (const b of this.walker.options()) add(b.dir, 1);
    const back = this.walker.backDir();
    if (back) add(back, this.walker.standing ? 0.8 : 0.45);
    // Standing on a stage it hasn't entered: prompt to enter.
    if (this.walker.standing) {
      const label = this.add
        .text(here.x * TILE + TILE / 2, here.y * TILE - TILE * 0.9, "Enter ⏎", { fontFamily: "monospace", fontSize: "40px", color: "#fff6c8", stroke: "#000000", strokeThickness: 8 })
        .setOrigin(0.5, 1)
        .setScale(0.25)
        .setDepth(13);
      label.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.tweens.add({ targets: label, y: label.y - 2, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.hints.push(label);
    }
  }
}

const DIR_VEC: Record<Dir, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export function createMapGame(parent: HTMLElement, bridge: MapBridge): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth || 960,
    height: parent.clientHeight || 540,
    pixelArt: true,
    backgroundColor: "#000000",
    scale: { mode: Phaser.Scale.RESIZE },
    ...PHASER_INPUT,
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add("map", MapScene, true, { bridge });
      },
    },
  });
}
