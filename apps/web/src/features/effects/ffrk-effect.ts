/**
 * FFRK ability effects in Phaser: loads an effect rig (`ab/ability/<id>/<id>_<phase>.json`) with everything it
 * uses — particle files (`pb_*.json`), frame animations (`.sajson`), images and their atlases — and plays it:
 * the rig is evaluated every frame (`evalRig`), `.sajson` sprites step through their frames, and particle emitters
 * follow FFRK's emitter settings (shape, rate, lifetime, speed, physics, scale/alpha/colour over life, blend).
 * See `.docs/ffrk-assets.md` §4.4.
 *
 * Effect files come from the dev server's `/ffrk-raw` route (the whole downloaded library) in development and from
 * the packed `public/effects` set in builds; both mirror the FFRK server layout under `ab/…`.
 */
import Phaser from "phaser";

import { playSfx } from "@/features/audio/music";
import { cachedFetch } from "@/lib/asset-cache";
import { evalRig, type EmitterNode, type Rig } from "@/features/sprites/ffrk-anim";

export const EFFECT_BASE = import.meta.env.DEV ? "/ffrk-raw" : "/effects";
/** Phase keys FFRK uses: "launch" (caster), "shot" (projectile), "hit" (target) and variants ("hit_1", "miss_hit"…). */
export type EffectPhase = string;

