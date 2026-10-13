import {
  activeSupports,
  apCost,
  availableAbilities,
  canEquip,
  deriveStats,
  EQUIP_SLOTS,
  gemsMax,
  gemsUsed,
  isMastered,
  slotUnlocked,
  type CharacterBuild,
  type RunState,
} from "@ffix-roguelike/game-core";
import { abilityName, findItem, getCharacter, getItem, getSupportAbility, parseAbilityRef, type AbilityRef } from "@ffix-roguelike/game-data";
import { useState } from "react";

import { GearPicker, Paperdoll } from "@/features/gear/paperdoll";
import { HeroSprite } from "@/features/sprites/hero-sprite";

import { itemName } from "./item-info";
import type { RunActions } from "./use-run";

/** Sidebar: party vitals, gil, consumables — and the equipment/abilities manager. */
export function PartyPanel({ run, actions, canManage }: { run: RunState; actions: RunActions; canManage: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const usable = run.consumables.filter((c) => [69, 70, 71, 72, 76].includes(findItem(c.itemId)?.effect?.scriptId ?? -1));
  return (
    <div className="flex flex-col gap-2">
      <div className="ff-window flex items-center justify-between px-3 py-2 text-lg">
        <span>Gil</span>
        <span className="tabular-nums">{run.gil}</span>
      </div>
      {run.party.map((m) => {
        const st = deriveStats(m.build);
        const down = m.hp <= 0;
        return (
          <button key={m.build.key} className="ff-window flex flex-col px-3 py-2 text-left enabled:hover:brightness-125" disabled={!canManage} onClick={() => setOpen(m.build.key)}>
            <div className="flex items-center gap-2">
              <HeroSprite heroKey={m.build.key} size={36} ko={down} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between">
                  <span>{getCharacter(m.build.key).name}</span>
                  <span className="ff-title">Lv {m.build.level}</span>
                </div>
                <div className={`text-sm tabular-nums ${down ? "text-red-400" : ""}`}>
                  HP {m.hp}/{st.maxHp} · MP {m.mp}/{st.maxMp}
                </div>
                <div className="ff-gauge h-1">
                  <div className="ff-gauge-fill" style={{ width: `${(m.hp / st.maxHp) * 100}%`, background: down ? "#7a2020" : "linear-gradient(90deg,#3ab868,#9cf0a0)" }} />
                </div>
              </div>
            </div>
          </button>
        );
      })}
      <div className="ff-window px-3 py-2 text-sm">
        <div className="ff-title">Items</div>
        {run.consumables.map((c) => (
          <div key={c.itemId} className="flex justify-between">
            <span>{itemName(c.itemId)}</span>
            <span>×{c.count}</span>
          </div>
        ))}
        {!run.consumables.length && <div className="opacity-60">None</div>}
      </div>
      {canManage && (
        <button className="ff-window px-3 py-1" disabled={actions.optimize.isPending} onClick={() => actions.optimize.mutate()}>
          Optimize gear
        </button>
      )}
      {open && <CharacterSheet run={run} keyName={open} actions={actions} usable={usable} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CharacterSheet({
  run,
  keyName,
  actions,
  usable,
  onClose,
}: {
  run: RunState;
  keyName: string;
  actions: RunActions;
  usable: { itemId: number; count: number }[];
  onClose(): void;
}) {
  const m = run.party.find((p) => p.build.key === keyName)!;
  const st = deriveStats(m.build);
  const char = getCharacter(keyName);
  const [slot, setSlot] = useState<(typeof EQUIP_SLOTS)[number] | null>(null);
  const supports = activeSupports(m.build);
  const abilities = availableAbilities(m.build);
  const supportRefs = char.abilities.filter((a) => parseAbilityRef(a.ref).kind === "support");
  const activeRefs = char.abilities.filter((a) => parseAbilityRef(a.ref).kind === "active");

  const options = slot
    ? run.gear.filter((g) => (!g.holder || g.holder.key !== keyName || g.holder.slot !== slot) && canEquip(keyName, getItem(g.itemId), slot))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ff-window flex max-h-[90vh] w-full max-w-4xl flex-col gap-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl">
            {char.name} <span className="ff-title">Lv {m.build.level}</span>
          </div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-base sm:grid-cols-4">
          <div>HP {m.hp}/{st.maxHp}</div>
          <div>MP {m.mp}/{st.maxMp}</div>
          <div>Speed {st.speed}</div>
          <div>Strength {st.strength}</div>
          <div>Magic {st.magic}</div>
          <div>Spirit {st.spirit}</div>
          <div>Attack {st.attack}</div>
          <div>Defence {st.defence}</div>
          <div>Evade {st.evade}</div>
          <div>M.Def {st.magicDefence}</div>
          <div>M.Eva {st.magicEvade}</div>
          <div>EXP {m.build.exp}</div>
        </div>

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
              />
            )
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            {usable.length > 0 && (
              <>
                <div className="ff-title mt-3">Use item</div>
                <div className="flex flex-wrap gap-1">
                  {usable.map((c) => (
                    <button key={c.itemId} className="ff-window px-2 py-0.5 text-sm" onClick={() => actions.useItem.mutate({ itemId: c.itemId, key: keyName })}>
                      {itemName(c.itemId)} ×{c.count}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="ff-title">
              Support abilities — stones {gemsUsed(m.build)}/{gemsMax(m.build)}
            </div>
            <div className="flex max-h-40 flex-col overflow-y-auto text-sm">
              {supportRefs.map((a) => {
                const id = parseAbilityRef(a.ref).id;
                const has = abilities.includes(a.ref);
                const on = supports.has(id);
                const sa = getSupportAbility(id);
                return (
                  <label key={a.ref} className={`flex items-center justify-between gap-2 ${has ? "" : "opacity-40"}`}>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={!has}
                        checked={on}
                        onChange={() =>
                          actions.setSupports.mutate({
                            key: keyName,
                            supports: on ? m.build.supports.filter((x) => x !== id) : [...m.build.supports, id],
                          })
                        }
                      />
                      {sa.name}
                    </span>
                    <span className="opacity-70">
                      ◆{sa.gems} · {apCostLabel(m.build, a.ref, a.ap)}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="ff-title mt-2">Abilities</div>
            <div className="flex max-h-40 flex-col overflow-y-auto text-sm">
              {activeRefs.map((a) => {
                const has = abilities.includes(a.ref);
                const mastered = isMastered(m.build, a.ref);
                return (
                  <div key={a.ref} className={`flex justify-between ${has ? "" : "opacity-40"}`}>
                    <span>{abilityName(a.ref)}</span>
                    <span className={mastered ? "text-yellow-200" : "opacity-70"}>{apCostLabel(m.build, a.ref, a.ap)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 text-xs opacity-70">Abilities work while their gear is equipped. Fill the AP to keep them forever.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "12/40 AP" or "Learned". */
function apCostLabel(build: CharacterBuild, ref: AbilityRef, cost = apCost(getCharacter(build.key), ref)) {
  const have = build.ap[ref] ?? 0;
  return have >= cost ? "Learned" : `${have}/${cost} AP`;
}
