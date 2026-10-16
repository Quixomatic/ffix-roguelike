import { WORLDS } from "@ffix-roguelike/game-core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AREA_MUSIC, MUSIC_SLOTS, useMusic } from "@/features/audio/music";
import { BattleView } from "@/features/battle/battle-view";
import { useBattleScript } from "@/features/battle/use-battle-script";
import { FocusItem, FocusSection } from "@/features/input/focus";
import { PAGE_FOCUS } from "@/features/input/nav";

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
  // Music: the area's theme on the map and its stages; battles pick their own (BattleView); the fanfare carries on
  // through the rewards; a finished run plays the fanfare or Game Over.
  useMusic(
    !run || run.phase.kind === "battle"
      ? undefined
      : run.phase.kind === "rewards"
        ? MUSIC_SLOTS.victory
        : run.phase.kind === "over"
          ? run.phase.won
            ? MUSIC_SLOTS.victory
            : MUSIC_SLOTS.gameOver
          : (AREA_MUSIC[WORLDS[run.world]!.id] ?? MUSIC_SLOTS.overworld),
  );

  if (active.isPending) return <div className="p-6">Loading…</div>;
  if (!run) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 p-8">
        <div className="ff-window px-6 py-4 text-xl">No run in progress.</div>
        <FocusItem>
          <Link to="/play" className="ff-window px-6 py-2 text-lg">
            Go to camp
          </Link>
        </FocusItem>
      </div>
    );
  }

  const phase = run.phase;

  if (phase.kind === "battle")
    return (
      <div className="relative flex h-full min-h-0 flex-col p-2">
        {(actions.finishBattle.isPending || !scriptReady) && (
          <div className="ff-window absolute left-1/2 top-4 z-30 -translate-x-1/2 px-4 py-1">{scriptReady ? "Verifying battle…" : "Loading battle…"}</div>
        )}
        {scriptReady && (
          <div className="min-h-0 flex-1">
            <BattleView
              key={`${phase.nodeId}-${run.stats.battles}`}
              initial={phase.battle}
              theme={WORLDS[run.world]!.theme}
              music={phase.nodeKind === "boss" || phase.nodeKind === "semiboss" ? MUSIC_SLOTS.boss : MUSIC_SLOTS.battle}
              onEnd={(final) => actions.finishBattle.mutate({ inputs: final.inputs })}
            />
          </div>
        )}
      </div>
    );

  if (phase.kind === "over")
    return (
      <FocusSection key="over" focusKey={PAGE_FOCUS} autoFocus>
        <div className="min-h-0 overflow-y-auto p-3">
          <RunOverPanel run={run} report={actions.report} />
        </div>
      </FocusSection>
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
          // Each stage's screen is the page's cursor section: arriving on it puts the cursor on its first item.
          <FocusSection key={`${run.world}-${run.position}-${phase.kind}`} focusKey={PAGE_FOCUS} autoFocus>
          <div className="absolute inset-0 overflow-y-auto p-3 pb-16">
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
          </FocusSection>
        )}
        <RunDock run={run} actions={actions} canManage={canManage} />
      </main>
      {managing && canManage && <RunCharacterSheet run={run} keyName={managing} actions={actions} onClose={() => setManaging(null)} />}
    </div>
  );
}
