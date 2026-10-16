/**
 * Sound: background music and one-shot sound effects (one Web Audio context).
 *
 * Background music: FF9's own tracks (`music.gen.ts`, built by `scripts/build-music.ts`), looped at FF9's loop
 * points with Web Audio, crossfading when the track changes. One player for the whole app: screens say which track
 * they want (`useMusic`); the last one asked for plays. Browsers only allow audio after the player interacts with
 * the page, so playback starts on the first click/key press if it was asked for earlier.
 */
import { useEffect } from "react";

import { MUSIC_TRACKS } from "./music.gen";

export { AREA_MUSIC, BOSS_MUSIC, MUSIC_SLOTS } from "./music.gen";

const FADE_S = 0.8;

interface Playing {
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * The one audio player's state. It lives on `globalThis`, not in module variables, so a dev hot reload (which
 * re-runs this module without reloading the page) keeps using the same AudioContext and the track already playing
 * instead of starting a second copy of it.
 */
interface AudioState {
  ctx: AudioContext | null;
  master: GainNode | null;
  sfxGain: GainNode | null;
  volume: number;
  sfxVolume: number;
  wanted: string | null;
  current: Playing | null;
  /** Every music source still sounding (the current one and any fading out). */
  sources: Set<AudioBufferSourceNode>;
  buffers: Map<string, Promise<AudioBuffer | null>>;
  sfxBuffers: Map<string, Promise<AudioBuffer | null>>;
}
const S: AudioState = ((globalThis as { __ffixAudio?: AudioState }).__ffixAudio ??= {
  ctx: null,
  master: null,
  sfxGain: null,
  volume: 0.25,
  sfxVolume: 0.25,
  wanted: null,
  current: null,
  sources: new Set(),
  buffers: new Map(),
  sfxBuffers: new Map(),
});

function audio(): AudioContext | null {
  if (S.ctx) return S.ctx;
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  const ctx = new AudioContext();
  S.ctx = ctx;
  S.master = ctx.createGain();
  S.master.gain.value = S.volume;
  S.master.connect(ctx.destination);
  S.sfxGain = ctx.createGain();
  S.sfxGain.gain.value = S.sfxVolume;
  S.sfxGain.connect(ctx.destination);
  // Autoplay policy: resume on the first interaction, then start whatever was asked for.
  const unlock = () => {
    void ctx.resume().then(() => {
      if (S.wanted && S.current?.id !== S.wanted) void start(S.wanted);
    });
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return ctx;
}

function load(id: string): Promise<AudioBuffer | null> {
  const track = MUSIC_TRACKS[id];
  const ac = audio();
  if (!track || !ac) return Promise.resolve(null);
  if (!S.buffers.has(id))
    S.buffers.set(
      id,
      fetch(track.url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => ac.decodeAudioData(b))
        .catch(() => null),
    );
  return S.buffers.get(id)!;
}

async function start(id: string) {
  const ac = audio();
  if (!ac || !S.master) return;
  const buffer = await load(id);
  // Something else was asked for while this loaded, or it's already playing.
  if (!buffer || S.wanted !== id || S.current?.id === id || ac.state !== "running") return;
  const track = MUSIC_TRACKS[id]!;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  if (track.loopEnd > track.loopStart) {
    source.loopStart = track.loopStart;
    source.loopEnd = track.loopEnd;
  }
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(1, ac.currentTime + FADE_S);
  source.connect(gain).connect(S.master);
  // Never more than one track: everything else still sounding fades out now.
  fadeOutAll();
  source.start();
  S.sources.add(source);
  source.onended = () => S.sources.delete(source);
  S.current = { id, source, gain };
}

/** Fade out and stop every music source (the current track and any stragglers). */
function fadeOutAll() {
  const ctx = S.ctx;
  if (!ctx) return;
  for (const source of S.sources) {
    const gain = source === S.current?.source ? S.current.gain : null;
    if (gain) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_S);
    }
    try {
      source.stop(ctx.currentTime + (gain ? FADE_S + 0.05 : 0));
    } catch {
      // already stopped
    }
  }
  S.current = null;
}

/** Ask for a track (null = silence). Crossfades from whatever is playing. */
export function playMusic(id: string | null) {
  S.wanted = id;
  if (!id) return fadeOutAll();
  if (S.current?.id === id) return;
  void start(id);
}

/** Music volume 0–100 (0 = silent). */
export function setMusicVolume(v: number) {
  S.volume = Math.max(0, Math.min(100, v)) / 100;
  if (S.master && S.ctx) S.master.gain.setTargetAtTime(S.volume, S.ctx.currentTime, 0.05);
}

// ---------- sound effects ----------

/** Play a one-shot sound (e.g. an FFRK ability sound) at the sound-effect volume. Silent until audio is unlocked. */
export function playSfx(url: string) {
  const ac = audio();
  if (!ac || !S.sfxGain || ac.state !== "running" || S.sfxVolume <= 0) return;
  if (!S.sfxBuffers.has(url))
    S.sfxBuffers.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => ac.decodeAudioData(b))
        .catch(() => null),
    );
  void S.sfxBuffers.get(url)!.then((buffer) => {
    if (!buffer || !S.sfxGain) return;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(S.sfxGain);
    source.start();
  });
}

/** Sound effect volume 0–100 (0 = silent). */
export function setSfxVolume(v: number) {
  S.sfxVolume = Math.max(0, Math.min(100, v)) / 100;
  if (S.sfxGain && S.ctx) S.sfxGain.gain.setTargetAtTime(S.sfxVolume, S.ctx.currentTime, 0.05);
}

/** Play `id` while this component wants it (the most recent caller wins; null = silence). */
export function useMusic(id: string | null | undefined) {
  useEffect(() => {
    if (id !== undefined) playMusic(id);
  }, [id]);
}
