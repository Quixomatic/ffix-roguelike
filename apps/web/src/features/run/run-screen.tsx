import { WORLDS } from "@ffix-roguelike/game-core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { BattleView } from "@/features/battle/battle-view";
import { useBattleScript } from "@/features/battle/use-battle-script";

import { Overworld } from "./overworld";
import { PartySidebar } from "./party-sidebar";
import { RunCharacterSheet } from "./run-character-sheet";
import { RunDock } from "./run-dock";
import { ChocoboPanel, StiltzkinPanel } from "./special-panels";
import { EventPanel, MooglePanel, RewardsPanel, RunOverPanel, ShopPanel, SynthPanel, TreasurePanel, WorldClearPanel } from "./stage-panels";
import { useActiveRun, useRunActions } from "./use-run";

/**
 * The whole run, driven by the server's run state. Outside battle: the party down the left, the map (or the
 * current stage's screen) filling the middle, and dock tabs on the right that slide out item/gear/run panels.
 */
export function RunScreen() {
  const active = useActiveRun();
  const actions = useRunActions();
  const run = active.data?.state;
  const [managing, setManaging] = useState<string | null>(null);
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

  if (phase.kind === "battle")
    return (
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-3">
        {actions.finishBattle.isPending && <div className="ff-window mx-auto px-4 py-1">Verifying battle…</div>}
        {!scriptReady && <div className="ff-window mx-auto px-4 py-1">Loading battle…</div>}
        {scriptReady && (
          <BattleView
            key={`${phase.nodeId}-${run.stats.battles}`}
            initial={phase.battle}
            theme={WORLDS[run.world]!.theme}
            onEnd={(final) => actions.finishBattle.mutate({ inputs: final.inputs })}
          />
        )}
      </div>
    );

  if (phase.kind === "over")
    return (
      <div className="min-h-0 overflow-y-auto p-3">
        <RunOverPanel run={run} report={actions.report} />
      </div>
    );

  const canManage = ["map", "moogle", "shop", "synth", "stiltzkin", "chocobo", "rewards", "treasure", "worldClear"].includes(phase.kind);

  return (
    <div className="grid min-h-0 gap-2 p-2 lg:grid-cols-[17rem_1fr]">
      <PartySidebar run={run} actions={actions} canManage={canManage} onManage={setManaging} />
      <main className="relative min-h-[60vh] overflow-hidden rounded-lg bg-black/40">
        {phase.kind === "map" ? (
          <div className="absolute inset-0">
            <Overworld run={run} busy={actions.move.isPending} onMove={(nodeId) => actions.move.mutate({ nodeId })} />
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto p-3 pr-20">
            {phase.kind === "rewards" && <RewardsPanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "treasure" && <TreasurePanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "shop" && <ShopPanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "synth" && <SynthPanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "stiltzkin" && <StiltzkinPanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "chocobo" && <ChocoboPanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "moogle" && <MooglePanel run={run} actions={actions} />}
            {phase.kind === "event" && <EventPanel run={run} phase={phase} actions={actions} />}
            {phase.kind === "worldClear" && <WorldClearPanel run={run} actions={actions} />}
          </div>
        )}
        <RunDock run={run} actions={actions} canManage={canManage} />
      </main>
      {managing && canManage && <RunCharacterSheet run={run} keyName={managing} actions={actions} onClose={() => setManaging(null)} />}
    </div>
  );
}
