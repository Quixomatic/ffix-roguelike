import {
  activeSupports,
  apCost,
  availableAbilities,
  canEquip,
  deriveStats,
  EQUIP_SLOTS,
  gemsMax,
  gemsUsed,
  getStarterWeapon,
  isMastered,
  loadoutSlots,
  loadoutUsed,
  LOADOUT_SLOT_COSTS,
  nextSlotCost,
  startLevelCost,
  type CharacterBuild,
} from "@ffix-roguelike/game-core";
import { abilityName, getCharacter, getItem, getSupportAbility, parseAbilityRef, type AbilityRef } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { gearSummary, itemName } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

const SLOT_LABEL = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory" } as const;
type Tab = "progress" | "gear" | "abilities";

/** Before a run: spend Completion Points, set up the loadout, and choose support abilities. */
export function CharacterSheet({ build, stash, onClose }: { build: CharacterBuild; stash: Record<number, number>; onClose(): void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("progress");
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const raise = useMutation(trpc.profile.raiseStartLevel.mutationOptions(opts));
  const buySlot = useMutation(trpc.profile.buySlot.mutationOptions(opts));
  const equip = useMutation(trpc.profile.equip.mutationOptions(opts));
  const supportsM = useMutation(trpc.profile.setSupports.mutationOptions(opts));

  const char = getCharacter(build.key);
  const st = deriveStats(build);
  const points = build.points ?? 0;
  const levelCost = startLevelCost(build.level);
  const slotCost = nextSlotCost(build);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="ff-window flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl">
            {char.name} <span className="ff-title">Start Lv {build.level}</span>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-lg text-yellow-200">{points} CP</span>
            <button onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="text-sm text-[#c8d0ff]">
          HP {st.maxHp} · MP {st.maxMp} · Str {st.strength} · Mag {st.magic} · Spr {st.spirit} · Spd {st.speed} · Atk {st.attack} · Def {st.defence} · Stones{" "}
          {st.gemsMax}
        </div>
        <div className="flex gap-1">
          {(["progress", "gear", "abilities"] as Tab[]).map((t) => (
            <button key={t} className="ff-option capitalize" data-active={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === "progress" && (
          <div className="flex flex-col gap-3">
            <div className="text-sm opacity-80">
              Runs earn Completion Points for everyone in the party: +1 per level gained, +3 per boss defeated, +10 for a win. Levels reset every
              run — spend CP here to start stronger.
            </div>
            <div className="ff-window flex items-center justify-between p-3">
              <div>
                <div className="text-lg">Start level {build.level}</div>
                <div className="text-sm opacity-70">Every run begins at this level.</div>
              </div>
              <button
                className="ff-window px-4 py-1 disabled:opacity-50"
                disabled={points < levelCost || raise.isPending}
                onClick={() => raise.mutate({ key: build.key })}
              >
                Lv {build.level + 1} — {levelCost} CP
              </button>
            </div>
            <div className="ff-window flex items-center justify-between p-3">
              <div>
                <div className="text-lg">
                  Gear slots {loadoutSlots(build)}/{LOADOUT_SLOT_COSTS.length}
                </div>
                <div className="text-sm opacity-70">Each slot lets {char.name} bring one piece of stash gear into a run.</div>
              </div>
              <button
                className="ff-window px-4 py-1 disabled:opacity-50"
                disabled={slotCost == null || points < slotCost || buySlot.isPending}
                onClick={() => buySlot.mutate({ key: build.key })}
              >
                {slotCost == null ? "All unlocked" : `New slot — ${slotCost} CP`}
              </button>
            </div>
            <div className="text-xs opacity-60">
              With {char.name}: {build.record?.runs ?? 0} runs · {build.record?.wins ?? 0} wins · {build.record?.bossKills ?? 0} bosses
            </div>
          </div>
        )}

        {tab === "gear" && <GearTab build={build} stash={stash} onEquip={(slot, itemId) => equip.mutate({ key: build.key, slot, itemId })} />}

        {tab === "abilities" && (
          <AbilitiesTab build={build} onToggle={(supports) => supportsM.mutate({ key: build.key, supports })} stones={[gemsUsed(build), gemsMax(build)]} />
        )}
      </div>
    </div>
  );
}

function GearTab({
  build,
  stash,
  onEquip,
}: {
  build: CharacterBuild;
  stash: Record<number, number>;
  onEquip(slot: (typeof EQUIP_SLOTS)[number], itemId: number | null): void;
}) {
  const [slot, setSlot] = useState<(typeof EQUIP_SLOTS)[number] | null>(null);
  const slots = loadoutSlots(build);
  const used = loadoutUsed(build);
  const starter = getStarterWeapon(build.key);
  const full = used.length >= slots;
  const options = slot ? Object.keys(stash).map(Number).filter((id) => canEquip(build.key, getItem(id), slot)) : [];
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm">
        Using {used.length} of {slots} gear slot{slots === 1 ? "" : "s"}
        {slots === 0 && <span className="opacity-70"> — buy one in Progress</span>}
      </div>
      {EQUIP_SLOTS.map((s) => {
        const id = build.equipment[s];
        const isStarter = s === "weapon" && id === starter;
        const filled = id != null && !isStarter;
        return (
          <button key={s} className="ff-option flex justify-between disabled:opacity-50" data-active={slot === s} disabled={!filled && full} onClick={() => setSlot(slot === s ? null : s)}>
            <span className="w-24 opacity-70">{SLOT_LABEL[s]}</span>
            <span className="flex-1">
              {id != null ? itemName(id) : "—"}
              {isStarter && <span className="opacity-60"> (starting weapon, free)</span>}
            </span>
          </button>
        );
      })}
      {slot && (
        <div className="mt-1 flex max-h-60 flex-col gap-1 overflow-y-auto rounded bg-black/20 p-2 text-sm">
          {build.equipment[slot] != null && !(slot === "weapon" && build.equipment.weapon === starter) && (
            <button className="ff-option" onClick={() => onEquip(slot, null)}>
              (Remove)
            </button>
          )}
          {options.map((id) => (
            <button key={id} className="ff-option text-left" onClick={() => onEquip(slot, id)}>
              <div>
                {itemName(id)} <span className="opacity-60">×{stash[id]}</span>
              </div>
              <div className="text-xs text-[#c8d0ff]">{gearSummary(getItem(id))}</div>
            </button>
          ))}
          {!options.length && <div className="opacity-60">No stash gear fits — buy some at the camp shop, or win a run to keep what you find.</div>}
        </div>
      )}
    </div>
  );
}

function apLabel(build: CharacterBuild, ref: AbilityRef) {
  const cost = apCost(getCharacter(build.key), ref);
  const have = build.ap[ref] ?? 0;
  return have >= cost ? "Learned" : `${have}/${cost} AP`;
}

function AbilitiesTab({ build, onToggle, stones }: { build: CharacterBuild; onToggle(supports: number[]): void; stones: [number, number] }) {
  const char = getCharacter(build.key);
  const available = availableAbilities(build);
  const active = activeSupports(build);
  const supports = char.abilities.filter((a) => parseAbilityRef(a.ref).kind === "support");
  const actives = char.abilities.filter((a) => parseAbilityRef(a.ref).kind === "active");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="ff-title mb-1">
          Support abilities — stones {stones[0]}/{stones[1]}
        </div>
        <div className="flex max-h-72 flex-col overflow-y-auto text-sm">
          {supports.map((a) => {
            const id = parseAbilityRef(a.ref).id;
            const has = available.includes(a.ref);
            const on = active.has(id);
            const sa = getSupportAbility(id);
            return (
              <label key={a.ref} className={`flex items-center justify-between gap-2 ${has ? "" : "opacity-40"}`}>
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!has}
                    checked={on}
                    onChange={() => onToggle(on ? build.supports.filter((x) => x !== id) : [...build.supports, id])}
                  />
                  {sa.name}
                </span>
                <span className="opacity-70">
                  ◆{sa.gems} · {apLabel(build, a.ref)}
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div>
        <div className="ff-title mb-1">Abilities</div>
        <div className="flex max-h-72 flex-col overflow-y-auto text-sm">
          {actives.map((a) => (
            <div key={a.ref} className={`flex justify-between ${available.includes(a.ref) ? "" : "opacity-40"}`}>
              <span>{abilityName(a.ref)}</span>
              <span className={isMastered(build, a.ref) ? "text-yellow-200" : "opacity-70"}>{apLabel(build, a.ref)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs opacity-70">Learned abilities are yours forever. Others work while gear that teaches them is equipped.</div>
      </div>
    </div>
  );
}
