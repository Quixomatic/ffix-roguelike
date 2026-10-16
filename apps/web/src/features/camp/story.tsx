import { availableJourneys, encounterNames, getArea, JOURNEYS, MAX_TIER, type JourneyDef } from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PixelIcon } from "@/components/pixel-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

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
      <PageTitle kicker="STORY" title="Journeys" sub="Each journey is a campaign of overworld maps ending in a boss. Clear one to recruit its hero and open the next — and its higher tiers." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {JOURNEYS.map((j) => (
          <JourneyCard key={j.id} journey={j} unlocked={open.includes(j.id)} best={bestTierCleared(p, j.id)} />
        ))}
      </div>
    </div>
  );
}

function JourneyCard({ journey: j, unlocked, best }: { journey: JourneyDef; unlocked: boolean; best: number | null }) {
  const navigate = useNavigate();
  const boss = encounterNames(getArea(j.areas[j.areas.length - 1]!).boss).join(" & ");
  const cleared = best != null;
  return (
    <div className={`ff-panel flex flex-col gap-3 p-4 ${unlocked ? "" : "opacity-75"}`}>
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
      {!!j.unlocks?.length && (
        <div className="flex items-end gap-2">
          {j.unlocks.map((k) => (
            <HeroSprite key={k} heroKey={k} size={40} silhouette={!cleared} />
          ))}
          <span className="pb-1 text-xs text-pink-200">{cleared ? `Joined: ${j.unlocks.map((k) => getCharacter(k).name).join(", ")}` : unlocked ? "Clear to recruit" : "???"}</span>
        </div>
      )}
      <div className="mt-auto flex items-center gap-2">
        <span className="flex-1 text-sm">
          {cleared ? (
            <>
              Highest tier cleared: <span className="text-yellow-200">{tierLabel(best)}</span>
            </>
          ) : (
            <span className="opacity-60">{unlocked ? "Not cleared yet" : ""}</span>
          )}
        </span>
        <FocusItem>
          <button
            disabled={!unlocked}
            onClick={() => navigate({ to: "/story/$journey", params: { journey: j.id }, search: { tier: 0 } })}
            className="ff-panel ff-lift inline-flex items-center gap-1.5 px-4 py-1.5 text-lg disabled:pointer-events-none disabled:opacity-50"
          >
            Choose <PixelIcon name="arrow-right" />
          </button>
        </FocusItem>
      </div>
    </div>
  );
}

const LAST_PARTY = "ffix-mock-last-party";

/**
 * The in-between page after choosing a journey: the journey and tier, four party slots, and the roster to
 * pick from (the last party is remembered). "Begin run" starts the run for real, as camp does.
 */
export function EmbarkPage({ journeyId, tier: wantedTier }: { journeyId: string; tier: number }) {
  const profile = useQuery(trpc.profile.get.queryOptions());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [party, setParty] = useState<string[] | null>(null);
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
  const begin = () => {
    try {
      localStorage.setItem(LAST_PARTY, JSON.stringify(party));
    } catch {
      /* not remembered */
    }
    start.mutate({ party, tier, journey: j.id });
  };
  const boss = encounterNames(getArea(j.areas[j.areas.length - 1]!).boss).join(" & ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      <FocusItem>
        <Link to="/story" data-sound="cancel" className="inline-flex items-center gap-1 self-start text-sm text-[#c8d0ff] hover:text-white">
          <PixelIcon name="arrow-left" /> Journeys
        </Link>
      </FocusItem>
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
        <FocusItem>
          <button onClick={begin} disabled={!party.length || start.isPending || !!p.activeRunId} className="ff-panel ff-lift inline-flex items-center gap-2 px-8 py-3 text-2xl disabled:pointer-events-none disabled:opacity-50">
            {start.isPending ? (
              "Setting out…"
            ) : (
              <>
                Begin run <PixelIcon name="arrow-right" size={32} />
              </>
            )}
          </button>
        </FocusItem>
      </div>
      {p.activeRunId && (
        <div className="text-sm text-pink-200">
          A run is already in progress —{" "}
          <FocusItem>
            <Link to="/run" className="underline">
              continue it
            </Link>
          </FocusItem>{" "}
          first.
        </div>
      )}

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
                <CharacterCard rows entry={e} footer={e.unlocked ? <div className={`text-xs ${chosen ? "text-yellow-200" : "opacity-70"}`}>{chosen ? `In the party · slot ${party.indexOf(e.key) + 1}` : "Click to add"}</div> : undefined} />
              </button>
            </FocusItem>
          );
        })}
      </div>
    </div>
  );
}

export function PageTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div>
      <div className="ff-title tracking-[0.25em]">{kicker}</div>
      <h1 className="ff-display text-4xl text-white [text-shadow:3px_3px_0_#000]">{title}</h1>
      {sub && <div className="max-w-3xl text-sm text-[#c8d0ff]">{sub}</div>}
    </div>
  );
}
