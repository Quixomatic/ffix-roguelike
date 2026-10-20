import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ffix-roguelike/ui/components/hover-card";
import { characterTags, getCharacter, rarityOf, relicById, ROSTER, synergyTable, type SynergyData } from "@ffix-roguelike/game-data";
import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

import { FocusItem } from "@/features/input/focus";

import { Badge } from "./badge";
import { effectText, synergyChipStyle, synergyColor } from "./relic-text";

/** The roster characters (for who carries a synergy's tag). */

type Side = "top" | "right" | "bottom" | "left";

/**
 * The FF popover shell shared by relics, synergies and the Story page's maps (the items' look): hover, or reach it
 * with the cursor. `cursor` false: hover only, for things inside something that's already a cursor stop (a card).
 */
export function Pop({ side, cursor = true, children, content }: { side: Side; cursor?: boolean; children: ReactElement; content: ReactNode }) {
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
          <span className="ff-display text-lg" style={{ color: synergyColor(s.id) }}>
            {s.name}
          </span>
          <span className="text-xs opacity-80">Party synergy{count != null ? ` · ${count} in the party` : ""}</span>
        </div>
      </div>
      {s.description && <div className="italic opacity-80">{s.description}</div>}
      <ul className="flex flex-col gap-1">
        {s.tiers.map((t) => (
          <li key={t.count} className={`rounded px-2 py-1 ${t === reached ? "" : "bg-black/25 opacity-80"}`} style={t === reached ? synergyChipStyle(s.id) : undefined}>
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
 * The one synergy chip used everywhere (character cards, the embark page, the run sidebar): tinted with the synergy's
 * colour, its badge, its name and — given `count` — how many of the party share it, `detail` adds the tier reached
 * beneath. Its card shows on hover (and on the cursor, unless `cursor` is false: inside something that's already a
 * cursor stop).
 */
export function SynergyChip({
  synergy: s,
  count,
  party,
  detail = false,
  showCount = true,
  cursor = true,
  side = "right",
  className = "",
}: {
  synergy: SynergyData;
  count?: number;
  party?: string[];
  detail?: boolean;
  /** Show the party count on the chip (character cards leave it to the popover). */
  showCount?: boolean;
  cursor?: boolean;
  side?: Side;
  className?: string;
}) {
  const reached = count != null ? [...s.tiers].sort((a, b) => b.count - a.count).find((t) => count >= t.count) : undefined;
  // Short of its first tier (where the count shows: a party's synergies): shown, but plainly not active — greyed, a
  // dashed edge, "1/2". Character cards' tag chips (no count shown) never grey.
  const first = Math.min(...s.tiers.map((t) => t.count));
  const inactive = showCount && count != null && !reached;
  const body = (
    <>
      <span className="inline-flex items-center gap-1">
        {s.badge && <Badge id={s.badge} scale={1} view={20} />}
        <span>{s.name}</span>
        {showCount && count != null && <span className="tabular-nums opacity-80">{inactive ? `${count}/${first}` : count}</span>}
      </span>
      {detail && (reached ? <span className="opacity-85">{reached.text}</span> : inactive && <span className="opacity-85">Needs {first} in the party</span>)}
    </>
  );
  const cls = `inline-flex cursor-help flex-col rounded px-1.5 py-0.5 text-left text-xs ${inactive ? "border-dashed opacity-60 grayscale" : ""} ${className}`;
  return (
    <SynergyPopover synergyId={s.id} count={count} party={party} side={side} cursor={cursor}>
      {/* A span inside something that's already a button (a character card): buttons can't nest. */}
      {cursor ? (
        <button type="button" data-sound="none" className={cls} style={synergyChipStyle(s.id)}>
          {body}
        </button>
      ) : (
        <span className={cls} style={synergyChipStyle(s.id)}>
          {body}
        </span>
      )}
    </SynergyPopover>
  );
}

/**
 * A character's synergy tags as chips, each with its popover on hover: for character cards' footers (the card is the
 * cursor stop, so the chips are hover only).
 */
export function SynergyTags({ character, party, side = "top" }: { character: string; party?: string[]; side?: Side }) {
  const synergies = characterTags(character).flatMap((tag) => synergyTable().find((x) => x.tag === tag) ?? []);
  const countOf = (s: SynergyData) => (party ? party.filter((k) => characterTags(k).includes(s.tag)).length : undefined);
  const chip = (s: SynergyData) => <SynergyChip key={s.id} synergy={s} count={countOf(s)} party={party} side={side} cursor={false} showCount={false} />;
  // One line only: as many chips as fit, then "+N" for the rest (hover it for them all). An invisible copy of the full
  // row is measured against the space, on every resize.
  const rowRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(synergies.length);
  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;
    const fit = () => {
      const room = row.clientWidth;
      const chips = [...measure.children] as HTMLElement[];
      const right = (i: number) => chips[i]!.offsetLeft + chips[i]!.offsetWidth;
      if (!chips.length || right(chips.length - 1) <= room) return setShown(chips.length);
      // Leave room for the "+N" chip.
      let n = chips.length - 1;
      while (n > 0 && right(n - 1) > room - MORE_CHIP_ROOM) n--;
      setShown(Math.max(1, n));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(row);
    return () => ro.disconnect();
  }, [synergies.length]);
  if (!synergies.length) return null;
  const hidden = synergies.length - shown;
  return (
    // No width of its own (w-0 grow): it takes the footer's width rather than pushing the card wider to fit every chip.
    <span ref={rowRef} className="relative flex w-0 min-w-0 grow flex-nowrap gap-1 overflow-hidden">
      <span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex flex-nowrap gap-1">
        {synergies.map(chip)}
      </span>
      {synergies.slice(0, shown).map(chip)}
      {hidden > 0 && (
        <Pop
          side={side}
          cursor={false}
          content={synergies.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 border-b border-white/10 pb-2 last:border-0 last:pb-0">
              <SynergyDetails synergy={s} count={countOf(s)} party={party} />
            </div>
          ))}
        >
          <span className="inline-flex shrink-0 cursor-help items-center rounded border border-white/25 bg-black/30 px-1.5 py-0.5 text-xs">+{hidden}</span>
        </Pop>
      )}
    </span>
  );
}

/** Width (px) kept free for the "+N" chip when a character's synergy chips overflow their line. */
const MORE_CHIP_ROOM = 32;
