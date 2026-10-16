/**
 * Keyboard and controller navigation for every menu (Norigin Spatial Navigation), alongside the mouse:
 *
 * - **Move**: ←↑→↓ or WASD move the focus to the nearest control in that direction (`FocusItem`s, grouped by
 *   `FocusSection`s, which remember their last focused item). The first arrow press on a page focuses its first item.
 * - **Confirm**: Enter (the browser's own) or Space (ours, the same for links and buttons) presses the focused control
 *   (Norigin's Enter is unused).
 * - **Back**: Escape or Backspace backs out (the router's Back) when no dialog is open; dialogs close on their own Escape.
 *   In a text field or dropdown, Escape lets go of it instead (the cursor takes over again).
 * - **Menu**: M (or the controller's Start) opens / closes the hub's sidebar and moves the cursor into / out of it.
 * - **Controller**: the D-pad / left stick send arrow-key events (repeating while held), A presses the focused control
 *   (or sends Enter where the screen has its own controls), B sends Escape, Start the menu — so battles and the
 *   overworld, which already listen for those keys, work with a controller too.
 *
 * Screens with their own controls (the overworld's walking, the battle menu, Phaser) pause menu navigation while they're
 * mounted (`useNavPause`). Typing in a text field pauses it too, so WASD types. Norigin runs with native events (it never
 * swallows keys); this layer decides when it acts.
 *
 * `<html data-input="keys|pointer">` records the last input, so focus rings only show when navigating by keys.
 */
import {
  doesFocusableExist,
  getCurrentFocusKey,
  init,
  pause,
  resume,
  setFocus,
  setKeyMap,
} from "@noriginmedia/norigin-spatial-navigation";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/** Focus keys of the shell's two sections: the page's content and the sidebar. */
export const PAGE_FOCUS = "page";
export const SIDEBAR_FOCUS = "sidebar";
/** The page's content (inside PAGE_FOCUS, beside the menu button and shortcuts): where arriving on a page lands. */
export const CONTENT_FOCUS = "page-content";
/** The hub's menu button, and its round shortcuts (`quick-0`, `quick-1`…, top to bottom). */
export const MENU_BUTTON_FOCUS = "menu-button";
export const quickFocus = (i: number) => `quick-${i}`;
/** Window event for the menu control (M, or the controller's Start): the hub shell opens / closes its sidebar. */
export const MENU_EVENT = "ffix:menu";

const ARROWS: Record<string, "up" | "down" | "left" | "right"> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

type NavState = { started: boolean; manual: number; editing: boolean };
// On globalThis so a dev hot reload doesn't init twice.
const S: NavState = ((globalThis as { __ffixNav?: NavState }).__ffixNav ??= { started: false, manual: 0, editing: false });

