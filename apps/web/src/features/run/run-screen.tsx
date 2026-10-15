import { WORLDS } from "@ffix-roguelike/game-core";
import { Link } from "@tanstack/react-router";

import { BattleView } from "@/features/battle/battle-view";
import { useBattleScript } from "@/features/battle/use-battle-script";

import { Overworld } from "./overworld";
import { PartyPanel } from "./party-panel";
import { ChocoboPanel, StiltzkinPanel } from "./special-panels";
import { EventPanel, MooglePanel, RewardsPanel, RunOverPanel, ShopPanel, SynthPanel, TreasurePanel, WorldClearPanel } from "./stage-panels";
import { useActiveRun, useRunActions } from "./use-run";

/** The whole run: overworld map, battles and stage screens, driven by the server's run state. */
export function RunScreen() {
  const active = useActiveRun();
  const actions = useRunActions();
  const run = active.data?.state;
  // The fight's FF9 AI script (fetched per battle) must be registered before its engine runs. Hooks stay above
  // the early returns so every render calls the same ones.
  const scriptReady = useBattleScript(run?.phase.kind === "battle" ? run.phase.battle.scene : undefined);

  if (active.isPending) return <div className="p-6">Loading…</div>;
  if (!run) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-8">
        <div className="ff-window px-6 py-4 text-xl">No run in progress.</div>
        <Link to="/play" className="ff-window px-6 py-2 text-lg">
          Go to camp
        </Link>
      </div>
    );
  }

  const phase = run.phase;
  const inBattle = phase.kind === "battle";
  const canManage = ["map", "moogle", "shop", "synth", "stiltzkin", "chocobo", "rewards", "treasure", "worldClear"].includes(phase.kind);

  return (
    <div className="flex flex-col gap-3 p-3 lg:flex-row">
      <div className="min-w-0 flex-1">
        {phase.kind === "map" && <Overworld run={run} busy={actions.move.isPending} onMove={(nodeId) => actions.move.mutate({ nodeId })} />}
        {phase.kind === "battle" && (
          <div className="flex flex-col gap-2">
            {actions.finishBattle.isPending && <div className="ff-window mx-auto px-4 py-1">Verifying battle…</div>}
            {!scriptReady && <div className="ff-window mx-auto px-4 py-1">Loading battle…</div>}
            {scriptReady && <BattleView
              key={`${phase.nodeId}-${run.stats.battles}`}
              initial={phase.battle}
              theme={WORLDS[run.world]!.theme}
              onEnd={(final) => actions.finishBattle.mutate({ inputs: final.inputs })}
            />}
          </div>
        )}
        {phase.kind === "rewards" && <RewardsPanel phase={phase} actions={actions} />}
        {phase.kind === "treasure" && <TreasurePanel phase={phase} actions={actions} />}
        {phase.kind === "shop" && <ShopPanel run={run} phase={phase} actions={actions} />}
        {phase.kind === "synth" && <SynthPanel run={run} phase={phase} actions={actions} />}
        {phase.kind === "stiltzkin" && <StiltzkinPanel run={run} phase={phase} actions={actions} />}
        {phase.kind === "chocobo" && <ChocoboPanel run={run} phase={phase} actions={actions} />}
        {phase.kind === "moogle" && <MooglePanel run={run} actions={actions} />}
        {phase.kind === "event" && <EventPanel run={run} phase={phase} actions={actions} />}
        {phase.kind === "worldClear" && <WorldClearPanel run={run} actions={actions} />}
        {phase.kind === "over" && <RunOverPanel run={run} report={actions.report} />}
      </div>
      {!inBattle && phase.kind !== "over" && (
        <aside className="flex w-full flex-col gap-2 lg:w-64">
          <PartyPanel run={run} actions={actions} canManage={canManage} />
          <button
            className="mt-2 text-sm text-red-300 opacity-70 hover:opacity-100"
            onClick={() => {
              if (confirm("Abandon this run? You still earn Completion Points and keep learned abilities; gear found this run is lost.")) actions.abandon.mutate();
            }}
          >
            Abandon run
          </button>
        </aside>
      )}
    </div>
  );
}
