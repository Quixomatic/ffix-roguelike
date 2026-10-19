import { achievement, achievementProgress, bagValue, relicSlotCount, relicUnlocked, type Profile } from "@ffix-roguelike/game-core";
import { rarityOf, relicTable, type RelicData } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FocusItem } from "@/features/input/focus";
import { trpc } from "@/utils/trpc";

import { Badge } from "./badge";
import { effectText, tagName } from "./relic-text";

/** FF9's card collector levels, by how much of the collection is unlocked. */
const COLLECTOR_RANKS = ["Beginner", "Novice", "Player", "Collector", "Expert", "Veteran", "Champion", "Master"];
const collectorRank = (have: number, total: number) => COLLECTOR_RANKS[Math.min(COLLECTOR_RANKS.length - 1, Math.floor((have / Math.max(1, total)) * (COLLECTOR_RANKS.length - 1)))]!;

type Filter = "all" | "unlocked" | "locked" | "starter";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "locked", label: "Locked" },
  { id: "starter", label: "Starters" },
];

const number = (r: RelicData) => `No. ${String(r.sort).padStart(3, "0")}`;

/**
 * The relic collection, like FF9's card browse screen: every relic in a numbered grid (unlocked ones show their badge,
 * locked ones an empty slot), the one under the cursor large beside it with its effects and how to unlock it, and a
 * collector rank on top.
 */
export function RelicsPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (profile.isPending) return <div className="p-6">Loading…</div>;
  const p = (profile.data ?? null) as Profile | null;
  const all = relicTable();
  const unlocked = (r: RelicData) => !!p && relicUnlocked(p, r);
  const have = all.filter(unlocked).length;
  const shown = all.filter((r) => (filter === "unlocked" ? unlocked(r) : filter === "locked" ? !unlocked(r) : filter === "starter" ? r.starter : true));
  const selected = all.find((r) => r.id === selectedId) ?? shown[0] ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 pb-24 pt-6">
      <div className="ff-window flex flex-col gap-2 px-5 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="ff-display text-3xl">Relics</div>
          <div className="flex items-baseline gap-4 text-lg">
            <span className="text-sm opacity-80">
              Collector rank <span className="ff-display text-yellow-200">{collectorRank(have, all.length)}</span>
            </span>
            <span>
              <span className="text-yellow-200">{have}</span> / {all.length}
            </span>
          </div>
        </div>
        <div className="ff-gauge h-2.5">
          <div className="ff-gauge-fill" data-full={have >= all.length && all.length > 0} style={{ width: `${all.length ? (have / all.length) * 100 : 0}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <FocusItem key={f.id}>
                <button
                  className={`rounded border px-3 py-0.5 hover:brightness-125 ${filter === f.id ? "border-yellow-300 bg-yellow-300/10 text-yellow-200" : "border-white/20 bg-black/25"}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              </FocusItem>
            ))}
          </div>
          {p && <span className="opacity-80">Relic slots per run: {relicSlotCount(p)}</span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start">
        <div className="ff-window grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2 p-3">
          {!shown.length && <div className="col-span-full py-6 text-center opacity-70">Nothing here yet.</div>}
          {shown.map((r, i) => {
            const open = unlocked(r);
            const on = selected?.id === r.id;
            return (
              <FocusItem key={r.id} defaultFocus={i === 0} onFocus={() => setSelectedId(r.id)}>
                <button
                  data-sound="none"
                  className={`flex flex-col items-center gap-1 rounded border p-1.5 ${on ? "border-yellow-300 bg-yellow-300/10" : "border-white/15 bg-black/30"} ${open ? "" : "opacity-60"}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  {open ? <Badge id={r.badge ?? 1} /> : <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-white/25 text-2xl opacity-50">?</span>}
                  <span className="text-xs tabular-nums opacity-80">{number(r)}</span>
                </button>
              </FocusItem>
            );
          })}
        </div>
        {selected && <RelicDetail relic={selected} unlocked={unlocked(selected)} profile={p} />}
      </div>
    </div>
  );
}

function RelicDetail({ relic: r, unlocked, profile }: { relic: RelicData; unlocked: boolean; profile: Profile | null }) {
  const rarity = rarityOf(r.rarity);
  const source = r.unlockedBy ? achievement(r.unlockedBy) : undefined;
  const progress = !unlocked && source && profile ? achievementProgress(source, profile) : null;
  const synergies = r.effects.flatMap((e) => (e.scope?.kind === "tag" ? [e.scope.tag] : []));
  return (
    <div className="ff-window flex flex-col gap-3 p-4 md:sticky md:top-4">
      <div className="flex items-center gap-3">
        {unlocked ? <Badge id={r.badge ?? 1} scale={3} view={36} /> : <span className="flex h-[108px] w-[108px] items-center justify-center rounded-full border border-dashed border-white/25 text-5xl opacity-50">?</span>}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs tabular-nums opacity-70">{number(r)}</span>
          <span className="ff-display text-xl">{unlocked ? r.name : "???"}</span>
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="rounded px-1.5 py-0.5" style={{ background: `${rarity?.color ?? "#888"}33`, color: rarity?.color ?? "#ccc" }}>
              {rarity?.name ?? r.rarity}
            </span>
            {r.cursed && <span className="rounded bg-purple-900/60 px-1.5 py-0.5 text-purple-200">Cursed</span>}
            {r.starter && <span className="rounded bg-sky-900/60 px-1.5 py-0.5 text-sky-200">Starter</span>}
          </div>
        </div>
      </div>
      {unlocked ? (
        <>
          <div className="text-sm">{r.description}</div>
          <ul className="flex flex-col gap-0.5 text-sm text-[#c8d0ff]">
            {r.effects.map((e, i) => (
              <li key={i}>• {effectText(e)}</li>
            ))}
          </ul>
          {synergies.length > 0 && <div className="text-xs opacity-70">Works with: {[...new Set(synergies)].map(tagName).join(", ")}</div>}
          {r.flavor && <div className="text-sm italic opacity-80">“{r.flavor}”</div>}
          <div className="flex gap-4 border-t border-white/10 pt-2 text-xs opacity-80">
            <span>
              Taken <span className="tabular-nums text-yellow-200">{bagValue(profile?.metrics, "relics.taken", { subject: r.id })}</span>×
            </span>
            <span>
              Runs won with it <span className="tabular-nums text-yellow-200">{bagValue(profile?.metrics, "relics.runs_won", { subject: r.id })}</span>
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <div className="opacity-80">Not yet unlocked.</div>
          {source ? (
            <div className="flex flex-col gap-1 rounded border border-white/10 bg-black/20 p-2">
              <span className="text-xs opacity-70">Unlocked by the achievement</span>
              <span className="text-yellow-200">{source.secret ? "???" : source.name}</span>
              {!source.secret && <span className="text-xs">{source.description}</span>}
              {progress && (
                <div className="flex items-center gap-2">
                  <div className="ff-gauge flex-1">
                    <div className="ff-gauge-fill" style={{ width: `${Math.min(100, (progress.have / progress.need) * 100)}%` }} />
                  </div>
                  <span className="text-xs tabular-nums">
                    {progress.have.toLocaleString()} / {progress.need.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="opacity-70">Found somewhere on the road…</div>
          )}
        </div>
      )}
    </div>
  );
}
