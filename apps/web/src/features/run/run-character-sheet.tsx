import { canWearInstance, deriveStats, EQUIP_SLOTS, expForLevel, gemsMax, gemsUsed, slotUnlocked, type RunState } from "@ffix-roguelike/game-core";
import { getCharacter, getItem, MAX_LEVEL, type EquipSlot } from "@ffix-roguelike/game-data";
import { useEffect, useState } from "react";

import { AbilityGrid, CharacterModal, Panel, StatBars, StoneMeter, SupportGrid, TrainingRows } from "@/features/gear/character-panels";
import { DollFigure, EquipmentList, GearPicker, SLOT_META, type PaperdollSlot } from "@/features/gear/paperdoll";
import { ItemIcon } from "@/features/items/item-icon";
import { actionForKey } from "@/features/input/actions";
import { ButtonHint } from "@/features/input/button-hint";
import { FocusItem } from "@/features/input/focus";
import { dialogOpen, isEditable } from "@/features/input/nav";

import { itemName } from "./item-info";
import { BoonList } from "./reward-cards";
import { fieldItems } from "./party-sidebar";
import type { RunActions } from "./use-run";

/**
 * A party member during a run: paperdoll on the left; Stats, Equipment, Abilities, Support and Items tabs.
 * LB / RB (Q / E) flip to the previous / next member (`onSwitch`); Y (C) or B / Escape closes it.
 */
