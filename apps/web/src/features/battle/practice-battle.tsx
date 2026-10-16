import { createBattle, encounterNames, encounterUnits, newBuild, partyUnit, WORLDS, type BattleState } from "@ffix-roguelike/game-core";
import { itemByName } from "@ffix-roguelike/game-data";
import { useMemo, useState } from "react";

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
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="ff-window flex flex-wrap items-center gap-4 px-3 py-2 text-base">
        <label className="flex items-center gap-2">
          World
          <select className="rounded bg-[#0c1238] px-2" value={world} onChange={(e) => onChange({ world: Number(e.target.value), encounter: 0 })}>
            {WORLDS.map((x) => (
              <option key={x.index} value={x.index}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Encounter
          <select className="rounded bg-[#0c1238] px-2" value={encounter % groups.length} onChange={(e) => onChange({ encounter: Number(e.target.value) })}>
            {groups.map((g, i) => (
              <option key={i} value={i}>
                {i >= w.encounters.length + w.elites.length ? "BOSS: " : i >= w.encounters.length ? "Elite: " : ""}
                {encounterNames(g).join(", ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Party Lv
          <input
            type="number"
            min={1}
            max={99}
            className="w-16 rounded bg-[#0c1238] px-2"
            value={level}
            onChange={(e) => onChange({ level: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
          />
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
        {result && (
          <span className="text-yellow-200">
            {result.outcome} in {Math.round(result.tick / 20)}s
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
      <p className="text-center text-sm text-muted-foreground">
        Arrows + Enter to choose, Esc to go back, Tab to swap target side · click a ready party member to switch who acts
      </p>
    </div>
  );
}
