import { canEquip, deriveStats, EQUIP_SLOTS, gemsMax, gemsUsed, slotUnlocked, type RunState } from "@ffix-roguelike/game-core";
import { getCharacter, getItem, type EquipSlot } from "@ffix-roguelike/game-data";
import { useState } from "react";

import { AbilityGrid, Panel, StatGrid, StoneMeter, SupportGrid } from "@/features/gear/character-panels";
import { GearPicker, Paperdoll } from "@/features/gear/paperdoll";
import { ItemIcon } from "@/features/items/item-icon";

import { itemName } from "./item-info";
import { fieldItems } from "./party-sidebar";
import type { RunActions } from "./use-run";

/** A party member during a run, on one screen: paperdoll + gear picker, stats, field items, supports, abilities. */
export function RunCharacterSheet({ run, keyName, actions, onClose }: { run: RunState; keyName: string; actions: RunActions; onClose(): void }) {
  const m = run.party.find((p) => p.build.key === keyName)!;
  const st = deriveStats(m.build);
  const char = getCharacter(keyName);
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const items = fieldItems(run);
  const options = slot ? run.gear.filter((g) => (!g.holder || g.holder.key !== keyName || g.holder.slot !== slot) && canEquip(keyName, getItem(g.itemId), slot)) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="ff-window flex max-h-[94vh] w-full max-w-6xl flex-col gap-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="ff-display text-2xl">
            {char.name} <span className="ff-title text-base">Lv {m.build.level}</span>
          </div>
          <button className="text-xl" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[22rem_1fr]">
          <Panel title="Equipment" right={<span className="opacity-70">click a slot to change it</span>} className="self-start">
            <Paperdoll
              heroKey={keyName}
              name={char.name}
              subtitle={`Lv ${m.build.level}`}
              selected={slot}
              onSelect={setSlot}
              slots={EQUIP_SLOTS.map((s) => {
                const inst = run.gear.find((g) => g.holder?.key === keyName && g.holder.slot === s);
                const open = slotUnlocked(m.build, s);
                return {
                  slot: s,
                  itemId: m.build.equipment[s],
                  locked: !open,
                  note: !open ? "locked — unlock at camp" : inst && !inst.secured ? "found this run" : undefined,
                  noteTone: "warn" as const,
                };
              })}
              picker={
                slot && (
                  <GearPicker
                    title={`${slot[0]!.toUpperCase()}${slot.slice(1)} — gear you're carrying`}
                    options={options.map((g) => ({
                      key: g.uid,
                      itemId: g.itemId,
                      caption: (
                        <>
                          {g.holder ? <span className="opacity-60">(on {getCharacter(g.holder.key).name})</span> : null}
                          {!g.secured && <span className="text-orange-300"> · found</span>}
                        </>
                      ),
                    }))}
                    onPick={(uid) => actions.equip.mutate({ key: keyName, slot, uid: Number(uid) })}
                    onRemove={slot !== "weapon" && m.build.equipment[slot] != null ? () => actions.equip.mutate({ key: keyName, slot, uid: null }) : undefined}
                    empty="Nothing else fits."
                    compare={m.build}
                  />
                )
              }
            />
          </Panel>

          <div className="grid content-start gap-3 xl:grid-cols-2">
            <Panel title="Stats" className="xl:col-span-2">
              <StatGrid stats={st} current={{ hp: m.hp, mp: m.mp }} extra={[["EXP", m.build.exp]]} />
            </Panel>

            {items.length > 0 && (
              <Panel title="Use item" className="xl:col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {items.map((c) => (
                    <button
                      key={c.itemId}
                      className="flex items-center gap-1 rounded border border-white/20 bg-black/25 px-2 py-0.5 text-sm hover:brightness-125 disabled:opacity-50"
                      disabled={actions.useItem.isPending}
                      onClick={() => actions.useItem.mutate({ itemId: c.itemId, key: keyName })}
                    >
                      <ItemIcon itemId={c.itemId} size={16} />
                      {itemName(c.itemId)} ×{c.count}
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Support abilities" right={<StoneMeter used={gemsUsed(m.build)} max={gemsMax(m.build)} />} className="xl:col-span-2">
              <SupportGrid build={m.build} onToggle={(supports) => actions.setSupports.mutate({ key: keyName, supports })} />
            </Panel>

            <Panel title="Abilities" right={<span className="opacity-70">fill the AP to keep them forever</span>} className="xl:col-span-2">
              <AbilityGrid build={m.build} />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
