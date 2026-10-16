import {
  activeSupports,
  apCost,
  availableAbilities,
  isMastered,
  TRAIN_EFFECT,
  TRAIN_MAX,
  TRAIN_STATS,
  trainCost,
  trainRank,
  type CharacterBuild,
  type DerivedStats,
  type TrainStat,
} from "@ffix-roguelike/game-core";
import { abilityName, getAction, getCharacter, getSupportAbility, parseAbilityRef, type AbilityRef } from "@ffix-roguelike/game-data";
import type { ReactNode } from "react";

import { HelpText } from "@/features/run/item-info";

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
            <HelpText text={sa.help} className="text-xs opacity-75" />
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
          <HelpText text={getAction(parseAbilityRef(a.ref).id)?.help} className="text-xs opacity-75" />
          <ApBar build={build} refId={a.ref} />
        </div>
      ))}
    </div>
  );
}

/** One labelled bar (value / max), e.g. HP. */
function StatBar({ label, value, max, color, text }: { label: string; value: number; max: number; color: string; text?: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-2">
      <span className="ff-title">{label}</span>
      <span className="ff-gauge h-2.5">
        <span className="block h-full" style={{ width: `${max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%`, background: color }} />
      </span>
      <span className="text-right tabular-nums">{text ?? `${value}/${max}`}</span>
    </div>
  );
}

const GREEN = "linear-gradient(90deg,#3ab868,#9cf0a0)";
const BLUE = "linear-gradient(90deg,#3a68c8,#9cc0ff)";
const PURPLE = "linear-gradient(90deg,#8a6ad8,#d0b8ff)";
const GOLD = "linear-gradient(90deg,#c8a030,#ffe066)";

