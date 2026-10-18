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
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { HelpText } from "@/features/run/item-info";
import { FocusItem, FocusSection } from "@/features/input/focus";
import { useInputOwner } from "@/features/input/owner";

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
          <FocusItem key={a.ref}>
            <button
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
          </FocusItem>
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

/**
 * One rank row (training, camp supplies): label, rank boxes, "rank/max", resulting value, and a "+ cost" button when
 * buying is possible. `unit` names the currency ("CP", "gil"); `labelWidth` sizes the label column.
 */
export function TrainRow({
  label,
  hint,
  rank,
  max,
  value,
  cost,
  canBuy,
  onBuy,
  unit = "CP",
  labelWidth = "6.5rem",
}: {
  label: ReactNode;
  hint: string;
  rank: number;
  max: number;
  value: ReactNode;
  cost: number;
  canBuy: boolean;
  onBuy?: () => void;
  unit?: string;
  labelWidth?: string;
}) {
  const maxed = rank >= max;
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: `${labelWidth} 1fr 3rem 3.5rem auto` }}>
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
        <FocusItem>
          <button
            className="min-w-[4.5rem] rounded border border-yellow-200/50 px-2 py-0.5 text-sm text-yellow-200 enabled:hover:bg-yellow-300/10 disabled:opacity-40"
            disabled={maxed || !canBuy}
            onClick={onBuy}
            title={maxed ? "Maxed" : `Next: ${cost} ${unit}`}
          >
            {maxed ? "Max" : `+ ${cost.toLocaleString()} ${unit}`}
          </button>
        </FocusItem>
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

/** The sheet's header height. The right-hand window is inset half that, top and bottom: vertically centred against the left one. */
const SHEET_HEADER = "h-16";
const SHEET_OFFSET = "md:my-8";

/**
 * The character sheet as two framed windows side by side: on the left the header (name — with ◂ ▸ to the previous /
 * next character when `cycle` is given — CP, close) over the paperdoll; on the right, starting level with the bottom
 * of that header and joined to the left window (no rounding on its left), the tabs and their panels. Only the bodies
 * scroll (each on its own), never the header. `inline` renders it as a page (filling its container, no overlay;
 * close = back) instead of a dialog.
 */
export function CharacterModal({
  title,
  headerRight,
  cycle,
  doll,
  tabs,
  tab,
  onTab,
  onClose,
  inline,
}: {
  inline?: boolean;
  title: ReactNode;
  headerRight?: ReactNode;
  /** Step to the previous / next character (shown as arrows either side of the name). */
  cycle?: { prev(): void; next(): void; prevName: string; nextName: string };
  doll: ReactNode;
  tabs: SheetTab[];
  tab: string;
  onTab(id: string): void;
  onClose(): void;
}) {
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  // As a dialog it has the controls (over the map too); Escape / Backspace / B close it.
  useInputOwner("menu", { active: !inline, onCancel: onClose });
  // Stable focus keys, so stepping to the next character keeps the cursor on the same chevron (`?focus=`).
  const arrow = (dir: "left" | "right", go: () => void, name: string) => (
    <FocusItem focusKey={dir === "left" ? "sheet-prev" : "sheet-next"}>
      <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded opacity-80 hover:bg-white/10 hover:opacity-100" onClick={go} aria-label={name} title={name}>
        {dir === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
      </button>
    </FocusItem>
  );
  const window = (
    <div className={`flex flex-col md:flex-row ${inline ? "h-full w-full" : "h-[90vh] w-[95vw] max-w-[1400px]"}`} onClick={(e) => e.stopPropagation()}>
      {/* Left: header + paperdoll. */}
      <div className="ff-window relative z-10 flex min-h-0 shrink-0 flex-col overflow-hidden md:w-[25rem]">
        <div className={`flex shrink-0 items-center justify-between gap-2 border-b border-white/15 px-3 ${SHEET_HEADER}`}>
          <div className="flex min-w-0 items-center gap-1">
            {cycle && arrow("left", cycle.prev, cycle.prevName)}
            <div className="ff-display truncate text-2xl">{title}</div>
            {cycle && arrow("right", cycle.next, cycle.nextName)}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {headerRight}
            {/* As a page, the breadcrumbs above go back; a dialog has its ✕. */}
            {!inline && (
              <FocusItem>
                <button className="text-xl" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </FocusItem>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{doll}</div>
      </div>
      {/* Right: its own window, centred against the left one and joined to it (square on that side — `!`, since
          .ff-window's own rounding would otherwise win). */}
      <div className={`ff-window flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-md:mt-2 md:-ml-[2px] md:!rounded-l-none ${SHEET_OFFSET}`}>
        <div className="flex shrink-0 gap-1 border-b border-white/15 px-3 pt-2">
          {tabs.map((t) => (
            <FocusItem key={t.id}>
              <button
                className={`rounded-t px-3 py-1.5 transition ${t.id === current.id ? "bg-white/15 text-yellow-200" : "opacity-75 hover:bg-white/10 hover:opacity-100"}`}
                onClick={() => onTab(t.id)}
              >
                {t.label}
              </button>
            </FocusItem>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{current.content}</div>
      </div>
    </div>
  );
  if (inline) return window;
  // A dialog: the cursor starts inside and stays there until it closes.
  return (
    <FocusSection boundary autoFocus>
      <div data-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
        {window}
      </div>
    </FocusSection>
  );
}
