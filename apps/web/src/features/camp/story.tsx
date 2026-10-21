import {
  availableRoutes,
  challengeRoutes,
  encounterNames,
  getArea,
  getJourney,
  getRoute,
  isRoute,
  JOURNEYS,
  MAX_TIER,
  partySynergies,
  routes,
  runName,
  starterRelics,
  type JourneyDef,
  type Profile,
  type RouteDef,
} from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { Castle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge } from "@/features/hub/badge";
import { Pop, RelicPopover, SynergyChip } from "@/features/hub/relic-popover";
import { effectText } from "@/features/hub/relic-text";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

import { Breadcrumbs, CAMP, type Crumb } from "./breadcrumbs";
import { CARD_CELL, CARD_GRID, CharacterCard, rosterEntries } from "./roster";

type StoryProfile = { maxTier: number; journeysCleared?: string[] } & Parameters<typeof availableRoutes>[0];

/** Whether every journey of a route (a journey, or a journey grouping) has been cleared. */
const routeCleared = (p: StoryProfile, routeId: string) => getRoute(routeId).journeys.every((j) => (p.journeysCleared ?? []).includes(j));

/**
 * The tiers a route can be played at: Tier 0 always; higher ones once it's cleared (every journey in it), capped for
 * now by the account's unlocked tier, until the rules track a tier per journey.
 */
export function journeyTiers(p: StoryProfile, routeId: string): number[] {
  const top = routeCleared(p, routeId) ? Math.min(MAX_TIER, p.maxTier) : 0;
  return Array.from({ length: top + 1 }, (_, i) => i);
}

const tierLabel = (t: number) => (t === 0 ? "Normal" : `Tier ${t}`);

/**
 * The Story page: what can be played as a card each (a journey, or a journey grouping played as one run), with its
 * highest tier cleared; choose one to pick a party and tier for it.
 */
export function StoryPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (!profile.data) return <div className="p-6">Loading…</div>;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      <PageTitle crumbs={[CAMP, { label: "Story" }]} title="Journeys" sub="Each journey is a campaign of overworld maps ending in a boss. Clear one to recruit its hero and open the next — and its higher tiers." />
      <RouteSections profile={profile.data} categories={["story"]} />
    </div>
  );
}

/**
 * What can be played, in sections by category (the Story page: the story and side journeys; the Challenges page:
 * hidden bosses and challenge runs): full-width cards, one per row; a journey grouping as one card.
 */
export function RouteSections({ profile: p, categories }: { profile: StoryProfile; categories: JourneyDef["category"][] }) {
  const open = availableRoutes(p);
  const all = [...routes(), ...challengeRoutes()];
  return (
    <>
      {JOURNEY_SECTIONS.filter((s) => categories.includes(s.category)).map(({ label, category }) => {
        const list = all.filter((r) => r.category === category);
        if (!list.length) return null;
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="ff-display text-xl text-[#c8d0ff]">{label}</h2>
            {list.map((r) =>
              r.grouped ? (
                <JourneyGroupRow key={r.id} route={r} unlocked={open.includes(r.id)} cleared={p.journeysCleared ?? []} />
              ) : (
                <JourneyCard key={r.id} route={r} unlocked={open.includes(r.id)} cleared={p.journeysCleared ?? []} />
              ),
            )}
          </section>
        );
      })}
    </>
  );
}

/**
 * A hero a journey recruits: a silhouette until they've joined, then the green check over them. The box is the
 * sprite's whole drawn cell (4⁄3 of its size).
 */
