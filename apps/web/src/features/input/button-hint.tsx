import { KEY_LABEL, PAD_LABEL, type Action } from "./actions";
import { useInputDevice } from "./owner";

/** Xbox-style face button colours (the layout the browser's "standard" mapping names). */
const FACE: Partial<Record<Action, string>> = {
  confirm: "bg-[#3a9a48] text-white",
  cancel: "bg-[#c83a3a] text-white",
  x: "bg-[#3a68c8] text-white",
  triangle: "bg-[#d8b030] text-black",
};

/**
 * Which button does it: the controller's button when a controller was used last (A / B / X / Y as coloured rounds,
 * LB / RB / Start / View as small pills), else the keyboard's key as a keycap.
 */
export function ButtonHint({ action, className = "" }: { action: Action; className?: string }) {
  const pad = useInputDevice() === "pad";
  const face = pad ? FACE[action] : undefined;
  const shape = face
    ? `h-[1.15rem] w-[1.15rem] justify-center rounded-full ${face}`
    : pad
      ? "h-[1.15rem] rounded-full bg-white/85 px-1.5 text-black"
      : "h-[1.15rem] min-w-[1.15rem] justify-center rounded border border-white/50 border-b-2 bg-black/40 px-1 text-white";
  return (
    <kbd aria-hidden className={`inline-flex shrink-0 items-center font-sans text-[0.65rem] font-bold leading-none ${shape} ${className}`}>
      {pad ? PAD_LABEL[action] : KEY_LABEL[action]}
    </kbd>
  );
}
