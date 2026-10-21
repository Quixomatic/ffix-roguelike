import {
  bagValue,
  deriveStats,
  EQUIP_SLOTS,
  METRIC_SECTIONS,
  METRICS,
  gemsMax,
  gemsUsed,
  nextSlotCost,
  slotUnlocked,
  starterGear,
  startLevelMax,
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

import { rosterEntries } from "@/features/camp/roster";
import { formatMetric } from "@/features/hub/stats-page";

import { StarterUpgrades } from "./starter-upgrades";

/**
 * Before a run: the paperdoll (starter gear) on the left; Training (all CP spending), Equipment, Abilities, Support and Record tabs on
 * the right.
 */
export function CharacterSheet({
  build: saved,
  onClose,
  inline,
  onSwitch,
}: {
  build: CharacterBuild;
  onClose(): void;
  inline?: boolean;
  /** Go to another recruited character's sheet (the ◂ ▸ arrows beside the name). */
  onSwitch?(key: string): void;
}) {
  // Show the character as they'll start a run: starter gear in unlocked slots.
  const build = { ...saved, equipment: starterGear(saved) };
  const qc = useQueryClient();
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const [tab, setTab] = useState("stats");
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  // Unlocking or buying something makes the figure celebrate (victory pose + a hop).
  const [cheer, setCheer] = useState(0);
  const cheering = {
    ...opts,
    onSuccess: () => {
      setCheer((n) => n + 1);
      return opts.onSuccess();
    },
  };
  const raise = useMutation(trpc.profile.raiseStartLevel.mutationOptions(cheering));
  const unlock = useMutation(trpc.profile.unlockSlot.mutationOptions(cheering));
  const supportsM = useMutation(trpc.profile.setSupports.mutationOptions(opts));
  const train = useMutation(trpc.profile.trainStat.mutationOptions(cheering));
  const buyTier = useMutation(trpc.profile.buyStarterUpgrade.mutationOptions(cheering));
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
  // ◂ ▸ beside the name: the previous / next recruited character, in roster order (wrapping).
  const recruited = profile ? rosterEntries({ ...profile, locked: [] }).map((e) => e.key) : [];
  const at = recruited.indexOf(build.key);
  const neighbour = (d: 1 | -1) => recruited[(at + d + recruited.length) % recruited.length]!;
  const cycle =
    onSwitch && at >= 0 && recruited.length > 1
      ? {
          prev: () => onSwitch(neighbour(-1)),
          next: () => onSwitch(neighbour(1)),
          prevName: getCharacter(neighbour(-1)).name,
          nextName: getCharacter(neighbour(1)).name,
        }
      : undefined;

  return (
    <CharacterModal
      inline={inline}
      title={char.name}
      headerRight={
        <>
          <span className="ff-display text-xl" title="Start level: every run starts here">
            Lvl. {build.level}
          </span>
          <span className="rounded border border-yellow-200/50 bg-black/30 px-2 py-0.5 text-lg text-yellow-200">{points} CP</span>
        </>
      }
      cycle={cycle}
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
            cheer={cheer}
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
                  level={{ value: build.level, max: startLevelMax(), cost: levelCost, onRaise: () => raise.mutate({ key: build.key }) }}
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
              {/* Their lifetime metrics (the ones kept per character), by section. */}
              <div className="grid gap-3 xl:grid-cols-2">
                {METRIC_SECTIONS.map((s) => {
                  const list = METRICS.filter((m) => m.section === s.id && m.perCharacter);
                  if (!list.length) return null;
                  return (
                    <Panel key={s.id} title={s.label}>
                      <div className="flex flex-col">
                        {list.map((m) => (
                          <div key={m.key} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-0.5 last:border-0" title={m.description}>
                            <span className="text-sm">{m.label}</span>
                            <span className="tabular-nums text-yellow-200">{formatMetric(m, bagValue(profile?.metrics, m.key, { character: build.key }))}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </div>
          ),
        },
      ]}
    />
  );
}
