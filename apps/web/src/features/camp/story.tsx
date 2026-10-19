import { activeSynergies, availableJourneys, encounterNames, getArea, JOURNEYS, MAX_TIER, starterRelics, type JourneyDef, type Profile } from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge } from "@/features/hub/badge";
import { RelicPopover, SynergyPopover } from "@/features/hub/relic-popover";
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
      {/* Cards line up row by row: each spans four rows of this grid (JOURNEY_CELL) and lays its lines into them (subgrid). */}
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
        {JOURNEYS.map((j) => (
          <JourneyCard key={j.id} journey={j} unlocked={open.includes(j.id)} best={bestTierCleared(p, j.id)} />
        ))}
      </div>
    </div>
  );
}

/**
 * A journey card's four rows — title + subtitle, maps + boss, the hero it recruits, footer — shared across a row of cards
 * (CSS subgrid), so matching lines sit at the same height in every card however long each one's text is.
 */
const JOURNEY_CELL = "row-span-4 mb-1 grid grid-rows-subgrid gap-y-3 p-4";

/** A journey as a card: the whole card opens the embark page (with the cards' lift); locked ones are plain. */
function JourneyCard({ journey: j, unlocked, best }: { journey: JourneyDef; unlocked: boolean; best: number | null }) {
  const boss = encounterNames(getArea(j.areas[j.areas.length - 1]!).boss).join(" & ");
  const cleared = best != null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="ff-display text-2xl">{unlocked ? j.name : "???"}</div>
          <div className="text-sm text-[#c8d0ff]">{unlocked ? j.subtitle : `Unlock: clear ${JOURNEYS.find((x) => x.id === j.unlockAfter)?.name ?? "the previous journey"}`}</div>
        </div>
        {cleared ? (
          <span className="ff-chip shrink-0 gap-1 px-2 py-0 text-xs">
            <PixelIcon name="check" />
            Cleared
          </span>
        ) : (
          !unlocked && <PixelIcon name="lock" size={32} label="Locked" className="shrink-0 opacity-90" />
        )}
      </div>
      <div className="text-sm">
        {j.areas.length} map{j.areas.length === 1 ? "" : "s"} · Final boss: {unlocked ? boss : "???"}
      </div>
      {/* Every card keeps the recruit row (empty when it recruits nobody), so the footers line up. */}
      {!j.unlocks?.length ? (
        <div />
      ) : (
        <div className="flex items-center gap-3">
          {j.unlocks.map((k) => (
            // The hero this journey recruits, large; a silhouette until they've joined, then the green check over them.
            // The box is the sprite's whole drawn cell (3 × its 32 px art), so nothing spills out of it.
            <span key={k} className="relative flex h-24 w-24 shrink-0 items-end justify-center">
              <HeroSprite heroKey={k} size={72} silhouette={!cleared} />
              {cleared && <PixelIcon name="check" size={32} label={`${getCharacter(k).name} joined`} className="absolute bottom-0 right-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />}
            </span>
          ))}
          <span className="text-sm text-pink-200">{cleared ? `Joined: ${j.unlocks.map((k) => getCharacter(k).name).join(", ")}` : unlocked ? "Clear to recruit" : "???"}</span>
        </div>
      )}
      {/* The footer is its own section of the card: the window's border across it, its gradient starting over. Locked
          journeys have none (their last row stays empty, so the subgrid rows still line up). */}
      {unlocked ? (
        <div className="ff-panel-footer -mx-[14px] -mb-[14px] mt-1 flex items-center gap-2 px-4 py-2.5">
          <span className="flex-1 text-sm">
            {cleared ? (
              <>
                Highest tier cleared: <span className="text-yellow-200">{tierLabel(best)}</span>
              </>
            ) : (
              <span className="opacity-60">Not cleared yet</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-lg text-yellow-200">
            Choose <PixelIcon name="arrow-right" />
          </span>
        </div>
      ) : (
        <div />
      )}
    </>
  );
  if (!unlocked) return <div className={`ff-panel opacity-75 ${JOURNEY_CELL}`}>{body}</div>;
  return (
    <FocusItem>
      <Link to="/story/$journey" params={{ journey: j.id }} search={{ tier: 0 }} className={`ff-panel ff-lift ${JOURNEY_CELL}`}>
        {body}
      </Link>
    </FocusItem>
  );
}

const LAST_PARTY = "ffix-mock-last-party";
/** The last starting relic picked ("" = none). */
const LAST_RELIC = "ffix-last-relic";

/**
 * The embark page's starting relic: the player's unlocked starter relics as tiles (or none), and the synergies the
 * chosen party has going in. `.plans/relics-and-synergies.md`.
 */
function StartingRelic({ profile, party, value, onChange }: { profile: Profile; party: string[]; value: string | null | undefined; onChange(id: string | null): void }) {
  const starters = starterRelics(profile);
  const synergies = activeSynergies(party);
  const button = (id: string | null, body: React.ReactNode) => (
    <button
      onClick={() => onChange(id)}
      className={`flex w-28 flex-col items-center gap-1 rounded border-2 p-1.5 text-center text-xs ${value === id ? "border-yellow-300 bg-yellow-300/10 text-yellow-200" : "border-white/20 bg-black/25 hover:bg-black/40"}`}
    >
      {body}
    </button>
  );
  // A relic tile shows its full card on hover / cursor (the items' popover); "None" is a plain cursor stop.
  const tile = (id: string | null, body: React.ReactNode) =>
    id ? (
      <RelicPopover key={id} relicId={id} side="top">
        {button(id, body)}
      </RelicPopover>
    ) : (
      <FocusItem key="none">{button(null, body)}</FocusItem>
    );
  return (
    <div className="ff-panel flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="ff-display text-xl">Starting relic</div>
        <Link to="/relics" className="text-sm text-[#c8d0ff] hover:underline">
          Your collection
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {starters.map((r) =>
          tile(
            r.id,
            <>
              <Badge id={r.badge ?? 1} scale={1} />
              <span className="leading-tight">{r.name}</span>
            </>,
          ),
        )}
        {tile(null, <span className="flex h-10 items-center opacity-70">None</span>)}
      </div>
      {value && <div className="text-sm text-[#c8d0ff]">{starters.find((r) => r.id === value)?.effects.map(effectText).join(" · ")}</div>}
      <div className="text-sm">
        <span className="opacity-80">Party synergies: </span>
        {synergies.length ? (
          synergies.map(({ synergy, count, tier }) => (
            <SynergyPopover key={synergy.id} synergyId={synergy.id} count={count} party={party} side="top">
              <span className="mr-2 inline-block cursor-help rounded bg-sky-900/50 px-1.5 py-0.5 text-xs text-sky-100">
                {synergy.name} {count}: {tier.text}
              </span>
            </SynergyPopover>
          ))
        ) : (
          <span className="opacity-60">none with this party</span>
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

      <div className="ff-panel flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="ff-display mr-2 text-xl">Party</div>
        <div className="flex flex-1 flex-wrap gap-3">
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
        <div className="flex flex-col items-end gap-2">
          {sameJourney && (
            <FocusItem>
              <Link to="/run" className="ff-panel ff-lift inline-flex items-center gap-2 px-8 py-3 text-2xl">
                Continue run <PixelIcon name="arrow-right" size={32} />
              </Link>
            </FocusItem>
          )}
          {/* Arriving on the page lands here: pick a party with the cursor afterwards, or just go. */}
          <FocusItem defaultFocus>
            <button
              onClick={startClicked}
              disabled={!party.length || start.isPending}
              className={`ff-panel ff-lift inline-flex items-center gap-2 disabled:pointer-events-none disabled:opacity-50 ${sameJourney ? "px-5 py-1.5 text-lg" : "px-8 py-3 text-2xl"}`}
            >
              {start.isPending ? (
                "Setting out…"
              ) : (
                <>
                  {sameJourney ? "New run" : "Begin run"} <PixelIcon name="arrow-right" size={sameJourney ? 16 : 32} />
                </>
              )}
            </button>
          </FocusItem>
        </div>
      </div>

      <StartingRelic profile={p} party={party} value={relic} onChange={setRelic} />
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
      <div className={`${CARD_GRID} sm:grid-cols-2 lg:grid-cols-4`}>
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
