/**
 * Controls for a Phaser scene, the Phaser way: its keyboard plugin and its gamepad plugin (the game config needs
 * `input: { gamepad: true }` — see `PHASER_INPUT`), read as the game's actions (`actions.ts`).
 *
 *   const controls = new SceneInput(this, { repeat: true });
 *   controls.on((action) => …);        // presses (held directions repeat with `repeat`)
 *   controls.isDown("left");           // held, for walking
 *
 * It only acts while the scene owns the controls (`inputOwner() === "game"`, see `owner.ts`) and nobody is typing in
 * a text field: when a menu opens over the scene, the scene goes quiet, and buttons already held when it gets the
 * controls back don't count as presses. Every connected controller counts (Windows often lists idle virtual pads next
 * to the real one), and non-standard pads' hat-switch D-pads work too.
 */
import Phaser from "phaser";

import { ACTIONS, isDirection, KEY_BINDINGS, padActions, REPEAT_DELAY, REPEAT_EVERY, type Action } from "./actions";
import { inputOwner, setInputDevice } from "./owner";

/** Spread into a Phaser game config: turns on Phaser's gamepad plugin. */
export const PHASER_INPUT = { input: { gamepad: true } } as const;

const BOUND_KEY_CODES = new Set(ACTIONS.flatMap((a) => KEY_BINDINGS[a].map((b) => b.keyCode)));

/** True while focus is in a text field (keys belong to it then). */
export function typingElsewhere(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export class SceneInput {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private listeners = new Set<(action: Action) => void>();
  private down = new Set<Action>();
  private padBefore = new Set<Action>();
  /** When each held action fired last (for repeats). */
  private held = new Map<Action, number>();
  private owned = false;

  constructor(
    private scene: Phaser.Scene,
    private opts: { repeat?: boolean } = {},
  ) {
    const kb = scene.input.keyboard!;
    // Not captured: the rest of the page keeps its keys. We cancel the browser's default ourselves while we own them.
    for (const a of ACTIONS) this.keys.set(a, KEY_BINDINGS[a].map((b) => kb.addKey(b.keyCode, false)));
    kb.on("keydown", this.onKeyDown, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.poll, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.poll, this);
      kb.off("keydown", this.onKeyDown, this);
      this.listeners.clear();
    });
  }

  /** Listen for presses. Returns the unsubscribe. */
  on(fn: (action: Action) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Held right now (always false while the scene doesn't own the controls). */
  isDown(action: Action) {
    return this.down.has(action);
  }

  /** The controllers' right stick (−1…1 each way, 0 inside the dead zone), for looking around. 0 while not ours. */
  rightStick(): { x: number; y: number } {
    if (!this.owns()) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const pad of this.scene.input.gamepad?.gamepads ?? []) {
      if (!pad?.connected || pad.pad?.mapping !== "standard") continue;
      const ax = pad.axes[2]?.getValue() ?? 0;
      const ay = pad.axes[3]?.getValue() ?? 0;
      if (Math.abs(ax) > Math.abs(x)) x = ax;
      if (Math.abs(ay) > Math.abs(y)) y = ay;
    }
    const dead = (v: number) => (Math.abs(v) < 0.25 ? 0 : v);
    return { x: dead(x), y: dead(y) };
  }

  private owns() {
    return inputOwner() === "game" && !typingElsewhere();
  }

  /** Our keys don't scroll the page, press a focused button or move the browser's focus while the scene has them. */
  private onKeyDown(e: KeyboardEvent) {
    if (this.owns() && !e.ctrlKey && !e.metaKey && !e.altKey && BOUND_KEY_CODES.has(e.keyCode)) e.preventDefault();
  }

  private padState() {
    const out = new Set<Action>();
    for (const pad of this.scene.input.gamepad?.gamepads ?? []) {
      if (!pad?.connected) continue;
      padActions(
        (i) => !!pad.buttons[i]?.pressed,
        (i) => pad.axes[i]?.getValue(),
        pad.pad?.mapping === "standard",
        out,
      );
    }
    return out;
  }

  private poll() {
    // Read (and clear) the keyboard's "just pressed" flags every frame, so presses made while a menu had the controls
    // don't fire later.
    const fresh = new Map<Action, "keyboard" | "pad">();
    const down = new Set<Action>();
    for (const [a, keys] of this.keys) {
      for (const key of keys) {
        if (Phaser.Input.Keyboard.JustDown(key)) fresh.set(a, "keyboard");
        if (key.isDown) down.add(a);
      }
    }
    const pad = this.padState();
    for (const a of pad) {
      down.add(a);
      if (!this.padBefore.has(a) && !fresh.has(a)) fresh.set(a, "pad");
    }
    this.padBefore = pad;

    if (!this.owns()) {
      this.owned = false;
      this.down.clear();
      this.held.clear();
      return;
    }
    this.down = down;
    // The first frame back from a menu: the press that closed it (Enter on Close, Escape) isn't the game's.
    if (!this.owned) {
      this.owned = true;
      for (const a of down) this.held.set(a, performance.now());
      return;
    }
    const now = performance.now();
    for (const a of ACTIONS) {
      const how = fresh.get(a);
      if (how) {
        setInputDevice(how);
        this.held.set(a, now);
        this.emit(a);
      } else if (!down.has(a)) {
        this.held.delete(a);
      } else if (this.opts.repeat && isDirection(a)) {
        const last = this.held.get(a) ?? now;
        if (now - last > REPEAT_DELAY) {
          // Repeat every REPEAT_EVERY after the first delay.
          this.held.set(a, now - REPEAT_DELAY + REPEAT_EVERY);
          this.emit(a);
        }
      }
    }
  }

  private emit(a: Action) {
    for (const fn of this.listeners) fn(a);
  }
}
