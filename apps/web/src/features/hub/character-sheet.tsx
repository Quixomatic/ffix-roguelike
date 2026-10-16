import {
  deriveStats,
  EQUIP_SLOTS,
  gemsMax,
  gemsUsed,
  nextSlotCost,
  slotUnlocked,
  starterGear,
  startLevelCost,
  UNLOCKABLE_SLOTS,
  type CharacterBuild,
} from "@ffix-roguelike/game-core";
import { getCharacter, type EquipSlot } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AbilityGrid, CharacterModal, Panel, StatBars, StoneMeter, SupportGrid, TrainingRows } from "@/features/gear/character-panels";
import { ItemIcon } from "@/features/items/item-icon";
import { DollFigure, EquipmentList, SLOT_META, type PaperdollSlot } from "@/features/gear/paperdoll";
import { trpc } from "@/utils/trpc";

/**
 * Before a run: the paperdoll (starter gear) on the left; Stats, Equipment, Abilities, Support and Progress tabs on
 * the right.
 */
export function CharacterSheet({ build: saved, onClose }: { build: CharacterBuild; onClose(): void }) {
  // Show the character as they'll start a run: starter gear in unlocked slots.
  const build = { ...saved, equipment: starterGear(saved) };
  const qc = useQueryClient();
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const [tab, setTab] = useState("stats");
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const raise = useMutation(trpc.profile.raiseStartLevel.mutationOptions(opts));
  const unlock = useMutation(trpc.profile.unlockSlot.mutationOptions(opts));
  const supportsM = useMutation(trpc.profile.setSupports.mutationOptions(opts));
  const train = useMutation(trpc.profile.trainStat.mutationOptions(opts));

  const char = getCharacter(build.key);
  const st = deriveStats(build);
  const points = build.points ?? 0;
  const levelCost = startLevelCost(build.level);
  const slotCost = nextSlotCost(build);
  const record = build.record;

  const slots: PaperdollSlot[] = EQUIP_SLOTS.map((s) => ({
    slot: s,
    itemId: build.equipment[s],
    locked: !slotUnlocked(build, s),
    note: s === "weapon" ? "starting weapon" : !slotUnlocked(build, s) ? "locked — unlock in Progress" : build.equipment[s] == null ? "fill it in a run" : "starter gear",
  }));
  const pickSlot = (s: EquipSlot) => {
    setSlot(s);
    setTab("equipment");
  };

  return (
    <CharacterModal
      title={
        <>
          {char.name} <span className="ff-title text-base">Start Lv {build.level}</span>
        </>
      }
      headerRight={<span className="rounded border border-yellow-200/50 bg-black/30 px-2 py-0.5 text-lg text-yellow-200">{points} CP</span>}
      onClose={onClose}
      tab={tab}
      onTab={setTab}
      doll={
        <div className="flex flex-col gap-3">
          <DollFigure heroKey={build.key} slots={slots} selected={slot} onSelect={pickSlot} />
          <EquipmentList slots={slots} selected={slot} onSelect={pickSlot} />
        </div>
      }
      tabs={[
        {
          id: "stats",
          label: "Stats",
          content: (
            <div className="flex flex-col gap-3">
              <Panel title="Training" right={<span className="opacity-70">spend CP to raise base stats for every run</span>}>
                <TrainingRows build={build} stats={st} points={points} busy={train.isPending} onTrain={(stat) => train.mutate({ key: build.key, stat })} />
              </Panel>
              <Panel title="Combat" right={<span className="opacity-70">at the start of a run</span>}>
                <StatBars stats={st} />
              </Panel>
            </div>
          ),
        },
        {
          id: "equipment",
          label: "Equipment",
          content: (
            <Panel title="Starting gear upgrades" right={<span className="text-orange-300">coming soon</span>}>
              <div className="text-sm opacity-80">
                Upgrade {char.name}'s starter gear step by step so every run starts better equipped. It won't be cheap.
              </div>
              <div className="flex flex-col gap-2">
                {slots
                  .filter((s) => !s.locked)
                  .map((s) => (
                    <div key={s.slot} className={`flex items-center gap-2 rounded p-1.5 ${slot === s.slot ? "bg-white/10" : ""}`}>
                      <span className="ff-title w-20 shrink-0">{SLOT_META[s.slot].label}</span>
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 border-yellow-200/60 bg-[#0c1238]" title="Current starter">
                        {s.itemId != null ? <ItemIcon itemId={s.itemId} size={32} /> : <span className="opacity-40">—</span>}
                      </span>
                      {[1, 2, 3].map((step) => (
                        <span key={step} className="flex items-center gap-2">
                          <span className="text-xl opacity-50">→</span>
                          <span className="flex h-14 w-14 flex-col items-center justify-center rounded border-2 border-dashed border-white/20 bg-black/30 text-xs opacity-60" title="Coming soon">
                            <span className="text-lg">🔒</span>
                            ??? CP
                          </span>
                        </span>
                      ))}
                    </div>
                  ))}
                {!slots.some((s) => !s.locked) && <div className="text-sm opacity-60">No gear slots open yet.</div>}
              </div>
            </Panel>
          ),
        },
        {
          id: "abilities",
          label: "Abilities",
          content: (
            <Panel title="Abilities" right={<span className="opacity-70">learned ones are yours forever</span>}>
              <AbilityGrid build={build} />
            </Panel>
          ),
        },
        {
          id: "support",
          label: "Support",
          content: (
            <Panel title="Support abilities" right={<StoneMeter used={gemsUsed(build)} max={gemsMax(build)} />}>
              <SupportGrid build={build} onToggle={(supports) => supportsM.mutate({ key: build.key, supports })} />
            </Panel>
          ),
        },
        {
          id: "progress",
          label: "Progress",
          content: (
            <div className="grid content-start gap-3 xl:grid-cols-2">
              <Panel title="Start level" right={<span className="opacity-70">every run begins here</span>}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-3xl">Lv {build.level}</span>
                  <button className="ff-window px-4 py-1 disabled:opacity-50" disabled={points < levelCost || raise.isPending} onClick={() => raise.mutate({ key: build.key })}>
                    → Lv {build.level + 1} · {levelCost} CP
                  </button>
                </div>
                <div className="text-xs opacity-70">CP from runs: +1 per level gained, +1 per 3 battles won, +3 per boss, +10 for a win. Levels reset every run.</div>
              </Panel>
              <Panel title="Gear slots" right={<span className="opacity-70">{slotCost == null ? "all unlocked" : `next: ${slotCost} CP`}</span>}>
                <div className="grid grid-cols-2 gap-1.5">
                  {UNLOCKABLE_SLOTS.map((s) => {
                    const open = slotUnlocked(build, s);
                    return (
                      <button
                        key={s}
                        className="rounded border px-2 py-1 text-sm transition disabled:cursor-default data-[open=true]:border-green-400/60 data-[open=true]:bg-green-900/40 data-[open=false]:border-white/20 data-[open=false]:bg-black/25 enabled:hover:brightness-125"
                        data-open={open}
                        disabled={open || slotCost == null || points < slotCost || unlock.isPending}
                        onClick={() => unlock.mutate({ key: build.key, slot: s as "head" | "wrist" | "armor" | "accessory" })}
                      >
                        {SLOT_META[s].label} {open ? "✓" : <span className="opacity-70">· {slotCost} CP</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs opacity-70">An open slot starts each run with {char.name}'s starter gear and holds what they find.</div>
              </Panel>
              <Panel title="Record" className="xl:col-span-2">
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {(
                    [
                      ["Runs", record?.runs ?? 0],
                      ["Wins", record?.wins ?? 0],
                      ["Bosses", record?.bossKills ?? 0],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="rounded bg-black/25 py-1">
                      <div className="ff-title text-xs">{k}</div>
                      <div className="text-xl">{v}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ),
        },
      ]}
    />
  );
}
