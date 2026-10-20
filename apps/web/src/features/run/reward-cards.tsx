import { apCost, gearChange, type RewardCard, type RewardOffer, type RunState, type ShopWares } from "@ffix-roguelike/game-core";
import { abilityName, BASE_RELIC_SLOTS, getCharacter, getItem, RARITIES, rarityOf, relicById, type RarityId } from "@ffix-roguelike/game-data";
import { useState } from "react";

import { Badge } from "@/features/hub/badge";
import { RelicPopover } from "@/features/hub/relic-popover";
import { effectText } from "@/features/hub/relic-text";
import { FocusItem } from "@/features/input/focus";
import { DeltaChips } from "@/features/gear/gear-delta";
import { ItemIcon } from "@/features/items/item-icon";
import { HeroSprite } from "@/features/sprites/hero-sprite";

import { KIND_LABEL } from "./item-info";
import type { RunActions } from "./use-run";

const BOON_LABEL: Record<string, string> = {
  strength: "Strength",
  magic: "Magic",
  spirit: "Spirit",
  speed: "Speed",
  attack: "Attack",
  defence: "Defence",
  evade: "Evade",
  magicDefence: "Magic Def",
  magicEvade: "Magic Eva",
  maxHpPct: "% max HP",
  maxMpPct: "% max MP",
  levels: "levels",
};

/** A member's boons, stacked by name (one row per boon: its total, and how many times it was taken). */
export function BoonList({ boons }: { boons: { boonId: string; name: string; stat: string; amount: number; rarity: string }[] }) {
  if (!boons.length) return <div className="text-sm opacity-60">No boons yet: they come from reward cards and last the run.</div>;
  const stacked = new Map<string, { name: string; stat: string; total: number; times: number; best: string }>();
  for (const b of boons) {
    const s = stacked.get(b.boonId) ?? { name: b.name, stat: b.stat, total: 0, times: 0, best: b.rarity };
    s.total += b.amount;
    s.times++;
    if (RARITY_ORDER.indexOf(b.rarity) > RARITY_ORDER.indexOf(s.best)) s.best = b.rarity;
    stacked.set(b.boonId, s);
  }
  return (
    <div className="flex flex-col gap-1">
      {[...stacked.values()].map((s) => (
        <div key={s.name} className="flex items-center justify-between gap-2 rounded bg-black/25 px-2 py-1 text-sm">
          <span style={{ color: rarityOf(s.best as RarityId).color }}>
            {s.name}
            {s.times > 1 && <span className="opacity-70"> ×{s.times}</span>}
          </span>
          <span>{boonText(s.stat, s.total)}</span>
        </div>
      ))}
    </div>
  );
}

const RARITY_ORDER: string[] = [...RARITIES];

/** "+3 Strength", "+8% max HP", "+2 levels". */
export const boonText = (stat: string, amount: number) => (stat.endsWith("Pct") ? `+${amount}${BOON_LABEL[stat]}` : `+${amount} ${BOON_LABEL[stat] ?? stat}`);

/**
 * A reward offer: the cards side by side, each for someone, saying exactly what it does — pick one and it applies at
 * once (`.plans/rewards.md`). Skip pays a little gil. Cards are cursor stops (keyboard / controller: move, A takes).
 */
