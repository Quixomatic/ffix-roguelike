import {
  availableJourneys,
  campSupplies,
  deriveStats,
  getArea,
  encounterNames,
  JOURNEYS,
  MAX_TIER,
  nextSlotCost,
  starterGear,
  startLevelCost,
} from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { MUSIC_SLOTS, useMusic } from "@/features/audio/music";
import { useState } from "react";
import { toast } from "sonner";

import { itemName } from "@/features/run/item-info";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";

import { CampShop } from "./camp-shop";
import { CharacterSheet } from "./character-sheet";

/** Between runs: roster (spend CP, gear, abilities), party picker, difficulty tier, shop and workshop. */
export function Camp() {
  useMusic(MUSIC_SLOTS.camp);
  const profile = useQuery(trpc.profile.get.queryOptions());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [party, setParty] = useState<string[]>([]);
  const [tier, setTier] = useState(0);
  const [journey, setJourney] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);

  const start = useMutation(
    trpc.run.start.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: trpc.run.active.queryKey() });
        await qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() });
        navigate({ to: "/run" });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (profile.isPending) return <div className="p-6">Loading…</div>;
  if (!profile.data) return null;
  const p = profile.data;
  const chosen = party.length ? party : p.unlocked.slice(0, 4);
  const between = !p.activeRunId;
  const supplies = campSupplies(p);
  const open = availableJourneys(p);
  const chosenJourney = journey && open.includes(journey) ? journey : open[open.length - 1]!;

  const toggle = (key: string) =>
    setParty((cur) => {
      const base = cur.length ? cur : p.unlocked.slice(0, 4);
      if (base.includes(key)) return base.filter((k) => k !== key);
      return base.length >= 4 ? base : [...base, key];
    });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="ff-window flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <div className="text-2xl">Camp</div>
          <div className="ff-title">
            Runs {p.stats.runs} · Wins {p.stats.wins} · Battles {p.stats.battles} · {p.gil} gil banked
          </div>
        </div>
        {p.activeRunId ? (
          <Link to="/run" className="ff-window px-6 py-2 text-xl">
            Continue run ▶
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Tier
              <select className="rounded bg-[#0c1238] px-2 py-1" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                {Array.from({ length: Math.min(MAX_TIER, p.maxTier) + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "Tier 0 (Normal)" : `Tier ${i}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ff-window px-6 py-2 text-xl disabled:opacity-50"
              disabled={!chosen.length || start.isPending}
              onClick={() => start.mutate({ party: chosen, tier, journey: chosenJourney })}
            >
              Begin run ▶
            </button>
          </div>
        )}
      </div>

      {between && (
        <>
          <div className="ff-title px-1 text-base">Journey</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {JOURNEYS.map((j) => {
              const unlocked = open.includes(j.id);
              const cleared = (p.journeysCleared ?? []).includes(j.id);
              const area = getArea(j.areas[j.areas.length - 1]!);
              return (
                <button
                  key={j.id}
                  className="ff-window flex flex-col gap-1 p-3 text-left enabled:hover:brightness-125 disabled:opacity-50 data-[on=true]:outline data-[on=true]:outline-2 data-[on=true]:outline-yellow-300"
                  data-on={chosenJourney === j.id}
                  disabled={!unlocked}
                  onClick={() => setJourney(j.id)}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg">{unlocked ? j.name : "???"}</span>
                    {cleared && <span className="text-sm text-yellow-200">Cleared ✓</span>}
                  </div>
                  <div className="text-sm opacity-80">
                    {unlocked ? j.subtitle : `Clear ${JOURNEYS.find((x) => x.id === j.unlockAfter)?.name ?? "the previous journey"} first`}
                  </div>
                  {unlocked && (
                    <div className="text-xs text-[#c8d0ff]">
                      {j.areas.length} map{j.areas.length === 1 ? "" : "s"} · Final boss: {encounterNames(area.boss).join(" & ")}
                    </div>
                  )}
                  {unlocked && j.unlocks?.length ? (
                    <div className="text-xs text-pink-200">
                      {cleared ? "Joined: " : "Clear to recruit: "}
                      {j.unlocks.map((k) => getCharacter(k).name).join(", ")}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="ff-title px-1 text-base">Party — pick up to 4 {p.activeRunId ? "(after this run)" : ""}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {p.unlocked.map((key) => {
          const b = p.builds[key]!;
          const st = deriveStats({ ...b, equipment: starterGear(b) });
          const slotsOpen = 1 + (b.unlockedSlots ?? []).length;
          const inParty = chosen.includes(key);
          const cp = b.points ?? 0;
          const canSpend = cp >= startLevelCost(b.level) || cp >= (nextSlotCost(b) ?? Infinity);
          return (
            <div
              key={key}
              className="ff-window flex flex-col gap-1 p-3 data-[on=true]:outline data-[on=true]:outline-2 data-[on=true]:outline-yellow-300"
              data-on={inParty}
            >
              <button className="flex flex-col gap-1 text-left disabled:cursor-default" disabled={!between} onClick={() => toggle(key)}>
                <div className="flex items-end gap-3">
                  <HeroSprite heroKey={key} size={56} className={inParty ? "ff-hop" : ""} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xl">{getCharacter(key).name}</div>
                    <div className="ff-title">Start Lv {b.level}</div>
                  </div>
                </div>
                <div className="text-sm">
                  HP {st.maxHp} · MP {st.maxMp}
                </div>
                <div className="text-xs text-[#c8d0ff]">
                  {Object.values(starterGear(b))
                    .filter((x): x is number => x != null)
                    .map(itemName)
                    .join(" · ")}
                </div>
                <div className="text-xs opacity-80">
                  <span className={canSpend ? "text-yellow-200" : ""}>{cp} CP</span> · {slotsOpen}/5 gear slots
                </div>
              </button>
              {between && (
                <button className="mt-1 self-start rounded border border-white/40 px-2 text-xs hover:bg-white/10" onClick={() => setSheet(key)}>
                  Manage{canSpend ? " ★" : ""}
                </button>
              )}
            </div>
          );
        })}
        {p.locked.map((l) => (
          <div key={l.key} className="ff-window flex items-end gap-3 p-3 opacity-70">
            <HeroSprite heroKey={l.key} size={56} silhouette />
            <div>
              <div className="text-xl">???</div>
              <div className="text-sm">Unlock: {l.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(supplies).length > 0 && <StashList title="Packed for your next run" entries={Object.entries(supplies)} />}

      {between && <CampShop profile={p} />}

      {sheet && <CharacterSheet build={p.builds[sheet]!} onClose={() => setSheet(null)} />}

      <div className="ff-window p-3 text-sm leading-relaxed">
        <div className="ff-title mb-1">How runs work</div>
        Pick a journey: a campaign of overworld maps, each ending in a boss castle — the last castle holds the journey's final boss. Story journeys follow FF9 and recruit a new party member when cleared. You start alone with Zidane;
        companions join your roster as you progress. Inside a run, characters level up normally from their start level. When the run ends,
        levels reset and everyone who came earns Completion Points (+1 per level gained, +1 per 3 battles won, +3 per boss, +10 for a win) — spend them here on a
        higher start level or on unlocking equipment slots (each starts runs with that character's FF9 starter gear, and can hold what they
        find). Gear teaches abilities while equipped; fill their AP to learn them forever. Win a run and all the gear you found is unlocked
        into future runs; banked gil unlocks more from the gear catalog, and achievements unlock the legendary pieces.
      </div>
    </div>
  );
}

function StashList({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div className="ff-window p-3">
      <div className="ff-title mb-1">{title}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {entries.map(([id, n]) => (
          <span key={id}>
            {itemName(Number(id))} ×{n}
          </span>
        ))}
        {!entries.length && <span className="opacity-60">Nothing yet</span>}
      </div>
    </div>
  );
}
