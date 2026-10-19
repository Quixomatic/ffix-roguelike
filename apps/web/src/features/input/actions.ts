/**
 * The game's controls as actions — one table for every input path:
 *
 * - **Phaser screens** (overworld, battle) read these with Phaser's own keyboard and gamepad plugins (`SceneInput`).
 * - **Menus** (React + Norigin) get the controller as key presses: the poller in `nav.ts` sends each pad button as the
 *   action's first key here, so a menu that handles the key handles the button.
 *
 * | action   | keyboard              | controller (standard mapping) | FF9      |
 * |----------|-----------------------|-------------------------------|----------|
 * | up…right | ↑↓←→ / WASD           | D-pad, left stick             |          |
 * | confirm  | Enter, Space          | A (0)                         | ○ / ×    |
 * | cancel   | Escape, Backspace     | B (1)                         |          |
 * | x        | X                     | X (2)                         | □        |
 * | triangle | C                     | Y (3)                         | △        |
 * | l1       | Q (Tab)               | LB (4)                        | L1       |
 * | r1       | E                     | RB (5)                        | R1       |
 * | l2       | − (minus, numpad −)   | LT (6)                        | L2       |
 * | r2       | + (=, numpad +)       | RT (7)                        | R2       |
 * | select   | V                     | Back / View (8)               | Select   |
 * | menu     | M                     | Start / Menu (9)              | Start    |
 *
 * L2 / R2 zoom the overworld map out / in.
 */
export const ACTIONS = ["up", "down", "left", "right", "confirm", "cancel", "x", "triangle", "l1", "r1", "l2", "r2", "select", "menu"] as const;
export type Action = (typeof ACTIONS)[number];
export const DIRECTIONS = ["up", "down", "left", "right"] as const satisfies readonly Action[];
export const isDirection = (a: Action): a is (typeof DIRECTIONS)[number] => (DIRECTIONS as readonly Action[]).includes(a);

/** A key: `code` for DOM listeners, `key` + `keyCode` for synthetic events and Phaser's keyboard. */
export interface KeyBinding {
  code: string;
  key: string;
  keyCode: number;
}
const k = (code: string, key: string, keyCode: number): KeyBinding => ({ code, key, keyCode });

/** Keys per action; the first is what the controller sends to menus. */
export const KEY_BINDINGS: Record<Action, KeyBinding[]> = {
  up: [k("ArrowUp", "ArrowUp", 38), k("KeyW", "w", 87)],
  down: [k("ArrowDown", "ArrowDown", 40), k("KeyS", "s", 83)],
  left: [k("ArrowLeft", "ArrowLeft", 37), k("KeyA", "a", 65)],
  right: [k("ArrowRight", "ArrowRight", 39), k("KeyD", "d", 68)],
  confirm: [k("Enter", "Enter", 13), k("Space", " ", 32)],
  cancel: [k("Escape", "Escape", 27), k("Backspace", "Backspace", 8)],
  x: [k("KeyX", "x", 88)],
  triangle: [k("KeyC", "c", 67)],
  l1: [k("KeyQ", "q", 81), k("Tab", "Tab", 9)],
  r1: [k("KeyE", "e", 69)],
  l2: [k("Minus", "-", 189), k("NumpadSubtract", "-", 109)],
  r2: [k("Equal", "=", 187), k("NumpadAdd", "+", 107)],
  select: [k("KeyV", "v", 86)],
  menu: [k("KeyM", "m", 77)],
};

/** Which action a DOM key event is (by `code`), if any. */
export function actionForKey(e: KeyboardEvent): Action | null {
  for (const a of ACTIONS) if (KEY_BINDINGS[a].some((b) => b.code === e.code)) return a;
  return null;
}

/** Controller buttons per action (the browser's "standard" layout; most pads report it). */
export const PAD_BUTTONS: Partial<Record<Action, number[]>> = {
  up: [12],
  down: [13],
  left: [14],
  right: [15],
  confirm: [0],
  cancel: [1],
  x: [2],
  triangle: [3],
  l1: [4],
  r1: [5],
  l2: [6],
  r2: [7],
  select: [8],
  menu: [9],
};

/** What a controller shows for each action, and the keyboard's main key. */
export const PAD_LABEL: Record<Action, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  confirm: "A",
  cancel: "B",
  x: "X",
  triangle: "Y",
  l1: "LB",
  r1: "RB",
  l2: "LT",
  r2: "RT",
  select: "View",
  menu: "Start",
};
export const KEY_LABEL: Record<Action, string> = {
  up: "W",
  down: "S",
  left: "A",
  right: "D",
  confirm: "Enter",
  cancel: "Esc",
  x: "X",
  triangle: "C",
  l1: "Q",
  r1: "E",
  l2: "−",
  r2: "+",
  select: "V",
  menu: "M",
};

/**
 * A raw controller's state as actions. Reads the D-pad both ways: "standard" pads have buttons 12–15; many others
 * (DirectInput / generic) report a hat switch as one axis (usually axes[9]: −1 up, −0.43 right, 0.14 down, 0.71 left,
 * in between for diagonals, and > 1 at rest). The left stick counts past half-way.
 */
export function padActions(buttons: (i: number) => boolean, axes: (i: number) => number | undefined, standard: boolean, out = new Set<Action>()) {
  for (const a of ACTIONS) if (PAD_BUTTONS[a]?.some(buttons)) out.add(a);
  if (!standard) {
    const hat = axes(9);
    if (hat != null && hat >= -1.05 && hat <= 1.05) {
      const near = (v: number) => Math.abs(hat - v) < 0.2;
      if (near(-1) || near(-0.71) || near(1)) out.add("up");
      if (near(-0.71) || near(-0.43) || near(-0.14)) out.add("right");
      if (near(-0.14) || near(0.14) || near(0.43)) out.add("down");
      if (near(0.43) || near(0.71) || near(1)) out.add("left");
    }
  }
  const x = axes(0) ?? 0;
  const y = axes(1) ?? 0;
  if (y < -0.5) out.add("up");
  if (y > 0.5) out.add("down");
  if (x < -0.5) out.add("left");
  if (x > 0.5) out.add("right");
  return out;
}

/** Held directions repeat after this delay, this often (menus' cursors). */
export const REPEAT_DELAY = 350;
export const REPEAT_EVERY = 120;
