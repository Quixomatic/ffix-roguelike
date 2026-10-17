/**
 * Who the controls belong to right now — so the Phaser screens and the menus never fight over a key or a button.
 *
 * A stack of claims; the top one owns the input (nothing claimed = the menus):
 *
 * - **"game"**: a Phaser screen (the overworld, a battle) reads keyboard and controller itself, with Phaser's own
 *   input plugins (`SceneInput`). Menu navigation is paused and the controller poller sends no key presses.
 * - **"menu"**: menus have the cursor (Norigin), and the controller arrives as key presses (`nav.ts`). Phaser screens
 *   ignore their input. A panel opened over a game (the character sheet, the run's bag, the hub's sidebar) claims
 *   "menu" while it's open and hands the controls back when it closes.
 *
 * A claim can take **cancel** (Escape / Backspace / B): the top claim's `onCancel` runs instead of the router's Back —
 * a panel over the map closes and the map has the controls again.
 *
 * Also here: which device was used last (`keyboard` or `pad`), for button hints.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";

export type InputOwner = "game" | "menu";
interface Claim {
  id: number;
  owner: InputOwner;
  onCancel?: () => void;
}
interface OwnerState {
  claims: Claim[];
  next: number;
  listeners: Set<() => void>;
  device: InputDevice;
}
export type InputDevice = "keyboard" | "pad";

// On globalThis so a dev hot reload keeps the claims of mounted screens.
const S: OwnerState = ((globalThis as { __ffixOwner?: OwnerState }).__ffixOwner ??= {
  claims: [],
  next: 1,
  listeners: new Set(),
  device: "keyboard",
});

const notify = () => S.listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  S.listeners.add(fn);
  return () => S.listeners.delete(fn);
};

/** Called whenever the owner or the device changes. Returns the unsubscribe. */
export const onInputChange = subscribe;

/** The current owner of the controls. */
export const inputOwner = (): InputOwner => S.claims.at(-1)?.owner ?? "menu";
/** The top claim's cancel, if it has one (Escape / Backspace / B close it instead of going Back). */
export const ownerCancel = () => S.claims.at(-1)?.onCancel;

/** Take the controls until the returned release is called. */
export function claimInput(owner: InputOwner, onCancel?: () => void): () => void {
  const claim: Claim = { id: S.next++, owner, onCancel };
  S.claims.push(claim);
  notify();
  return () => {
    const i = S.claims.findIndex((c) => c.id === claim.id);
    if (i < 0) return;
    S.claims.splice(i, 1);
    notify();
  };
}

/**
 * Hold the controls while the component is mounted (and `active`). Claim when shown: a claim made later sits on top.
 * `onCancel` is read when cancel is pressed, so it can change between renders.
 */
export function useInputOwner(owner: InputOwner, { active = true, onCancel }: { active?: boolean; onCancel?: () => void } = {}) {
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const hasCancel = !!onCancel;
  useEffect(() => {
    if (!active) return;
    return claimInput(owner, hasCancel ? () => cancelRef.current?.() : undefined);
  }, [owner, active, hasCancel]);
}

/** Re-render on ownership changes; returns the current owner. */
export const useCurrentOwner = () => useSyncExternalStore(subscribe, inputOwner, () => "menu" as InputOwner);

/** The last device used (a controller press, or a real key press). */
export function setInputDevice(device: InputDevice) {
  if (S.device === device) return;
  S.device = device;
  notify();
}
export const inputDevice = () => S.device;
export const useInputDevice = () => useSyncExternalStore(subscribe, inputDevice, () => "keyboard" as InputDevice);
