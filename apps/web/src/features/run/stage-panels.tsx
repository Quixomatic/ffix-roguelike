import { achievement, eventById, getArea, getJourney, JOURNEYS, rewardItemIds, sellPrice, WORLDS, type RunPhase, type RunState } from "@ffix-roguelike/game-core";
import { abilityName, findItem, getCharacter, synthesis } from "@ffix-roguelike/game-data";
import { Link } from "@tanstack/react-router";

import { useTween } from "@/features/results/use-tween";
import { VictoryScreen } from "@/features/results/victory-screen";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { FocusItem } from "@/features/input/focus";

import { ItemCard, itemName } from "./item-info";
import type { RunActions, RunReport } from "./use-run";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <div className="ff-window px-5 py-3 text-2xl">{title}</div>
      {children}
    </div>
  );
}

const name = (key: string) => getCharacter(key).name;

export function RewardsPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "rewards" }>; actions: RunActions }) {
  const party = run.party.map((m) => m.build);
  // Runs saved before per-member progress existed have no `members`.
  const s = { ...phase.summary, members: phase.summary.members ?? [] };
  const pending = actions.claim.isPending;
  return (
    <VictoryScreen title={phase.boss ? "Boss defeated!" : "Victory!"} summary={s}>
      {phase.gearChoices.length > 0 ? (
        <>
          <div className="ff-title text-center text-base">Choose one</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {phase.gearChoices.map((id, i) => (
              <ItemCard key={id} itemId={id} party={party} onClick={pending ? undefined : () => actions.claim.mutate({ choice: i })} />
            ))}
          </div>
          <FocusItem>
            <button className="ff-window mx-auto px-4 py-1" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
              Skip
            </button>
          </FocusItem>
        </>
      ) : (
        <FocusItem>
          <button className="ff-window mx-auto px-6 py-2 text-lg" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
            Continue
          </button>
        </FocusItem>
      )}
    </VictoryScreen>
  );
}

