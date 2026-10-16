import { availableJourneys, ACHIEVEMENTS, gearCatalog, JOURNEYS } from "@ffix-roguelike/game-core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { PixelIcon } from "@/components/pixel-icon";
import { FocusItem } from "@/features/input/focus";
import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";

import { canSpend, RosterLine } from "./roster";

/** Potion and Phoenix Down for the Supplies card; Mage Masher and Leather Hat for the Gear card. */
const SUPPLY_ICONS = [236, 240];
const GEAR_ICONS = [2, 112];

/**
 * The Play hub (replaces camp's single long page): the player's currency top right with a floating stack
 * of quick links, a "continue" banner during a run, the cast in a line (hover for a card, click to manage), and
 * four big cards — Story, Party, Shops, Challenges.
 */
export function PlayHub() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (!profile.data) return <div className="p-6">Loading…</div>;
  const p = profile.data;
  const open = availableJourneys(p);
  const cleared = p.journeysCleared ?? [];
  const next = JOURNEYS.find((j) => open.includes(j.id) && !cleared.includes(j.id)) ?? JOURNEYS.find((j) => j.id === open[open.length - 1]);
  const spenders = p.unlocked.filter((k) => canSpend(p.builds[k]!));
  const challengeDefs = ACHIEVEMENTS.filter((a) => a.category === "challenge");
  const challengesDone = challengeDefs.filter((a) => (p.achievements ?? []).includes(a.id)).length;

  return (
    <>
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-6">
      <div className="pr-14">
        <div className="ff-title tracking-[0.25em]">CAMP</div>
        <h1 className="ff-display text-4xl text-white [text-shadow:3px_3px_0_#000]">Where to next?</h1>
        <div className="text-sm text-[#c8d0ff]">
          Runs {p.stats.runs} · Wins {p.stats.wins} · Battles {p.stats.battles}
        </div>
      </div>

      {p.activeRunId && (
        <FocusItem>
        <Link to="/run" className="ff-panel ff-lift flex items-center justify-between gap-4 px-5 py-3">
          <span>
            <span className="ff-display block text-xl">A run is in progress</span>
            <span className="text-sm text-[#c8d0ff]">Pick up where you left off. Party and shop changes wait until it ends.</span>
          </span>
          <span className="ff-display inline-flex items-center gap-2 text-2xl text-yellow-200">
            Continue <PixelIcon name="arrow-right" size={32} />
          </span>
        </Link>
        </FocusItem>
      )}

      <div className="ff-panel px-4 pb-3 pt-4">
        <RosterLine profile={p} />
        <div className="mt-2 text-center text-xs text-[#c8d0ff]">
          {p.unlocked.length} of {p.unlocked.length + p.locked.length} recruited · hover for details, click to manage
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HubCard
          to="/story"
          title="Story"
          art={<HeroSprite heroKey="zidane" size={88} anim="walk" />}
          lines={[
            next ? (
              <>
                Next: <span className="text-yellow-200">{next.name}</span>
              </>
            ) : (
              "Every journey cleared"
            ),
            `${cleared.length} of ${JOURNEYS.length} journeys cleared`,
          ]}
          blurb="Follow FF9's story as roguelite journeys. Each clear recruits someone new."
        />
        <HubCard
          to="/party"
          title="Party"
          art={
            <div className="flex -space-x-6">
              {p.unlocked.slice(0, 4).map((k) => (
                <HeroSprite key={k} heroKey={k} size={72} />
              ))}
            </div>
          }
          lines={[`${p.unlocked.length} recruited`, spenders.length ? (
              <span className="inline-flex items-center gap-1 text-yellow-200">
                <PixelIcon name="star" /> {spenders.length} can spend CP
              </span>
            ) : (
              "Train, gear and abilities"
            )]}
          blurb="Spend Completion Points, unlock gear slots, learn abilities."
        />
        {/* Shops: two half-size cards in one slot — each shop is its own page. */}
        <div className="grid grid-cols-2 gap-4">
          <HubCard
            compact
            to="/shops/supplies"
            title="Supplies"
            art={<ShopIcons ids={SUPPLY_ICONS} />}
            lines={["Starting-kit ranks", `${p.gil.toLocaleString()} gil banked`]}
            blurb="More of each item in every run."
            disabled={!!p.activeRunId}
          />
          <HubCard
            compact
            to="/shops/gear"
            title="Gear"
            art={<ShopIcons ids={GEAR_ICONS} />}
            lines={[`${gearCatalog(p).length} to unlock`, `${(p.gearUnlocked ?? []).length} unlocked`]}
            blurb="Add gear to the drop pools."
            disabled={!!p.activeRunId}
          />
        </div>
        <HubCard
          to="/challenges"
          title="Challenges"
          art={<Trophy className="size-16 text-yellow-200 drop-shadow-[2px_2px_0_#000]" />}
          lines={[`${challengesDone} of ${challengeDefs.length} challenges done`, "Boss Gauntlet · coming soon"]}
          blurb="Solo runs, higher tiers and the gauntlet."
        />
      </div>
    </div>
    </>
  );
}

/** A big hub card; `compact` is the half-width version (two share one slot), with the art above the text. */
function HubCard({ to, title, art, lines, blurb, disabled, compact }: { to: string; title: string; art: ReactNode; lines: ReactNode[]; blurb: string; disabled?: boolean; compact?: boolean }) {
  return (
    <FocusItem>
    <Link
      to={to}
      className={`ff-panel ff-lift group grid min-h-44 items-center gap-4 ${compact ? "grid-rows-[auto_1fr] px-4 py-4" : "grid-cols-[1fr_auto] px-6 py-5"}`}
    >
      <div className={`flex flex-col gap-1 ${compact ? "row-start-2 self-start" : ""}`}>
        <span className={`ff-display ${compact ? "text-2xl" : "text-3xl"}`}>{title}</span>
        {lines.map((l, i) => (
          <span key={i} className={i === 0 ? "text-base" : "text-sm text-[#c8d0ff]"}>
            {l}
          </span>
        ))}
        <span className="mt-1 text-xs opacity-70">{blurb}</span>
        {disabled && <span className="text-xs text-pink-200">During a run: look, but changes wait</span>}
      </div>
      <div className={`flex items-end transition group-hover:scale-105 ${compact ? "row-start-1 justify-start" : "justify-center"}`}>{art}</div>
    </Link>
    </FocusItem>
  );
}

function ShopIcons({ ids }: { ids: number[] }) {
  return (
    <div className="flex gap-2">
      {ids.map((id) => (
        <ItemIcon key={id} itemId={id} size={40} />
      ))}
    </div>
  );
}

