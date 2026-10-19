import { isShownUnit, shownHp, type BattleUnit } from "@ffix-roguelike/game-core";
import { useRef } from "react";

/**
 * Boss fights (`bossFight`: our own flag — a run's boss or fortress node, Practice's boss pick): the boss's frame at
 * the top centre (level, the HP left to chew through, the items still there to steal), with the other enemies'
 * frames smaller beside it. The boss is whoever FF9 flags as one, else the enemy with the most HP. A unit an effect
 * hasn't hit yet (`incoming`) keeps showing its HP from before the hit, like the party window.
 */
export function BossFrame({ enemies, bossFight, incoming = () => false }: { enemies: BattleUnit[]; bossFight: boolean; incoming?: (id: string) => boolean }) {
  /** HP last shown per enemy (held while an effect is on its way), and how many items each could be stolen at first. */
  const lastHp = useRef(new Map<string, number>());
  const stealTotal = useRef(new Map<string, number>());
  if (!bossFight) return null;

  const shown = enemies.filter((u) => isShownUnit(u) && ((u.hp > 0 && u.statuses.death === undefined) || incoming(u.id)));
  const frame = (u: BattleUnit, big: boolean) => {
    if (!incoming(u.id)) lastHp.current.set(u.id, u.hp);
    const { hp, maxHp } = shownHp(u, lastHp.current.get(u.id) ?? u.hp);
    // A stolen slot's item becomes -1; count the slots that held one the first time the unit is seen.
    const left = (u.steal ?? []).filter((s) => s.itemId >= 0).length;
    if (!stealTotal.current.has(u.id)) stealTotal.current.set(u.id, left);
    const total = stealTotal.current.get(u.id)!;
    return <EnemyFrame key={u.id} unit={u} hp={hp} maxHp={maxHp} stealLeft={left} stealTotal={total} big={big} />;
  };
  const flagged = enemies.filter((u) => u.boss);
  const main = flagged.length ? flagged : [...enemies].sort((a, b) => shownHp(b).maxHp - shownHp(a).maxHp).slice(0, 1);
  const bosses = shown.filter((u) => main.includes(u));
  const others = shown.filter((u) => !main.includes(u));
  if (!shown.length) return null;

  return (
    <div className="pointer-events-none flex max-w-full flex-wrap items-start justify-center gap-2">
      {others.slice(0, Math.ceil(others.length / 2)).map((u) => frame(u, false))}
      {bosses.map((u) => frame(u, true))}
      {others.slice(Math.ceil(others.length / 2)).map((u) => frame(u, false))}
    </div>
  );
}

function EnemyFrame({ unit, hp, maxHp, stealLeft, stealTotal, big }: { unit: BattleUnit; hp: number; maxHp: number; stealLeft: number; stealTotal: number; big: boolean }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  return (
    <div className={`ff-window flex flex-col ${big ? "w-[26rem] max-w-full gap-1 px-3 py-2" : "w-44 gap-0.5 px-2 py-1 text-sm"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={`truncate ${big ? "ff-display text-lg" : ""}`}>{unit.name}</span>
          <span className={`shrink-0 tabular-nums text-yellow-200 ${big ? "text-sm" : "text-xs"}`}>Lv {unit.level}</span>
        </span>
        {stealTotal > 0 && <StealDots left={stealLeft} total={stealTotal} big={big} />}
      </div>
      <div className={`ff-gauge ${big ? "h-3" : "h-1.5"}`}>
        <div className="ff-gauge-fill transition-[width] duration-300" style={{ width: `${pct * 100}%`, background: "linear-gradient(90deg,#a01830,#ff5050)" }} />
      </div>
      <div className={`text-right tabular-nums ${big ? "text-sm" : "text-xs"} opacity-80`}>
        {hp.toLocaleString()}
        <span className="opacity-60"> / {maxHp.toLocaleString()}</span>
      </div>
    </div>
  );
}

/** One dot per item the enemy carried: lit while it's still there to steal, an empty ring once it's taken. */
function StealDots({ left, total, big }: { left: number; total: number; big: boolean }) {
  const size = big ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <span className="flex shrink-0 items-center gap-1" title={`${left} of ${total} item${total === 1 ? "" : "s"} left to steal`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`${size} rounded-full border ${i < left ? "border-yellow-100 bg-yellow-300 shadow-[0_0_4px_#ffe066]" : "border-white/40 bg-transparent"}`}
        />
      ))}
    </span>
  );
}
