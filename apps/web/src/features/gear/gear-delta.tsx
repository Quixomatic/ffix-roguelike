import { COMPARED_STATS, gearChange, type CharacterBuild, type ComparedStat, type GearChange } from "@ffix-roguelike/game-core";
import { abilityName, getCharacter } from "@ffix-roguelike/game-data";

import { HeroSprite } from "@/features/sprites/hero-sprite";

const STAT_LABEL: Record<ComparedStat, string> = {
  maxHp: "HP",
  maxMp: "MP",
  strength: "Str",
  magic: "Mag",
  spirit: "Spr",
  speed: "Spd",
  attack: "Atk",
  defence: "Def",
  evade: "Eva",
  magicDefence: "MDef",
  magicEvade: "MEva",
  gemsMax: "Stones",
};

/** The stat and ability changes of one gear swap as coloured chips ("+3 Def", "−1 Eva", "+ Steal"). */
export function DeltaChips({ change }: { change: GearChange }) {
  if (change.same) return <span className="text-xs opacity-60">Equipped</span>;
  const stats = COMPARED_STATS.filter((k) => change.deltas[k]);
  if (!stats.length && !change.gains.length && !change.loses.length) return <span className="text-xs opacity-60">No change</span>;
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
      {stats.map((k) => {
        const d = change.deltas[k]!;
        return (
          <span key={k} className={`whitespace-nowrap tabular-nums ${d > 0 ? "text-green-300" : "text-red-300"}`}>
            <span aria-label={d > 0 ? "up" : "down"}>{d > 0 ? "▲" : "▼"}</span>
            {Math.abs(d)} {STAT_LABEL[k]}
          </span>
        );
      })}
      {change.gains.map((r) => (
        <span key={r} className="whitespace-nowrap text-yellow-200">
          + {abilityName(r)}
        </span>
      ))}
      {change.loses.map((r) => (
        <span key={r} className="whitespace-nowrap text-red-300 line-through decoration-red-300/60">
          {abilityName(r)}
        </span>
      ))}
    </span>
  );
}

/**
 * How an item would change each party member who can wear it, against what they wear in that slot now.
 * Members who can't use it are left out; locked slots are noted (gear can't go there yet).
 */
export function PartyGearDeltas({ party, itemId }: { party: CharacterBuild[]; itemId: number }) {
  const rows = party
    .map((b) => ({ b, change: gearChange(b, itemId) }))
    .filter((r): r is { b: CharacterBuild; change: GearChange } => !!r.change && r.change.canEquip);
  if (!party.length) return null;
  if (!rows.length) return <div className="text-xs opacity-60">No one in the party can use this.</div>;
  return (
    <div className="flex flex-col gap-1 border-t border-white/10 pt-1">
      {rows.map(({ b, change }) => (
        <div key={b.key} className="flex items-start gap-1.5">
          <HeroSprite heroKey={b.key} size={24} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs opacity-80">
              {getCharacter(b.key).name}
              {change.slotLocked && <span className="ml-1 text-orange-300">· slot locked</span>}
            </div>
            <DeltaChips change={change} />
          </div>
        </div>
      ))}
    </div>
  );
}
