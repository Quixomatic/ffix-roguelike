import { getJourney, WORLDS, type RunState } from "@ffix-roguelike/game-core";
import { findItem, getCharacter } from "@ffix-roguelike/game-data";
import { useState } from "react";

import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { FocusItem } from "@/features/input/focus";

import { gearSummary, HelpText, itemEffectText, itemName } from "./item-info";
import { fieldItems } from "./party-sidebar";
import type { RunActions } from "./use-run";

type DockTab = "inventory" | "gear" | "run";

const TABS: { id: DockTab; label: string; glyph: string }[] = [
  { id: "inventory", label: "Items", glyph: "🧪" },
  { id: "gear", label: "Gear", glyph: "⚔" },
  { id: "run", label: "Run", glyph: "🗺" },
];

/**
 * Bottom centre of the run screen: tabs that slide a panel out over the map (on the right) — the item bag, every piece of gear the
 * party carries, and the run's progress (with Abandon).
 */
export function RunDock({ run, actions, canManage }: { run: RunState; actions: RunActions; canManage: boolean }) {
  const [tab, setTab] = useState<DockTab | null>(null);
  return (
    <>
      <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1">
        {TABS.map((t) => (
          <FocusItem key={t.id}>
            <button
              className="ff-window flex items-center gap-1.5 px-3 py-1 text-sm data-[on=true]:text-yellow-200 data-[on=true]:brightness-125"
              data-on={tab === t.id}
              onClick={() => setTab(tab === t.id ? null : t.id)}
            >
              <span className="text-base leading-none">{t.glyph}</span>
              {t.label}
            </button>
          </FocusItem>
        ))}
      </div>
      {tab && (
        <div className="ff-window absolute bottom-14 right-2 top-2 z-20 flex w-80 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex items-center justify-between">
            <span className="ff-display text-lg">{TABS.find((t) => t.id === tab)!.label}</span>
            <FocusItem>
              <button onClick={() => setTab(null)} aria-label="Close">
                ✕
              </button>
            </FocusItem>
          </div>
          {tab === "inventory" && <InventoryPanel run={run} actions={actions} canManage={canManage} />}
          {tab === "gear" && <GearBagPanel run={run} />}
          {tab === "run" && <RunInfoPanel run={run} actions={actions} />}
        </div>
      )}
    </>
  );
}

/** Consumables; field items can be used on a party member from here. */
function InventoryPanel({ run, actions, canManage }: { run: RunState; actions: RunActions; canManage: boolean }) {
  const [using, setUsing] = useState<number | null>(null);
  const usable = new Set(fieldItems(run).map((c) => c.itemId));
  if (!run.consumables.length) return <div className="text-sm opacity-60">No items.</div>;
  return (
    <div className="flex flex-col gap-1">
      {run.consumables.map((c) => (
        <div key={c.itemId} className="rounded bg-black/25 px-2 py-1">
          <div className="flex items-center gap-2">
            <ItemIcon itemId={c.itemId} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block">{itemName(c.itemId)}</span>
              <ItemEffectLine itemId={c.itemId} />
            </span>
            <span className="tabular-nums">×{c.count}</span>
            {canManage && usable.has(c.itemId) && (
              <FocusItem>
                <button className="rounded border border-white/20 px-1.5 text-xs hover:brightness-125" onClick={() => setUsing(using === c.itemId ? null : c.itemId)}>
                  Use
                </button>
              </FocusItem>
            )}
          </div>
          {using === c.itemId && (
            <div className="mt-1 flex flex-wrap gap-1">
              {run.party.map((m) => (
                <FocusItem key={m.build.key}>
                  <button
                    className="flex items-center gap-1 rounded border border-white/20 bg-black/30 px-1.5 text-xs hover:brightness-125"
                    disabled={actions.useItem.isPending}
                    onClick={() => actions.useItem.mutate({ itemId: c.itemId, key: m.build.key })}
                  >
                    <HeroSprite heroKey={m.build.key} size={20} ko={m.hp <= 0} />
                    {getCharacter(m.build.key).name}
                  </button>
                </FocusItem>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** What a consumable does (exact effect) and FF9's help line, under its name. */
function ItemEffectLine({ itemId }: { itemId: number }) {
  const item = findItem(itemId);
  if (!item) return null;
  return (
    <span className="block text-xs">
      {itemEffectText(item) && <span className="block text-[#c8d0ff]">{itemEffectText(item)}</span>}
      <HelpText text={item.help} className="opacity-70" />
    </span>
  );
}

/** Every piece of gear the party carries: who wears it, and whether it's safe (starter/won) or found this run. */
function GearBagPanel({ run }: { run: RunState }) {
  const sorted = [...run.gear].sort((a, b) => Number(!!a.holder) - Number(!!b.holder) || (findItem(a.itemId)?.kind ?? "").localeCompare(findItem(b.itemId)?.kind ?? ""));
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs opacity-70">Found gear (orange) goes home only if the run is won. Equip from a character's Manage sheet.</div>
      {sorted.map((g) => {
        const item = findItem(g.itemId);
        if (!item) return null;
        return (
          <div key={g.uid} className="flex items-center gap-2 rounded bg-black/25 px-2 py-1">
            <ItemIcon itemId={g.itemId} size={32} />
            <div className="min-w-0 flex-1">
              <div className={`truncate ${g.secured ? "" : "text-orange-300"}`}>{item.name}</div>
              <div className="truncate text-xs text-[#c8d0ff]">{gearSummary(item) || "—"}</div>
            </div>
            {g.holder ? (
              <span title={`On ${getCharacter(g.holder.key).name}`}>
                <HeroSprite heroKey={g.holder.key} size={24} />
              </span>
            ) : (
              <span className="text-xs opacity-60">bag</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Where the run is and how it's going; abandoning lives here. */
function RunInfoPanel({ run, actions }: { run: RunState; actions: RunActions }) {
  const journey = getJourney(run.journey);
  const rows: [string, string | number][] = [
    ["Journey", journey.name],
    ["Area", `${WORLDS[run.world]!.name} (map ${run.stage + 1}/${journey.areas.length})`],
    ["Difficulty", `Tier ${run.tier}`],
    ["Battles won", run.stats.battles],
    ["Bosses", run.stats.bossKills.length],
    ["Steals", run.stats.steals],
    ["Gil", run.gil],
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <span className="ff-title">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="ff-title">Route</span>
        {journey.areas.map((a, i) => {
          const w = WORLDS.find((x) => x.id === a);
          return (
            <span key={a} className={i < run.stage ? "opacity-50 line-through" : i === run.stage ? "text-yellow-200" : ""}>
              {i + 1}. {w?.name ?? a}
            </span>
          );
        })}
      </div>
      <FocusItem>
        <button
          className="mt-2 rounded border border-red-400/50 px-2 py-1 text-sm text-red-300 hover:bg-red-900/30"
          onClick={() => {
            if (confirm("Abandon this run? You still earn Completion Points and keep learned abilities; gear found this run is lost.")) actions.abandon.mutate();
          }}
        >
          Abandon run
        </button>
      </FocusItem>
    </div>
  );
}
