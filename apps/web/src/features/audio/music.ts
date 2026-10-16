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

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let sfxVolume = 0.25;
let volume = 0.25;
let wanted: string | null = null;
let current: { id: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function audio(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxVolume;
  sfxGain.connect(ctx.destination);
  // Autoplay policy: resume on the first interaction, then start whatever was asked for.
  const unlock = () => {
    void ctx!.resume().then(() => {
      if (wanted && current?.id !== wanted) void start(wanted);
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
  if (!buffers.has(id))
    buffers.set(
      id,
      fetch(track.url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => ac.decodeAudioData(b))
        .catch(() => null),
    );
  return buffers.get(id)!;
}

async function start(id: string) {
  const ac = audio();
  if (!ac || !master) return;
  const buffer = await load(id);
  // Something else was asked for while this loaded, or it's already playing.
  if (!buffer || wanted !== id || current?.id === id || ac.state !== "running") return;
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
  source.connect(gain).connect(master);
  source.start();
  fadeOut();
  current = { id, source, gain };
}

function fadeOut() {
  if (!current || !ctx) return;
  const { source, gain } = current;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_S);
  source.stop(ctx.currentTime + FADE_S + 0.05);
  current = null;
}

/** Ask for a track (null = silence). Crossfades from whatever is playing. */
export function playMusic(id: string | null) {
  wanted = id;
  if (!id) return fadeOut();
  if (current?.id === id) return;
  void start(id);
}

/** Music volume 0–100 (0 = silent). */
export function setMusicVolume(v: number) {
  volume = Math.max(0, Math.min(100, v)) / 100;
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

// ---------- sound effects ----------

const sfxBuffers = new Map<string, Promise<AudioBuffer | null>>();

/** Play a one-shot sound (e.g. an FFRK ability sound) at the sound-effect volume. Silent until audio is unlocked. */
export function playSfx(url: string) {
  const ac = audio();
  if (!ac || !sfxGain || ac.state !== "running" || sfxVolume <= 0) return;
  if (!sfxBuffers.has(url))
    sfxBuffers.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => ac.decodeAudioData(b))
        .catch(() => null),
    );
  void sfxBuffers.get(url)!.then((buffer) => {
    if (!buffer || !sfxGain) return;
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(sfxGain);
    source.start();
  });
}

/** Sound effect volume 0–100 (0 = silent). */
export function setSfxVolume(v: number) {
  sfxVolume = Math.max(0, Math.min(100, v)) / 100;
  if (sfxGain && ctx) sfxGain.gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.05);
}

/** Play `id` while this component wants it (the most recent caller wins; null = silence). */
export function useMusic(id: string | null | undefined) {
  useEffect(() => {
    if (id !== undefined) playMusic(id);
  }, [id]);
}
