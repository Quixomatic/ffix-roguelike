import { availableJourneys, encounterNames, getArea, JOURNEYS, MAX_TIER, partySynergies, starterRelics, type JourneyDef, type Profile } from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge } from "@/features/hub/badge";
import { RelicPopover, SynergyChip } from "@/features/hub/relic-popover";
import { effectText } from "@/features/hub/relic-text";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

import { Breadcrumbs, CAMP, type Crumb } from "./breadcrumbs";
import { CARD_CELL, CARD_GRID, CharacterCard, rosterEntries } from "./roster";

type StoryProfile = { maxTier: number; journeysCleared?: string[] } & Parameters<typeof availableJourneys>[0];

/**
 * The tiers a journey can be played at (per journey): Tier 0 always; higher ones once that journey
 * is cleared — capped for now by the account's unlocked tier, until the rules track a tier per journey.
 */
export function journeyTiers(p: StoryProfile, journeyId: string): number[] {
  const cleared = (p.journeysCleared ?? []).includes(journeyId);
  const top = cleared ? Math.min(MAX_TIER, p.maxTier) : 0;
  return Array.from({ length: top + 1 }, (_, i) => i);
}

const tierLabel = (t: number) => (t === 0 ? "Normal" : `Tier ${t}`);

/**
 * The highest tier a journey has been cleared on, or null if it hasn't been. The rules don't track a tier per journey
 * yet (only that it was cleared), so a cleared journey reads as Normal until they do.
 */
export function bestTierCleared(p: StoryProfile, journeyId: string): number | null {
  return (p.journeysCleared ?? []).includes(journeyId) ? 0 : null;
}