export function RewardOfferView({ run, offer, actions }: { run: RunState; offer: RewardOffer; actions: RunActions }) {
  const pending = actions.claim.isPending;
  /** A relic card picked while the rack is full: which held relic to give up for it. */
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const rackFull = (run.relics ?? []).length >= (run.relicSlots ?? BASE_RELIC_SLOTS);
  const take = (i: number) => {
    if (offer.cards[i]?.kind === "relic" && rackFull) setSwapFor(i);
    else actions.claim.mutate({ choice: i });
  };
  if (swapFor != null)
    return <RelicSwap run={run} incoming={offer.cards[swapFor]} pending={pending} onPick={(id) => actions.claim.mutate({ choice: swapFor, replace: id })} onBack={() => setSwapFor(null)} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="ff-title text-center text-base">Choose one</div>
      <div className={`grid gap-3 ${offer.cards.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {offer.cards.map((card, i) => (
          <FocusItem key={i}>
            <button
              className="ff-window ff-lift flex flex-col gap-2 border-2 p-3 text-left disabled:opacity-60"
              style={{ borderColor: rarityOf(card.rarity).color }}
              disabled={pending}
              data-sound="purchase"
              onClick={() => take(i)}
            >
              <CardBody run={run} card={card} />
            </button>
          </FocusItem>
        ))}
      </div>
      <FocusItem>
        <button className="ff-window mx-auto px-4 py-1" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
          Skip <span className="text-yellow-200">+{offer.skipGil} gil</span>
        </button>
      </FocusItem>
    </div>
  );
}

/** A relic card taken (or bought) while the rack is full: which held relic to give up for it (swap only). */
function RelicSwap({ run, incoming, pending, onPick, onBack }: { run: RunState; incoming: RewardCard | undefined; pending: boolean; onPick(id: string): void; onBack(): void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="ff-title text-center text-base">Your relics are full: give one up for {incoming?.kind === "relic" ? incoming.name : "it"}</div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(run.relics ?? []).map((id) => {
          const r = relicById(id);
          return (
            <RelicPopover key={id} relicId={id} side="top">
              <button className="ff-window ff-lift flex items-center gap-2 p-2 text-left disabled:opacity-60" disabled={pending} data-sound="purchase" onClick={() => onPick(id)}>
                <Badge id={r?.badge ?? 1} scale={1} />
                <span className="min-w-0">
                  <span className="block truncate">{r?.name ?? id}</span>
                  <span className="block text-xs opacity-70">{r?.effects.map(effectText).join(" · ")}</span>
                </span>
              </button>
            </RelicPopover>
          );
        })}
      </div>
      <FocusItem>
        <button className="ff-window mx-auto px-4 py-1" disabled={pending} onClick={onBack}>
          Back to the cards
        </button>
      </FocusItem>
    </div>
  );
}

/**
 * The shop's wares (`.plans/shop-wares.md`): reward cards for sale, each for someone and saying exactly what it does,
 * with its price. Buying one applies it at once, like taking a reward (gear is equipped on its member); each sells once,
 * and any number can be bought while the gil lasts.
 */
export function ShopWaresView({ run, wares, actions }: { run: RunState; wares: ShopWares; actions: RunActions }) {
  const pending = actions.buyWare.isPending;
  const [swapFor, setSwapFor] = useState<number | null>(null);
  const rackFull = (run.relics ?? []).length >= (run.relicSlots ?? BASE_RELIC_SLOTS);
  const buy = (i: number) => {
    if (wares.cards[i]?.kind === "relic" && rackFull) setSwapFor(i);
    else actions.buyWare.mutate({ index: i });
  };
  if (swapFor != null)
    return (
      <RelicSwap
        run={run}
        incoming={wares.cards[swapFor]}
        pending={pending}
        onPick={(id) => actions.buyWare.mutate({ index: swapFor, replace: id }, { onSuccess: () => setSwapFor(null) })}
        onBack={() => setSwapFor(null)}
      />
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {wares.cards.map((card, i) => {
        const sold = wares.bought.includes(i);
        const price = wares.prices[i] ?? 0;
        const afford = run.gil >= price;
        return (
          <FocusItem key={i}>
            <button
              className="ff-window ff-lift flex flex-col gap-2 border-2 p-3 text-left disabled:opacity-50"
              style={{ borderColor: rarityOf(card.rarity).color }}
              disabled={pending || sold}
              data-sound={afford ? "none" : "buzzer"}
              onClick={() => afford && buy(i)}
            >
              <CardBody run={run} card={card} />
              <div className={`mt-auto border-t border-white/15 pt-1 text-right ${sold ? "text-white/60" : afford ? "text-yellow-200" : "text-red-300"}`}>
                {sold ? "Sold" : `${price.toLocaleString()} gil`}
              </div>
            </button>
          </FocusItem>
        );
      })}
    </div>
  );
}

function Who({ keyName }: { keyName: string | null }) {
  if (!keyName) return <span className="ff-display text-base">Whole party</span>;
  return (
    <span className="flex items-center gap-1.5">
      <HeroSprite heroKey={keyName} size={28} />
      <span className="ff-display text-base">{getCharacter(keyName).name}</span>
    </span>
  );
}

function CardBody({ run, card }: { run: RunState; card: RewardCard }) {
  const rarity = rarityOf(card.rarity);
  const head = (
    <div className="flex items-center justify-between gap-2">
      {"key" in card ? <Who keyName={card.key} /> : <span className="ff-display text-base">{card.kind === "relic" ? "Relic" : "Supplies"}</span>}
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: rarity.color }}>
        {rarity.name}
      </span>
    </div>
  );
  switch (card.kind) {
    case "gear": {
      const item = getItem(card.itemId);
      const build = run.party.find((m) => m.build.key === card.key)?.build;
      const change = build ? gearChange(build, card.itemId) : null;
      return (
        <>
          {head}
          <div className="flex items-center gap-2">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-black/30">
              <ItemIcon itemId={card.itemId} size={48} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg">{item.name}</span>
              <span className="text-xs opacity-70">{KIND_LABEL[item.kind] ?? item.kind} · equips now</span>
            </span>
          </div>
          {change && <DeltaChips change={change} />}
          {card.teaches.length > 0 && <div className="text-xs text-yellow-200">Teaches {card.teaches.map(abilityName).join(", ")}</div>}
          {card.stopsLearning.map((l) => (
            <div key={l.ref} className="text-xs text-orange-300">
              Stops learning {abilityName(l.ref)} ({l.ap}/{l.cost} AP); the old piece goes to the bag
            </div>
          ))}
        </>
      );
    }
    case "boon":
      return (
        <>
          {head}
          <div className="ff-display text-xl" style={{ color: rarity.color }}>
            {card.name}
          </div>
          <div className="text-lg">{boonText(card.stat, card.amount)}</div>
          <div className="text-xs opacity-70">{card.stat === "levels" ? "Real level-ups, right now." : "For the rest of the run."}</div>
        </>
      );
    case "ap": {
      const build = run.party.find((m) => m.build.key === card.key)?.build;
      const cost = apCost(getCharacter(card.key), card.ref);
      const had = build?.ap[card.ref] ?? 0;
      return (
        <>
          {head}
          <div className="text-lg">+{card.amount} AP</div>
          <div className="text-sm">
            toward <span className="text-yellow-200">{abilityName(card.ref)}</span>{" "}
            <span className="opacity-70">
              ({had} → {Math.min(cost, had + card.amount)}/{cost}
              {had + card.amount >= cost ? ", learned!" : ""})
            </span>
          </div>
        </>
      );
    }
    case "supplies":
      return (
        <>
          {head}
          <div className="flex items-center gap-2">
            <ItemIcon itemId={card.itemId} size={32} />
            <span className="text-lg">
              {getItem(card.itemId).name} ×{card.count}
            </span>
          </div>
        </>
      );
    case "gil":
      return (
        <>
          {head}
          <div className="text-xl text-yellow-200">+{card.amount} gil</div>
        </>
      );
    case "relic": {
      const r = relicById(card.relicId);
      return (
        <>
          {head}
          <div className="flex items-center gap-2">
            <Badge id={r?.badge ?? 1} scale={1} />
            <span className="min-w-0">
              <span className="ff-display block truncate text-xl" style={{ color: rarity.color }}>
                {card.name}
              </span>
              <span className="text-xs opacity-70">{r?.cursed ? "Cursed · " : ""}For the rest of the run</span>
            </span>
          </div>
          <ul className="flex flex-col gap-0.5 text-sm text-[#c8d0ff]">
            {r?.effects.map((e, i) => (
              <li key={i}>• {effectText(e)}</li>
            ))}
          </ul>
        </>
      );
    }
  }
}
