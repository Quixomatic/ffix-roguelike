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
    <span className="flex flex-wrap gap-1">
      {stats.map((k) => {
        const d = change.deltas[k]!;
        return (
          <span key={k} className={`rounded px-1 text-xs ${d > 0 ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"}`}>
            {d > 0 ? "+" : "−"}
            {Math.abs(d)} {STAT_LABEL[k]}
          </span>
        );
      })}
      {change.gains.map((r) => (
        <span key={r} className="rounded bg-yellow-900/40 px-1 text-xs text-yellow-200">
          + {abilityName(r)}
        </span>
      ))}
      {change.loses.map((r) => (
        <span key={r} className="rounded bg-red-900/40 px-1 text-xs text-red-300 line-through decoration-red-300/60">
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