/** "/Content/lang/ab/x/y.png" or "./lang/ab/x/y.png" → "ab/x/y.png". */
const serverPath = (p: string) => p.replace(/^.*?lang\//, "").replace(/\/\/+/g, "/");
const urlOf = (p: string) => `${EFFECT_BASE}/${serverPath(p)}`;
const textureKey = (p: string) => `fx:${serverPath(p)}`;

// ---------- file formats ----------

type Kf<T> = { key: number; value: T }[];
interface EmitterDef {
  alpha_type?: "constant" | "keyframes";
  alpha_constant?: number;
  alpha_keyframes?: Kf<number>;
  anchor?: [number, number];
  color_type?: "" | "rand" | "keyframes" | "randKeyframes";
  color_rand_min?: number[];
  color_rand_max?: number[];
  color_keyframes?: Kf<number[]>;
  color_randKeyframes?: Kf<{ min: number[]; max: number[] }>;
  emitShape_type?: "circle" | "line" | "box";
  emitShape_circle_innerRadius?: number;
  emitShape_circle_outerRadius?: number;
  emitShape_line_angle?: number;
  emitShape_line_length?: number;
  emitShape_line_thickness?: number;
  emitShape_box_max?: [number, number];
  emitter_blendMode?: "add" | "alpha";
  emitter_freeParticles?: boolean;
  emitter_lifetimeMin?: number;
  emitter_lifetimeMax?: number;
  emitter_maxParticles?: number;
  emitter_position?: [number, number];
  emitter_rate?: number;
  initVel_angle?: number;
  initVel_angleDelta?: number;
  initVel_speedMin?: number;
  initVel_speedMax?: number;
  physics_accel?: [number, number];
  physics_dragCoeff?: number;
  physics_radialAccel?: number;
  physics_tangentialAccel?: number;
  rotation_alignToVelocity?: boolean;
  rotation_alignToVelocityAngle?: number;
  rotation_angle?: number;
  rotation_angleDelta?: number;
  rotation_spinRateMin?: number;
  rotation_spinRateMax?: number;
  scale_type?: "constant" | "keyframes";
  scale_constant?: [number, number];
  scale_keyframes?: Kf<[number, number]>;
  size_preserveAspectRatio?: boolean;
  size_rand_scale_min?: [number, number];
  size_rand_scale_max?: [number, number];
  startframe?: number;
  texture_type?: "constant" | "randPick";
  texture_constant?: { file?: string; image: string; packerid?: string };
  texture_randPick?: { image: string; uvMin: [number, number]; uvMax: [number, number] }[];
  /** Emission time in frames (60 fps). */
  time?: number;
}
interface ParticleFile {
  tree: { children?: { attrs: EmitterDef; name: string; type: string }[] }[];
}
interface Sajson {
  action: Record<string, { loop: boolean; frame: { duration: number; layer: { image: string; uv: string; offset: [number, number] }[] }[] }>;
}

export interface EffectAsset {
  /** Server path of the rig ("ab/ability/11000/11000_hit.json"). */
  path: string;
  rig: Rig;
  particles: Map<string, EmitterDef[]>;
  sprites: Map<string, Sajson>;
  /** Rig frames the effect plays: the "play" tag, else the first tag. */
  range: [number, number];
}

// ---------- loading ----------

const jsonCache = new Map<string, Promise<unknown>>();
const getJson = <T>(path: string): Promise<T | null> => {
  const url = urlOf(path);
  if (!jsonCache.has(url))
    jsonCache.set(
      url,
      cachedFetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  return jsonCache.get(url) as Promise<T | null>;
};

/** Loaded effects per Phaser game (textures live in a game's texture manager, so a new game must load its own). */
const assetCache = new WeakMap<Phaser.Game, Map<string, Promise<EffectAsset | null>>>();

/** The usual rig path for an effect id and phase (`<id>/<id>_<phase>.json`; FFRK also uses other names — see the catalog). */
export const rigPath = (id: number, phase: string) => `ab/ability/${id}/${id}_${phase}.json`;

/** Load an effect rig (server path) and every texture it needs into `scene`. Null if the effect doesn't exist. */
export function loadEffect(scene: Phaser.Scene, path: string): Promise<EffectAsset | null> {
  let cache = assetCache.get(scene.game);
  if (!cache) assetCache.set(scene.game, (cache = new Map()));
  const key = serverPath(path);
  if (!cache.has(key)) cache.set(key, doLoad(scene, key));
  return cache.get(key)!;
}

async function doLoad(scene: Phaser.Scene, path: string): Promise<EffectAsset | null> {
  const rig = await getJson<Rig>(path);
  if (!rig) return null;
  /** png path → its atlas json path (null: plain image). */
  const images = new Map<string, string | null>();
  // An image used with frame names anywhere is loaded as an atlas (which still has the whole image as a frame).
  const addImage = (png: string, atlas?: string | null) => {
    const p = serverPath(png);
    if (!images.has(p) || (atlas && !images.get(p))) images.set(p, atlas ? serverPath(atlas) : null);
  };
  const particleFiles = new Set<string>();
  const spriteFiles = new Set<string>();
  const walk = (n: Rig["tree"][number]) => {
    const a = n.attrs ?? {};
    if (a.image?.url) addImage(a.image.url, a.image.packerid ? (a.image.file ?? a.image.url.replace(/\.png$/, ".json")) : null);
    if (a.particle?.file) particleFiles.add(serverPath(a.particle.file));
    if (a.sprite?.file) spriteFiles.add(serverPath(a.sprite.file));
    for (const c of n.children ?? []) walk(c);
  };
  rig.tree.forEach(walk);

  const particles = new Map<string, EmitterDef[]>();
  await Promise.all(
    [...particleFiles].map(async (f) => {
      const pf = await getJson<ParticleFile>(f);
      const defs = (pf?.tree ?? []).flatMap((t) => (t.children ?? []).filter((c) => c.type === "emitter").map((c) => c.attrs));
      particles.set(f, defs);
      for (const d of defs) {
        if (d.texture_constant?.image) addImage(d.texture_constant.image, d.texture_constant.packerid ? (d.texture_constant.file ?? d.texture_constant.image.replace(/\.png$/, ".json")) : null);
        for (const r of d.texture_randPick ?? []) addImage(r.image, null);
      }
    }),
  );
  const sprites = new Map<string, Sajson>();
  await Promise.all(
    [...spriteFiles].map(async (f) => {
      const sa = await getJson<Sajson>(f);
      if (!sa) return;
      sprites.set(f, sa);
      for (const act of Object.values(sa.action)) for (const fr of act.frame) for (const l of fr.layer) if (l.image) addImage(l.image, l.image.replace(/\.png$/, ".json"));
    }),
  );

  // Textures: atlases where frame names are used, plain images otherwise. Both come through the asset cache
  // (Phaser gets a blob URL and the parsed atlas), so they survive hard reloads.
  const toLoad = await Promise.all(
    [...images]
      .filter(([png]) => !scene.textures.exists(textureKey(png)))
      .map(async ([png, atlas]) => {
        const res = await cachedFetch(urlOf(png)).catch(() => null);
        if (!res?.ok) return null;
        const blobUrl = URL.createObjectURL(await res.blob());
        return { key: textureKey(png), blobUrl, atlas: atlas ? await getJson<object>(atlas) : null };
      }),
  );
  let queued = 0;
  for (const t of toLoad) {
    if (!t || scene.textures.exists(t.key)) continue;
    if (t.atlas) scene.load.atlas(t.key, t.blobUrl, t.atlas);
    else scene.load.image(t.key, t.blobUrl);
    queued++;
  }
  if (queued) {
    await new Promise<void>((resolve) => {
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      if (!scene.load.isLoading()) scene.load.start();
    });
  }
  const tags = Object.values(rig.tag ?? {});
  const range = (rig.tag?.play ?? tags[0] ?? [0, 60]).slice(0, 2) as [number, number];
  return { path, rig, particles, sprites, range };
}

// ---------- particles ----------

const rand = (a = 0, b = a) => a + Math.random() * (b - a);
function kfAt<T extends number | number[]>(kf: Kf<T> | undefined, t: number, fallback: T): T {
  if (!kf?.length) return fallback;
  if (t <= kf[0]!.key) return kf[0]!.value;
  for (let i = 1; i < kf.length; i++) {
    const a = kf[i - 1]!;
    const b = kf[i]!;
    if (t <= b.key) {
      const u = b.key === a.key ? 1 : (t - a.key) / (b.key - a.key);
      if (typeof a.value === "number") return ((a.value as number) + ((b.value as number) - (a.value as number)) * u) as T;
      return (a.value as number[]).map((v, j) => v + (((b.value as number[])[j] ?? v) - v) * u) as T;
    }
  }
  return kf[kf.length - 1]!.value;
}

interface Particle {
  img: Phaser.GameObjects.Image;
  age: number;
  life: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  sx: number;
  sy: number;
  color?: number[];
  colorKf?: Kf<number[]>;
}

/** One FFRK emitter, simulated in the effect's local space (y down). */
class Emitter {
  private particles: Particle[] = [];
  private age = 0;
  private carry = 0;
  constructor(
    private scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Container,
    private def: EmitterDef,
    /** Where the emitter node is now (updated every frame by the rig). */
    public node: EmitterNode,
  ) {}

  get done() {
    return this.age >= ((this.def.startframe ?? 0) + (this.def.time ?? 1)) / 60 + (this.def.emitter_lifetimeMax ?? 1) && this.particles.length === 0;
  }

  update(dt: number) {
    const d = this.def;
    this.age += dt;
    // `startframe` and `time` are frames at 60 fps.
    const delay = (d.startframe ?? 0) / 60;
    const active = this.age >= delay && this.age < delay + (d.time ?? 1) / 60;
    if (active) {
      this.carry += (d.emitter_rate ?? 10) * dt;
      while (this.carry >= 1) {
        this.carry -= 1;
        if (this.particles.length < (d.emitter_maxParticles ?? 100)) this.spawn();
      }
    }
    const [ax, ay] = d.physics_accel ?? [0, 0];
    for (const p of this.particles) {
      p.age += dt;
      // Radial/tangential acceleration relative to the emitter origin.
      const r = Math.hypot(p.x, p.y) || 1;
      const rx = p.x / r;
      const ry = p.y / r;
      const ra = d.physics_radialAccel ?? 0;
      const ta = d.physics_tangentialAccel ?? 0;
      p.vx += (ax + rx * ra - ry * ta) * dt;
      p.vy += (-ay + ry * ra + rx * ta) * dt;
      const drag = d.physics_dragCoeff ?? 0;
      if (drag) {
        p.vx *= Math.max(0, 1 - drag * dt);
        p.vy *= Math.max(0, 1 - drag * dt);
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (const p of this.particles.filter((q) => q.age >= q.life)) p.img.destroy();
    this.particles = this.particles.filter((q) => q.age < q.life);
    this.draw();
  }

  private spawn() {
    const d = this.def;
    let x = d.emitter_position?.[0] ?? 0;
    let y = -(d.emitter_position?.[1] ?? 0);
    if (d.emitShape_type === "circle") {
      const a = rand(0, Math.PI * 2);
      const r = rand(d.emitShape_circle_innerRadius ?? 0, d.emitShape_circle_outerRadius ?? 0);
      x += Math.cos(a) * r;
      y += Math.sin(a) * r;
    } else if (d.emitShape_type === "line") {
      const a = ((d.emitShape_line_angle ?? 0) * Math.PI) / 180;
      const along = rand(-0.5, 0.5) * (d.emitShape_line_length ?? 0);
      const across = rand(-0.5, 0.5) * (d.emitShape_line_thickness ?? 0);
      x += Math.cos(a) * along - Math.sin(a) * across;
      y -= Math.sin(a) * along + Math.cos(a) * across;
    } else if (d.emitShape_type === "box") {
      const [bw, bh] = d.emitShape_box_max ?? [0, 0];
      x += rand(-bw / 2, bw / 2);
      y += rand(-bh / 2, bh / 2);
    }
    const ang = (((d.initVel_angle ?? 90) + rand(-(d.initVel_angleDelta ?? 0), d.initVel_angleDelta ?? 0)) * Math.PI) / 180;
    const speed = rand(d.initVel_speedMin ?? 0, d.initVel_speedMax ?? 0);
    const mn = d.size_rand_scale_min ?? [1, 1];
    const mx = d.size_rand_scale_max ?? [1, 1];
    const t = Math.random();
    const sx = mn[0] + (mx[0] - mn[0]) * t;
    const sy = d.size_preserveAspectRatio ? sx : mn[1] + (mx[1] - mn[1]) * (d.size_preserveAspectRatio ? t : Math.random());
    const img = this.texture();
    if (!img) return;
    img.setOrigin(d.anchor?.[0] ?? 0.5, 1 - (d.anchor?.[1] ?? 0.5)).setBlendMode(d.emitter_blendMode === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    this.layer.add(img);
    const p: Particle = {
      img,
      age: 0,
      life: rand(d.emitter_lifetimeMin ?? 1, d.emitter_lifetimeMax ?? d.emitter_lifetimeMin ?? 1),
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: -Math.sin(ang) * speed,
      rot: (d.rotation_angle ?? 0) + rand(-(d.rotation_angleDelta ?? 0), d.rotation_angleDelta ?? 0),
      spin: rand(d.rotation_spinRateMin ?? 0, d.rotation_spinRateMax ?? 0),
      sx,
      sy,
    };
    if (d.color_type === "rand") p.color = (d.color_rand_min ?? [1, 1, 1]).map((v, i) => rand(v, d.color_rand_max?.[i] ?? v));
    else if (d.color_type === "randKeyframes") p.colorKf = (d.color_randKeyframes ?? []).map((k) => ({ key: k.key, value: k.value.min.map((v, i) => rand(v, k.value.max[i] ?? v)) }));
    this.particles.push(p);
  }

  private texture(): Phaser.GameObjects.Image | null {
    const d = this.def;
    if (d.texture_type === "randPick" && d.texture_randPick?.length) {
      const pick = d.texture_randPick[Math.floor(Math.random() * d.texture_randPick.length)]!;
      const k = textureKey(pick.image);
      if (!this.scene.textures.exists(k)) return null;
      return this.scene.add.image(0, 0, k).setFlip(pick.uvMin[0] > pick.uvMax[0], pick.uvMin[1] > pick.uvMax[1]);
    }
    const tc = d.texture_constant;
    if (!tc) return null;
    const k = textureKey(tc.image);
    if (!this.scene.textures.exists(k)) return null;
    return this.scene.add.image(0, 0, k, tc.packerid && this.scene.textures.get(k).has(tc.packerid) ? tc.packerid : undefined);
  }

  private draw() {
    const d = this.def;
    const [a, b, c, dd, tx, ty] = this.node.m;
    const free = d.emitter_freeParticles;
    for (const p of this.particles) {
      const t = Math.min(1, p.age / p.life);
      const [ksx, ksy] = d.scale_type === "keyframes" ? kfAt(d.scale_keyframes, t, [1, 1] as [number, number]) : (d.scale_constant ?? [1, 1]);
      const alpha = (d.alpha_type === "keyframes" ? kfAt(d.alpha_keyframes, t, 1) : (d.alpha_constant ?? 1)) * this.node.alpha;
      const col = p.colorKf ? kfAt(p.colorKf, t, [1, 1, 1]) : d.color_type === "keyframes" ? kfAt(d.color_keyframes, t, [1, 1, 1]) : (p.color ?? [1, 1, 1]);
      const tint = col.map((v, i) => Math.round(Math.min(1, Math.max(0, v * (this.node.tint[i] ?? 1))) * 255)) as [number, number, number];
      // Attached particles ride the emitter node's transform; free ones were placed when spawned (approximation:
      // both use the current node transform — FFRK effects rarely move emitters far).
      void free;
      const X = a * p.x + c * p.y + tx;
      const Y = b * p.x + dd * p.y + ty;
      const nodeRot = Math.atan2(b, a);
      const nodeScale = Math.hypot(a, b);
      const angle = d.rotation_alignToVelocity ? Math.atan2(p.vy, p.vx) + (((d.rotation_alignToVelocityAngle ?? 0) * Math.PI) / 180) : (-p.rot * Math.PI) / 180;
      p.img
        .setPosition(X, Y)
        .setRotation(angle + nodeRot)
        .setScale(p.sx * ksx * nodeScale, p.sy * ksy * nodeScale)
        .setAlpha(alpha)
        .setTint((tint[0] << 16) | (tint[1] << 8) | tint[2]);
    }
  }

  destroy() {
    for (const p of this.particles) p.img.destroy();
    this.particles = [];
  }
}

// ---------- the player ----------

export interface PlayOptions {
  x: number;
  y: number;
  /** Pixel scale (the battle's hero scale). */
  scale?: number;
  /** Mirror (effects are authored for enemies on the left hitting the party on the right… or vice versa). */
  flipX?: boolean;
  depth?: number;
  /** Playback speed (battle speed ×1/×2/×4). */
  speed?: number;
  loop?: boolean;
  onDone?: () => void;
  /** Rig frame → callback (e.g. the impact moment for damage numbers). */
  onFrame?: { frame: number; fn: () => void }[];
  /** Don't play the effect's sounds (e.g. the gallery's loops). */
  mute?: boolean;
}

export class FfrkEffectPlayer {
  readonly container: Phaser.GameObjects.Container;
  private frame: number;
  private images: Phaser.GameObjects.Image[] = [];
  private sprites: Phaser.GameObjects.Image[] = [];
  private emitters = new Map<string, Emitter[]>();
  private finished = false;
  private pending: { frame: number; fn: () => void }[];

  constructor(
    private scene: Phaser.Scene,
    private asset: EffectAsset,
    private opts: PlayOptions,
  ) {
    const s = opts.scale ?? 1;
    this.container = scene.add.container(opts.x, opts.y).setScale(opts.flipX ? -s : s, s).setDepth(opts.depth ?? 50);
    this.frame = asset.range[0];
    // FFRK's own sounds fire on their frames (action_sound → lang/se/se_ogg/<id>.ogg).
    const sounds = (asset.rig.action ?? []).filter((x) => x.actionName === "action_sound" && typeof x.id === "string").map((x) => ({ frame: x.frame, fn: () => playSfx(`${EFFECT_BASE}/se/se_ogg/${x.id}.ogg`) }));
    this.pending = [...(opts.onFrame ?? []), ...(opts.mute ? [] : sounds)].sort((a, b) => a.frame - b.frame);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
  }

  /** Total length in ms at speed 1 (rig frames only; trailing particles may run a little longer). */
  get durationMs() {
    return ((this.asset.range[1] - this.asset.range[0]) / (this.asset.rig.fps || 60)) * 1000;
  }

  private tick(_time: number, delta: number) {
    if (this.finished) return;
    const dt = (delta / 1000) * (this.opts.speed ?? 1);
    this.frame += dt * (this.asset.rig.fps || 60);
    const [start, end] = this.asset.range;
    while (this.pending.length && this.frame >= this.pending[0]!.frame) this.pending.shift()!.fn();
    if (this.frame > end) {
      if (this.opts.loop) {
        this.frame = start;
        this.pending = (this.asset.rig.action ?? []).filter((x) => x.actionName === "action_sound" && typeof x.id === "string" && !this.opts.mute).map((x) => ({ frame: x.frame, fn: () => playSfx(`${EFFECT_BASE}/se/se_ogg/${x.id}.ogg`) }));
        for (const list of this.emitters.values()) list.forEach((e) => e.destroy());
        this.emitters.clear();
      }
    }
    const f = Math.min(this.frame, end);
    const ev = evalRig(this.asset.rig, f);
    this.drawImages(ev.parts);
    this.drawSprites(ev.sprites, f);
    // Emitters start at their node's frame and keep their own clock.
    for (const node of ev.emitters) {
      if (f < node.start) continue;
      let list = this.emitters.get(node.node);
      if (!list) {
        list = (this.asset.particles.get(serverPath(node.file)) ?? []).map((def) => new Emitter(this.scene, this.container, def, node));
        this.emitters.set(node.node, list);
      }
      for (const e of list) e.node = node;
    }
    let alive = false;
    for (const list of this.emitters.values())
      for (const e of list) {
        e.update(dt);
        if (!e.done) alive = true;
      }
    if (this.frame > end && !alive && !this.opts.loop) this.finish();
  }

  private drawImages(parts: ReturnType<typeof evalRig>["parts"]) {
    parts.forEach((p, i) => {
      const key = p.url ? textureKey(p.url) : "";
      if (!this.scene.textures.exists(key)) return;
      let img = this.images[i];
      if (!img) {
        img = this.scene.add.image(0, 0, key).setOrigin(0, 0);
        this.container.add(img);
        this.images[i] = img;
      }
      const tex = this.scene.textures.get(key);
      if (p.packerid && tex.has(p.packerid)) img.setTexture(key, p.packerid);
      else {
        img.setTexture(key);
        if (p.uvs) {
          const src = tex.getSourceImage() as { width: number; height: number };
          const [u, v, uw, vh] = p.uvs;
          img.setCrop(Math.max(0, u * src.width), Math.max(0, v * src.height), Math.abs(uw) * src.width, Math.abs(vh) * src.height);
        }
      }
      const [a, b, c, d, tx, ty] = p.m;
      const sx = Math.hypot(a, b);
      const det = a * d - b * c;
      img
        .setVisible(true)
        .setPosition(tx, ty)
        .setRotation(Math.atan2(b, a))
        .setScale((sx * p.w) / img.frame.width, ((sx ? det / sx : 0) * p.h) / img.frame.height)
        .setAlpha(p.alpha)
        .setTint(rgb(p.tint))
        .setBlendMode(p.blend === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    });
    for (let i = parts.length; i < this.images.length; i++) this.images[i]?.setVisible(false);
  }

  private drawSprites(nodes: ReturnType<typeof evalRig>["sprites"], f: number) {
    let n = 0;
    for (const s of nodes) {
      const act = this.asset.sprites.get(serverPath(s.file))?.action[s.action];
      if (!act || f < s.start) continue;
      const total = act.frame.reduce((t, fr) => t + fr.duration, 0);
      let t = f - s.start;
      if (act.loop && total) t %= total;
      let fr = act.frame[act.frame.length - 1];
      for (const cand of act.frame) {
        if (t < cand.duration) {
          fr = cand;
          break;
        }
        t -= cand.duration;
      }
      if (!fr || (!act.loop && f - s.start >= total)) continue;
      for (const layer of fr.layer) {
        if (!layer.uv) continue;
        const key = textureKey(layer.image);
        if (!this.scene.textures.exists(key) || !this.scene.textures.get(key).has(layer.uv)) continue;
        let img = this.sprites[n];
        if (!img) {
          img = this.scene.add.image(0, 0, key);
          this.container.add(img);
          this.sprites[n] = img;
        }
        n++;
        const [a, b, c, d, tx, ty] = s.m;
        const [ox, oy] = layer.offset;
        const sx = Math.hypot(a, b);
        const det = a * d - b * c;
        img
          .setTexture(key, layer.uv)
          .setVisible(true)
          .setPosition(a * ox + c * oy + tx, b * ox + d * oy + ty)
          .setRotation(Math.atan2(b, a))
          .setScale(sx, sx ? det / sx : 0)
          .setAlpha(s.alpha)
          .setTint(rgb(s.tint))
          .setBlendMode(s.blend === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      }
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i]?.setVisible(false);
  }

  private finish() {
    this.finished = true;
    this.destroy();
    this.opts.onDone?.();
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    for (const list of this.emitters.values()) list.forEach((e) => e.destroy());
    this.container.destroy();
  }
}

const rgb = (t: [number, number, number]) => {
  const c = t.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
  return (c[0]! << 16) | (c[1]! << 8) | c[2]!;
};

/** Load and play an effect rig at a point. Resolves with the player (or null if the effect doesn't exist). */
export async function playEffect(scene: Phaser.Scene, path: string, opts: PlayOptions): Promise<FfrkEffectPlayer | null> {
  const asset = await loadEffect(scene, path);
  if (!asset || !scene.sys.isActive()) return null;
  return new FfrkEffectPlayer(scene, asset, opts);
}
