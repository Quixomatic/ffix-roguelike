import { getJourney, WORLDS, type MapNode, type RunState } from "@ffix-roguelike/game-core";
import type Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

import { useNavPause } from "@/features/input/nav";

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

export function Overworld({ run, onMove, busy }: { run: RunState; onMove(nodeId: string): void; busy: boolean }) {
  // The map walks with arrows / WASD itself: menu navigation steps aside while it's up.
  useNavPause();
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
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 ff-window px-4 py-2">
        <div className="text-xl">
          {world.name} <span className="ff-title">— map {run.stage + 1}/{getJourney(run.journey).areas.length}</span>
        </div>
        <div className="ff-title">{getJourney(run.journey).name}</div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 ff-window px-4 py-1 text-base">{KIND_TEXT[hover.kind]}</div>
      )}
      <div className="pointer-events-none absolute bottom-14 right-3 text-xs text-white/60 [text-shadow:0_1px_2px_#000]">
        WASD / arrows to walk · Enter / Space to enter a stage · or click a glowing stage
      </div>
    </div>
  );
}
