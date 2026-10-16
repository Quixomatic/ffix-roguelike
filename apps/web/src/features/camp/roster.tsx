import { deriveStats, nextSlotCost, starterGear, startLevelCost, type CharacterBuild } from "@ffix-roguelike/game-core";
import { characters, getCharacter, MAIN_CAST } from "@ffix-roguelike/game-data";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ffix-roguelike/ui/components/hover-card";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { itemName } from "@/features/run/item-info";
import { HeroSprite } from "@/features/sprites/hero-sprite";

/** What the roster needs from `profile.get`. */
export interface RosterProfile {
  unlocked: string[];
  locked: { key: string; hint: string }[];
  builds: Record<string, CharacterBuild>;
}

export type RosterEntry = { key: string; build: CharacterBuild; unlocked: true } | { key: string; hint: string; unlocked: false };

/** Everyone on the roster, recruited or not, in FF9's order: the main cast first, then the others. */
export function rosterEntries(p: RosterProfile): RosterEntry[] {
  const order = [...MAIN_CAST, ...characters.map((c) => c.key).filter((k) => !(MAIN_CAST as readonly string[]).includes(k))];
  const rank = (k: string) => (order.indexOf(k) < 0 ? 99 : order.indexOf(k));
  const entries: RosterEntry[] = [
    ...p.unlocked.map((key) => ({ key, build: p.builds[key]!, unlocked: true as const })),
    ...p.locked.map((l) => ({ key: l.key, hint: l.hint, unlocked: false as const })),
  ];
  return entries.sort((a, b) => rank(a.key) - rank(b.key));
}

/** Something to spend: CP covers the next start level or the next gear slot. */
export function canSpend(b: CharacterBuild): boolean {
  const cp = b.points ?? 0;
  return cp >= startLevelCost(b.level) || cp >= (nextSlotCost(b) ?? Infinity);
}

/**
 * The cast in a line, like the title screen's parade: recruited characters hop and open their page on click; the
 * rest are silhouettes. Hovering anyone shows their card (`CharacterCard`) in a popover.
 */
export function RosterLine({ profile, size = 64 }: { profile: RosterProfile; size?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-1 sm:gap-3">
      {rosterEntries(profile).map((e, i) => (
        <HoverCard key={e.key}>
          <HoverCardTrigger
            delay={150}
            closeDelay={50}
            render={
              e.unlocked ? (
                <Link to="/party/$character" params={{ character: e.key }} aria-label={getCharacter(e.key).name} />
              ) : (
                <span role="img" aria-label="Locked character" />
              )
            }
            className="group relative flex flex-col items-center rounded px-1 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={e.unlocked ? "ff-hop transition group-hover:-translate-y-1" : "opacity-80"}
              style={e.unlocked ? { animationDelay: `${i * 120}ms`, animationIterationCount: "infinite", animationDuration: "1.6s" } : undefined}
            >
              <HeroSprite heroKey={e.key} size={size} silhouette={!e.unlocked} />
            </span>
            {e.unlocked && canSpend(e.build) && <span className="absolute -top-1 right-0 text-sm text-yellow-200 [text-shadow:1px_1px_0_#000]">★</span>}
          </HoverCardTrigger>
          <HoverCardContent side="bottom" sideOffset={6} className="theme-ff ff-panel w-72 rounded-md p-3 text-sm">
            <CharacterCard entry={e} />
          </HoverCardContent>
        </HoverCard>
      ))}
    </div>
  );
}

/** A character at a glance: how they start a run, or how to recruit them. */
export function CharacterCard({ entry: e, footer }: { entry: RosterEntry; footer?: ReactNode }) {
  if (!e.unlocked)
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-3">
          <HeroSprite heroKey={e.key} size={48} silhouette />
          <div>
            <div className="ff-display text-lg">???</div>
            <div className="ff-title">Not recruited</div>
          </div>
        </div>
        <div className="text-xs text-[#c8d0ff]">
          Unlock: <span className="text-yellow-200">{e.hint}</span>
        </div>
        {footer}
      </div>
    );
  const b = e.build;
  const st = deriveStats({ ...b, equipment: starterGear(b) });
  const gear = Object.values(starterGear(b)).filter((x): x is number => x != null);
  const cp = b.points ?? 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end gap-3">
        <HeroSprite heroKey={e.key} size={48} />
        <div className="min-w-0 flex-1">
          <div className="ff-display text-lg">{getCharacter(e.key).name}</div>
          <div className="ff-title">Start Lv {b.level}</div>
        </div>
        <span className={`ff-chip text-xs ${canSpend(b) ? "" : "opacity-70"}`}>
          {cp} CP{canSpend(b) ? " ★" : ""}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center text-xs">
        <Stat label="HP" value={st.maxHp} />
        <Stat label="MP" value={st.maxMp} />
        <Stat label="Str" value={st.strength} />
        <Stat label="Mag" value={st.magic} />
      </div>
      <div className="text-xs text-[#c8d0ff]">{gear.map(itemName).join(" · ") || "No gear"}</div>
      <div className="text-xs opacity-80">{1 + (b.unlockedSlots ?? []).length}/5 gear slots open</div>
      {footer ?? <div className="text-xs text-yellow-200/80">Click to manage ▸</div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-black/30 px-1 py-0.5">
      <div className="text-[0.65rem] text-[#c8d0ff]">{label}</div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}
