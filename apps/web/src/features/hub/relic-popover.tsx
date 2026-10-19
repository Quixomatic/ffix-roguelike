import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ffix-roguelike/ui/components/hover-card";
import { characterTags, getCharacter, rarityOf, relicById, synergyTable, type SynergyData } from "@ffix-roguelike/game-data";
import type { ReactElement, ReactNode } from "react";

import { FocusItem } from "@/features/input/focus";

import { Badge } from "./badge";
import { effectText } from "./relic-text";

/** The roster characters (for who carries a synergy's tag). */
const ROSTER = ["zidane", "vivi", "garnet", "steiner", "freya", "quina", "eiko", "amarant", "beatrix", "blank"];

type Side = "top" | "right" | "bottom" | "left";

/**
 * The FF popover shell shared by relics and synergies (the items' look): hover, or reach it with the cursor. `cursor`
 * false: hover only, for badges inside something that's already a cursor stop (a character card).
 */
function Pop({ side, cursor = true, children, content }: { side: Side; cursor?: boolean; children: ReactElement; content: ReactNode }) {
  const trigger = <HoverCardTrigger delay={250} closeDelay={50} render={children} />;
  return (
    <HoverCard>
      {/* A cursor stop too, so the keyboard / controller can reach it. */}
      {cursor ? <FocusItem>{trigger}</FocusItem> : trigger}
      <HoverCardContent side={side} align="start" sideOffset={8} className="theme-ff ff-panel flex w-80 flex-col gap-2 rounded-md p-3 text-sm">
        {content}
      </HoverCardContent>
    </HoverCard>
  );
}

/** A relic's card: badge, name, rarity, cursed / starter, every effect, its flavour line. */
export function RelicDetails({ relicId, extra }: { relicId: string; extra?: ReactNode }) {
  const r = relicById(relicId);
  if (!r) return <div className="opacity-70">Unknown relic</div>;
  const rarity = rarityOf(r.rarity);
  return (
    <>
      {extra}
      <div className="flex items-center gap-2">
        <Badge id={r.badge ?? 1} scale={1} />
        <div className="flex min-w-0 flex-col">
          <span className="ff-display truncate text-lg" style={{ color: rarity.color }}>
            {r.name}
          </span>
          <span className="flex flex-wrap gap-1 text-xs">
            <span style={{ color: rarity.color }}>{rarity.name} relic</span>
            {r.cursed && <span className="text-purple-200">· Cursed</span>}
            {r.starter && <span className="text-sky-200">· Starter</span>}
          </span>
        </div>
      </div>
      <div>{r.description}</div>
      <ul className="flex flex-col gap-0.5 text-[#c8d0ff]">
        {r.effects.map((e, i) => (
          <li key={i}>• {effectText(e)}</li>
        ))}
      </ul>
      {r.flavor && <div className="text-xs italic opacity-80">“{r.flavor}”</div>}
    </>
  );
}

/** Hover a relic (a badge, a card, a tile) for its full card. `children` is the element to hover. */
export function RelicPopover({ relicId, side = "right", extra, children }: { relicId: string; side?: Side; extra?: ReactNode; children: ReactElement }) {
  return <Pop side={side} content={<RelicDetails relicId={relicId} extra={extra} />}>{children}</Pop>;
}

/**
 * A synergy's card: what each tier does (the one reached highlighted, given `count`), and which characters carry its
 * tag (the party's ones marked, given `party`).
 */
export function SynergyDetails({ synergy: s, count, party }: { synergy: SynergyData; count?: number; party?: string[] }) {
  const reached = count != null ? [...s.tiers].sort((a, b) => b.count - a.count).find((t) => count >= t.count) : undefined;
  const members = ROSTER.filter((k) => characterTags(k).includes(s.tag));
  return (
    <>
      <div className="flex items-center gap-2">
        {s.badge && <Badge id={s.badge} scale={1} />}
        <div className="flex min-w-0 flex-col">
          <span className="ff-display text-lg text-sky-100">{s.name}</span>
          <span className="text-xs opacity-80">Party synergy{count != null ? ` · ${count} in the party` : ""}</span>
        </div>
      </div>
      {s.description && <div className="italic opacity-80">{s.description}</div>}
      <ul className="flex flex-col gap-1">
        {s.tiers.map((t) => (
          <li key={t.count} className={`rounded px-2 py-1 ${t === reached ? "bg-sky-800/60 text-sky-50" : "bg-black/25 opacity-80"}`}>
            <span className="tabular-nums text-yellow-200">{t.count}+</span> {t.text}
          </li>
        ))}
      </ul>
      <div className="text-xs">
        <span className="opacity-70">Members: </span>
        {members.map((k, i) => (
          <span key={k} className={party?.includes(k) ? "text-yellow-200" : "opacity-80"}>
            {i ? ", " : ""}
            {getCharacter(k).name}
          </span>
        ))}
      </div>
    </>
  );
}

/** Hover a synergy (a chip, a badge) for its card. By id or by tag. */
export function SynergyPopover({
  synergyId,
  tag,
  count,
  party,
  side = "right",
  cursor = true,
  children,
}: {
  synergyId?: string;
  tag?: string;
  count?: number;
  party?: string[];
  side?: Side;
  cursor?: boolean;
  children: ReactElement;
}) {
  const s = synergyTable().find((x) => (synergyId ? x.id === synergyId : x.tag === tag));
  if (!s) return children;
  return (
    <Pop side={side} cursor={cursor} content={<SynergyDetails synergy={s} count={count} party={party} />}>
      {children}
    </Pop>
  );
}

/**
 * A character's synergy tags as small badges, each with its popover on hover: for character cards' footers (the card
 * is the cursor stop, so the badges are hover only).
 */
export function SynergyTags({ character, party, side = "top" }: { character: string; party?: string[]; side?: Side }) {
  const tags = characterTags(character);
  if (!tags.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const s = synergyTable().find((x) => x.tag === tag);
        const count = party ? party.filter((k) => characterTags(k).includes(tag)).length : undefined;
        return (
          <SynergyPopover key={tag} tag={tag} count={count} party={party} side={side} cursor={false}>
            <span className="inline-flex items-center gap-1 rounded bg-sky-900/60 px-1.5 py-0.5 text-xs text-sky-100">
              {s?.badge && <Badge id={s.badge} scale={1} view={20} />}
              {s?.name ?? tag}
            </span>
          </SynergyPopover>
        );
      })}
    </span>
  );
}
