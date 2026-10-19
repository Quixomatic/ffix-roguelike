import { bagValue, getEnemy, METRIC_SECTIONS, METRICS, parseBagKey, type MetricBag, type MetricDef, type Profile } from "@ffix-roguelike/game-core";
import { findItem, getAction, getCharacter, relicById } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FocusItem } from "@/features/input/focus";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";

const TICKS_PER_SECOND = 15;

/** A metric's value for display: durations as m:ss, the rest as numbers. */
export function formatMetric(def: MetricDef | undefined, v: number): string {
  if (def?.ticks) {
    const s = Math.round(v / TICKS_PER_SECOND);
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
  }
  return Math.round(v).toLocaleString();
}

/** A metric subject's name: an enemy, item, ability, status… */
function subjectName(def: MetricDef, subject: string): string {
  try {
    if (def.subject === "enemy") return getEnemy(subject).name;
    if (def.subject === "item") return findItem(Number(subject))?.name ?? subject;
    if (def.subject === "ability") return getAction(Number(subject)).name;
    if (def.subject === "relic") return relicById(subject)?.name ?? subject;
  } catch {
    /* unknown: show the id */
  }
  return subject.charAt(0).toUpperCase() + subject.slice(1).replace(/-/g, " ");
}

/** Per-subject entries of a metric for the player, biggest first. */
function topSubjects(bag: MetricBag, key: string, n: number) {
  const def = METRICS.find((m) => m.key === key)!;
  return Object.entries(bag)
    .map(([k, v]) => ({ ...parseBagKey(k), v }))
    .filter((e) => e.key === key && e.subject && !e.character)
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((e) => ({ name: subjectName(def, e.subject), v: e.v }));
}

/** The party table's columns. */
const PARTY_COLUMNS = ["enemies.killed", "damage.dealt", "damage.best_hit", "healing.done", "steals.succeeded", "kos.suffered", "battles.won", "runs.won"];

/**
 * Lifetime stats: every metric the game keeps (`metrics/registry.ts`), by section; each recruited character side by side
 * (sortable); and the most defeated enemies, most used items and abilities.
 */
export function StatsPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (profile.isPending) return <div className="p-6">Loading…</div>;
  const p = (profile.data ?? null) as Profile | null;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-24 pt-6">
      <div className="ff-window flex flex-col gap-1 px-5 py-3">
        <div className="ff-display text-3xl">Stats</div>
        <div className="text-sm text-[#c8d0ff]">Counted from the server's verified battles. Who landed each hit, damage and steals count from v0.3.1 on.</div>
      </div>
      <MetricsOverview bag={p?.metrics ?? {}} characters={p?.unlocked ?? []} />
    </div>
  );
}

/** A player's metrics: the party side by side (sortable), every metric by section, and the top tens. */
export function MetricsOverview({ bag, characters }: { bag: MetricBag; characters: string[] }) {
  const [sortBy, setSortBy] = useState("enemies.killed");
  const party = [...characters].sort((a, b) => bagValue(bag, sortBy, { character: b }) - bagValue(bag, sortBy, { character: a }));
  const lists: { title: string; key: string }[] = [
    { title: "Most defeated", key: "enemies.killed" },
    { title: "Bosses", key: "bosses.defeated" },
    { title: "Items used", key: "items.used" },
    { title: "Abilities used", key: "abilities.used" },
  ];

  return (
    <>
      <section className="flex flex-col gap-2">
        <Heading title="Party" />
        <div className="ff-window overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1" />
                {PARTY_COLUMNS.map((k) => {
                  const def = METRICS.find((m) => m.key === k)!;
                  return (
                    <th key={k} className="px-2 py-1 text-right font-normal">
                      <FocusItem>
                        <button
                          className={`ff-title whitespace-nowrap hover:text-white ${sortBy === k ? "text-yellow-200" : ""}`}
                          onClick={() => setSortBy(k)}
                          title={`${def.description} Click to sort.`}
                        >
                          {def.label}
                        </button>
                      </FocusItem>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {party.map((k) => (
                <tr key={k} className="border-t border-white/10">
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <HeroSprite heroKey={k} size={32} />
                      {getCharacter(k).name}
                    </span>
                  </td>
                  {PARTY_COLUMNS.map((m) => (
                    <td key={m} className={`px-2 py-1 text-right tabular-nums ${sortBy === m ? "text-yellow-200" : ""}`}>
                      {formatMetric(METRICS.find((d) => d.key === m), bagValue(bag, m, { character: k }))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {METRIC_SECTIONS.map((s) => (
          <section key={s.id} className="flex flex-col gap-2">
            <Heading title={s.label} />
            <div className="ff-window flex flex-col p-2">
              {METRICS.filter((m) => m.section === s.id).map((m) => (
                <div key={m.key} className="flex items-baseline justify-between gap-3 border-b border-white/5 px-2 py-1 last:border-0" title={m.description}>
                  <span className="text-sm">{m.label}</span>
                  <span className="tabular-nums text-yellow-200">{formatMetric(m, bagValue(bag, m.key))}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {lists.map((l) => {
          const top = topSubjects(bag, l.key, 10);
          return (
            <section key={l.key} className="flex flex-col gap-2">
              <Heading title={l.title} />
              <div className="ff-window flex flex-col p-2 text-sm">
                {top.length ? (
                  top.map((e, i) => (
                    <div key={`${e.name}-${i}`} className="flex justify-between gap-2 px-2 py-0.5">
                      <span className="truncate">{e.name}</span>
                      <span className="tabular-nums text-yellow-200">{Math.round(e.v).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-2 py-1 opacity-60">Nothing yet</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Heading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="ff-display text-2xl">{title}</span>
      <span className="h-px flex-1 bg-white/20" />
    </div>
  );
}
