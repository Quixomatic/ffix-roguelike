import { WORLDS } from "@ffix-roguelike/game-core";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AREA_MUSIC, MUSIC_SLOTS, useMusic } from "@/features/audio/music";
import { BattleView } from "@/features/battle/battle-view";
import { useBattleScript } from "@/features/battle/use-battle-script";
import { actionForKey, type Action } from "@/features/input/actions";
import { FocusItem, FocusSection } from "@/features/input/focus";
import { dialogOpen, isEditable, MENU_EVENT } from "@/features/input/nav";
import { inputOwner } from "@/features/input/owner";

import { Overworld } from "./overworld";
import { PartySidebar, type PartyLayout } from "./party-sidebar";
import { RunCharacterSheet } from "./run-character-sheet";
import { RunDock, type DockTab } from "./run-dock";
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
  const [dock, setDock] = useState<DockTab | null>(null);
  const [partyLayout, setPartyLayout] = usePartyLayout();
  const floating = partyLayout === "overlay";
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
  const canManage = ["map", "moogle", "shop", "synth", "stiltzkin", "chocobo", "rewards", "treasure", "worldClear"].includes(phase.kind);

  if (phase.kind === "battle")
    return (
      <div className="relative flex h-svh min-h-0 flex-col p-4">
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
      <FocusSection key="over" focusKey="run-over" autoFocus>
        <div className="min-h-0 overflow-y-auto p-3">
          <RunOverPanel run={run} report={actions.report} />
        </div>
      </FocusSection>
    );

  const partyProps = {
    run,
    actions,
    canManage,
    onManage: setManaging,
    onBag: () => setDock("inventory"),
    layout: partyLayout,
    onLayout: setPartyLayout,
  };

  return (
    <>
    <RunButtons
      onAction={(a) => {
        // Y: the party (character sheets, LB / RB through the members). X: the bag. Start: the hub's menu.
        if (a === "triangle" && canManage) setManaging(run.party[0]!.build.key);
        else if (a === "x") setDock("inventory");
        else if (a === "menu") window.dispatchEvent(new Event(MENU_EVENT));
      }}
    />
    {/* Fills the window with an even 1rem margin (the hub's menu button floats inside the game frame's top-left corner).
        The map / stage fills it; the party floats over its right edge, or sits in its own column beside it ("docked"). */}
    <div className={`grid h-svh min-h-0 gap-3 p-4 ${floating ? "" : "lg:grid-cols-[1fr_18.75rem]"}`}>
      <main className="ff-frame relative min-h-[60vh] overflow-hidden">
        {phase.kind === "map" ? (
          <div className="absolute inset-0">
            <Overworld
              run={run}
              // The floating sidebar (18.75rem, the ad's 300px, + its 0.75rem margin) covers the map's right edge.
              insetRight={floating ? 19.5 * REM : 0}
              busy={actions.move.isPending}
              onMove={(nodeId) => actions.move.mutate({ nodeId })}
              onAction={(a) => {
                if (a === "triangle") setManaging(run.party[0]!.build.key);
                else if (a === "x") setDock("inventory");
                else if (a === "menu") window.dispatchEvent(new Event(MENU_EVENT));
              }}
            />
          </div>
        ) : (
          // Each stage's screen is its own cursor section (inside the hub's page section — its own key, never "page"):
          // arriving on it puts the cursor on its first item.
          <FocusSection key={`${run.world}-${run.position}-${phase.kind}`} focusKey="run-stage" autoFocus>
          <div className={`absolute inset-0 overflow-y-auto p-3 pt-14 ${floating ? "pr-[20.25rem]" : ""}`}>
            {/* pt-14: room for the menu button floating in the frame's corner. */}
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
        <RunDock run={run} actions={actions} canManage={canManage} tab={dock} onTab={setDock} besideParty={floating} />
        {floating && <PartySidebar {...partyProps} className="absolute bottom-3 right-3 top-3 z-20 w-[18.75rem]" />}
      </main>
      {!floating && <PartySidebar {...partyProps} />}
      {managing && canManage && (
        <RunCharacterSheet run={run} keyName={managing} actions={actions} onClose={() => setManaging(null)} onSwitch={setManaging} />
      )}
    </div>
    </>
  );
}

const PARTY_LAYOUT_KEY = "ffix-run-party-layout";
/** Pixels per rem (the root font size), for sizes the canvas needs in pixels. */
const REM = typeof document === "undefined" ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/** The party's place on the run screen (floating over the game, or docked beside it), remembered in this browser. */
function usePartyLayout(): [PartyLayout, (layout: PartyLayout) => void] {
  const [layout, setLayout] = useState<PartyLayout>(() => {
    try {
      return localStorage.getItem(PARTY_LAYOUT_KEY) === "docked" ? "docked" : "overlay";
    } catch {
      return "overlay";
    }
  });
  const set = (next: PartyLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(PARTY_LAYOUT_KEY, next);
    } catch {
      /* not remembered */
    }
  };
  return [layout, set];
}

/**
 * The run's shortcuts on the stage screens (shops, rewards…), where the menus have the controls: C / Y opens the
 * party, X the bag. (On the map, the map's own controls send them — see Overworld.) Not while a panel or dialog is up.
 */
function RunButtons({ onAction }: { onAction(a: Action): void }) {
  const ref = useRef(onAction);
  ref.current = onAction;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || inputOwner() !== "menu" || dialogOpen() || isEditable(e.target as Element)) return;
      const a = actionForKey(e);
      if (a !== "triangle" && a !== "x") return;
      // Only when nothing has claimed the controls over the run (a dock panel, the menu).
      if (document.querySelector("[data-run-panel]")) return;
      e.preventDefault();
      ref.current(a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
