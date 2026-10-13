import { canEquip, deriveStats, EQUIP_SLOTS, PRE_EQUIP_LEVELS, preEquipUnlocked, type CharacterBuild } from "@ffix-roguelike/game-core";
import { getCharacter, getItem } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { gearSummary, itemName } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

const SLOT_LABEL = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory" } as const;

/** Camp loadout: pre-equip stash gear into the slots this character has unlocked by level. */
export function LoadoutSheet({ build, stash, onClose }: { build: CharacterBuild; stash: Record<number, number>; onClose(): void }) {
  const qc = useQueryClient();
  const [slot, setSlot] = useState<(typeof EQUIP_SLOTS)[number] | null>(null);
  const equip = useMutation(
    trpc.profile.equip.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
      onError: (e) => toast.error(e.message),
    }),
  );
  const char = getCharacter(build.key);
  const st = deriveStats(build);
  const options = slot ? Object.keys(stash).map(Number).filter((id) => canEquip(build.key, getItem(id), slot)) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ff-window flex w-full max-w-2xl flex-col gap-3 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl">
            {char.name} <span className="ff-title">Lv {build.level}</span>
          </div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="text-sm text-[#c8d0ff]">
          HP {st.maxHp} · MP {st.maxMp} · Atk {st.attack} · Def {st.defence} · M.Def {st.magicDefence} · Stones {st.gemsMax}
        </div>
        <div className="ff-title">Starting loadout</div>
        {EQUIP_SLOTS.map((s) => {
          const open = preEquipUnlocked(build.level, s);
          const id = build.equipment[s];
          return (
            <button key={s} className="ff-option flex justify-between disabled:opacity-50" data-active={slot === s} disabled={!open} onClick={() => setSlot(slot === s ? null : s)}>
              <span className="w-24 opacity-70">{SLOT_LABEL[s]}</span>
              <span className="flex-1">{open ? (id != null ? itemName(id) : "—") : `Unlocks at Lv ${PRE_EQUIP_LEVELS[s]}`}</span>
            </button>
          );
        })}
        {slot && (
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded bg-black/20 p-2 text-sm">
            {slot !== "weapon" && build.equipment[slot] != null && (
              <button className="ff-option" onClick={() => equip.mutate({ key: build.key, slot, itemId: null })}>
                (Remove)
              </button>
            )}
            {options.map((id) => (
              <button key={id} className="ff-option text-left" onClick={() => equip.mutate({ key: build.key, slot, itemId: id })}>
                <div>
                  {itemName(id)} <span className="opacity-60">×{stash[id]}</span>
                </div>
                <div className="text-xs text-[#c8d0ff]">{gearSummary(getItem(id))}</div>
              </button>
            ))}
            {!options.length && <div className="opacity-60">No stash gear fits this slot yet — find some on a run and mail it home.</div>}
          </div>
        )}
        <div className="text-xs opacity-70">Only gear in unlocked slots comes with you. Everything else you'll have to find along the way.</div>
      </div>
    </div>
  );
}
