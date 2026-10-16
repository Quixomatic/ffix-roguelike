import { availableJourneys, ACHIEVEMENTS, JOURNEYS } from "@ffix-roguelike/game-core";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ffix-roguelike/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Package, Settings, Trophy } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";

import { canSpend, RosterLine } from "./roster";

/** Potion and Phoenix Down, for the Shops card. */
const SHOP_ICONS = [236, 240];

/**
 * Mockup of the Play hub (replaces camp's single long page): the player's currency top right with a floating stack
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
    <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-6">
      <QuickLinks gil={p.gil} cp={p.unlocked.reduce((n, k) => n + (p.builds[k]!.points ?? 0), 0)} />

      <div className="pr-14">
        <div className="ff-title tracking-[0.25em]">CAMP</div>
        <h1 className="ff-display text-4xl text-white [text-shadow:3px_3px_0_#000]">Where to next?</h1>
        <div className="text-sm text-[#c8d0ff]">
          Runs {p.stats.runs} · Wins {p.stats.wins} · Battles {p.stats.battles}
        </div>
      </div>

      {p.activeRunId && (
        <Link to="/run" className="ff-panel ff-lift flex items-center justify-between gap-4 px-5 py-3">
          <span>
            <span className="ff-display block text-xl">A run is in progress</span>
            <span className="text-sm text-[#c8d0ff]">Pick up where you left off. Party and shop changes wait until it ends.</span>
          </span>
          <span className="ff-display text-2xl text-yellow-200">Continue ▶</span>
        </Link>
      )}

      <div className="ff-panel px-4 pb-3 pt-4">
        <RosterLine profile={p} />
        <div className="mt-2 text-center text-xs text-[#c8d0ff]">
          {p.unlocked.length} of {p.unlocked.length + p.locked.length} recruited · hover for details, click to manage
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HubCard
          to="/mock/story"
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
          to="/mock/party"
          title="Party"
          art={
            <div className="flex -space-x-6">
              {p.unlocked.slice(0, 4).map((k) => (
                <HeroSprite key={k} heroKey={k} size={72} />
              ))}
            </div>
          }
          lines={[`${p.unlocked.length} recruited`, spenders.length ? <span className="text-yellow-200">★ {spenders.length} can spend CP</span> : "Train, gear and abilities"]}
          blurb="Spend Completion Points, unlock gear slots, learn abilities."
        />
        <HubCard
          to="/mock/shops"
          title="Shops"
          art={
            <div className="flex gap-2">
              {SHOP_ICONS.map((id) => (
                <ItemIcon key={id} itemId={id} size={48} />
              ))}
            </div>
          }
          lines={["Supplies · Gear catalog", `${p.gil.toLocaleString()} gil banked`]}
          blurb="Permanent supply ranks for every run, and gear for the drop pools."
          disabled={!!p.activeRunId}
        />
        <HubCard
          to="/mock/challenges"
          title="Challenges"
          art={<Trophy className="size-16 text-yellow-200 drop-shadow-[2px_2px_0_#000]" />}
          lines={[`${challengesDone} of ${challengeDefs.length} challenges done`, "Boss Gauntlet · coming soon"]}
          blurb="Solo runs, higher tiers and the gauntlet."
        />
      </div>
    </div>
  );
}

function HubCard({ to, title, art, lines, blurb, disabled }: { to: string; title: string; art: ReactNode; lines: ReactNode[]; blurb: string; disabled?: boolean }) {
  return (
    <Link to={to} className="ff-panel ff-lift group grid min-h-44 grid-cols-[1fr_auto] items-center gap-4 px-6 py-5" aria-disabled={disabled || undefined}>
      <div className="flex flex-col gap-1">
        <span className="ff-display text-3xl">{title}</span>
        {lines.map((l, i) => (
          <span key={i} className={i === 0 ? "text-base" : "text-sm text-[#c8d0ff]"}>
            {l}
          </span>
        ))}
        <span className="mt-1 text-xs opacity-70">{blurb}</span>
        {disabled && <span className="text-xs text-pink-200">During a run: look, but changes wait</span>}
      </div>
      <div className="flex items-end justify-center transition group-hover:scale-105">{art}</div>
    </Link>
  );
}

/** Currency top right, and a floating stack of round shortcuts below it. */
function QuickLinks({ gil, cp }: { gil: number; cp: number }) {
  return (
    <div className="absolute right-6 top-6 z-10 flex flex-col items-end gap-3">
      <div className="flex gap-2">
        <span className="ff-chip">{gil.toLocaleString()} gil</span>
        <span className="ff-chip">{cp} CP</span>
      </div>
      <div className="flex flex-col gap-2">
        <RoundLink to="/items" label="Items" icon={Package} />
        <RoundLink to="/achievements" label="Achievements" icon={Trophy} />
        <RoundLink to="/settings" label="Settings" icon={Settings} />
      </div>
    </div>
  );
}

function RoundLink({ to, label, icon: Icon }: { to: string; label: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Link to={to} aria-label={label} />} className="ff-panel ff-lift flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
