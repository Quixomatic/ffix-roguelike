import { deriveStats, EQUIP_SLOTS, expForLevel, getJourney, WORLDS, type RunMember, type RunState } from "@ffix-roguelike/game-core";
import { findItem, getCharacter, MAX_LEVEL } from "@ffix-roguelike/game-data";

import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";

import { itemName } from "./item-info";
import type { RunActions } from "./use-run";

/** Consumables that work outside battle (Potion, Hi-Potion, Ether, Elixir, Phoenix Down — FF9 script ids). */
const FIELD_ITEM_SCRIPTS = [69, 70, 71, 72, 76];
export const fieldItems = (run: RunState) => run.consumables.filter((c) => c.count > 0 && FIELD_ITEM_SCRIPTS.includes(findItem(c.itemId)?.effect?.scriptId ?? -1));

/**
 * Left sidebar of a run: gil and where you are, then the party filling the height — portrait, vitals, key stats,
 * lasting statuses, equipped gear and quick actions (manage, use a field item on that member).
 */
export function PartySidebar({ run, actions, canManage, onManage }: { run: RunState; actions: RunActions; canManage: boolean; onManage(key: string): void }) {
  const journey = getJourney(run.journey);
  return (
    <aside className="flex min-h-0 flex-col gap-2">
      <div className="ff-window flex items-center justify-between px-3 py-2">
        <div className="min-w-0">
          <div className="ff-display truncate text-base">{WORLDS[run.world]!.name}</div>
          <div className="ff-title truncate text-xs">
            {journey.name} · map {run.stage + 1}/{journey.areas.length}
          </div>
        </div>
        <div className="text-right">
          <div className="ff-title text-xs">Gil</div>
          <div className="tabular-nums text-yellow-200">{run.gil}</div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {run.party.map((m) => (
          <MemberCard key={m.build.key} run={run} member={m} actions={actions} canManage={canManage} onManage={() => onManage(m.build.key)} />
        ))}
      </div>
      {canManage && (
        <button className="ff-window px-3 py-1 text-sm" disabled={actions.optimize.isPending} onClick={() => actions.optimize.mutate()}>
          Optimize gear
        </button>
      )}
    </aside>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-1.5 text-xs tabular-nums">
      <span className="ff-title">{label}</span>
      <span className="ff-gauge h-1.5">
        <span className="block h-full" style={{ width: `${max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%`, background: color }} />
      </span>
      <span>
        {value}/{max}
      </span>
    </div>
  );
}

function MemberCard({ run, member: m, actions, canManage, onManage }: { run: RunState; member: RunMember; actions: RunActions; canManage: boolean; onManage(): void }) {
  const st = deriveStats(m.build);
  const down = m.hp <= 0;
  const lowHp = !down && m.hp < st.maxHp / 6;
  const lv = m.build.level;
  const expFrom = expForLevel(lv);
  const expTo = lv >= MAX_LEVEL ? expFrom : expForLevel(lv + 1);
  const items = fieldItems(run);
  return (
    <div className="ff-window flex min-h-0 flex-1 flex-col gap-1 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <button
          className="flex h-14 w-12 shrink-0 items-end justify-center rounded bg-black/30 enabled:hover:brightness-125"
          onClick={onManage}
          disabled={!canManage}
          title={canManage ? "Equipment & abilities" : undefined}
        >
          <HeroSprite heroKey={m.build.key} size={48} ko={down} anim={lowHp ? "dying" : undefined} variant={m.statuses?.includes("blind") ? "blind" : null} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="ff-display truncate">{getCharacter(m.build.key).name}</span>
            <span className="ff-title text-xs">Lv {lv}</span>
          </div>
          <Bar label="HP" value={m.hp} max={st.maxHp} color={down ? "#7a2020" : lowHp ? "linear-gradient(90deg,#c8a030,#ffe066)" : "linear-gradient(90deg,#3ab868,#9cf0a0)"} />
          <Bar label="MP" value={m.mp} max={st.maxMp} color="linear-gradient(90deg,#3a68c8,#9cc0ff)" />
          <Bar label="EXP" value={m.build.exp - expFrom} max={Math.max(1, expTo - expFrom)} color="linear-gradient(90deg,#8a6ad8,#d0b8ff)" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-center text-[0.7rem] tabular-nums">
        {(
          [
            ["Atk", st.attack],
            ["Def", st.defence],
            ["Mag", st.magic],
            ["Spd", st.speed],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded bg-black/25 py-0.5">
            <span className="ff-title">{k}</span> {v}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex gap-0.5">
          {EQUIP_SLOTS.map((s) => {
            const id = m.build.equipment[s];
            return (
              <span key={s} className="flex h-5 w-5 items-center justify-center rounded bg-black/30" title={id != null ? itemName(id) : `${s} — empty`}>
                {id != null && <ItemIcon itemId={id} size={16} />}
              </span>
            );
          })}
        </div>
        {(m.statuses?.length ?? 0) > 0 && <span className="truncate text-[0.7rem] text-purple-300">{m.statuses!.join(", ")}</span>}
      </div>

      {canManage && (
        <div className="mt-auto flex flex-wrap items-center gap-1">
          <button className="rounded border border-white/20 bg-black/25 px-1.5 text-xs hover:brightness-125" onClick={onManage}>
            Manage
          </button>
          {items.map((c) => (
            <button
              key={c.itemId}
              className="flex items-center gap-0.5 rounded border border-white/20 bg-black/25 px-1 text-xs hover:brightness-125 disabled:opacity-50"
              title={`Use ${itemName(c.itemId)} on ${getCharacter(m.build.key).name}`}
              disabled={actions.useItem.isPending}
              onClick={() => actions.useItem.mutate({ itemId: c.itemId, key: m.build.key })}
            >
              <ItemIcon itemId={c.itemId} size={16} />×{c.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
