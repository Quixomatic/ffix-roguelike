import { apCost, gearChange, type RewardCard, type RewardOffer, type RunState } from "@ffix-roguelike/game-core";
import { abilityName, getCharacter, getItem, RARITIES, rarityOf, type RarityId } from "@ffix-roguelike/game-data";

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
              onClick={() => actions.claim.mutate({ choice: i })}
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
      {"key" in card ? <Who keyName={card.key} /> : <span className="ff-display text-base">Supplies</span>}
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
  }
}
