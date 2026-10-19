import { createBattle, encounterNames, encounterUnits, newBuild, partyUnit, TICKS_PER_SECOND, WORLDS, type BattleState } from "@ffix-roguelike/game-core";
import { itemByName } from "@ffix-roguelike/game-data";
import { useMemo, useState } from "react";

import { LIVE_BOSSES_KEY } from "./battle-scene";
import { BattleView } from "./battle-view";
import { useBattleScript } from "./use-battle-script";
import { FocusItem } from "@/features/input/focus";

interface Props {
  world: number;
  level: number;
  encounter: number;
  onChange(next: { world?: number; level?: number; encounter?: number }): void;
}

/** Practice arena: pick a world, an encounter and a party level, then fight it with the real engine. */
export function PracticeBattle({ world, level, encounter, onChange }: Props) {
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<BattleState | null>(null);
  const [live, setLive] = useState(() => {
    try {
      return localStorage.getItem(LIVE_BOSSES_KEY) === "1";
    } catch {
      return false;
    }
  });
  const w = WORLDS[world] ?? WORLDS[0]!;
  const groups = [...w.encounters, ...w.elites, w.boss];
  const group = groups[encounter % groups.length]!;

  const foes = useMemo(() => encounterUnits(group, 0), [group]);
  const scriptReady = useBattleScript(foes.scene);

  const initial = useMemo(() => {
    if (!scriptReady) return null;
    return createBattle({
        seed: Date.now() >>> 0,
        party: ["zidane", "vivi", "steiner", "garnet"].map((k, i) => partyUnit(newBuild(k, level), i)),
        enemies: structuredClone(foes.units),
        ...(foes.scene ? { scene: foes.scene } : {}),
        inventory: [
          { itemId: itemByName("Potion").id, count: 6 },
          { itemId: itemByName("Hi-Potion").id, count: 2 },
          { itemId: itemByName("Phoenix Down").id, count: 3 },
          { itemId: itemByName("Ether").id, count: 2 },
          { itemId: itemByName("Antidote").id, count: 2 },
        ],
      });
  },
    // A new round re-rolls the seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, level, encounter, round, scriptReady],
  );

  return (
    // In the hub layout like the run: the window's full height with an even margin; the controls leave room for the
    // menu button floating in the top-left corner.
    <div className="flex h-svh min-h-0 flex-col gap-3 p-4">
      <div className="ff-window ml-12 flex flex-wrap items-center gap-4 px-3 py-2 text-base">
        <span className="ff-display text-lg">Practice</span>
        <label className="flex items-center gap-2">
          World
          <FocusItem>
          <select className="rounded bg-[#0c1238] px-2" value={world} onChange={(e) => onChange({ world: Number(e.target.value), encounter: 0 })}>
            {WORLDS.map((x) => (
              <option key={x.index} value={x.index}>
                {x.name}
              </option>
            ))}
          </select>
          </FocusItem>
        </label>
        <label className="flex items-center gap-2">
          Encounter
          <FocusItem>
          <select className="rounded bg-[#0c1238] px-2" value={encounter % groups.length} onChange={(e) => onChange({ encounter: Number(e.target.value) })}>
            {groups.map((g, i) => (
              <option key={i} value={i}>
                {i >= w.encounters.length + w.elites.length ? "BOSS: " : i >= w.encounters.length ? "Elite: " : ""}
                {encounterNames(g).join(", ")}
              </option>
            ))}
          </select>
          </FocusItem>
        </label>
        <label className="flex items-center gap-2">
          Party Lv
          <FocusItem>
          <input
            type="number"
            min={1}
            max={99}
            className="w-16 rounded bg-[#0c1238] px-2"
            value={level}
            onChange={(e) => onChange({ level: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
          />
          </FocusItem>
        </label>
        <FocusItem>
          <button
            className="ff-option"
            onClick={() => {
              setResult(null);
              setRound((r) => r + 1);
            }}
          >
            New fight
          </button>
        </FocusItem>
        {import.meta.env.DEV && (
          // Bosses drawn live from their FFRK rig (dev server: the raw rigs) instead of the baked sprite; restarts the fight.
          <FocusItem>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm" title="Bosses drawn live from their FFRK rig: pieces rotate at screen resolution, at 60 fps">
              <input
                type="checkbox"
                checked={live}
                onChange={(e) => {
                  setLive(e.target.checked);
                  try {
                    localStorage.setItem(LIVE_BOSSES_KEY, e.target.checked ? "1" : "0");
                  } catch {
                    /* not remembered */
                  }
                  setResult(null);
                  setRound((r) => r + 1);
                }}
              />
              Live boss animation
            </label>
          </FocusItem>
        )}
        {result && (
          <span className="text-yellow-200">
            {result.outcome} in {Math.round(result.tick / TICKS_PER_SECOND)}s
            {result.stolen.length ? ` · stole ${result.stolen.length}` : ""}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {initial ? (
          <BattleView key={`${world}-${level}-${encounter}-${round}`} initial={initial} theme={w.theme} onEnd={setResult} />
        ) : (
          <div className="ff-window mx-auto px-4 py-1">Loading battle…</div>
        )}
      </div>
    </div>
  );
}
