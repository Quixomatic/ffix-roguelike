import { WORLDS, type MapNode, type RunState } from "@ffix-roguelike/game-core";
import type Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

import type { Action } from "@/features/input/actions";
import { ButtonHint } from "@/features/input/button-hint";
import { useInputDevice, useInputOwner } from "@/features/input/owner";

import { createMapGame, type MapBridge } from "./map-scene";

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

export function Overworld({ run, onMove, busy, onAction }: { run: RunState; onMove(nodeId: string): void; busy: boolean; onAction?(action: Action): void }) {
  // The map has the controls while it's up (keyboard + controller through Phaser's input); a panel opened over it takes
  // them back for the menus until it closes (input/owner.ts).
  useInputOwner("game");
  const device = useInputDevice();
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
      {hover && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 ff-window px-4 py-1 text-base">{KIND_TEXT[hover.kind]}</div>
      )}
      <div className="pointer-events-none absolute bottom-14 right-3 flex items-center gap-1.5 text-xs text-white/70 [text-shadow:0_1px_2px_#000]">
        {device === "pad" ? "D-pad / stick to walk" : "WASD / arrows to walk"} · <ButtonHint action="confirm" /> enter a stage · or click a glowing stage
      </div>
    </div>
  );
}