export function TreasurePanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "treasure" }>; actions: RunActions }) {
  const party = run.party.map((m) => m.build);
  const pending = actions.claim.isPending;
  return (
    <Panel title="Treasure!">
      {phase.gil > 0 && <div className="ff-window p-3 text-lg">Found {phase.gil} gil.</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {phase.gearChoices.map((id, i) => (
          <ItemCard key={id} itemId={id} party={party} onClick={pending ? undefined : () => actions.claim.mutate({ choice: i })} />
        ))}
      </div>
      <FocusItem>
        <button className="ff-window mx-auto px-4 py-1" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
          Leave it
        </button>
      </FocusItem>
    </Panel>
  );
}

export function ShopPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "shop" }>; actions: RunActions }) {
  return (
    <Panel title={`${phase.name} — ${run.gil} gil`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {phase.stock.map((entry, i) => {
          const sold = phase.sold.includes(i);
          const afford = run.gil >= entry.price;
          return (
            <ItemCard
              key={i}
              itemId={entry.itemId}
              party={run.party.map((m) => m.build)}
              onClick={sold || !afford || actions.buy.isPending ? undefined : () => actions.buy.mutate({ index: i })}
              footer={<div className={`text-right ${afford ? "" : "text-red-300"}`}>{sold ? "Sold out" : `${entry.price} gil`}</div>}
            />
          );
        })}
      </div>
      <SellList run={run} actions={actions} />
      <FocusItem>
        <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
          Leave
        </button>
      </FocusItem>
    </Panel>
  );
}

/** Unequipped gear you can sell for half price. */
function SellList({ run, actions }: { run: RunState; actions: RunActions }) {
  const sellable = run.gear.filter((g) => !g.holder);
  if (!sellable.length) return null;
  return (
    <div className="ff-window p-3">
      <div className="ff-title mb-1">Sell (unequipped gear)</div>
      <div className="flex flex-wrap gap-2">
        {sellable.map((g) => (
          <FocusItem key={g.uid}>
            <button
              className="rounded border border-white/30 px-2 py-0.5 text-sm hover:bg-white/10 disabled:opacity-50"
              disabled={actions.sell.isPending}
              onClick={() => actions.sell.mutate({ uid: g.uid })}
            >
              {itemName(g.itemId)} · {sellPrice(g.itemId)}g{!g.secured && <span className="text-orange-300"> ·found</span>}
            </button>
          </FocusItem>
        ))}
      </div>
    </div>
  );
}

/** How many of an item the run has available as an ingredient (consumables + unequipped gear). */
function ingredientCount(run: RunState, itemId: number): number {
  return (run.consumables.find((c) => c.itemId === itemId)?.count ?? 0) + run.gear.filter((g) => g.itemId === itemId && !g.holder).length;
}

export function SynthPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "synth" }>; actions: RunActions }) {
  const recipes = phase.recipes.map((id) => synthesis.find((r) => r.id === id)!).filter(Boolean);
  const canMake = (r: (typeof recipes)[number]) => {
    if (run.gil < r.price) return false;
    const need = new Map<number, number>();
    for (const id of r.ingredients) need.set(id, (need.get(id) ?? 0) + 1);
    return [...need].every(([id, n]) => ingredientCount(run, id) >= n);
  };
  const sorted = [...recipes].sort((a, b) => Number(canMake(b)) - Number(canMake(a)) || a.price - b.price);
  return (
    <Panel title={`${phase.name} — ${run.gil} gil`}>
      <div className="ff-window p-3 text-sm">Combine two items and some gil into something better. Ingredients must be unequipped.</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((r) => {
          const ok = canMake(r);
          return (
            <ItemCard
              key={r.id}
              itemId={r.result}
              party={run.party.map((m) => m.build)}
              onClick={ok && !actions.synthesize.isPending ? () => actions.synthesize.mutate({ recipeId: r.id }) : undefined}
              footer={
                <div className="flex justify-between text-sm">
                  <span>
                    {r.ingredients.map((id, i) => (
                      <span key={i} className={ingredientCount(run, id) > 0 ? "" : "text-red-300"}>
                        {i > 0 && " + "}
                        {findItem(id)?.name ?? id}
                      </span>
                    ))}
                  </span>
                  <span className={run.gil >= r.price ? "" : "text-red-300"}>{r.price}g</span>
                </div>
              }
            />
          );
        })}
      </div>
      <SellList run={run} actions={actions} />
      <FocusItem>
        <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
          Leave
        </button>
      </FocusItem>
    </Panel>
  );
}

export function MooglePanel({ run, actions }: { run: RunState; actions: RunActions }) {
  return (
    <Panel title="Moogle — Kupo!">
      <div className="ff-window p-4 text-lg leading-relaxed">
        "You look tired, kupo! Rest up — everyone's back on their feet."
        <br />
        "I'll buy any gear you can't use, kupo. Remember — what you find out here only comes home if you see the journey through!"
      </div>
      <SellList run={run} actions={actions} />
      <FocusItem>
        <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
          Set off
        </button>
      </FocusItem>
    </Panel>
  );
}

