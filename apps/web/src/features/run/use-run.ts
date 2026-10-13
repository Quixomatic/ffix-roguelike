import type { RunState } from "@ffix-roguelike/game-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export interface RunReport {
  newlyUnlocked: string[];
  tierUnlocked: number | null;
  gilEarned: number;
  /** Gear found this run (unlocked into future drop pools if won). */
  foundGear: number[];
  /** Achievement ids earned by this run. */
  achievements: string[];
  /** Gear newly unlocked by winning. */
  gearUnlocked: number[];
  won: boolean;
  /** Completion Points earned per character. */
  points: Record<string, number>;
}

export function useActiveRun() {
  return useQuery(trpc.run.active.queryOptions());
}

/**
 * All run actions. Each mutation returns the new authoritative state, which is written straight into the
 * `run.active` cache (no refetch). When a run ends, the server's report is kept for the results screen.
 */
export function useRunActions() {
  const qc = useQueryClient();
  const [report, setReport] = useState<RunReport | null>(null);
  const activeKey = trpc.run.active.queryKey();

  const onSuccess = (data: { state: RunState; report: RunReport | null }) => {
    qc.setQueryData(activeKey, (prev) => (prev ? { ...prev, state: data.state } : prev));
    if (data.report) {
      setReport(data.report);
      qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() });
    }
  };
  const onError = (e: { message: string }) => toast.error(e.message);
  const opts = { onSuccess, onError };

  return {
    report,
    clearReport: () => setReport(null),
    move: useMutation(trpc.run.move.mutationOptions(opts)),
    finishBattle: useMutation(trpc.run.finishBattle.mutationOptions(opts)),
    claim: useMutation(trpc.run.claim.mutationOptions(opts)),
    buy: useMutation(trpc.run.buy.mutationOptions(opts)),
    synthesize: useMutation(trpc.run.synthesize.mutationOptions(opts)),
    sell: useMutation(trpc.run.sell.mutationOptions(opts)),
    buyOffer: useMutation(trpc.run.buyOffer.mutationOptions(opts)),
    dig: useMutation(trpc.run.dig.mutationOptions(opts)),
    leave: useMutation(trpc.run.leave.mutationOptions(opts)),
    choose: useMutation(trpc.run.choose.mutationOptions(opts)),
    nextWorld: useMutation(trpc.run.nextWorld.mutationOptions(opts)),
    equip: useMutation(trpc.run.equip.mutationOptions(opts)),
    optimize: useMutation(trpc.run.optimize.mutationOptions(opts)),
    setSupports: useMutation(trpc.run.setSupports.mutationOptions(opts)),
    useItem: useMutation(trpc.run.useItem.mutationOptions(opts)),
    abandon: useMutation(trpc.run.abandon.mutationOptions(opts)),
  };
}

export type RunActions = ReturnType<typeof useRunActions>;
