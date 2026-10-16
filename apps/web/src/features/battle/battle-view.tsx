import type { BattleState } from "@ffix-roguelike/game-core";
import type Phaser from "phaser";
import { useEffect, useRef, useState } from "react";

import { createBattleGame, type BattleBridge } from "./battle-scene";
import { CommandMenu } from "./command-menu";
import { EnemyList, PartyStatus } from "./party-status";
import { useBattle } from "./use-battle";

interface Props {
  initial: BattleState;
  theme: string;
  onEnd(state: BattleState): void;
}

/** A full battle: Phaser battlefield (filling its parent — give it a height) with FF9-style menu windows on top. */
export function BattleView({ initial, theme, onEnd }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<BattleBridge | null>(null);
  const pickRef = useRef<((id: string) => void) | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const battle = useBattle(initial, {
    onEvents: (events) => bridgeRef.current?.play?.(events),
    onEnd,
  });
  const { engine, state } = battle;

  if (!bridgeRef.current) {
    bridgeRef.current = {
      getState: () => engine.state,
      theme,
      speed: battle.speed,
      highlighted: new Set(),
      activeId: null,
      onUnitClick: (id) => pickRef.current?.(id),
    };
  }

  useEffect(() => {
    if (!hostRef.current) return;
    const game: Phaser.Game = createBattleGame(hostRef.current, bridgeRef.current!);
    return () => game.destroy(true);
  }, []);

  // Whose turn the menu is showing: the clicked ready member, else the first in line.
  const ready = state.ready;
  const activeId = selectedId && ready.includes(selectedId) ? selectedId : (ready[0] ?? null);
  const actor = activeId ? engine.unit(activeId) : null;
  bridgeRef.current.activeId = activeId;
  bridgeRef.current.speed = battle.speed;

  const party = state.units.filter((u) => u.side === "party");
  const enemies = state.units.filter((u) => u.side === "enemy");

  return (
    <div className="relative h-full min-h-[360px] w-full select-none overflow-hidden rounded-lg bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      {battle.banner && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <div className="ff-window px-6 py-1 text-xl">{battle.banner}</div>
        </div>
      )}

      <div className="absolute right-2 top-2 flex gap-2 text-sm">
        <button className="ff-window px-2 py-0.5" data-on={battle.auto} onClick={() => battle.setAuto(!battle.auto)}>
          Auto {battle.auto ? "ON" : "OFF"}
        </button>
        <button className="ff-window px-2 py-0.5" onClick={() => battle.setSpeed(battle.speed === 1 ? 2 : battle.speed === 2 ? 4 : 1)}>
          ×{battle.speed}
        </button>
      </div>

      <div className="absolute inset-x-2 bottom-2 flex items-end gap-2">
        <EnemyList enemies={enemies} />
        {actor && !battle.auto && !state.outcome ? (
          <CommandMenu
            engine={engine}
            actor={actor}
            onSubmit={(cmd) => {
              battle.submit(cmd);
              setSelectedId(null);
            }}
            onTargeting={(ids, pick) => {
              bridgeRef.current!.highlighted = new Set(ids);
              pickRef.current = pick;
            }}
          />
        ) : null}
        <div onClick={() => setSelectedId(ready.find((id) => id !== activeId) ?? activeId)} className="flex-1">
          <PartyStatus party={party} activeId={activeId} readyIds={ready} />
        </div>
      </div>

      {state.outcome && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="ff-window px-10 py-4 text-3xl">
            {state.outcome === "victory" ? "Victory!" : state.outcome === "fled" ? "Escaped!" : "Defeat..."}
          </div>
        </div>
      )}
    </div>
  );
}
