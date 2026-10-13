import {
  activeSupports,
  apCost,
  availableAbilities,
  deriveStats,
  EQUIP_SLOTS,
  gemsMax,
  gemsUsed,
  isMastered,
  nextSlotCost,
  slotUnlocked,
  starterGear,
  startLevelCost,
  UNLOCKABLE_SLOTS,
  type CharacterBuild,
} from "@ffix-roguelike/game-core";
import { abilityName, getCharacter, getSupportAbility, parseAbilityRef, type AbilityRef, type EquipSlot } from "@ffix-roguelike/game-data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Paperdoll } from "@/features/gear/paperdoll";
import { trpc } from "@/utils/trpc";

type Tab = "progress" | "gear" | "abilities";

const SLOT_NAME: Record<EquipSlot, string> = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory" };

/** Before a run: spend Completion Points (start level, slot unlocks), see starter gear, choose support abilities. */
export function CharacterSheet({ build: saved, onClose }: { build: CharacterBuild; onClose(): void }) {
  // Show the character as they'll start a run: starter gear in unlocked slots.
  const build = { ...saved, equipment: starterGear(saved) };
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("progress");
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
            <div className="ff-window flex flex-col gap-2 p-3">
              <div className="flex items-baseline justify-between">
                <div className="text-lg">Equipment slots</div>
                <div className="text-sm opacity-80">{slotCost == null ? "All unlocked" : `Next unlock: ${slotCost} CP`}</div>
              </div>
              <div className="text-sm opacity-70">
                Unlocking a slot starts every run with {char.name}'s starter gear there, and lets them equip what they find in it.
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {UNLOCKABLE_SLOTS.map((slot) => {
                  const open = slotUnlocked(build, slot);
                  return (
                    <button
                      key={slot}
                      className="ff-window px-2 py-1 text-sm disabled:opacity-50 data-[open=true]:bg-none data-[open=true]:bg-[#2a5a2a]"
                      data-open={open}
                      disabled={open || slotCost == null || points < slotCost || unlock.isPending}
                      onClick={() => unlock.mutate({ key: build.key, slot: slot as "head" | "wrist" | "armor" | "accessory" })}
                    >
                      {SLOT_NAME[slot]} {open ? "✓" : `— ${slotCost} CP`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-xs opacity-60">
              With {char.name}: {build.record?.runs ?? 0} runs · {build.record?.wins ?? 0} wins · {build.record?.bossKills ?? 0} bosses
            </div>
          </div>
        )}

        {tab === "gear" && <GearTab build={build} />}

        {tab === "abilities" && (
          <AbilitiesTab build={build} onToggle={(supports) => supportsM.mutate({ key: build.key, supports })} stones={[gemsUsed(build), gemsMax(build)]} />
        )}
      </div>
    </div>
  );
}

function GearTab({ build }: { build: CharacterBuild }) {
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const name = getCharacter(build.key).name;
  return (
    <Paperdoll
      heroKey={build.key}
      name={name}
      subtitle="Starting gear for every run"
      selected={slot}
      onSelect={setSlot}
      slots={EQUIP_SLOTS.map((s) => ({
        slot: s,
        itemId: build.equipment[s],
        locked: !slotUnlocked(build, s),
        note: s === "weapon" ? "starting weapon" : slotUnlocked(build, s) ? (build.equipment[s] == null ? "open — fill it in a run" : "starter gear") : "unlock in Progress",
      }))}
      picker={
        slot && (
          <div className="rounded bg-black/25 p-2 text-sm opacity-80">
            Gear isn't chosen here — {name} starts every run with this, and equips what they find along the way.
          </div>
        )
      }
    />
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
