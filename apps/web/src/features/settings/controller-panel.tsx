import { useEffect, useState } from "react";

import { Panel } from "@/features/gear/character-panels";
import { connectedPads, padInput, type PadKey } from "@/features/input/nav";

type PadView = { id: string; index: number; mapping: string; buttons: number[]; axes: number[] };

/**
 * What the browser reports about controllers, live: whether the page may use them at all, every connected pad (name,
 * slot, layout), the buttons pressed and the stick/hat values, and what the game reads from them. For setting up and
 * debugging a controller.
 */
export function ControllerPanel() {
  const [pads, setPads] = useState<PadView[]>([]);
  const [input, setInput] = useState<Record<PadKey, boolean> | null>(null);
  const secure = typeof window !== "undefined" && window.isSecureContext;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setPads(
        connectedPads().map((p) => ({
          id: p.id,
          index: p.index,
          mapping: p.mapping || "none",
          buttons: p.buttons.flatMap((b, i) => (b.pressed ? [i] : [])),
          axes: p.axes.map((a) => Math.round(a * 100) / 100),
        })),
      );
      setInput(padInput());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const reading = input ? (Object.entries(input) as [PadKey, boolean][]).filter(([, on]) => on).map(([k]) => k) : [];
  return (
    <Panel title="Controller" className="md:col-span-2">
      {!secure ? (
        <div className="text-sm text-red-300">
          This page isn't on a secure address, so the browser hides controllers. Open the game on <span className="text-yellow-200">localhost</span> or
          an https address.
        </div>
      ) : !pads.length ? (
        <div className="flex flex-col gap-1 text-sm opacity-80">
          <span>
            No controller yet. Connect one and <span className="text-yellow-200">press any button on it</span> with this page focused — browsers only show a
            controller to the page after that.
          </span>
          <span className="text-xs">
            Still nothing? <span className="text-yellow-200">Quit the browser completely and reopen it</span> (Chrome: ⋮ → Exit; it keeps running in the
            background otherwise) — its controller support can get stuck. Steam can also hide controllers from browsers while it's running.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          {pads.map((p) => (
            <div key={p.index} className="rounded border border-white/15 bg-black/25 p-2">
              <div className="truncate">
                <span className="text-yellow-200">Slot {p.index}</span> · {p.id}
              </div>
              <div className="text-xs opacity-80">
                Layout: {p.mapping === "standard" ? "standard" : `${p.mapping} (D-pad read from the hat axis too)`}
              </div>
              <div className="text-xs tabular-nums">Buttons pressed: {p.buttons.length ? p.buttons.join(", ") : "—"}</div>
              <div className="text-xs tabular-nums opacity-80">Axes: {p.axes.map((a, i) => `${i}: ${a}`).join("  ")}</div>
            </div>
          ))}
          <div className="text-xs">
            The game reads: <span className="text-yellow-200">{reading.length ? reading.join(" + ") : "nothing"}</span>
            <span className="opacity-60"> (D-pad / left stick move · A = 0 confirms · B = 1 backs out · Start = 9 menu)</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
