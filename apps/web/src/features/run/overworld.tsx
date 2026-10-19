import { WORLDS, type MapNode, type NodeKind, type RunState } from "@ffix-roguelike/game-core";
import { Bird, Castle, CircleHelp, Flag, Gem, Hammer, Music, Shield, Skull, Store, Swords, Tent, type LucideIcon } from "lucide-react";
import type Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

import type { Action } from "@/features/input/actions";
import { ButtonHint } from "@/features/input/button-hint";
import { useInputDevice, useInputOwner } from "@/features/input/owner";

import { createMapGame, type MapBridge } from "./map-scene";

const KIND_ICON: Record<NodeKind, LucideIcon> = {
  start: Flag,
  battle: Swords,
  elite: Skull,
  semiboss: Shield,
  treasure: Gem,
  shop: Store,
  synth: Hammer,
  stiltzkin: Music,
  chocobo: Bird,
  moogle: Tent,
  event: CircleHelp,
  boss: Castle,
};
const KIND_NAME: Record<NodeKind, string> = {
  start: "Start",
  battle: "Battle",
  elite: "Elite",
  semiboss: "Fortress",
  treasure: "Treasure",
  shop: "Shop",
  synth: "Synthesis",
  stiltzkin: "Stiltzkin",
  chocobo: "Chocobo",
  moogle: "Moogle",
  event: "Event",
  boss: "Boss",
};

/**
 * Where you are on this map, Pokelike-style: "1-3" (map 1, round 3: the round you're choosing now) and a track of the
 * map's rounds — the stage you took in each round played (its icon), the round you're on, and what's ahead (its icon
 * when the whole round is one kind: the Moogles, the boss).
 */
function MapProgress({ run }: { run: RunState }) {
  const nodes = run.map.nodes;
  const last = Math.max(...nodes.map((n) => n.col));
  const here = nodes.find((n) => n.id === run.position);
  const col = here?.col ?? 0;
  const round = Math.min(col + 1, last);
  const visited = new Set(run.visited);
  return (
    <div className="ff-window flex items-center gap-3 px-3 py-1.5">
      <div className="flex flex-col items-center leading-none">
        <span className="ff-display text-xl tabular-nums text-yellow-200">
          {run.stage + 1}-{round}
        </span>
        <span className="text-[0.6rem] opacity-60">of {last}</span>
      </div>
      <div className="flex items-center">
        {Array.from({ length: last }, (_, i) => {
          const c = i + 1;
          const inCol = nodes.filter((n) => n.col === c);
          const taken = inCol.find((n) => visited.has(n.id));
          const kinds = new Set(inCol.map((n) => n.kind));
          const shown = taken?.kind ?? (kinds.size === 1 ? [...kinds][0]! : null);
          const Icon = shown ? KIND_ICON[shown] : null;
          const state = c <= col ? "done" : c === round ? "now" : "ahead";
          return (
            <div key={c} className="flex items-center">
              {i > 0 && <span className={`h-0.5 w-3 ${c <= col ? "bg-[#9cf0a0]/70" : "bg-white/25"}`} />}
              <span
                title={`${run.stage + 1}-${c}${shown ? `: ${KIND_NAME[shown]}` : ""}`}
                className={`flex items-center justify-center rounded-full border ${
                  state === "done"
                    ? "h-6 w-6 border-[#9cf0a0]/70 bg-[#1f5a2c] text-[#d8ffd8]"
                    : state === "now"
                      ? "h-7 w-7 animate-pulse border-2 border-yellow-200 bg-black/40 text-yellow-200"
                      : "h-6 w-6 border-white/25 bg-black/30 text-white/45"
                }`}
              >
                {Icon ? <Icon size={state === "now" ? 15 : 13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_TEXT: Record<MapNode["kind"], string> = {
  start: "Start",
  battle: "Battle",
  elite: "Elite battle — tougher foes, better loot",
  treasure: "Treasure",
  shop: "Item shop — buy gear and supplies, sell what you don't need",
  synth: "Synthesis shop — combine gear into something better",
  stiltzkin: "Stiltzkin — a traveling moogle with special deals",
  chocobo: "Chocobo Hot & Cold — dig for buried treasure",
  moogle: "Moogle — full rest for the party, and a place to sell gear",
  event: "Something's going on here…",
  semiboss: "Fortress — a semi-boss blocks the road",
  boss: "Boss castle",
};

export function Overworld({
  run,
  onMove,
  busy,
  onAction,
  insetRight = 0,
}: {
  run: RunState;
  onMove(nodeId: string): void;
  busy: boolean;
  onAction?(action: Action): void;
  /** Screen px on the right covered by the floating party sidebar (0 when it's docked beside the map). */
  insetRight?: number;
}) {
  const insetRef = useRef(insetRight);
  insetRef.current = insetRight;
  // The map has the controls while it's up (keyboard + controller through Phaser's input); a panel opened over it takes
  // them back for the menus until it closes (input/owner.ts).
  useInputOwner("game");
  const device = useInputDevice();
  const [looking, setLooking] = useState(false);
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const hostRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<MapNode | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const world = WORLDS[run.world]!;

  useEffect(() => {
    if (!hostRef.current) return;
    const bridge: MapBridge = {
      map: run.map,
      position: run.position,
      visited: run.visited,
      leader: run.party[0]!.build.key,
      theme: world.theme,
      onHover: setHover,
      isBusy: () => busyRef.current,
      onAction: (a) => onActionRef.current?.(a),
      onLook: setLooking,
      insetRight: () => insetRef.current,
      // The scene calls this once the party has walked onto the stage: commit the move.
      onSelect: (id) => {
        if (busyRef.current) return;
        onMoveRef.current(id);
      },
    };
    const game: Phaser.Game = createMapGame(hostRef.current, bridge);
    return () => game.destroy(true);
    // Rebuild the scene whenever the position or map changes.
  }, [run.map, run.position, run.visited, run.party, world.theme]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* The area, map and journey are in the party sidebar. */}
      <div ref={hostRef} className="absolute inset-0" />
      {/* Overlays, centred on the whole map frame (whether or not the party floats over it). */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <div className="flex items-center gap-1.5 text-xs text-white/75 [text-shadow:0_1px_2px_#000]">
            {looking ? (
              <>
                Looking around · {device === "pad" ? "right stick / D-pad" : "arrows / drag"} to pan · <ButtonHint action="select" /> or <ButtonHint action="cancel" /> back to
                the party
              </>
            ) : (
              <>
                {device === "pad" ? "D-pad / stick to walk" : "WASD / arrows to walk"} · <ButtonHint action="confirm" /> enter a stage · <ButtonHint action="select" />{" "}
                {device === "pad" ? "or right stick" : "or drag"} to look around
              </>
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
          {hover && <div className="ff-window px-4 py-1 text-base">{KIND_TEXT[hover.kind]}</div>}
          <MapProgress run={run} />
        </div>
      </div>
    </div>
  );
}
