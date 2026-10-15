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

import { AbilityGrid, Panel, StatGrid, StoneMeter, SupportGrid } from "@/features/gear/character-panels";
import { Paperdoll } from "@/features/gear/paperdoll";
import { trpc } from "@/utils/trpc";

const SLOT_NAME: Record<EquipSlot, string> = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory" };

/**
 * Before a run, everything about a character on one screen: the paperdoll (starter gear) on the left; stats,
 * Completion Point spending, support abilities and abilities in panels on the right.
 */
export function CharacterSheet({ build: saved, onClose }: { build: CharacterBuild; onClose(): void }) {
  // Show the character as they'll start a run: starter gear in unlocked slots.
  const build = { ...saved, equipment: starterGear(saved) };
  const qc = useQueryClient();
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const raise = useMutation(trpc.profile.raiseStartLevel.mutationOptions(opts));
  const unlock = useMutation(trpc.profile.unlockSlot.mutationOptions(opts));
  const supportsM = useMutation(trpc.profile.setSupports.mutationOptions(opts));

  const char = getCharacter(build.key);
  const st = deriveStats(build);
  const points = build.points ?? 0;
  const levelCost = startLevelCost(build.level);
  const slotCost = nextSlotCost(build);
  const record = build.record;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="ff-window flex max-h-[94vh] w-full max-w-6xl flex-col gap-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="ff-display text-2xl">
            {char.name} <span className="ff-title text-base">Start Lv {build.level}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="rounded border border-yellow-200/50 bg-black/30 px-2 py-0.5 text-lg text-yellow-200">{points} CP</span>
            <button className="text-xl" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[22rem_1fr]">
          {/* Left: who they are and what they wear */}
          <Panel title="Equipment" right={<span className="opacity-70">starts every run</span>} className="self-start">
            <Paperdoll
              heroKey={build.key}
              name={char.name}
              subtitle={`Start Lv ${build.level}`}
              selected={slot}
              onSelect={setSlot}
              slots={EQUIP_SLOTS.map((s) => ({
                slot: s,
                itemId: build.equipment[s],
                locked: !slotUnlocked(build, s),
                note: s === "weapon" ? "starting weapon" : !slotUnlocked(build, s) ? "locked" : build.equipment[s] == null ? "fill it in a run" : undefined,
              }))}
              picker={
                slot && (
                  <div className="rounded bg-black/25 p-2 text-sm opacity-80">
                    Gear isn't chosen here — {char.name} starts every run with this, and equips what they find along the way.
                  </div>
                )
              }
            />
          </Panel>

          {/* Right: numbers, progression, abilities */}
          <div className="grid content-start gap-3 xl:grid-cols-2">
            <Panel title="Stats" className="xl:col-span-2">
              <StatGrid stats={st} />
            </Panel>

            <Panel title="Start level" right={<span className="opacity-70">every run begins here</span>}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-3xl">Lv {build.level}</span>
                <button className="ff-window px-4 py-1 disabled:opacity-50" disabled={points < levelCost || raise.isPending} onClick={() => raise.mutate({ key: build.key })}>
                  → Lv {build.level + 1} · {levelCost} CP
                </button>
              </div>
              <div className="text-xs opacity-70">
                CP from runs: +1 per level gained, +1 per 3 battles won, +3 per boss, +10 for a win. Levels reset every run.
              </div>
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
                      {SLOT_NAME[s]} {open ? "✓" : <span className="opacity-70">· {slotCost} CP</span>}
                    </button>
                  );
                })}
              </div>
              <div className="text-xs opacity-70">An open slot starts each run with {char.name}'s starter gear and holds what they find.</div>
            </Panel>

            <Panel title="Support abilities" right={<StoneMeter used={gemsUsed(build)} max={gemsMax(build)} />} className="xl:col-span-2">
              <SupportGrid build={build} onToggle={(supports) => supportsM.mutate({ key: build.key, supports })} />
            </Panel>

            <Panel title="Abilities" right={<span className="opacity-70">learned ones are yours forever</span>} className="xl:col-span-2">
              <AbilityGrid build={build} />
            </Panel>

            <div className="text-xs opacity-60 xl:col-span-2">
              With {char.name}: {record?.runs ?? 0} runs · {record?.wins ?? 0} wins · {record?.bossKills ?? 0} bosses
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