function RecruitSprite({ heroKey, joined, size }: { heroKey: string; joined: boolean; size: number }) {
  const box = Math.round((size * 4) / 3);
  return (
    <span className="relative flex shrink-0 items-end justify-center" style={{ width: box, height: box }}>
      <HeroSprite heroKey={heroKey} size={size} silhouette={!joined} />
      {joined && <PixelIcon name="check" size={size >= 64 ? 32 : 24} label={`${getCharacter(heroKey).name} joined`} className="absolute bottom-0 right-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />}
    </span>
  );
}

/** Distinct monster names across encounter groups, in order. */
const monsterNames = (groups: string[][]) => [...new Set(groups.flatMap((g) => encounterNames(g)))];

/** A map's details for its popover: name and subtitle, where it sits in the run, its boss, elites and monsters. */
function MapDetails({ areaId, number, total, journey, final }: { areaId: string; number: number; total: number; journey: JourneyDef; final: boolean }) {
  const area = getArea(areaId);
  const elites = monsterNames(area.elites);
  const monsters = monsterNames(area.encounters);
  return (
    <>
      <div>
        <div className="ff-display text-lg leading-tight">{area.name}</div>
        <div className="text-xs text-[#c8d0ff]">{area.subtitle}</div>
      </div>
      <div className="text-xs opacity-80">
        Map {number} of {total} · {journey.name} · Tier {area.tier}
      </div>
      <div>
        <span className={final ? "text-red-200" : "text-yellow-200"}>{final ? "Final boss" : "Boss"}:</span> {encounterNames(area.boss).join(" & ")}
      </div>
      {elites.length > 0 && (
        <div>
          <span className="text-orange-200">Elites:</span> {elites.join(", ")}
        </div>
      )}
      {monsters.length > 0 && (
        <div className="text-[#c8d0ff]">
          <span className="text-white">Monsters:</span> {monsters.slice(0, 14).join(", ")}
          {monsters.length > 14 ? ` +${monsters.length - 14} more` : ""}
        </div>
      )}
    </>
  );
}

/**
 * A run's maps as a track, like the run's round track at the bottom of the map: one node per map (its number in the
 * run, a castle on the map that ends a journey, green once that journey is cleared), each with its details on hover.
 * `start`: the run's map number before the first of these (a grouping's later journeys continue the count). `cursor`:
 * each map is a cursor stop too (not inside a card that already is one).
 */
function MapTrack({ journey, start = 0, total, cleared, cursor = false }: { journey: JourneyDef; start?: number; total: number; cleared: boolean; cursor?: boolean }) {
  return (
    <div className="inline-flex w-fit items-center rounded-full border border-white/15 bg-black/30 px-2 py-1">
      {journey.areas.map((id, i) => {
        const final = i === journey.areas.length - 1;
        const n = start + i + 1;
        return (
          <div key={id} className="flex items-center">
            {i > 0 && <span className={`h-0.5 w-3 ${cleared ? "bg-[#9cf0a0]/70" : "bg-white/25"}`} />}
            <Pop side="top" cursor={cursor} content={<MapDetails areaId={id} number={n} total={total} journey={journey} final={final} />}>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs tabular-nums ${
                  cleared
                    ? "border-[#9cf0a0]/70 bg-[#1f5a2c] text-[#d8ffd8]"
                    : final
                      ? "border-red-300/60 bg-red-900/40 text-red-100"
                      : "border-white/30 bg-black/40 text-white/80"
                }`}
              >
                {final ? <Castle size={14} /> : n}
              </span>
            </Pop>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A journey grouping (one run across several journeys) as one card: its heading (name, how many maps the run is,
 * subtitle) over its journeys as sections side by side, the window's own border above and between them, and the
 * status / Choose column down the right like a journey card's. The whole card opens the grouping's embark page.
 */
function JourneyGroupRow({ route: r, unlocked, cleared }: { route: RouteDef; unlocked: boolean; cleared: string[] }) {
  const journeys = r.journeys.map(getJourney);
  const first = journeys[0]!;
  // Three sections a row at most; longer runs (the disc challenges, The Whole Story) wrap.
  const cols = Math.min(3, journeys.length);
  const body = (
    <>
      {/* The heading, with Play at its right. */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
          <span className="ff-display text-2xl">{r.name}</span>
          <span className="text-sm text-[#c8d0ff]">
            One run · {r.areas.length} maps{r.subtitle ? ` · ${r.subtitle}` : ""}
          </span>
        </div>
        {unlocked && <PlayButton />}
      </div>
      {/* The journeys: sections side by side, reaching the card's inner edges (the footer's border and gradient). */}
      <div className="ff-panel-footer -mx-[10px] -mb-[10px] grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {journeys.map((j, i) => (
          <GroupedJourney
            key={j.id}
            journey={j}
            cleared={cleared.includes(j.id)}
            dividerLeft={i % cols !== 0}
            dividerTop={i >= cols}
            start={journeys.slice(0, i).reduce((n, x) => n + x.areas.length, 0)}
            total={r.areas.length}
          />
        ))}
      </div>
    </>
  );
  if (!unlocked) {
    const why = `Clear ${JOURNEYS.find((x) => x.id === first.unlockAfter)?.name ?? "the previous journey"} to unlock`;
    return (
      <div className={`group ff-panel relative ${GROUP_CARD}`}>
        <div className="contents [&>*]:opacity-60">{body}</div>
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <PixelIcon name="lock" size={64} label="Locked" className="translate-y-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:-translate-y-1" />
          <span className="ff-display translate-y-3 px-4 text-center text-lg text-white opacity-0 transition duration-300 [text-shadow:2px_2px_0_#000] group-hover:translate-y-0 group-hover:opacity-100">
            {why}
          </span>
        </div>
      </div>
    );
  }
  return (
    <FocusItem>
      <Link to="/story/$journey" params={{ journey: r.id }} search={{ tier: 0 }} className={`ff-panel ff-lift ${GROUP_CARD}`}>
        {body}
      </Link>
    </FocusItem>
  );
}

/** A grouping card's layout: the heading (with Play), then the journeys' sections across the full width. */
const GROUP_CARD = "flex flex-col gap-3 p-3";

/**
 * Play, on the right of a card: the run buttons' green look. The card itself is the link (a button can't sit inside
 * one), so this only shows the way in.
 */
function PlayButton() {
  return (
    <span data-on="true" className="ff-panel inline-flex shrink-0 items-center gap-2 px-6 py-2 text-xl">
      Play <PixelIcon name="arrow-right" size={20} />
    </span>
  );
}

/** One journey's section of a grouping's card: its recruit (or number), title, subtitle and route; a check once cleared. */
function GroupedJourney({
  journey: j,
  cleared,
  dividerLeft,
  dividerTop,
  start,
  total,
}: {
  journey: JourneyDef;
  cleared: boolean;
  /** The window's border on its left (not the first in its row) / on top (not in the first row). */
  dividerLeft: boolean;
  dividerTop: boolean;
  start: number;
  total: number;
}) {
  const number = journeyNumber(j);
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 p-3 ${dividerLeft ? "border-l-2 border-l-[#e8e8f4] shadow-[-2px_0_0_#0c1238,inset_2px_0_0_#0c1238]" : ""} ${dividerTop ? "border-t-2 border-t-[#e8e8f4]" : ""}`}
    >
      <div className="flex items-center gap-3">
        {j.unlocks?.length ? (
          j.unlocks.map((k) => <RecruitSprite key={k} heroKey={k} joined={cleared} size={56} />)
        ) : number ? (
          <span className="ff-display w-14 shrink-0 text-center text-4xl text-white/30 [text-shadow:3px_3px_0_#000]">{number}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="ff-display text-xl leading-tight">{number ? `${number} · ${journeyTitle(j)}` : journeyTitle(j)}</div>
          {j.unlocks?.length ? (
            <div className="text-xs text-pink-200">{`${cleared ? "Joined" : "Recruits"}: ${j.unlocks.map((k) => getCharacter(k).name).join(", ")}`}</div>
          ) : null}
        </div>
        {cleared && <PixelIcon name="check" size={24} label="Cleared" className="shrink-0" />}
      </div>
      <div className="text-sm text-[#c8d0ff]">{j.subtitle}</div>
      <MapTrack journey={j} start={start} total={total} cleared={cleared} />
    </div>
  );
}

/** A journey's number and title ("9 · Return to Alexandria" → "9", "Return to Alexandria"). */
const journeyNumber = (j: JourneyDef) => (j.name.includes(" · ") ? j.name.split(" · ")[0]! : null);
const journeyTitle = (j: JourneyDef) => (j.name.includes(" · ") ? j.name.split(" · ").slice(1).join(" · ") : j.name);

const JOURNEY_SECTIONS: { label: string; category: JourneyDef["category"] }[] = [
  { label: "The story", category: "story" },
  { label: "Side journeys", category: "echoes" },
  { label: "Hidden bosses", category: "hidden" },
  { label: "Challenges", category: "challenge" },
];

/** A journey card's layout: the hero (or number) column, the journey and its route, then the status / Choose column. */
const JOURNEY_ROW = "flex min-h-28 items-stretch gap-4 p-3 pr-0";

/**
 * A journey, or a journey grouping played as one run, as a full-width card: on the left the heroes it recruits (or its
 * number), then its name, subtitle and map track, and Play on the right. The whole card opens the embark page (with
 * the cards' lift); locked ones are plain.
 */
function JourneyCard({ route: r, unlocked, cleared: clearedIds }: { route: RouteDef; unlocked: boolean; cleared: string[] }) {
  const journeys = r.journeys.map(getJourney);
  const first = journeys[0]!;
  // A grouping's number is its journeys' range ("9–10"); its name is the grouping's.
  const numbers = journeys.map(journeyNumber).filter((n) => n != null);
  const number = !numbers.length ? null : numbers.length === 1 ? numbers[0]! : `${numbers[0]}–${numbers.at(-1)}`;
  const title = r.grouped ? r.name : journeyTitle(first);
  // Each recruit joins on their own journey's clear.
  const recruits = journeys.flatMap((j) => (j.unlocks ?? []).map((k) => ({ key: k, joined: clearedIds.includes(j.id) })));
  const done = r.journeys.filter((j) => clearedIds.includes(j)).length;
  const recruitLine = recruits.length ? (
    <span className="text-sm text-pink-200">
      {recruits.every((x) => x.joined)
        ? `Joined: ${recruits.map((x) => getCharacter(x.key).name).join(", ")}`
        : `Recruits ${recruits.map((x) => getCharacter(x.key).name).join(", ")}`}
    </span>
  ) : null;
  const body = (
    <>
      {/* The heroes it recruits, large: silhouettes until they've joined, then the green check over them (each box is
          the sprite's whole drawn cell, 3 × its 32 px art). One that recruits nobody shows its number. */}
      <div className="flex min-w-24 shrink-0 items-center justify-center">
        {recruits.length ? (
          recruits.map(({ key: k, joined }) => <RecruitSprite key={k} heroKey={k} joined={joined} size={72} />)
        ) : number ? (
          <span className="ff-display text-5xl text-white/30 [text-shadow:3px_3px_0_#000]">{number}</span>
        ) : (
          <PixelIcon name="star" size={48} className="opacity-40" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="ff-display text-2xl">{number ? `${number} · ${title}` : title}</span>
          {recruitLine}
        </div>
        <div className="text-sm text-[#c8d0ff]">{r.subtitle}</div>
        <MapTrack journey={first} total={r.areas.length} cleared={done === r.journeys.length} />
      </div>
      {/* The right-hand aside: Play (locked journeys keep the space empty). */}
      <div className="flex w-40 shrink-0 items-center justify-center pr-3">{unlocked && <PlayButton />}</div>
    </>
  );
  // Locked: the card dimmed, with a big padlock centred over it. Hovering blurs the card, raises the padlock and
  // brings in why it's locked beneath it.
  if (!unlocked) {
    const why = r.challengeRun ? "Clear every journey in it to unlock" : `Clear ${JOURNEYS.find((x) => x.id === first.unlockAfter)?.name ?? "the previous journey"} to unlock`;
    return (
      <div className={`group ff-panel relative ${JOURNEY_ROW}`}>
        {/* `contents` keeps the columns direct children of the card's row; they're dimmed one by one. */}
        <div className="contents [&>*]:opacity-60">{body}</div>
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <PixelIcon
            name="lock"
            size={64}
            label="Locked"
            className="translate-y-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] transition-transform duration-300 group-hover:-translate-y-1"
          />
          <span className="ff-display translate-y-3 px-4 text-center text-lg text-white opacity-0 transition duration-300 [text-shadow:2px_2px_0_#000] group-hover:translate-y-0 group-hover:opacity-100">
            {why}
          </span>
        </div>
      </div>
    );
  }
  return (
    <FocusItem>
      <Link to="/story/$journey" params={{ journey: r.id }} search={{ tier: 0 }} className={`ff-panel ff-lift ${JOURNEY_ROW}`}>
        {body}
      </Link>
    </FocusItem>
  );
}

const LAST_PARTY = "ffix-mock-last-party";
/** The embark page's run buttons (Begin / New / Continue run): all one size. */
const RUN_BUTTON = "px-6 py-2 text-xl";
/** The last starting relic picked ("" = none). */
const LAST_RELIC = "ffix-last-relic";

/**
 * The embark page's starting relic: the player's unlocked starter relics as tiles (or none), and the synergies the
 * chosen party has going in. `.plans/relics-and-synergies.md`.
 */
function StartingRelic({ profile, party, value, onChange }: { profile: Profile; party: string[]; value: string | null | undefined; onChange(id: string | null): void }) {
  const starters = starterRelics(profile);
  const synergies = partySynergies(party);
  const chosen = starters.find((r) => r.id === value);
  const button = (id: string | null, body: React.ReactNode) => (
    <button
      onClick={() => onChange(id)}
      className={`flex aspect-square w-full items-center justify-center rounded border-2 ${value === id ? "border-yellow-300 bg-yellow-300/10 text-yellow-200" : "border-white/20 bg-black/25 hover:bg-black/40"}`}
    >
      {body}
    </button>
  );
  // A relic tile is just its badge: its full card shows on hover / cursor (the items' popover, opening toward the
  // page). "None" is a plain cursor stop.
  const tile = (id: string | null, body: React.ReactNode) =>
    id ? (
      <RelicPopover key={id} relicId={id} side="left">
        {button(id, body)}
      </RelicPopover>
    ) : (
      <FocusItem key="none">{button(null, body)}</FocusItem>
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="ff-panel flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="ff-display text-lg">Starting relic</div>
          <Link to="/relics" className="text-xs text-[#c8d0ff] hover:underline">
            Collection
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {starters.map((r) => tile(r.id, <Badge id={r.badge ?? 1} scale={1} />))}
          {tile(null, <span className="text-xs opacity-70">None</span>)}
        </div>
        <div className="min-h-10 text-sm">
          {chosen ? (
            <>
              <div className="text-yellow-200">{chosen.name}</div>
              <div className="text-xs text-[#c8d0ff]">{chosen.effects.map(effectText).join(" · ")}</div>
            </>
          ) : (
            <div className="opacity-60">No starting relic</div>
          )}
        </div>
      </div>
      <div className="ff-panel flex flex-col gap-2 p-4">
        <div className="ff-display text-lg">Party synergies</div>
        {synergies.length ? (
          // Active ones, then the ones still short of a tier (greyed, "1/2"): what one more member would turn on.
          synergies.map(({ synergy, count }) => <SynergyChip key={synergy.id} synergy={synergy} count={count} party={party} detail side="left" className="w-full" />)
        ) : (
          <div className="text-sm opacity-60">None with this party. Characters' synergies are on their cards.</div>
        )}
      </div>
    </div>
  );
}

/**
 * The in-between page after choosing a journey: the journey and tier, four party slots, and the roster to
 * pick from (the last party is remembered). "Begin run" starts the run for real, as camp does.
 */
export function EmbarkPage({ journeyId, tier: wantedTier }: { journeyId: string; tier: number }) {
  const profile = useQuery(trpc.profile.get.queryOptions());
  const active = useQuery(trpc.run.active.queryOptions());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [party, setParty] = useState<string[] | null>(null);
  /** Asking before a start that would wipe the run in progress. */
  const [confirming, setConfirming] = useState(false);
  /** The starting relic (an unlocked starter): the last one used, else the first. Null: none. */
  const [relic, setRelic] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!profile.data || relic !== undefined) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_RELIC);
    } catch {
      /* not remembered */
    }
    const starters = starterRelics(profile.data);
    setRelic(last === "" ? null : (starters.find((r) => r.id === last) ?? starters[0])?.id ?? null);
  }, [profile.data, relic]);
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
  // Start from the last party used (still recruited), else the first four on the roster.
  useEffect(() => {
    if (!profile.data || party) return;
    let last: string[] = [];
    try {
      last = JSON.parse(localStorage.getItem(LAST_PARTY) ?? "[]") as string[];
    } catch {
      /* no saved party */
    }
    const ok = last.filter((k) => profile.data.unlocked.includes(k)).slice(0, 4);
    setParty(ok.length ? ok : profile.data.unlocked.slice(0, 4));
  }, [profile.data, party]);

  if (!profile.data || !party) return <div className="p-6">Loading…</div>;
  const p = profile.data;
  // A journey, or a journey grouping played as one run.
  const j = isRoute(journeyId) ? getRoute(journeyId) : undefined;
  if (!j || !availableRoutes(p).includes(j.id))
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="ff-panel p-5">
          That journey isn't open yet.{" "}
          <FocusItem>
            <Link to="/story" className="text-yellow-200 underline">
              Back to Story
            </Link>
          </FocusItem>
        </div>
      </div>
    );
  const tiers = journeyTiers(p, j.id);
  const tier = tiers.includes(wantedTier) ? wantedTier : tiers[tiers.length - 1]!;
  const toggle = (k: string) => setParty((cur) => (cur!.includes(k) ? cur!.filter((x) => x !== k) : cur!.length >= 4 ? cur : [...cur!, k]));
  // Like Pokelike: a run in progress never blocks starting another — starting one wipes it (after asking).
  const current = active.data ?? null;
  const currentName = current ? runName(current.state) : undefined;
  const sameJourney = !!current && (current.state.journeyGroup ?? current.state.journey) === j.id;
  const begin = (replace: boolean) => {
    try {
      localStorage.setItem(LAST_PARTY, JSON.stringify(party));
    } catch {
      /* not remembered */
    }
    try {
      localStorage.setItem(LAST_RELIC, relic ?? "");
    } catch {
      /* not remembered */
    }
    start.mutate({ party, tier, journey: j.id, replace, ...(relic && starterRelics(p).some((r) => r.id === relic) ? { relic } : {}) });
  };
  const startClicked = () => (current ? setConfirming(true) : begin(false));
  const boss = encounterNames(getArea(j.areas[j.areas.length - 1]!).boss).join(" & ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      {/* Hidden bosses and challenge runs are chosen on the Challenges page. */}
      <Breadcrumbs crumbs={[CAMP, j.category !== "story" ? { label: "Challenges", to: "/challenges" } : { label: "Story", to: "/story" }, { label: j.name }]} />
      {/* The page beside a sticky sidebar (the starting relic and the party's synergies), within the page's width. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
      <div className="ff-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="ff-title tracking-[0.25em]">EMBARK</div>
          <div className="ff-display text-3xl">{j.name}</div>
          <div className="text-sm text-[#c8d0ff]">
            {j.subtitle ? `${j.subtitle} · ` : ""}
            {j.areas.length} map{j.areas.length === 1 ? "" : "s"} · Final boss: {boss}
          </div>
          {/* Every map of the run, journey by journey (hover a map for its details). */}
          <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
            {j.journeys.map((id, i) => {
              const journey = getJourney(id);
              const start = j.journeys.slice(0, i).reduce((n, x) => n + getJourney(x).areas.length, 0);
              return (
                <div key={id} className="flex flex-col gap-1">
                  {j.grouped && <span className="text-xs text-[#c8d0ff]">{journey.name}</span>}
                  <MapTrack journey={journey} start={start} total={j.areas.length} cleared={(p.journeysCleared ?? []).includes(id)} cursor />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#c8d0ff]">Tier</span>
          {tiers.map((t) => (
            <FocusItem key={t}>
              <Link
                to="/story/$journey"
                params={{ journey: j.id }}
                search={{ tier: t }}
                replace
                className={`rounded border px-2.5 py-1 text-sm ${t === tier ? "border-yellow-300 bg-yellow-300/20 text-yellow-200" : "border-white/40 hover:bg-white/10"}`}
              >
                {tierLabel(t)}
              </Link>
            </FocusItem>
          ))}
        </div>
      </div>

      {/* The party: heading, the four slots, and the run buttons straddling the card's bottom edge (room below for them). */}
      <div className="ff-panel relative mb-7 flex flex-col gap-3 px-5 pb-12 pt-4">
        <div className="ff-display text-xl">Party</div>
        <div className="flex flex-wrap justify-center gap-3">
          {Array.from({ length: 4 }, (_, i) => {
            const k = party[i];
            return (
              <FocusItem key={i}>
                <button
                  onClick={() => k && toggle(k)}
                  title={k ? `Remove ${getCharacter(k).name}` : "Empty slot"}
                  className={`flex h-24 w-24 flex-col items-center justify-end rounded border-2 pb-1 ${k ? "border-yellow-300/70 bg-black/30 hover:bg-black/40" : "border-dashed border-white/25 bg-black/15"}`}
                >
                  {k ? (
                    <>
                      <HeroSprite heroKey={k} size={56} />
                      <span className="text-xs">{getCharacter(k).name}</span>
                    </>
                  ) : (
                    <span className="pb-6 text-xs opacity-50">Slot {i + 1}</span>
                  )}
                </button>
              </FocusItem>
            );
          })}
        </div>
        {/* At the card's bottom-right corner: the main action (Continue run, else Begin run) rightmost, New run to its
            left. One size for both. Arriving
            on the page lands on the main one: pick a party with the cursor afterwards, or just go. */}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-1/2 items-center justify-end gap-3 px-5">
          <FocusItem defaultFocus={!sameJourney}>
            <button
              onClick={startClicked}
              disabled={!party.length || start.isPending}
              data-on="true"
              className={`ff-panel ff-btn ff-lift inline-flex items-center gap-2 ${RUN_BUTTON}`}
            >
              {start.isPending ? (
                "Setting out…"
              ) : (
                <>
                  {sameJourney ? "New run" : "Begin run"} <PixelIcon name="arrow-right" size={20} />
                </>
              )}
            </button>
          </FocusItem>
          {sameJourney && (
            <FocusItem defaultFocus>
              <Link to="/run" data-on="true" className={`ff-panel ff-lift inline-flex items-center gap-2 ${RUN_BUTTON}`}>
                Continue run <PixelIcon name="arrow-right" size={20} />
              </Link>
            </FocusItem>
          )}
        </div>
      </div>

      {current && !sameJourney && (
        <div className="text-sm text-pink-200">
          Beginning this run ends your run in progress ({currentName ?? "another journey"}, map {current.state.stage + 1}).
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={sameJourney ? "Start this journey over?" : "End your current run?"}
        confirmLabel={sameJourney ? "Start over" : "End it and begin"}
        onConfirm={() => begin(true)}
      >
        Your run in <span className="text-yellow-200">{currentName ?? "progress"}</span> (map {(current?.state.stage ?? 0) + 1}, {current?.state.gil ?? 0} gil) will be
        wiped: no rewards, Completion Points or gear from it. This can't be undone.
      </ConfirmDialog>

      <div className="text-sm text-[#c8d0ff]">Pick up to four. Click a card to add or remove them.</div>
      {/* Cards share row tracks (subgrid), so names, stats, gear and footers line up across a row. */}
      <div className={`${CARD_GRID} sm:grid-cols-2 lg:grid-cols-3`}>
        {rosterEntries(p).map((e) => {
          const chosen = party.includes(e.key);
          return (
            <FocusItem key={e.key}>
              <button
                disabled={!e.unlocked}
                onClick={() => toggle(e.key)}
                data-on={chosen}
                className={`ff-panel p-3 text-left transition enabled:hover:brightness-110 ${CARD_CELL} ${e.unlocked ? "" : "opacity-60"}`}
              >
                <CharacterCard rows entry={e} party={party} footer={e.unlocked ? <div className={`text-xs ${chosen ? "text-yellow-200" : "opacity-70"}`}>{chosen ? `In the party · slot ${party.indexOf(e.key) + 1}` : "Click to add"}</div> : undefined} />
              </button>
            </FocusItem>
          );
        })}
      </div>
      </div>
      <aside className="lg:sticky lg:top-6">
        <StartingRelic profile={p} party={party} value={relic} onChange={setRelic} />
      </aside>
      </div>
    </div>
  );
}

/** A camp page's heading: the breadcrumb trail back to Camp, the title, and a line about the page. */
export function PageTitle({ crumbs, title, sub }: { crumbs: Crumb[]; title: string; sub?: string }) {
  return (
    <div>
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="ff-display text-4xl text-white [text-shadow:3px_3px_0_#000]">{title}</h1>
      {sub && <div className="max-w-3xl text-sm text-[#c8d0ff]">{sub}</div>}
    </div>
  );
}
