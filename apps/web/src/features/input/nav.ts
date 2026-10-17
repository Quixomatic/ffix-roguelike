/**
 * Keyboard and controller navigation for every menu (Norigin Spatial Navigation), alongside the mouse:
 *
 * - **Move**: ←↑→↓ or WASD move the focus to the nearest control in that direction (`FocusItem`s, grouped by
 *   `FocusSection`s, which remember their last focused item). The first arrow press on a page focuses its first item.
 * - **Confirm**: Enter (the browser's own) or Space (ours, the same for links and buttons) presses the control the
 *   cursor is on (`cursorTarget`: the browser's focus, else Norigin's marked item). Norigin's Enter is unused.
 * - **Back**: Escape or Backspace backs out: the top input claim's cancel (a panel over the game closes), else the
 *   router's Back when no dialog is open; dialogs close on their own Escape. In a text field or dropdown, Escape lets
 *   go of it instead (the cursor takes over again).
 * - **Menu**: M (or the controller's Start) opens / closes the hub's sidebar and moves the cursor into / out of it.
 * - **Controller**, in menus: each button arrives as its action's key (`actions.ts`): the D-pad / left stick as arrows
 *   (repeating while held), A presses the focused control, B sends Escape, Start M, LB / RB Q / E, Y C, X X, View V.
 *
 * Phaser screens (the overworld, battles) read the keyboard and controller themselves, with Phaser's own input
 * (`SceneInput`). Who has the controls is explicit (`owner.ts`): while a Phaser screen owns them, menu navigation is
 * paused and the controller sends no key presses; a panel opened over it claims them back for the menus, and cancel
 * closes it. Typing in a text field pauses navigation too, so WASD types. Norigin runs with native events (it never
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

import { ACTIONS, isDirection, KEY_BINDINGS, padActions, REPEAT_DELAY, REPEAT_EVERY, type Action } from "./actions";
import { inputOwner, onInputChange, ownerCancel, setInputDevice } from "./owner";

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

type NavState = { started: boolean; editing: boolean };
// On globalThis so a dev hot reload doesn't init twice.
const S: NavState = ((globalThis as { __ffixNav?: NavState }).__ffixNav ??= { started: false, editing: false });

/** Typing goes here (a slider isn't typing: ↑/↓ still move the cursor off it; it keeps ←/→ — see `isSliderKey`). */
export const isEditable = (el: Element | null) =>
  !!el && ((el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true']") && !el.matches("input[type='range']")) || !!el.closest("[contenteditable='true']"));
const isSliderKey = (el: Element | null, dir: string) => !!el?.matches("input[type='range']") && (dir === "left" || dir === "right");
export const dialogOpen = () => !!document.querySelector("[role='dialog'], [data-modal]");
/** Menu navigation is off: a Phaser screen has the controls (`owner.ts`), or the player is typing. */
export const navPaused = () => inputOwner() === "game" || S.editing;
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
      // A real key press (the controller's are synthetic): show keyboard hints.
      if (e.isTrusted) setInputDevice("keyboard");
      // Escape in a text field or dropdown lets go of it: the cursor and arrows take over again (not Back).
      if (e.key === "Escape" && isEditable(e.target as Element) && inputOwner() === "menu") {
        e.preventDefault();
        e.stopImmediatePropagation();
        (e.target as HTMLElement).blur();
        const cur = getCurrentFocusKey();
        if (cur && doesFocusableExist(cur)) void setFocus(cur);
        return;
      }
      // M: the menu (the hub's sidebar). A Phaser screen with the controls sends it itself.
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
  // (as browsers press buttons), and never scrolls the page. Text fields keep their spaces; Phaser screens take Space
  // as confirm themselves.
  const spaceTarget = (e: KeyboardEvent) => {
    if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey || navPaused() || isEditable(e.target as Element)) return null;
    return cursorTarget();
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
  // Enter is the browser's own on a focused control. When the browser's focus isn't on one but the cursor is (it landed
  // while the control was disabled), Enter presses what the cursor is on — so one press always does it.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.repeat || navPaused() || isEditable(e.target as Element)) return;
      const focused = document.activeElement as HTMLElement | null;
      if (focused && focused !== document.body && focused.matches(PRESSABLE)) return;
      const el = cursorTarget();
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
  // A Phaser screen taking the controls (or giving them back) pauses / resumes the menus' cursor.
  onInputChange(applyPause);
  applyPause();
  startGamepad();
}

/**
 * Mounts navigation for the app: starts it once, and makes Escape / Backspace back out: the top input claim's cancel
 * (a panel over the game closes), else the router's Back outside dialogs.
 */
export function NavRoot() {
  const router = useRouter();
  useEffect(() => {
    startNav();
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "Escape" && e.key !== "Backspace") || e.repeat || e.defaultPrevented || navPaused() || isEditable(e.target as Element)) return;
      const cancel = ownerCancel();
      if (cancel) {
        e.preventDefault();
        cancel();
        return;
      }
      if (dialogOpen()) return;
      e.preventDefault();
      if (router.history.canGoBack()) router.history.back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}

// ── Controller (menus) ──────────────────────────────────────────────────────────────────────────────────────────────

/** A real-looking key event: `keyCode`/`which` too (the constructor can't set them). */
function keyEvent(type: "keydown" | "keyup", key: string, code: string, keyCode: number) {
  const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  Object.defineProperty(ev, "keyCode", { get: () => keyCode });
  Object.defineProperty(ev, "which", { get: () => keyCode });
  return ev;
}

/** Send an action to the menus as its key (`actions.ts`: the first key bound to it). */
function sendKey(a: Action) {
  const { key, code, keyCode } = KEY_BINDINGS[a][0]!;
  document.documentElement.dataset.input = "keys";
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(keyEvent("keydown", key, code, keyCode));
  target.dispatchEvent(keyEvent("keyup", key, code, keyCode));
}

/** A: press the control the cursor is on; with none (e.g. a menu with its own cursor), send Enter. */
function confirm() {
  const el = S.editing ? null : cursorTarget();
  if (el) {
    if (!(el as HTMLButtonElement).disabled) el.click();
  } else sendKey("confirm");
}

const PRESSABLE = "button, a[href], [role='button'], summary";

/**
 * What confirm presses: the control the cursor is on. That's the browser's focus when it's on a control — else the
 * element Norigin marked (`data-focused`): a control that was disabled when the cursor landed on it (e.g. Continue
 * while the battle result saves) never got the browser's focus, yet it's where the cursor is.
 */
export function cursorTarget(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  if (el && el !== document.body && el.matches(PRESSABLE)) return el;
  const marked = document.querySelector<HTMLElement>("[data-focused='true']");
  return marked?.matches(PRESSABLE) ? marked : null;
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

/** What every connected controller is pressing, as actions, merged (Windows often adds idle virtual pads next to the real one). */
export function padInput(): Set<Action> {
  const out = new Set<Action>();
  for (const pad of connectedPads()) padActions((i) => !!pad.buttons[i]?.pressed, (i) => pad.axes[i], pad.mapping === "standard", out);
  return out;
}

/**
 * The menus' controller: polls the pads and sends each press as its action's key. While a Phaser screen has the
 * controls it sends nothing (the scene reads the pads itself), but keeps track of what's held, so a button held across
 * a hand-off doesn't press anything on the other side.
 */
function startGamepad() {
  const held = new Map<Action, number>();
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
    const menus = inputOwner() === "menu";
    for (const a of ACTIONS) {
      if (!down.has(a)) {
        held.delete(a);
        continue;
      }
      const since = held.get(a);
      if (since == null) {
        held.set(a, now);
        if (!menus) continue;
        setInputDevice("pad");
        if (a === "confirm") confirm();
        else sendKey(a);
      } else if (menus && isDirection(a) && now - since > REPEAT_DELAY) {
        held.set(a, now - REPEAT_DELAY + REPEAT_EVERY);
        sendKey(a);
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
