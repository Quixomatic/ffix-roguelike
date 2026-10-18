import {
  deriveStats,
  EQUIP_SLOTS,
  gemsMax,
  gemsUsed,
  nextSlotCost,
  slotUnlocked,
  starterGear,
  START_LEVEL_MAX,
  startLevelCost,
  starterTierPicked,
  type CharacterBuild,
  type Profile,
} from "@ffix-roguelike/game-core";
import { getCharacter, type EquipSlot } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AbilityGrid, CharacterModal, Panel, StatBars, StoneMeter, SupportGrid, TrainingRows } from "@/features/gear/character-panels";
import { DollFigure, EquipmentList, type PaperdollSlot } from "@/features/gear/paperdoll";
import { trpc } from "@/utils/trpc";

import { StarterUpgrades } from "./starter-upgrades";

/**
 * Before a run: the paperdoll (starter gear) on the left; Training (all CP spending), Equipment, Abilities, Support and Record tabs on
 * the right.
 */
export function CharacterSheet({ build: saved, onClose, inline }: { build: CharacterBuild; onClose(): void; inline?: boolean }) {
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
  const buyTier = useMutation(trpc.profile.buyStarterUpgrade.mutationOptions(opts));
  const pickTier = useMutation(trpc.profile.pickStarterTier.mutationOptions(opts));
  // Gil, unlocked gear, journeys and achievements decide which upgrade tiers can be bought.
  const profile = (useQuery(trpc.profile.get.queryOptions()).data ?? null) as Profile | null;

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
    note: !slotUnlocked(build, s)
      ? "locked — hover the slot to unlock"
      : starterTierPicked(build, s)
        ? `starting gear · upgrade tier ${starterTierPicked(build, s)}`
        : build.equipment[s] == null
          ? "fill it in a run"
          : s === "weapon"
            ? "starting weapon"
            : "starter gear",
  }));
  const pickSlot = (s: EquipSlot) => {
    setSlot(s);
    setTab("equipment");
  };

  return (
    <CharacterModal
      inline={inline}
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
          <DollFigure
            heroKey={build.key}
            slots={slots}
            selected={slot}
            onSelect={pickSlot}
            unlock={{
              cost: slotCost,
              affordable: slotCost != null && points >= slotCost,
              busy: unlock.isPending,
              onUnlock: (s) => unlock.mutate({ key: build.key, slot: s as "head" | "wrist" | "armor" | "accessory" }),
            }}
          />
          <EquipmentList slots={slots} selected={slot} onSelect={pickSlot} />
        </div>
      }
      tabs={[
        {
          id: "stats",
          label: "Training",
          content: (
            <div className="grid content-start gap-3 xl:grid-cols-2">
              <Panel title="Training" className="xl:col-span-2" right={<span className="opacity-70">spend CP — it carries into every run</span>}>
                <TrainingRows
                  build={build}
                  stats={st}
                  points={points}
                  busy={train.isPending || raise.isPending}
                  onTrain={(stat) => train.mutate({ key: build.key, stat })}
                  level={{ value: build.level, max: START_LEVEL_MAX, cost: levelCost, onRaise: () => raise.mutate({ key: build.key }) }}
                />
                <div className="text-xs opacity-70">
                  CP from runs: +1 per level gained, +1 per 3 battles won, +3 per boss, +10 for a win. Levels reset every run. Locked gear slots unlock from the
                  paperdoll (hover one).
                </div>
              </Panel>
              <Panel title="Combat" className="xl:col-span-2" right={<span className="opacity-70">at the start of a run</span>}>
                <StatBars stats={st} />
              </Panel>
            </div>
          ),
        },
        {
          id: "equipment",
          label: "Equipment",
          content: (
            <Panel
              title="Starting gear upgrades"
              right={
                <span className="opacity-80">
                  <span className="text-yellow-200">{(profile?.gil ?? 0).toLocaleString()}</span> gil · <span className="text-yellow-200">{points}</span> CP
                </span>
              }
            >
              <StarterUpgrades
                build={saved}
                profile={profile}
                selected={slot}
                busy={buyTier.isPending || pickTier.isPending || unlock.isPending}
                onBuy={(s) => buyTier.mutate({ key: build.key, slot: s })}
                onPick={(s, tier) => pickTier.mutate({ key: build.key, slot: s, tier })}
                onUnlockSlot={(s) => unlock.mutate({ key: build.key, slot: s as "head" | "wrist" | "armor" | "accessory" })}
              />
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
          id: "record",
          label: "Record",
          content: (
            <div className="grid content-start gap-3">
              <Panel title="Record" right={<span className="opacity-70">runs with {char.name} in the party</span>}>
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
