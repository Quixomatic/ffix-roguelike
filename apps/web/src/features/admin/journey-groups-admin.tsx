import { checkJourneyGroups, JOURNEYS, type JourneyDef } from "@ffix-roguelike/game-core";
import type { JourneyGroupData, RewardTables } from "@ffix-roguelike/game-data";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FocusItem } from "@/features/input/focus";
import { trpc } from "@/utils/trpc";

import { Field, SaveButton, Text, useSaved } from "./admin-fields";

/** The story line, in order: the journeys groupings are made from. */
// A function, not a constant: JOURNEYS fills in when the content tables load, after this module does.
const storyJourneys = () => JOURNEYS.filter((j) => j.category === "story");

/** A journey's title without its number ("9 · Return to Alexandria" → "Return to Alexandria"). */
const title = (j: JourneyDef) => (j.name.includes(" · ") ? j.name.split(" · ").slice(1).join(" · ") : j.name);
const number = (j: JourneyDef) => (j.name.includes(" · ") ? j.name.split(" · ")[0]! : "");

type Names = Record<string, { id: string; name: string; subtitle: string }>;

/**
 * Admin → Journey groupings (`.plans/journey-groups.md`): the story line, one journey per row, with a join / split
 * toggle between neighbours. Joined journeys play as one run; each group of 2+ gets a name and subtitle. Save
 * replaces every story grouping at once (challenge groupings are left alone). Runs in progress keep their route.
 */
export function JourneyGroupsTab({ tables }: { tables: RewardTables }) {
  const saved = (tables.journeyGroups ?? []).filter((g) => g.category !== "challenge");
  // Which journeys are joined to the next one, and each group's name, keyed by its first journey.
  const [joined, setJoined] = useState<Set<string>>(() => new Set(saved.flatMap((g) => g.journeys.slice(0, -1))));
  const [names, setNames] = useState<Names>(() =>
    Object.fromEntries(saved.map((g) => [g.journeys[0]!, { id: g.id, name: g.name, subtitle: g.subtitle ?? "" }])),
  );
  const save = useMutation(trpc.admin.saveJourneyGroups.mutationOptions(useSaved("Journey groupings")));

  // The story line cut into runs of joined journeys.
  const story = storyJourneys();
  const segments = useMemo(() => {
    const out: JourneyDef[][] = [];
    for (const j of storyJourneys()) {
      const prev = out.at(-1)?.at(-1);
      if (prev && joined.has(prev.id)) out.at(-1)!.push(j);
      else out.push([j]);
    }
    return out;
  }, [joined]);

  const groups: JourneyGroupData[] = segments
    .filter((s) => s.length > 1)
    .map((s, i) => {
      const n = names[s[0]!.id];
      return {
        id: n?.id ?? `g-${s[0]!.id}`,
        name: n?.name ?? s.map(title).join(" & "),
        ...(n?.subtitle ? { subtitle: n.subtitle } : {}),
        journeys: s.map((j) => j.id),
        sort: i + 1,
        enabled: true,
      };
    });
  const challenges = (tables.journeyGroups ?? []).filter((g) => g.category === "challenge");
  const problems = checkJourneyGroups([...challenges, ...groups]);

  const toggle = (id: string) =>
    setJoined((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setName = (first: string, patch: Partial<Names[string]>) =>
    setNames((cur) => {
      const g = groups.find((x) => x.journeys[0] === first)!;
      const base = cur[first] ?? { id: g.id, name: g.name, subtitle: g.subtitle ?? "" };
      return { ...cur, [first]: { ...base, ...patch } };
    });

  return (
    <div className="ff-window flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl text-sm opacity-80">
          Join neighbouring story journeys to play them as <span className="text-yellow-200">one run</span>: their maps end to end, each
          journey's boss giving its rewards, then on to the next journey's first map. Journeys still clear, recruit and earn achievements
          on their own. Split a group to play its journeys separately again. Runs in progress keep the route they started with.
        </div>
        <SaveButton pending={save.isPending} onClick={() => save.mutate(groups.map(({ id, name, subtitle, journeys }) => ({ id, name, subtitle, journeys })))} />
      </div>
      {problems.length > 0 && (
        <ul className="rounded border border-red-300/40 bg-red-900/20 p-2 text-sm text-red-200">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col">
        {segments.map((seg, si) => {
          const first = seg[0]!;
          const group = groups.find((g) => g.journeys[0] === first.id);
          const maps = seg.reduce((n, j) => n + j.areas.length, 0);
          return (
            <div key={first.id} className="flex flex-col">
              {si > 0 && <JoinToggle joined={false} canJoin={story[story.indexOf(first) - 1]?.id === first.unlockAfter} onClick={() => toggle(first.unlockAfter!)} />}
              <div className={group ? "flex flex-col gap-2 rounded border-2 border-yellow-300/50 bg-yellow-300/5 p-3" : ""}>
                {group && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                    <Field label="Name">
                      <Text value={group.name} onChange={(name) => setName(first.id, { name })} />
                    </Field>
                    <Field label="Subtitle">
                      <Text value={group.subtitle} onChange={(subtitle) => setName(first.id, { subtitle })} />
                    </Field>
                    <span className="pb-1 text-sm text-yellow-200">
                      {seg.length} journeys · {maps} maps
                    </span>
                  </div>
                )}
                {seg.map((j, i) => (
                  <div key={j.id} className="flex flex-col">
                    {i > 0 && <JoinToggle joined canJoin onClick={() => toggle(seg[i - 1]!.id)} />}
                    <JourneyRow journey={j} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JourneyRow({ journey: j }: { journey: JourneyDef }) {
  return (
    <div className="flex items-center gap-3 rounded border border-white/15 bg-black/25 px-3 py-2">
      <span className="ff-display w-8 text-right text-xl text-white/40">{number(j)}</span>
      <span className="ff-display text-lg">{title(j)}</span>
      <span className="text-sm opacity-60">
        {j.areas.length} maps{j.unlocks?.length ? ` · recruits ${j.unlocks.join(", ")}` : ""}
      </span>
    </div>
  );
}

/** Between two neighbouring journeys: join them into one run, or split them apart. */
function JoinToggle({ joined, canJoin, onClick }: { joined: boolean; canJoin: boolean; onClick(): void }) {
  return (
    <div className="flex justify-center py-1">
      <FocusItem>
        <button
          disabled={!canJoin}
          onClick={onClick}
          className={`rounded border px-3 py-0.5 text-xs ${joined ? "border-yellow-300/60 text-yellow-200 hover:bg-yellow-300/10" : "border-white/20 opacity-70 hover:bg-white/10 hover:opacity-100"} disabled:opacity-30`}
        >
          {joined ? "Split here" : "Join"}
        </button>
      </FocusItem>
    </div>
  );
}
