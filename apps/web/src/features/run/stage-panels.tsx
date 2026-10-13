import { eventById, WORLDS, type RunPhase, type RunState } from "@ffix-roguelike/game-core";
import { abilityName, getCharacter } from "@ffix-roguelike/game-data";
import { Link } from "@tanstack/react-router";

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

export function RewardsPanel({ phase, actions }: { phase: Extract<RunPhase, { kind: "rewards" }>; actions: RunActions }) {
  const s = phase.summary;
  const pending = actions.claim.isPending;
  return (
    <Panel title={phase.boss ? "Boss defeated!" : "Victory!"}>
      <div className="ff-window grid grid-cols-3 gap-2 p-4 text-lg">
        <div>EXP {s.exp}</div>
        <div>AP {s.ap}</div>
        <div>Gil {s.gil}</div>
        {s.items.length > 0 && <div className="col-span-3 text-base">Received: {s.items.map(itemName).join(", ")}</div>}
        {s.levelUps.map((l) => (
          <div key={l.key} className="col-span-3 text-base text-yellow-200">
            {name(l.key)} reached Lv {l.to}!
          </div>
        ))}
        {s.mastered.map((m) => (
          <div key={m.key + m.ref} className="col-span-3 text-base text-pink-200">
            {name(m.key)} learned {abilityName(m.ref)}!
          </div>
        ))}
      </div>
      {phase.gearChoices.length > 0 ? (
        <>
          <div className="ff-title text-center text-base">Choose one</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {phase.gearChoices.map((id, i) => (
              <ItemCard key={id} itemId={id} onClick={pending ? undefined : () => actions.claim.mutate({ choice: i })} />
            ))}
          </div>
          <button className="ff-window mx-auto px-4 py-1" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
            Skip
          </button>
        </>
      ) : (
        <button className="ff-window mx-auto px-6 py-2 text-lg" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
          Continue
        </button>
      )}
    </Panel>
  );
}

export function TreasurePanel({ phase, actions }: { phase: Extract<RunPhase, { kind: "treasure" }>; actions: RunActions }) {
  const pending = actions.claim.isPending;
  return (
    <Panel title="Treasure!">
      {phase.gil > 0 && <div className="ff-window p-3 text-lg">Found {phase.gil} gil.</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {phase.gearChoices.map((id, i) => (
          <ItemCard key={id} itemId={id} onClick={pending ? undefined : () => actions.claim.mutate({ choice: i })} />
        ))}
      </div>
      <button className="ff-window mx-auto px-4 py-1" disabled={pending} onClick={() => actions.claim.mutate({ choice: null })}>
        Leave it
      </button>
    </Panel>
  );
}

export function ShopPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "shop" }>; actions: RunActions }) {
  return (
    <Panel title={`Shop — ${run.gil} gil`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {phase.stock.map((entry, i) => {
          const sold = phase.sold.includes(i);
          const afford = run.gil >= entry.price;
          return (
            <ItemCard
              key={i}
              itemId={entry.itemId}
              onClick={sold || !afford || actions.buy.isPending ? undefined : () => actions.buy.mutate({ index: i })}
              footer={<div className={`text-right ${afford ? "" : "text-red-300"}`}>{sold ? "Sold out" : `${entry.price} gil`}</div>}
            />
          );
        })}
      </div>
      <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
        Leave
      </button>
    </Panel>
  );
}

export function MooglePanel({ phase, actions }: { phase: Extract<RunPhase, { kind: "moogle" }>; actions: RunActions }) {
  return (
    <Panel title="Moogle — Kupo!">
      <div className="ff-window p-4 text-lg leading-relaxed">
        "You look tired, kupo! Rest up — everyone's back on their feet."
        <br />
        {phase.mailed > 0
          ? `Mognet delivered ${phase.mailed} piece${phase.mailed === 1 ? "" : "s"} of gear home. They're yours to keep, even if you fall.`
          : "\"Nothing to mail home this time, kupo.\""}
      </div>
      <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
        Set off
      </button>
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
          <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
            Continue
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {ev.choices.map((c, i) => (
            <button
              key={c.label}
              className="ff-window px-4 py-2 text-left text-lg enabled:hover:brightness-125 disabled:opacity-50"
              disabled={(c.cost ?? 0) > run.gil || actions.choose.isPending}
              onClick={() => actions.choose.mutate({ index: i })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function WorldClearPanel({ run, actions }: { run: RunState; actions: RunActions }) {
  const next = WORLDS[run.world + 1];
  return (
    <Panel title={`${WORLDS[run.world]!.name} cleared!`}>
      <div className="ff-window p-4 text-lg">
        The road leads on to <span className="text-yellow-200">{next?.name}</span> — {next?.subtitle}. The party rests before setting out.
      </div>
      <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.nextWorld.mutate()}>
        Travel on
      </button>
    </Panel>
  );
}

export function RunOverPanel({ run, report }: { run: RunState; report: RunReport | null }) {
  const won = run.phase.kind === "over" && run.phase.won;
  return (
    <Panel title={won ? "The world is saved!" : "The party has fallen..."}>
      <div className="ff-window flex flex-col gap-1 p-4 text-lg">
        <div>Reached: {WORLDS[run.world]!.name}</div>
        <div>Battles won: {run.stats.battles}</div>
        {run.party.map((m) => (
          <div key={m.build.key}>
            {name(m.build.key)} — Lv {m.build.level}
          </div>
        ))}
        {report && (
          <>
            <div className="mt-2 text-yellow-200">{report.gilEarned} gil banked.</div>
            {report.gearLost.length > 0 && <div className="text-red-300">Lost (never mailed home): {report.gearLost.map(itemName).join(", ")}</div>}
            {report.newlyUnlocked.map((k) => (
              <div key={k} className="text-pink-200">
                {name(k)} joined your roster!
              </div>
            ))}
            {report.tierUnlocked != null && <div className="text-pink-200">Difficulty Tier {report.tierUnlocked} unlocked!</div>}
          </>
        )}
        <div className="mt-2 text-sm opacity-80">Levels and learned abilities are permanent.</div>
      </div>
      <Link to="/play" className="ff-window mx-auto px-6 py-2 text-lg">
        Back to camp
      </Link>
    </Panel>
  );
}
