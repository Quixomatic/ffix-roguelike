import { WORLDS, type MapNode, type RunState } from "@ffix-roguelike/game-core";
import type Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

import { createMapGame, type MapBridge } from "./map-scene";

const KIND_TEXT: Record<MapNode["kind"], string> = {
  start: "Start",
  battle: "Battle",
  elite: "Elite battle — tougher foes, better loot",
  treasure: "Treasure",
  shop: "Item shop — buy gear and supplies, sell what you don't need",
  synth: "Synthesis shop — combine gear into something better",
  moogle: "Moogle — full rest for the party, and a place to sell gear",
  event: "Something's going on here…",
  boss: "Boss castle",
};

export function Overworld({ run, onMove, busy }: { run: RunState; onMove(nodeId: string): void; busy: boolean }) {
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
      onSelect: (id) => {
        if (busyRef.current) return;
        bridge.walkTo?.(id);
        // Let the walk play before the stage opens.
        setTimeout(() => onMoveRef.current(id), 420);
      },
    };
    const game: Phaser.Game = createMapGame(hostRef.current, bridge);
    return () => game.destroy(true);
    // Rebuild the scene whenever the position or map changes.
  }, [run.map, run.position, run.visited, run.party, world.theme]);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-[1200px] overflow-hidden rounded-lg bg-black">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 ff-window px-4 py-2">
        <div className="text-xl">
          World {run.world + 1}: {world.name}
        </div>
        <div className="ff-title">{world.subtitle}</div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 ff-window px-4 py-1 text-base">{KIND_TEXT[hover.kind]}</div>
      )}
    </div>
  );
}
