import { ACHIEVEMENTS } from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { PixelIcon } from "@/components/pixel-icon";
import { ShopContents } from "@/features/hub/camp-shop";
import { CharacterSheet } from "@/features/hub/character-sheet";
import { trpc } from "@/utils/trpc";
import { FocusItem, stableFocusKey } from "@/features/input/focus";

import { GearCatalogGrid } from "./gear-catalog";
import { CARD_CELL, CARD_GRID, CharacterCard, rosterEntries } from "./roster";
import { Breadcrumbs, CAMP } from "./breadcrumbs";
import { PageTitle } from "./story";

/** The Party page: the whole roster as cards; recruited ones open their own page. */
export function PartyPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (!profile.data) return <div className="p-6">Loading…</div>;
  const p = profile.data;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      <PageTitle crumbs={[CAMP, { label: "Party" }]} title="Roster" sub="Spend Completion Points on start levels, training and gear slots; equip support abilities; see what each character has mastered." />
      {/* Cards share row tracks (subgrid), so names, stats, gear and footers line up across a row. */}
      <div className={`${CARD_GRID} sm:grid-cols-2 lg:grid-cols-4`}>
        {rosterEntries(p).map((e) =>
          e.unlocked ? (
            <FocusItem key={e.key}>
              <Link to="/party/$character" params={{ character: e.key }} className={`ff-panel ff-lift p-3 ${CARD_CELL}`}>
                <CharacterCard
                  rows
                  entry={e}
                  footer={
                    <div className="inline-flex items-center gap-1 text-xs text-yellow-200/80">
                      Manage <PixelIcon name="arrow-right" />
                    </div>
                  }
                />
              </Link>
            </FocusItem>
          ) : (
            <div key={e.key} className={`ff-panel p-3 opacity-60 ${CARD_CELL}`}>
              <CharacterCard rows entry={e} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** A character's own page (/party/:character): the camp character sheet as a page, not a dialog. */
export function CharacterPage({ characterKey }: { characterKey: string }) {
  const profile = useQuery(trpc.profile.get.queryOptions());
  const navigate = useNavigate();
  if (!profile.data) return <div className="p-6">Loading…</div>;
  const build = profile.data.builds[characterKey];
  if (!build || !profile.data.unlocked.includes(characterKey))
    return (
      <div className="mx-auto max-w-xl p-8">
        <div className="ff-panel p-5">
          {characterKey in profile.data.builds ? `${getCharacter(characterKey).name} hasn't joined yet.` : "No such character."}{" "}
          <FocusItem>
            <Link to="/party" className="text-yellow-200 underline">
              Back to the roster
            </Link>
          </FocusItem>
        </div>
      </div>
    );
  return (
    // The same centred column as the other hub pages, the window filling the height between (the backdrop shows around it).
    // (The shell's menu button takes 2.5rem above every page.)
    <div className="mx-auto flex h-[calc(100svh-2.5rem)] max-w-6xl flex-col gap-2 px-6 pb-6 pt-6">
      <Breadcrumbs crumbs={[CAMP, { label: "Party", to: "/party" }, { label: getCharacter(characterKey).name }]} />
      <div className="min-h-0 flex-1">
        <CharacterSheet
          key={characterKey}
          inline
          build={build}
          onClose={() => navigate({ to: "/party" })}
          // Keep the cursor where it was (the chevron) on the next character's page.
          onSwitch={(k) => navigate({ to: "/party/$character", params: { character: k }, search: { focus: stableFocusKey() } as never, replace: true })}
        />
      </div>
    </div>
  );
}

/** A camp shop's own page: Supplies (/shops/supplies) or the gear catalog (/shops/gear). */
export function ShopPage({ shop }: { shop: "supplies" | "gear" }) {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (!profile.data) return <div className="p-6">Loading…</div>;
  const p = profile.data;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      <div className="flex items-end justify-between gap-4">
        <PageTitle crumbs={[CAMP, { label: shop === "supplies" ? "Supplies" : "Gear catalog" }]} title={shop === "supplies" ? "Supplies" : "Gear catalog"} />
        <span className="ff-chip text-lg">{p.gil.toLocaleString()} gil</span>
      </div>
      <div className="ff-panel p-4 text-sm">{shop === "supplies" ? <ShopContents shop="supplies" profile={p} /> : <GearCatalogGrid profile={p} />}</div>
    </div>
  );
}

/** The Challenges page: the challenge achievements as goals, and the modes still to come. */
export function ChallengesPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (!profile.data) return <div className="p-6">Loading…</div>;
  const done = new Set(profile.data.achievements ?? []);
  const challenges = ACHIEVEMENTS.filter((a) => a.category === "challenge");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pb-10 pt-6">
      <PageTitle crumbs={[CAMP, { label: "Challenges" }]} title="Challenges" sub="Harder ways to play, and what they pay." />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { title: "Boss Gauntlet", text: "Every story boss back to back, no maps in between." },
          { title: "Solo runs", text: "Clear a late-game journey with one character." },
          { title: "Higher tiers", text: "Tougher monsters and better loot, per journey." },
        ].map((m) => (
          <div key={m.title} className="ff-panel flex flex-col gap-1 p-4">
            <span className="ff-display text-xl">{m.title}</span>
            <span className="text-sm text-[#c8d0ff]">{m.text}</span>
            <span className="mt-2 text-xs text-pink-200">Coming soon</span>
          </div>
        ))}
      </div>
      <div className="ff-title px-1 text-base">Challenge goals</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {challenges.map((a) => (
          <div key={a.id} className={`ff-panel flex flex-col gap-0.5 p-3 ${done.has(a.id) ? "" : "opacity-80"}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base">{a.name}</span>
              {done.has(a.id) && <PixelIcon name="check" label="Done" />}
            </div>
            <span className="text-xs text-[#c8d0ff]">{a.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
