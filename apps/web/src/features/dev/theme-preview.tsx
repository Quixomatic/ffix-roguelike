import { generateWorldMap, MAP_THEMES, Rng, type MapTheme } from "@ffix-roguelike/game-core";
import { useEffect, useRef, useState } from "react";

import { Panel } from "@/features/gear/character-panels";
import { createMapGame, type MapBridge } from "@/features/run/map-scene";
import { THEMES } from "@/features/sprites/sprites";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * Dev: any area theme on a generated map (the first area's shape, a new seed per "Another map") and its battle
 * background, to look at themes before an area uses them.
 */
export function ThemePreview() {
  const [theme, setTheme] = useState<MapTheme>("grassland");
  const [seed, setSeed] = useState(1);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const map = generateWorldMap(new Rng(seed), 0);
    const bridge: MapBridge = {
      map,
      position: map.startId,
      visited: [map.startId],
      leader: "zidane",
      theme,
      onSelect: () => {},
      onHover: () => {},
      isBusy: () => false,
    };
    const game = createMapGame(hostRef.current, bridge);
    return () => game.destroy(true);
  }, [theme, seed]);

  const [sky, ground, deep] = THEMES[theme] ?? THEMES.grassland!;
  return (
    <Panel title="Map themes" right={<span className="opacity-70">overworld and battle background per area theme</span>}>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {MAP_THEMES.map((t) => (
          <button key={t} className={`ff-window px-2 py-0.5 text-sm ${t === theme ? "text-yellow-200" : ""}`} onClick={() => setTheme(t)}>
            {t}
          </button>
        ))}
        <button className="ff-window ml-auto px-2 py-0.5 text-sm" onClick={() => setSeed((s) => s + 1)}>
          Another map
        </button>
      </div>
      <div ref={hostRef} className="relative h-[28rem] w-full overflow-hidden rounded" />
      <div
        className="mt-2 h-24 w-full rounded"
        style={{ background: `linear-gradient(${hex(sky)}, ${hex(ground)} 55%, ${hex(deep)})` }}
        title="Battle background (drawBattleBackground's gradient)"
      />
    </Panel>
  );
}