export function RunCharacterSheet({
  run,
  keyName,
  actions,
  onClose,
  onSwitch,
}: {
  run: RunState;
  keyName: string;
  actions: RunActions;
  onClose(): void;
  onSwitch?(key: string): void;
}) {
  const m = run.party.find((p) => p.build.key === keyName)!;
  const st = deriveStats(m.build);
  const char = getCharacter(keyName);
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const [tab, setTab] = useState("stats");
  const items = fieldItems(run);
  // Only what's in the bag: gear another member wears isn't listed, and reward gear found for someone else can't go on.
  const options = slot ? run.gear.filter((g) => !g.holder && canWearInstance(keyName, g, slot)) : [];
  const lv = m.build.level;
  const expFrom = expForLevel(lv);
  const expTo = lv >= MAX_LEVEL ? expFrom : expForLevel(lv + 1);

  const slots: PaperdollSlot[] = EQUIP_SLOTS.map((s) => {
    const inst = run.gear.find((g) => g.holder?.key === keyName && g.holder.slot === s);
    const open = slotUnlocked(m.build, s);
    return {
      slot: s,
      itemId: m.build.equipment[s],
      locked: !open,
      note: !open ? "locked — unlock at camp" : inst && !inst.secured ? "found this run" : undefined,
      noteTone: "warn" as const,
    };
  });
  const pickSlot = (s: EquipSlot) => {
    setSlot(s);
    setTab("equipment");
  };
  const at = run.party.findIndex((p) => p.build.key === keyName);
  const neighbour = (d: 1 | -1) => run.party[(at + d + run.party.length) % run.party.length]!.build.key;
  const many = run.party.length > 1 && !!onSwitch;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target as Element)) return;
      // Another dialog over the sheet keeps its keys.
      if (document.querySelectorAll("[role='dialog'], [data-modal]").length > 1 && dialogOpen()) return;
      const a = actionForKey(e);
      if ((a === "l1" || a === "r1") && many) {
        setSlot(null);
        onSwitch!(neighbour(a === "r1" ? 1 : -1));
      } else if (a === "triangle") onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <CharacterModal
      title={
        <>
          {char.name} <span className="ff-title text-base">Lv {lv}</span>
        </>
      }
      onClose={onClose}
      headerRight={
        many && (
          <div className="flex items-center gap-2 text-sm">
            <button className="flex items-center gap-1.5 opacity-80 hover:opacity-100" onClick={() => onSwitch!(neighbour(-1))}>
              <ButtonHint action="l1" /> {getCharacter(neighbour(-1)).name}
            </button>
            <span className="opacity-40">·</span>
            <button className="flex items-center gap-1.5 opacity-80 hover:opacity-100" onClick={() => onSwitch!(neighbour(1))}>
              {getCharacter(neighbour(1)).name} <ButtonHint action="r1" />
            </button>
          </div>
        )
      }
      tab={tab}
      onTab={setTab}
      doll={
        <div className="flex flex-col gap-3">
          <DollFigure heroKey={keyName} slots={slots} selected={slot} onSelect={pickSlot} variant={m.statuses?.includes("blind") ? "blind" : null} />
          <EquipmentList slots={slots} selected={slot} onSelect={pickSlot} />
        </div>
      }
      tabs={[
        {
          id: "stats",
          label: "Stats",
          content: (
            <div className="flex flex-col gap-3">
              <Panel title="Stats" right={(m.statuses?.length ?? 0) > 0 ? <span className="text-purple-300">{m.statuses!.join(", ")}</span> : undefined}>
                <StatBars stats={st} current={{ hp: m.hp, mp: m.mp }} exp={{ into: m.build.exp - expFrom, span: Math.max(1, expTo - expFrom), total: m.build.exp }} />
              </Panel>
              <Panel title="Boons" right={<span className="opacity-70">this run only</span>}>
                <BoonList boons={m.build.boons ?? []} />
              </Panel>
              <Panel title="Training" right={<span className="opacity-70">bought with CP at camp</span>}>
                <TrainingRows build={m.build} stats={st} />
              </Panel>
            </div>
          ),
        },
        {
          id: "equipment",
          label: "Equipment",
          content: (
            <div className="flex flex-col gap-3">
              {!slot && <div className="rounded bg-black/25 p-3 text-sm opacity-80">Select a slot on the left to swap its gear.</div>}
              {slot && (
                <GearPicker
                  title={`${SLOT_META[slot].label} — gear you're carrying`}
                  options={options.map((g) => ({
                    key: g.uid,
                    itemId: g.itemId,
                    caption: (
                      <>
                        {g.boundTo && <span className="text-yellow-200">found for {getCharacter(g.boundTo).name}</span>}
                        {!g.secured && <span className="text-orange-300">{g.boundTo ? " · " : ""}found</span>}
                      </>
                    ),
                  }))}
                  onPick={(uid) => actions.equip.mutate({ key: keyName, slot, uid: Number(uid) })}
                  onRemove={slot !== "weapon" && m.build.equipment[slot] != null ? () => actions.equip.mutate({ key: keyName, slot, uid: null }) : undefined}
                  empty="Nothing else fits."
                  compare={m.build}
                />
              )}
            </div>
          ),
        },
        {
          id: "abilities",
          label: "Abilities",
          content: (
            <Panel title="Abilities" right={<span className="opacity-70">fill the AP to keep them forever</span>}>
              <AbilityGrid build={m.build} />
            </Panel>
          ),
        },
        {
          id: "support",
          label: "Support",
          content: (
            <Panel title="Support abilities" right={<StoneMeter used={gemsUsed(m.build)} max={gemsMax(m.build)} />}>
              <SupportGrid build={m.build} onToggle={(supports) => actions.setSupports.mutate({ key: keyName, supports })} />
            </Panel>
          ),
        },
        {
          id: "items",
          label: "Items",
          content: (
            <Panel title="Use an item" right={<span className="opacity-70">on {char.name}</span>}>
              {items.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((c) => (
                    <FocusItem key={c.itemId}>
                      <button
                        className="flex items-center gap-2 rounded border border-white/20 bg-black/25 px-2 py-1 text-left hover:brightness-125 disabled:opacity-50"
                        disabled={actions.useItem.isPending}
                        onClick={() => actions.useItem.mutate({ itemId: c.itemId, key: keyName })}
                      >
                        <ItemIcon itemId={c.itemId} size={32} />
                        <span className="flex-1">{itemName(c.itemId)}</span>
                        <span className="tabular-nums">×{c.count}</span>
                      </button>
                    </FocusItem>
                  ))}
                </div>
              ) : (
                <div className="text-sm opacity-60">No items usable outside battle.</div>
              )}
            </Panel>
          ),
        },
      ]}
    />
  );
}
