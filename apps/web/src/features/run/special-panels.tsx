import type { ChocoboSpot, RunPhase, RunState } from "@ffix-roguelike/game-core";
import { findItem } from "@ffix-roguelike/game-data";

import { ItemCard, itemName } from "./item-info";
import type { RunActions } from "./use-run";

function Header({ title, subtitle, gil }: { title: string; subtitle: string; gil: number }) {
  return (
    <div className="ff-window flex items-baseline justify-between px-5 py-3">
      <div>
        <div className="text-2xl">{title}</div>
        <div className="ff-title">{subtitle}</div>
      </div>
      <div className="text-lg tabular-nums text-yellow-200">{gil} gil</div>
    </div>
  );
}

export function StiltzkinPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "stiltzkin" }>; actions: RunActions }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <Header title="Stiltzkin" subtitle={'"I\'m traveling the world, kupo! Special prices, just for you!"'} gil={run.gil} />
      <div className="grid gap-3 sm:grid-cols-3">
        {phase.offers.map((o, i) => {
          const bought = phase.bought.includes(i);
          const afford = run.gil >= o.price;
          const single = o.items.length === 1;
          return single ? (
            <ItemCard
              key={i}
              itemId={o.items[0]!}
              onClick={!bought && afford && !actions.buyOffer.isPending ? () => actions.buyOffer.mutate({ index: i }) : undefined}
              footer={
                <div className="flex justify-between text-sm">
                  <span className="text-pink-200">{o.label}</span>
                  <span className={afford ? "" : "text-red-300"}>{bought ? "Sold" : `${o.price} gil`}</span>
                </div>
              }
            />
          ) : (
            <button
              key={i}
              className="ff-window flex flex-col gap-1 p-3 text-left enabled:hover:brightness-125 disabled:opacity-50"
              disabled={bought || !afford || actions.buyOffer.isPending}
              onClick={() => actions.buyOffer.mutate({ index: i })}
            >
              <span className="text-lg">{o.label}</span>
              <span className="text-sm text-[#c8d0ff]">{summarize(o.items)}</span>
              <span className={`mt-auto text-right text-sm ${afford ? "" : "text-red-300"}`}>{bought ? "Sold" : `${o.price} gil`}</span>
            </button>
          );
        })}
      </div>
      <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
        Farewell, kupo
      </button>
    </div>
  );
}

function summarize(ids: number[]) {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => `${itemName(id)}${n > 1 ? ` ×${n}` : ""}`).join(", ");
}

function spotLabel(spot: ChocoboSpot) {
  if (spot.type === "gil") return `${spot.amount} gil`;
  if (spot.type === "item") return findItem(spot.itemId)?.name ?? "Treasure";
  return "Nothing…";
}

export function ChocoboPanel({ run, phase, actions }: { run: RunState; phase: Extract<RunPhase, { kind: "chocobo" }>; actions: RunActions }) {
  const done = phase.digsLeft <= 0;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <Header title="Chocobo Hot & Cold" subtitle={done ? "Choco's all tuckered out. Kweh!" : `Pick a spot to dig — ${phase.digsLeft} dig${phase.digsLeft === 1 ? "" : "s"} left`} gil={run.gil} />
      <div className="grid grid-cols-3 gap-3">
        {phase.spots.map((spot, i) => {
          const dug = phase.dug.includes(i);
          const revealed = dug || done;
          return (
            <button
              key={i}
              className={`ff-window flex aspect-square flex-col items-center justify-center gap-1 p-2 text-center enabled:hover:brightness-125 ${
                revealed ? (dug ? "" : "opacity-50") : ""
              }`}
              disabled={revealed || actions.dig.isPending}
              onClick={() => actions.dig.mutate({ index: i })}
            >
              {revealed ? (
                <>
                  <span className={`text-3xl ${dug ? "ff-pop" : ""}`}>{spot.type === "nothing" ? "·" : spot.type === "gil" ? "💰" : "✦"}</span>
                  <span className={`text-sm ${dug && spot.type !== "nothing" ? "text-yellow-200" : ""}`}>{spotLabel(spot)}</span>
                </>
              ) : (
                <span className="text-3xl opacity-70">?</span>
              )}
            </button>
          );
        })}
      </div>
      <button className="ff-window mx-auto px-6 py-2 text-lg" onClick={() => actions.leave.mutate()}>
        {done ? "Ride on" : "Leave early"}
      </button>
    </div>
  );
}
