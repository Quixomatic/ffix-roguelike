import { getJourney, WORLDS, type RunState } from "@ffix-roguelike/game-core";
import { findItem, getCharacter } from "@ffix-roguelike/game-data";
import { useEffect, useState } from "react";

import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { actionForKey } from "@/features/input/actions";
import { ButtonHint } from "@/features/input/button-hint";
import { FocusItem, FocusSection } from "@/features/input/focus";
import { dialogOpen, isEditable } from "@/features/input/nav";
import { useInputOwner } from "@/features/input/owner";

import { gearSummary, HelpText, itemEffectText, itemName } from "./item-info";
import { fieldItems } from "./party-sidebar";
import type { RunActions } from "./use-run";

export type DockTab = "inventory" | "gear" | "run";

const TABS: { id: DockTab; label: string; glyph: string }[] = [
  { id: "inventory", label: "Items", glyph: "🧪" },
  { id: "gear", label: "Gear", glyph: "⚔" },
  { id: "run", label: "Run", glyph: "🗺" },
];

/**
 * The bag: a panel over the run's map / stage, on the right (left of the party when the party floats over the game,
 * `besideParty`), with three tabs in its header: the items, every piece of gear the party carries, and the run's
 * progress (with Abandon). Opened from the party sidebar's Bag button, or X.
 *
 * Controls: while it's open it has the controls (the map waits): LB / RB (Q / E) flip between Items, Gear and Run, and
 * B / Escape or X closes it and hands the controls back.
 */
export function RunDock({
  run,
  actions,
  canManage,
  tab,
  onTab,
  besideParty,
}: {
  run: RunState;
  actions: RunActions;
  canManage: boolean;
  tab: DockTab | null;
  onTab(tab: DockTab | null): void;
  besideParty?: boolean;
}) {
  const setTab = onTab;
  useInputOwner("menu", { active: !!tab, onCancel: () => setTab(null) });
  useEffect(() => {
    if (!tab) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target as Element) || dialogOpen()) return;
      const a = actionForKey(e);
      const i = TABS.findIndex((t) => t.id === tab);
      if (a === "l1" || a === "r1") setTab(TABS[(i + (a === "r1" ? 1 : TABS.length - 1)) % TABS.length]!.id);
      else if (a === "x") setTab(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, setTab]);
  if (!tab) return null;
  return (
    // The open panel has the cursor (its own section, so the cursor starts in it — keyed so each tab starts on its first item).
    <FocusSection key={tab} focusKey="run-dock" autoFocus>
      <div
        data-run-panel
        className={`ff-window absolute bottom-3 top-3 z-30 flex w-80 flex-col gap-2 overflow-y-auto p-3 ${besideParty ? "right-[18.5rem]" : "right-3"}`}
      >
        <div className="flex items-center gap-1">
          <ButtonHint action="l1" />
          {TABS.map((t) => (
            <FocusItem key={t.id}>
              <button
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm opacity-75 hover:bg-white/10 hover:opacity-100 data-[on=true]:bg-white/15 data-[on=true]:text-yellow-200 data-[on=true]:opacity-100"
                data-on={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                <span className="leading-none">{t.glyph}</span>
                {t.label}
              </button>
            </FocusItem>
          ))}
          <ButtonHint action="r1" />
          <FocusItem>
            <button className="ml-auto flex items-center gap-1.5" onClick={() => setTab(null)} aria-label="Close">
              <ButtonHint action="cancel" /> ✕
            </button>
          </FocusItem>
        </div>
        {tab === "inventory" && <InventoryPanel run={run} actions={actions} canManage={canManage} />}
        {tab === "gear" && <GearBagPanel run={run} />}
        {tab === "run" && <RunInfoPanel run={run} actions={actions} />}
      </div>
    </FocusSection>
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

/** The gear in the bag (not worn by anyone): whether it's safe (starter/won) or found this run, and who it was found for. */
function GearBagPanel({ run }: { run: RunState }) {
  const sorted = run.gear.filter((g) => !g.holder).sort((a, b) => (findItem(a.itemId)?.kind ?? "").localeCompare(findItem(b.itemId)?.kind ?? ""));
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs opacity-70">Found gear (orange) goes home only if the run is won. Equip from a character's Manage sheet.</div>
      {!sorted.length && <div className="text-sm opacity-60">Nothing in the bag: everything is being worn.</div>}
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
            {g.boundTo && (
              <span title={`Found for ${getCharacter(g.boundTo).name}: only they can wear it`}>
                <HeroSprite heroKey={g.boundTo} size={24} />
              </span>
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
  const [confirming, setConfirming] = useState(false);
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
          onClick={() => setConfirming(true)}
        >
          Abandon run
        </button>
      </FocusItem>
      <ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Abandon this run?" confirmLabel="Abandon run" onConfirm={() => actions.abandon.mutate()}>
        It ends as a loss: you still earn Completion Points and keep learned abilities, and half the gil is banked; gear found this run is lost.
      </ConfirmDialog>
    </div>
  );
}