export function EventPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "event" }>; actions: RunActions }) {
  const ev = eventById(phase.eventId);
  return (
    <Panel title={ev.title}>
      <div className="ff-window p-4 text-lg leading-relaxed">{ev.text}</div>
      {phase.result ? (
        <>
          <div className="ff-window p-4 text-lg text-yellow-100">{phase.result}</div>
          <FocusItem>
            <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
              Continue
            </button>
          </FocusItem>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {ev.choices.map((c, i) => (
            <FocusItem key={c.label}>
              <button
                className="ff-window px-4 py-2 text-left text-lg enabled:hover:brightness-125 disabled:opacity-50"
                disabled={(c.cost ?? 0) > run.gil || actions.choose.isPending}
                onClick={() => actions.choose.mutate({ index: i })}
              >
                {c.label}
              </button>
            </FocusItem>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function WorldClearPanel({ run, actions }: { run: RunState; actions: RunActions }) {
  const nextId = getJourney(run.journey).areas[run.stage + 1];
  const next = nextId ? getArea(nextId) : undefined;
  return (
    <Panel title={`${WORLDS[run.world]!.name} cleared!`}>
      <div className="ff-window p-4 text-lg">
        The road leads on to <span className="text-yellow-200">{next?.name}</span> — {next?.subtitle}. The party rests before setting out.
      </div>
      <FocusItem>
        <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.nextWorld.mutate()}>
          Travel on
        </button>
      </FocusItem>
    </Panel>
  );
}

export function RunOverPanel({ run, report }: { run: RunState; report: RunReport | null }) {
  const won = run.phase.kind === "over" && run.phase.won;
  const gil = useTween(0, report?.gilEarned ?? 0, 1200, 600);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div className={`ff-window px-5 py-4 text-center ${won ? "" : "grayscale-[0.3]"}`}>
        <div className="ff-pop text-3xl">{won ? "Journey complete!" : "The party has fallen..."}</div>
        <div className="ff-title mt-1">
          Reached {WORLDS[run.world]!.name} · {run.stats.battles} battles won · {run.stats.bossKills.length} boss{run.stats.bossKills.length === 1 ? "" : "es"} defeated
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 [&>*]:w-48">
        {run.party.map((m, i) => (
          <CompletionCard key={m.build.key} heroKey={m.build.key} level={m.build.level} ko={m.hp <= 0} points={report?.points[m.build.key] ?? 0} delay={500 + i * 200} />
        ))}
      </div>

      {report && (
        <div className="ff-window flex flex-col gap-1 p-4 text-lg">
          <div className="tabular-nums text-yellow-200">+{Math.round(gil)} gil banked</div>
          {report.journeyCleared && (
            <div className="ff-pop text-pink-200">
              {getJourney(report.journeyCleared).name} cleared!
              {JOURNEYS.filter((j) => j.unlockAfter === report.journeyCleared).map((j) => ` New journey: ${j.name}.`)}
            </div>
          )}
          {report.gearUnlocked.length > 0 && (
            <div className="text-base text-green-300">Unlocked for future runs: {report.gearUnlocked.map(itemName).join(", ")}</div>
          )}
          {!report.won && report.foundGear.length > 0 && (
            <div className="text-base text-red-300">Found this run (win to unlock it for good): {report.foundGear.map(itemName).join(", ")}</div>
          )}
          {report.achievements.map((id, i) => {
            const a = achievement(id);
            if (!a) return null;
            const reward = [a.reward.gil ? `${a.reward.gil} gil` : "", a.reward.cp ? `+${a.reward.cp} CP${a.reward.cpFor ? "" : " each"}` : "", rewardItemIds(a).length ? `unlocks ${rewardItemIds(a).map(itemName).join(", ")}` : "", a.reward.supplies?.length ? `camp supplies: ${a.reward.supplies.join(", ")}` : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={id} className="ff-pop flex items-baseline gap-2 text-yellow-100" style={{ animationDelay: `${2000 + i * 300}ms` }}>
                <span>🏆 {a.name}</span>
                <span className="text-sm opacity-80">{reward}</span>
              </div>
            );
          })}
          {report.newlyUnlocked.map((k, i) => (
            <div key={k} className="ff-pop flex items-center gap-3 text-pink-200" style={{ animationDelay: `${1600 + i * 300}ms` }}>
              <HeroSprite heroKey={k} size={40} /> {name(k)} joined your roster!
            </div>
          ))}
          {report.tierUnlocked != null && <div className="text-pink-200">Difficulty Tier {report.tierUnlocked} unlocked!</div>}
        </div>
      )}

      <div className="text-center text-sm opacity-80">Spend Completion Points at camp on a higher start level or unlocking equipment slots.</div>
      <FocusItem>
        <Link to="/play" className="ff-window mx-auto px-6 py-2 text-lg">
          Back to camp
        </Link>
      </FocusItem>
    </div>
  );
}

function CompletionCard({ heroKey, level, ko, points, delay }: { heroKey: string; level: number; ko: boolean; points: number; delay: number }) {
  const shown = useTween(0, points, 1000, delay);
  return (
    <div className="ff-window flex flex-col items-center gap-2 p-3">
      <HeroSprite heroKey={heroKey} size={80} ko={ko} />
      <div className="text-lg">{name(heroKey)}</div>
      <div className="ff-title">Reached Lv {level}</div>
      <div className="ff-pop text-2xl tabular-nums text-yellow-200" style={{ animationDelay: `${delay}ms` }}>
        +{Math.round(shown)} CP
      </div>
    </div>
  );
}
