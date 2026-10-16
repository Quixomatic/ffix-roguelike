import { autoCommand, BattleEngine, TICKS_PER_SECOND, type BattleCommand, type BattleEvent, type BattleState } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSettings } from "@/features/settings/use-settings";

export interface BattleLogLine {
  id: number;
  text: string;
}

/**
 * Runs a BattleEngine in real time (20 ticks/s). React re-renders on every tick that changed something;
 * events are forwarded to `onEvents` (the Phaser scene) for animation.
 */
export function useBattle(
  initial: BattleState,
  opts: {
    onEvents?: (e: BattleEvent[]) => void;
    onEnd?: (s: BattleState) => void;
    /** When (Date.now() ms) the battlefield's last effect lands — the end waits for it. */
    settleAt?: () => number;
  },
) {
  const engineRef = useRef<BattleEngine | null>(null);
  if (!engineRef.current) engineRef.current = new BattleEngine(structuredClone(initial));
  const engine = engineRef.current;
  const [, setVersion] = useState(0);
  // Battles start at the player's saved speed and Auto setting (Settings page); changing them here is per fight.
  const { settings } = useSettings();
  const [auto, setAuto] = useState(settings.autoBattle);
  const [speed, setSpeed] = useState<number>(settings.battleSpeed);
  const [banner, setBanner] = useState<string | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const autoRef = useRef(auto);
  autoRef.current = auto;
  const endedRef = useRef(false);

  useEffect(() => {
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      const all: BattleEvent[] = [];
      for (let i = 0; i < speed; i++) {
        if (autoRef.current) for (const u of engine.readyUnits()) engine.submit(autoCommand(engine, u));
        all.push(...engine.step());
      }
      if (all.length) {
        optsRef.current.onEvents?.(all);
        const start = all.findLast((e) => e.type === "actionStart");
        if (start && start.type === "actionStart" && start.kind !== "attack") {
          setBanner(start.name);
          clearTimeout(bannerTimer);
          bannerTimer = setTimeout(() => setBanner(null), 1100);
        }
        // Results ("Stole Potion!", "Couldn't steal anything", "Not enough MP"…) show once the action's effect lands.
        const msg = all.findLast((e) => e.type === "message" || (e.type === "steal" && e.itemId != null));
        const text = msg?.type === "message" ? msg.text : msg?.type === "steal" && msg.itemId != null ? `Stole ${findItem(msg.itemId)?.name ?? "an item"}!` : null;
        if (text) {
          const wait = Math.max(0, (optsRef.current.settleAt?.() ?? 0) - Date.now());
          setTimeout(() => {
            setBanner(text);
            clearTimeout(bannerTimer);
            bannerTimer = setTimeout(() => setBanner(null), 1600);
          }, wait);
        }
      }
      setVersion((v) => v + 1);
      if (engine.state.outcome && !endedRef.current) {
        endedRef.current = true;
        // Let the last effects land and the animations play before handing back.
        const wait = Math.max(0, (optsRef.current.settleAt?.() ?? 0) - Date.now());
        setTimeout(() => optsRef.current.onEnd?.(engine.state), wait + 1200);
      }
    }, 1000 / TICKS_PER_SECOND);
    return () => {
      clearInterval(interval);
      clearTimeout(bannerTimer);
    };
  }, [engine, speed]);

  const submit = useCallback(
    (cmd: BattleCommand) => {
      const res = engine.submit(cmd);
      setVersion((v) => v + 1);
      return res;
    },
    [engine],
  );

  return { engine, state: engine.state, submit, auto, setAuto, speed, setSpeed, banner };
}
