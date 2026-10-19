import { deriveStats, EQUIP_SLOTS, expForLevel, getJourney, WORLDS, type RunMember, type RunState } from "@ffix-roguelike/game-core";
import { findItem, getCharacter, MAX_LEVEL } from "@ffix-roguelike/game-data";
import { PanelRight, PanelRightDashed } from "lucide-react";

import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { ButtonHint } from "@/features/input/button-hint";
import { FocusItem } from "@/features/input/focus";
import { MENU_EVENT } from "@/features/input/nav";

import { itemEffectText, itemName } from "./item-info";
import { RelicRack } from "./relic-rack";
import { boonText } from "./reward-cards";
import type { RunActions } from "./use-run";

/** Consumables that work outside battle (Potion, Hi-Potion, Ether, Elixir, Phoenix Down — FF9 script ids). */
const FIELD_ITEM_SCRIPTS = [69, 70, 71, 72, 76];
export const fieldItems = (run: RunState) => run.consumables.filter((c) => c.count > 0 && FIELD_ITEM_SCRIPTS.includes(findItem(c.itemId)?.effect?.scriptId ?? -1));

/** Where the run's party sits: floating over the game (the default), or docked in its own column beside it. */
export type PartyLayout = "overlay" | "docked";

/**
 * The run's party, on the right: gil and where you are, then the party filling the height — portrait, vitals, key
 * stats, lasting statuses, equipped gear and quick actions (manage, use a field item on that member) — and the Party,
 * Bag and Menu buttons. The header's toggle floats it over the game or docks it beside it (`layout`).
 */
export function PartySidebar({
  run,
  actions,
  canManage,
  onManage,
  onBag,
  layout,
  onLayout,
  className = "",
}: {
  run: RunState;
  actions: RunActions;
  canManage: boolean;
  onManage(key: string): void;
  onBag(): void;
  layout: PartyLayout;
  onLayout(layout: PartyLayout): void;
  className?: string;
}) {
  const journey = getJourney(run.journey);
  const floating = layout === "overlay";
  return (
    <aside className={`flex min-h-0 flex-col gap-2 ${className}`}>
      <div className="ff-window flex items-center justify-between gap-2 px-3 py-2">
        <FocusItem>
          <button
            className="shrink-0 rounded p-0.5 opacity-70 hover:bg-white/10 hover:opacity-100"
            title={floating ? "Dock the party beside the game" : "Float the party over the game"}
            aria-label={floating ? "Dock the party beside the game" : "Float the party over the game"}
            onClick={() => onLayout(floating ? "docked" : "overlay")}
          >
            {floating ? <PanelRightDashed size={18} /> : <PanelRight size={18} />}
          </button>
        </FocusItem>
        <div className="min-w-0 flex-1">
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
      {/* Relics held (and empty slots), and the party's active synergies. */}
      <div className="ff-window px-3 py-2">
        <RelicRack run={run} compact />
      </div>
      {canManage && (
        <div className="grid grid-cols-3 gap-1 text-sm">
          <FocusItem>
            <button className="ff-window flex items-center justify-center gap-1.5 py-1" onClick={() => onManage(run.party[0]!.build.key)}>
              <ButtonHint action="triangle" /> Party
            </button>
          </FocusItem>
          <FocusItem>
            <button className="ff-window flex items-center justify-center gap-1.5 py-1" onClick={onBag}>
              <ButtonHint action="x" /> Bag
            </button>
          </FocusItem>
          <FocusItem>
            <button className="ff-window flex items-center justify-center gap-1.5 py-1" onClick={() => window.dispatchEvent(new Event(MENU_EVENT))}>
              <ButtonHint action="menu" /> Menu
            </button>
          </FocusItem>
        </div>
      )}
      <div className="flex min-h-0 flex-col gap-2">
        {run.party.map((m) => (
          <MemberCard key={m.build.key} run={run} member={m} actions={actions} canManage={canManage} onManage={() => onManage(m.build.key)} />
        ))}
      </div>
      {canManage && (
        <FocusItem>
          <button className="ff-window px-3 py-1 text-sm" disabled={actions.optimize.isPending} onClick={() => actions.optimize.mutate()}>
            Optimize gear
          </button>
        </FocusItem>
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
    <div className="ff-window flex max-h-[13rem] min-h-0 shrink flex-col gap-1 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <FocusItem>
          <button
            className="flex h-14 w-12 shrink-0 items-end justify-center rounded bg-black/30 enabled:hover:brightness-125"
            onClick={onManage}
            disabled={!canManage}
            title={canManage ? "Equipment & abilities" : undefined}
          >
            <HeroSprite heroKey={m.build.key} size={48} ko={down} anim={lowHp ? "dying" : undefined} variant={m.statuses?.includes("blind") ? "blind" : null} />
          </button>
        </FocusItem>
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
        {(m.build.boons?.length ?? 0) > 0 && (
          <span className="shrink-0 rounded bg-yellow-300/15 px-1 text-[0.7rem] text-yellow-200" title={m.build.boons!.map((b) => `${b.name}: ${boonText(b.stat, b.amount)}`).join("\n")}>
            ★{m.build.boons!.length}
          </span>
        )}
      </div>

      {canManage && (
        <div className="mt-auto flex flex-wrap items-center gap-1">
          <FocusItem>
            <button className="rounded border border-white/20 bg-black/25 px-1.5 text-xs hover:brightness-125" onClick={onManage}>
              Manage
            </button>
          </FocusItem>
          {items.map((c) => (
            <FocusItem key={c.itemId}>
              <button
                className="flex items-center gap-0.5 rounded border border-white/20 bg-black/25 px-1 text-xs hover:brightness-125 disabled:opacity-50"
                title={`Use ${itemName(c.itemId)} on ${getCharacter(m.build.key).name}${findItem(c.itemId) ? ` — ${itemEffectText(findItem(c.itemId)!)}` : ""}`}
                disabled={actions.useItem.isPending}
                onClick={() => actions.useItem.mutate({ itemId: c.itemId, key: m.build.key })}
              >
                <ItemIcon itemId={c.itemId} size={16} />×{c.count}
              </button>
            </FocusItem>
          ))}
        </div>
      )}
    </div>
  );
}