/** Typing goes here (a slider isn't typing: ↑/↓ still move the cursor off it; it keeps ←/→ — see `isSliderKey`). */
const isEditable = (el: Element | null) =>
  !!el && ((el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true']") && !el.matches("input[type='range']")) || !!el.closest("[contenteditable='true']"));
const isSliderKey = (el: Element | null, dir: string) => !!el?.matches("input[type='range']") && (dir === "left" || dir === "right");
const dialogOpen = () => !!document.querySelector("[role='dialog'], [data-modal]");
/** Menu navigation is off: a screen with its own controls is up, or the player is typing. */
export const navPaused = () => S.manual > 0 || S.editing;
const applyPause = () => (navPaused() ? pause() : resume());

export function startNav() {
  if (S.started || typeof window === "undefined") return;
  S.started = true;
  init({
    shouldFocusDOMNode: true,
    shouldUseNativeEvents: true,
    // We scroll ourselves (`FocusItem`), so hovering an item can focus it without jumping the page.
    domNodeFocusOptions: { preventScroll: true },
    useGetBoundingClientRect: true,
    distanceCalculationMethod: "center",
  });
  // keyCode for real key presses, code for the controller's synthetic ones. Enter isn't mapped: the browser handles it.
  setKeyMap({
    up: [38, "ArrowUp", 87, "KeyW"],
    down: [40, "ArrowDown", 83, "KeyS"],
    left: [37, "ArrowLeft", 65, "KeyA"],
    right: [39, "ArrowRight", 68, "KeyD"],
    enter: ["__none__"],
  });

  const root = document.documentElement;
  window.addEventListener(
    "keydown",
    (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) root.dataset.input = "keys";
      // Escape in a text field or dropdown lets go of it: the cursor and arrows take over again (not Back).
      if (e.key === "Escape" && isEditable(e.target as Element) && S.manual === 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        (e.target as HTMLElement).blur();
        const cur = getCurrentFocusKey();
        if (cur && doesFocusableExist(cur)) void setFocus(cur);
        return;
      }
      // M: the menu (the hub's sidebar).
      if (e.code === "KeyM" && !e.repeat && !navPaused() && !isEditable(e.target as Element) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new Event(MENU_EVENT));
        return;
      }
      const dir = ARROWS[e.code];
      if (!dir || navPaused() || e.ctrlKey || e.metaKey || e.altKey) return;
      // A slider keeps ←/→ (it adjusts natively; its FocusItem keeps Norigin from moving).
      if (isSliderKey(document.activeElement, dir)) return;
      // Arrows move the cursor, not the page.
      e.preventDefault();
      // Nothing focused yet (or it's gone): start on the page, else the sidebar.
      const cur = getCurrentFocusKey();
      if (!cur || !doesFocusableExist(cur)) {
        e.stopImmediatePropagation();
        // A key press placed it: pass the event, so it ticks like any move the player makes.
        void setFocus(doesFocusableExist(PAGE_FOCUS) ? PAGE_FOCUS : SIDEBAR_FOCUS, { event: e });
      }
    },
    true,
  );
  // Space = Enter in menus: it presses the focused control (links included — browsers only do buttons), once, on release
  // (as browsers press buttons), and never scrolls the page. Text fields keep their spaces; screens with their own
  // controls (battle menu, map) already treat Space as Enter.
  const spaceTarget = (e: KeyboardEvent) => {
    if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey || navPaused() || isEditable(e.target as Element)) return null;
    const el = document.activeElement as HTMLElement | null;
    return el && el !== document.body && el.matches("button, a[href], [role='button'], summary") ? el : null;
  };
  window.addEventListener(
    "keydown",
    (e) => {
      if (spaceTarget(e) || (e.code === "Space" && !navPaused() && !isEditable(e.target as Element))) e.preventDefault();
    },
    true,
  );
  window.addEventListener(
    "keyup",
    (e) => {
      const el = spaceTarget(e);
      if (!el) return;
      e.preventDefault();
      if (!(el as HTMLButtonElement).disabled) el.click();
    },
    true,
  );
  for (const ev of ["pointerdown", "pointermove"] as const) window.addEventListener(ev, () => (root.dataset.input = "pointer"), { passive: true });
  document.addEventListener("focusin", (e) => {
    S.editing = isEditable(e.target as Element);
    applyPause();
  });
  document.addEventListener("focusout", () => {
    S.editing = false;
    applyPause();
  });
  startGamepad();
}

/** Pause menu navigation while the calling component (a screen with its own controls) is mounted. */
export function useNavPause(active = true) {
  useEffect(() => {
    if (!active) return;
    S.manual += 1;
    applyPause();
    return () => {
      S.manual -= 1;
      applyPause();
    };
  }, [active]);
}

/** Mounts navigation for the app: starts it once, and makes Escape / Backspace back out (the router's Back) outside dialogs. */
export function NavRoot() {
  const router = useRouter();
  useEffect(() => {
    startNav();
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "Escape" && e.key !== "Backspace") || e.repeat || e.defaultPrevented || navPaused() || isEditable(e.target as Element) || dialogOpen()) return;
      e.preventDefault();
      if (router.history.canGoBack()) router.history.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

// ── Controller ──────────────────────────────────────────────────────────────────────────────────────────────────────

const PAD_KEYS = {
  up: ["ArrowUp", "ArrowUp"],
  down: ["ArrowDown", "ArrowDown"],
  left: ["ArrowLeft", "ArrowLeft"],
  right: ["ArrowRight", "ArrowRight"],
  enter: ["Enter", "Enter"],
  escape: ["Escape", "Escape"],
  menu: ["m", "KeyM"],
  // FF9's shoulder / Triangle buttons, as the battle menu's keys: L1 swap target side, R1 all / single, Y next character.
  l1: ["q", "KeyQ"],
  r1: ["e", "KeyE"],
  triangle: ["c", "KeyC"],
} as const;
export type PadKey = keyof typeof PAD_KEYS;
const REPEAT_DELAY = 350;
const REPEAT_EVERY = 120;

const KEY_CODES: Record<string, number> = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Enter: 13, Escape: 27, m: 77, q: 81, e: 69, c: 67 };

