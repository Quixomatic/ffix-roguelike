import { COMPARED_STATS, gearChange, type CharacterBuild, type ComparedStat, type GearChange } from "@ffix-roguelike/game-core";
import { abilityName, getCharacter } from "@ffix-roguelike/game-data";

import { Badge } from "@/components/badge";
import { StatDelta } from "@/components/stat-delta";
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
  if (change.same) return <Badge>Equipped</Badge>;
  const stats = COMPARED_STATS.filter((k) => change.deltas[k]);
  if (!stats.length && !change.gains.length && !change.loses.length) return <Badge>No change</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {stats.map((k) => (
        <StatDelta key={k} value={change.deltas[k]!} label={STAT_LABEL[k]} />
      ))}
      {change.gains.map((r) => (
        <Badge key={r} tone="highlight" title="Ability this would let them use">
          + {abilityName(r)}
        </Badge>
      ))}
      {change.loses.map((r) => (
        <Badge key={r} tone="bad" title="Ability they'd lose">
          <span className="line-through decoration-red-300/60">{abilityName(r)}</span>
        </Badge>
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
