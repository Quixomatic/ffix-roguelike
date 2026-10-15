import { activeSupports, apCost, availableAbilities, isMastered, type CharacterBuild, type DerivedStats } from "@ffix-roguelike/game-core";
import { abilityName, getCharacter, getSupportAbility, parseAbilityRef, type AbilityRef } from "@ffix-roguelike/game-data";
import type { ReactNode } from "react";

/** A titled section of the character sheet. */
export function Panel({ title, right, className = "", children }: { title: ReactNode; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`flex flex-col gap-2 rounded-md border border-white/15 bg-black/20 p-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="ff-display text-lg">{title}</h3>
        {right && <div className="text-sm">{right}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * The character's numbers as a grid of labelled cells. `current` shows HP/MP as current/max (in a run); `extra`
 * adds cells (e.g. EXP).
 */
export function StatGrid({ stats, current, extra = [] }: { stats: DerivedStats; current?: { hp: number; mp: number }; extra?: [string, ReactNode][] }) {
  const cells: [string, ReactNode][] = [
    ["HP", current ? `${current.hp}/${stats.maxHp}` : stats.maxHp],
    ["MP", current ? `${current.mp}/${stats.maxMp}` : stats.maxMp],
    ["Strength", stats.strength],
    ["Magic", stats.magic],
    ["Spirit", stats.spirit],
    ["Speed", stats.speed],
    ["Attack", stats.attack],
    ["Defence", stats.defence],
    ["Evade", stats.evade],
    ["M.Defence", stats.magicDefence],
    ["M.Evade", stats.magicEvade],
    ["Stones", stats.gemsMax],
    ...extra,
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
      {cells.map(([label, value]) => (
        <div key={label} className="flex flex-col rounded bg-black/25 px-2 py-1">
          <span className="ff-title text-[0.7rem]">{label}</span>
          <span className="text-lg leading-tight">{value}</span>
        </div>
      ))}
    </div>
  );
}

/** AP progress toward an ability: a bar, or "Learned". */
function ApBar({ build, refId }: { build: CharacterBuild; refId: AbilityRef }) {
  const cost = apCost(getCharacter(build.key), refId);
  const have = Math.min(cost, build.ap[refId] ?? 0);
  if (isMastered(build, refId)) return <span className="text-xs text-yellow-200">★ Learned</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="ff-gauge h-1.5 w-16">
        <span className="ff-gauge-fill block" style={{ width: `${cost ? (have / cost) * 100 : 0}%` }} />
      </span>
      <span className="text-xs opacity-70">
        {have}/{cost}
      </span>
    </span>
  );
}

/** Magic stones used / available as a meter. */
export function StoneMeter({ used, max }: { used: number; max: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="ff-gauge h-2 w-28">
        <span className="ff-gauge-fill block" style={{ width: `${max ? Math.min(100, (used / max) * 100) : 0}%` }} />
      </span>
      <span>
        ◆ {used}/{max}
      </span>
    </span>
  );
}

/**
 * Support abilities as toggle cards: equip with magic stones once learned (or while gear teaching them is worn).
 * `onToggle` receives the new list of active support ids; omit it for a read-only view.
 */
export function SupportGrid({ build, onToggle }: { build: CharacterBuild; onToggle?: (supports: number[]) => void }) {
  const char = getCharacter(build.key);
  const available = availableAbilities(build);
  const active = activeSupports(build);
  const supports = char.abilities.filter((a) => parseAbilityRef(a.ref).kind === "support");
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {supports.map((a) => {
        const id = parseAbilityRef(a.ref).id;
        const has = available.includes(a.ref);
        const on = active.has(id);
        const sa = getSupportAbility(id);
        return (
          <button
            key={a.ref}
            disabled={!has || !onToggle}
            onClick={() => onToggle?.(on ? build.supports.filter((x) => x !== id) : [...build.supports, id])}
            className={`flex flex-col gap-0.5 rounded border px-2 py-1 text-left text-sm transition ${
              on ? "border-yellow-300/80 bg-yellow-300/10" : "border-white/15 bg-black/25"
            } ${has ? "enabled:hover:brightness-125" : "opacity-40"}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">
                <span className={on ? "text-yellow-200" : "opacity-50"}>{on ? "◉" : "○"}</span> {sa.name}
              </span>
              <span className="shrink-0 text-xs opacity-80">◆{sa.gems}</span>
            </span>
            <ApBar build={build} refId={a.ref} />
          </button>
        );
      })}
    </div>
  );
}

/** Active abilities (commands' skills/spells) with AP progress. */
export function AbilityGrid({ build }: { build: CharacterBuild }) {
  const char = getCharacter(build.key);
  const available = availableAbilities(build);
  const actives = char.abilities.filter((a) => parseAbilityRef(a.ref).kind === "active");
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
      {actives.map((a) => (
        <div key={a.ref} className={`flex flex-col gap-0.5 rounded border border-white/15 bg-black/25 px-2 py-1 text-sm ${available.includes(a.ref) ? "" : "opacity-40"}`}>
          <span className="truncate">{abilityName(a.ref)}</span>
          <ApBar build={build} refId={a.ref} />
        </div>
      ))}
    </div>
  );
}