/** The Story page: every journey as a card (its highest tier cleared); choose one to pick a party and tier for it. */
export function StoryPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (!profile.data) return <div className="p-6">Loading…</div>;
  const p = profile.data;
  const open = availableJourneys(p);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      <PageTitle crumbs={[CAMP, { label: "Story" }]} title="Journeys" sub="Each journey is a campaign of overworld maps ending in a boss. Clear one to recruit its hero and open the next — and its higher tiers." />
      {/* Full-width cards, one journey per row, in sections: the story in order, then the side journeys. */}
      {JOURNEY_SECTIONS.map(({ label, category }) => {
        const list = JOURNEYS.filter((j) => j.category === category);
        if (!list.length) return null;
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="ff-display text-xl text-[#c8d0ff]">{label}</h2>
            {list.map((j) => (
              <JourneyCard key={j.id} journey={j} unlocked={open.includes(j.id)} best={bestTierCleared(p, j.id)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

const JOURNEY_SECTIONS: { label: string; category: JourneyDef["category"] }[] = [
  { label: "The story", category: "story" },
  { label: "Side journeys", category: "echoes" },
  { label: "Challenges", category: "challenge" },
];

/** A journey card's layout: the hero (or number) column, the journey and its route, then the status / Choose column. */
const JOURNEY_ROW = "flex min-h-28 items-stretch gap-4 p-3 pr-0";

/**
 * A journey as a full-width card: on the left the hero it recruits (or the journey's number), then its name, subtitle
 * and route (each map with its boss), and on the right its highest tier cleared and Choose. The whole card opens the
 * embark page (with the cards' lift); locked ones are plain.
 */
function JourneyCard({ journey: j, unlocked, best }: { journey: JourneyDef; unlocked: boolean; best: number | null }) {
  const cleared = best != null;
  const number = j.name.includes(" · ") ? j.name.split(" · ")[0] : null;
  const title = j.name.includes(" · ") ? j.name.split(" · ").slice(1).join(" · ") : j.name;
  const body = (
    <>
      {/* The hero this journey recruits, large: a silhouette until they've joined, then the green check over them (the
          box is the sprite's whole drawn cell, 3 × its 32 px art). A journey that recruits nobody shows its number. */}
      <div className="flex w-24 shrink-0 items-center justify-center">
        {j.unlocks?.length ? (
          j.unlocks.map((k) => (
            <span key={k} className="relative flex h-24 w-24 shrink-0 items-end justify-center">
              <HeroSprite heroKey={k} size={72} silhouette={!cleared} />
              {cleared && <PixelIcon name="check" size={32} label={`${getCharacter(k).name} joined`} className="absolute bottom-0 right-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />}
            </span>
          ))
        ) : number ? (
          <span className="ff-display text-5xl text-white/30 [text-shadow:3px_3px_0_#000]">{number}</span>
        ) : (
          <PixelIcon name="star" size={48} className="opacity-40" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="ff-display text-2xl">{unlocked ? (number ? `${number} · ${title}` : title) : "???"}</span>
          {j.unlocks?.length ? (
            <span className="text-sm text-pink-200">{cleared ? `Joined: ${j.unlocks.map((k) => getCharacter(k).name).join(", ")}` : unlocked ? `Recruits ${j.unlocks.map((k) => getCharacter(k).name).join(", ")}` : "Recruits ???"}</span>
          ) : null}
        </div>
        <div className="text-sm text-[#c8d0ff]">{unlocked ? j.subtitle : `Unlock: clear ${JOURNEYS.find((x) => x.id === j.unlockAfter)?.name ?? "the previous journey"}`}</div>
        {/* The route: each map with the boss at its end; the last one's is the journey's final boss. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          {j.areas.map((id, i) => {
            const area = getArea(id);
            const last = i === j.areas.length - 1;
            return (
              <span key={id} className="inline-flex items-center gap-1.5">
                {i > 0 && <PixelIcon name="arrow-right" size={16} className="opacity-50" />}
                <span className={`rounded border px-2 py-0.5 ${last ? "border-red-300/40 bg-red-900/20" : "border-white/15 bg-black/20"}`}>
                  {unlocked ? area.name : "???"}
                  <span className={last ? "text-red-200" : "text-white/60"}> · {unlocked ? encounterNames(area.boss).join(" & ") : "???"}</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {/* The status column: the window's footer turned on its side (.ff-panel-side: its border down the left, its gradient
          starting over), reaching the card's inner edges. Locked journeys keep the space empty. */}
      <div data-on={unlocked} className={`-my-[10px] mr-[2px] flex w-44 shrink-0 flex-col items-end justify-center gap-1 px-4 text-right ${unlocked ? "ff-panel-side" : ""}`}>
        {unlocked && (
          <>
            <span className="text-sm">
              {cleared ? (
                <>
                  Cleared: <span className="text-yellow-200">{tierLabel(best)}</span>
                </>
              ) : (
                <span className="opacity-60">Not cleared yet</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 text-lg text-yellow-200">
              Choose <PixelIcon name="arrow-right" />
            </span>
          </>
        )}
      </div>
    </>
  );
  // Locked: the card dimmed, with a big padlock centred over it. Hovering blurs the card, raises the padlock and
  // brings in why it's locked beneath it.
  if (!unlocked) {
    const why = `Clear ${JOURNEYS.find((x) => x.id === j.unlockAfter)?.name ?? "the previous journey"} to unlock`;
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
      <Link to="/story/$journey" params={{ journey: j.id }} search={{ tier: 0 }} className={`ff-panel ff-lift ${JOURNEY_ROW}`}>
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
  const j = JOURNEYS.find((x) => x.id === journeyId);
  if (!j || !availableJourneys(p).includes(j.id))
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
  const currentJourney = current ? JOURNEYS.find((x) => x.id === current.state.journey) : undefined;
  const sameJourney = current?.state.journey === j.id;
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
      <Breadcrumbs crumbs={[CAMP, { label: "Story", to: "/story" }, { label: j.name }]} />
      {/* The page beside a sticky sidebar (the starting relic and the party's synergies), within the page's width. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
      <div className="ff-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div>
          <div className="ff-title tracking-[0.25em]">EMBARK</div>
          <div className="ff-display text-3xl">{j.name}</div>
          <div className="text-sm text-[#c8d0ff]">
            {j.subtitle} · {j.areas.length} map{j.areas.length === 1 ? "" : "s"} · Final boss: {boss}
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
          Beginning this run ends your run in progress ({currentJourney?.name ?? "another journey"}, map {current.state.stage + 1}).
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={sameJourney ? "Start this journey over?" : "End your current run?"}
        confirmLabel={sameJourney ? "Start over" : "End it and begin"}
        onConfirm={() => begin(true)}
      >
        Your run in <span className="text-yellow-200">{currentJourney?.name ?? "progress"}</span> (map {(current?.state.stage ?? 0) + 1}, {current?.state.gil ?? 0} gil) will be
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