/** Vitals as bars (HP/MP current/max and EXP, in a run) and the combat numbers (Attack, Defence, Evade…) as cells. */
export function StatBars({ stats, current, exp }: { stats: DerivedStats; current?: { hp: number; mp: number }; exp?: { into: number; span: number; total: number } }) {
  const hp = current?.hp ?? stats.maxHp;
  const mp = current?.mp ?? stats.maxMp;
  const cells: [string, ReactNode][] = [
    ["Attack", stats.attack],
    ["Defence", stats.defence],
    ["Evade", stats.evade],
    ["M.Defence", stats.magicDefence],
    ["M.Evade", stats.magicEvade],
    ["Stones", stats.gemsMax],
  ];
  return (
    <div className="flex flex-col gap-3">
      {current && (
        <div className="flex flex-col gap-1.5">
          <StatBar label="HP" value={hp} max={stats.maxHp} color={hp < stats.maxHp / 6 ? GOLD : GREEN} />
          <StatBar label="MP" value={mp} max={stats.maxMp} color={BLUE} />
          {exp && <StatBar label="EXP" value={exp.into} max={exp.span} color={PURPLE} text={`${exp.total.toLocaleString()}`} />}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {cells.map(([label, value]) => (
          <div key={label} className="flex flex-col rounded bg-black/25 px-2 py-1">
            <span className="ff-title text-[0.7rem]">{label}</span>
            <span className="text-lg leading-tight">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The stat a training row shows as its resulting value. */
const TRAIN_VALUE: Record<TrainStat, (s: DerivedStats) => number> = {
  strength: (s) => s.strength,
  magic: (s) => s.magic,
  spirit: (s) => s.spirit,
  speed: (s) => s.speed,
  hp: (s) => s.maxHp,
  mp: (s) => s.maxMp,
};

/**
 * Training: one row per stat — name, TRAIN_MAX tick boxes for the ranks bought, "5/20", the stat's resulting
 * value, and a + button (with the next rank's CP cost) when `onTrain` is given; read-only otherwise.
 */
export function TrainingRows({
  build,
  stats,
  points,
  onTrain,
  busy,
  level,
}: {
  build: CharacterBuild;
  stats: DerivedStats;
  points?: number;
  onTrain?: (stat: TrainStat) => void;
  busy?: boolean;
  /** Start level as the first row (camp): current level, the cap, the next level's cost, and how to raise it. */
  level?: { value: number; max: number; cost: number; onRaise?: () => void };
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {level && (
        <TrainRow
          label="Start level"
          hint="Every run begins at this level"
          rank={level.value - 1}
          max={level.max - 1}
          value={`Lv ${level.value}`}
          cost={level.cost}
          canBuy={!!level.onRaise && !busy && (points ?? 0) >= level.cost}
          onBuy={level.onRaise}
        />
      )}
      {TRAIN_STATS.map((stat) => {
        const rank = trainRank(build, stat);
        const fx = TRAIN_EFFECT[stat];
        const cost = trainCost(rank);
        return (
          <TrainRow
            key={stat}
            label={fx.label}
            hint={`+${fx.per}${fx.unit === "percent" ? "%" : ""} per rank`}
            rank={rank}
            max={TRAIN_MAX}
            value={TRAIN_VALUE[stat](stats)}
            cost={cost}
            canBuy={!!onTrain && !busy && (points ?? 0) >= cost}
            onBuy={onTrain ? () => onTrain(stat) : undefined}
          />
        );
      })}
    </div>
  );
}

/** One training row: name, rank boxes, "rank/max", resulting value, and a + button when buying is possible. */
function TrainRow({
  label,
  hint,
  rank,
  max,
  value,
  cost,
  canBuy,
  onBuy,
}: {
  label: string;
  hint: string;
  rank: number;
  max: number;
  value: ReactNode;
  cost: number;
  canBuy: boolean;
  onBuy?: () => void;
}) {
  const maxed = rank >= max;
  return (
    <div className="grid grid-cols-[6.5rem_1fr_3rem_3.5rem_auto] items-center gap-2">
      <span className="ff-title" title={hint}>
        {label}
      </span>
      <span className="flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`h-4 w-2 rounded-[2px] border ${i < rank ? "border-yellow-200 bg-yellow-300" : "border-white/25 bg-black/30"}`} />
        ))}
      </span>
      <span className="text-right text-sm tabular-nums opacity-80">
        {rank}/{max}
      </span>
      <span className="text-right text-lg tabular-nums">{value}</span>
      {onBuy ? (
        <button
          className="min-w-[4.5rem] rounded border border-yellow-200/50 px-2 py-0.5 text-sm text-yellow-200 enabled:hover:bg-yellow-300/10 disabled:opacity-40"
          disabled={maxed || !canBuy}
          onClick={onBuy}
          title={maxed ? "Maxed" : `Next: ${cost} CP`}
        >
          {maxed ? "Max" : `+ ${cost} CP`}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

export interface SheetTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * The character sheet window: a fixed header, then the paperdoll figure on the left and tabbed panels on the
 * right. Only the body scrolls (each side on its own), never the header.
 */
export function CharacterModal({
  title,
  headerRight,
  doll,
  tabs,
  tab,
  onTab,
  onClose,
}: {
  title: ReactNode;
  headerRight?: ReactNode;
  doll: ReactNode;
  tabs: SheetTab[];
  tab: string;
  onTab(id: string): void;
  onClose(): void;
}) {
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="ff-window flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 px-4 py-3">
          <div className="ff-display text-2xl">{title}</div>
          <div className="flex items-center gap-4">
            {headerRight}
            <button className="text-xl" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[25rem_1fr]">
          <div className="min-h-0 overflow-y-auto border-white/15 p-4 md:border-r">{doll}</div>
          <div className="flex min-h-0 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-white/15 px-3 pt-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  className={`rounded-t px-3 py-1.5 transition ${t.id === current.id ? "bg-white/15 text-yellow-200" : "opacity-75 hover:bg-white/10 hover:opacity-100"}`}
                  onClick={() => onTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{current.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
