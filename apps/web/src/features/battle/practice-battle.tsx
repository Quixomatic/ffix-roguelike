import {
  createBattle,
  encounterNames,
  encounterUnits,
  newBuild,
  partyUnit,
  relicModifiers,
  synergyModifiers,
  TICKS_PER_SECOND,
  WORLDS,
  type BattleState,
} from "@ffix-roguelike/game-core";
import { itemByName, relicTable } from "@ffix-roguelike/game-data";
import { useMemo, useState } from "react";

import { LIVE_BOSSES_KEY, liveBossesOn } from "./battle-scene";
import { BattleView } from "./battle-view";
import { useBattleScript } from "./use-battle-script";
import { Badge } from "@/features/hub/badge";
import { RelicPopover } from "@/features/hub/relic-popover";
import { FocusItem } from "@/features/input/focus";

/** Practice's party. */
const PARTY = ["zidane", "vivi", "steiner", "garnet"] as const;

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
  const [live, setLive] = useState(liveBossesOn);
  /** Relics to try in the fight (any relic, unlocked or not): they apply like a run's, with the party's synergies. */
  const [relics, setRelics] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const w = WORLDS[world] ?? WORLDS[0]!;
  const groups = [...w.encounters, ...w.elites, w.boss];
  const group = groups[encounter % groups.length]!;

  const foes = useMemo(() => encounterUnits(group, 0), [group]);
  const scriptReady = useBattleScript(foes.scene);

  const initial = useMemo(() => {
    if (!scriptReady) return null;
    return createBattle({
        seed: Date.now() >>> 0,
        party: PARTY.map((k, i) => partyUnit(newBuild(k, level), i)),
        // The picked relics and the party's synergies, as in a run.
        modifiers: [...relicModifiers(relics), ...synergyModifiers([...PARTY])],
        enemies: structuredClone(foes.units),
        ...(foes.scene ? { scene: foes.scene } : {}),
        // The world's boss pick is a boss fight (the boss frame shows).
        bossFight: encounter % groups.length >= w.encounters.length + w.elites.length,
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
    [world, level, encounter, round, scriptReady, relics],
  );
  const toggleRelic = (id: string) => {
    setResult(null);
    setRelics((rs) => (rs.includes(id) ? rs.filter((x) => x !== id) : [...rs, id]));
  };

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
        {/* The same switch as Settings → Live boss animation (this device); restarts the fight to compare. */}
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
        <FocusItem>
          <button className="ff-option" onClick={() => setPicking(!picking)}>
            Relics{relics.length ? ` (${relics.length})` : ""}
          </button>
        </FocusItem>
        {result && (
          <span className="text-yellow-200">
            {result.outcome} in {Math.round(result.tick / TICKS_PER_SECOND)}s
            {result.stolen.length ? ` · stole ${result.stolen.length}` : ""}
          </span>
        )}
      </div>
      {/* Try any relic: toggling one restarts the fight with it. Hover a badge for its card. */}
      {picking && (
        <div className="ff-window ml-12 flex flex-wrap items-center gap-1 px-3 py-2">
          {relicTable().map((r) => (
            <RelicPopover key={r.id} relicId={r.id} side="bottom">
              <button
                className={`rounded p-0.5 ${relics.includes(r.id) ? "bg-yellow-300/25 ring-1 ring-yellow-300" : "opacity-60 hover:opacity-100"}`}
                aria-label={r.name}
                onClick={() => toggleRelic(r.id)}
              >
                <Badge id={r.badge ?? 1} scale={1} />
              </button>
            </RelicPopover>
          ))}
          {relics.length > 0 && (
            <FocusItem>
              <button className="ff-option ml-2 text-sm" onClick={() => (setResult(null), setRelics([]))}>
                Clear
              </button>
            </FocusItem>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {initial ? (
          <BattleView key={`${world}-${level}-${encounter}-${round}-${relics.join(",")}`} initial={initial} theme={w.theme} onEnd={setResult} />
        ) : (
          <div className="ff-window mx-auto px-4 py-1">Loading battle…</div>
        )}
      </div>
    </div>
  );
}