/** A real-looking key event: `keyCode`/`which` too, which Phaser's keyboard reads (the constructor can't set them). */
function keyEvent(type: "keydown" | "keyup", key: string, code: string) {
  const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  const keyCode = KEY_CODES[key] ?? 0;
  Object.defineProperty(ev, "keyCode", { get: () => keyCode });
  Object.defineProperty(ev, "which", { get: () => keyCode });
  return ev;
}

function sendKey(k: PadKey) {
  const [key, code] = PAD_KEYS[k];
  document.documentElement.dataset.input = "keys";
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(keyEvent("keydown", key, code));
  target.dispatchEvent(keyEvent("keyup", key, code));
}

/** A: press the focused control in menus; where a screen has its own controls, send Enter. */
function confirm() {
  const el = document.activeElement as HTMLElement | null;
  if (!navPaused() && el && el !== document.body && el.matches("button, a[href], [role='button'], summary")) el.click();
  else sendKey("enter");
}

/** Connected controllers (the browser only lists one after a button on it is pressed with the page focused). */
export function connectedPads(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  try {
    return [...navigator.getGamepads()].filter((p): p is Gamepad => !!p?.connected);
  } catch {
    return []; // not a secure context (http:// on a LAN address): no controllers
  }
}

/**
 * A controller's D-pad, read both ways: "standard" pads have buttons 12–15; many others (DirectInput / generic) report
 * a hat switch as one axis (usually axes[9]: −1 up, −0.43 right, 0.14 down, 0.71 left, in between for diagonals,
 * and > 1 at rest).
 */
function dpad(pad: Gamepad) {
  const b = (i: number) => !!pad.buttons[i]?.pressed;
  const out = { up: b(12), down: b(13), left: b(14), right: b(15) };
  if (pad.mapping !== "standard") {
    const hat = pad.axes[9];
    if (hat != null && hat >= -1.05 && hat <= 1.05) {
      const near = (v: number) => Math.abs(hat - v) < 0.2;
      out.up ||= near(-1) || near(-0.71) || near(1);
      out.right ||= near(-0.71) || near(-0.43) || near(-0.14);
      out.down ||= near(-0.14) || near(0.14) || near(0.43);
      out.left ||= near(0.43) || near(0.71) || near(1);
    }
  }
  return out;
}

/** What every connected controller is pressing, merged (Windows often adds idle virtual pads next to the real one). */
export function padInput(): Record<PadKey, boolean> {
  const out: Record<PadKey, boolean> = { up: false, down: false, left: false, right: false, enter: false, escape: false, menu: false, l1: false, r1: false, triangle: false };
  for (const pad of connectedPads()) {
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const [x = 0, y = 0] = pad.axes;
    const d = dpad(pad);
    out.up ||= d.up || y < -0.5;
    out.down ||= d.down || y > 0.5;
    out.left ||= d.left || x < -0.5;
    out.right ||= d.right || x > 0.5;
    out.enter ||= b(0);
    out.escape ||= b(1);
    out.menu ||= b(9);
    out.l1 ||= b(4);
    out.r1 ||= b(5);
    out.triangle ||= b(3);
  }
  return out;
}

function startGamepad() {
  const held = new Map<PadKey, number>();
  let running = false;
  const loop = () => {
    // Keep polling while any controller is connected (a pad can read as missing for a frame).
    if (!connectedPads().length) {
      running = false;
      held.clear();
      return;
    }
    const down = padInput();
    const now = performance.now();
    for (const k of Object.keys(down) as PadKey[]) {
      if (!down[k]) {
        held.delete(k);
        continue;
      }
      const since = held.get(k);
      const repeats = k === "up" || k === "down" || k === "left" || k === "right";
      if (since == null) {
        held.set(k, now);
        k === "enter" ? confirm() : sendKey(k);
      } else if (repeats && now - since > REPEAT_DELAY) {
        held.set(k, now - REPEAT_DELAY + REPEAT_EVERY);
        sendKey(k);
      }
    }
    requestAnimationFrame(loop);
  };
  const start = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  };
  window.addEventListener("gamepadconnected", (e) => {
    console.info(`[controller] connected: "${e.gamepad.id}" (slot ${e.gamepad.index}, mapping "${e.gamepad.mapping || "none"}")`);
    start();
  });
  // Already connected (e.g. after a hot reload), or a pad the browser lists without firing the event.
  if (connectedPads().length) start();
  window.addEventListener("focus", () => connectedPads().length && start());
}
