import { getCharacter, ROSTER } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Panel } from "@/features/gear/character-panels";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { trpc } from "@/utils/trpc";

import { ThemePreview } from "./theme-preview";

/** Dev/admin tools (development only): roster unlocks, Completion Points and banked gil on your own profile. */
export function DevPage() {
  const qc = useQueryClient();
  const enabled = useQuery(trpc.dev.enabled.queryOptions());
  const profile = useQuery(trpc.profile.get.queryOptions());
  const opts = {
    onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
    onError: (e: { message: string }) => toast.error(e.message),
  };
  const setUnlocked = useMutation(trpc.dev.setUnlocked.mutationOptions(opts));
  const grantPoints = useMutation(trpc.dev.grantPoints.mutationOptions(opts));
  const grantGil = useMutation(trpc.dev.grantGil.mutationOptions(opts));
  const p = profile.data;

  if (enabled.data === false)
    return (
      <div className="ff-window m-4 p-4">
        Dev tools are off: they need an admin account (apps/server: <code>bun scripts/set-role.ts &lt;email&gt; admin</code>) and a server in
        development mode.
      </div>
    );
  if (!p) return <div className="p-4">Loading…</div>;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4">
      <div className="ff-window flex items-center justify-between p-3">
        <span className="ff-display text-2xl">Dev tools</span>
        <span className="text-sm text-orange-300">Development only — changes your real profile</span>
      </div>

      <div className="ff-window grid gap-3 p-3">
        <Panel title="Roster" right={<span className="opacity-70">unlock / relock characters</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ROSTER.map((key) => {
              const on = p.unlocked.includes(key);
              const b = p.builds[key];
              return (
                <div key={key} className={`flex items-center gap-2 rounded border p-2 ${on ? "border-green-400/50 bg-green-900/20" : "border-white/15 bg-black/25"}`}>
                  <HeroSprite heroKey={key} size={40} silhouette={!on} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{getCharacter(key).name}</div>
                    <div className="text-xs opacity-70">
                      Start Lv {b?.level ?? 1} · {b?.points ?? 0} CP
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      className="rounded border border-white/25 px-2 text-xs hover:brightness-125 disabled:opacity-40"
                      disabled={setUnlocked.isPending || (key === "zidane" && on)}
                      onClick={() => setUnlocked.mutate({ key, unlocked: !on })}
                    >
                      {on ? "Relock" : "Unlock"}
                    </button>
                    <button
                      className="rounded border border-white/25 px-2 text-xs hover:brightness-125 disabled:opacity-40"
                      disabled={grantPoints.isPending}
                      onClick={() => grantPoints.mutate({ key, points: 10 })}
                    >
                      +10 CP
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid gap-3 sm:grid-cols-2">
          <Panel title="Completion Points" right={<span className="opacity-70">everyone on the roster</span>}>
            <div className="flex flex-wrap gap-2">
              {[10, 50, 100].map((n) => (
                <button key={n} className="ff-window px-3 py-1" disabled={grantPoints.isPending} onClick={() => grantPoints.mutate({ points: n })}>
                  +{n} CP
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Banked gil" right={<span className="tabular-nums text-yellow-200">{p.gil}</span>}>
            <div className="flex flex-wrap gap-2">
              {[1000, 10000, 100000].map((n) => (
                <button key={n} className="ff-window px-3 py-1" disabled={grantGil.isPending} onClick={() => grantGil.mutate({ gil: n })}>
                  +{n.toLocaleString()}
                </button>
              ))}
            </div>
          </Panel>
        </div>
        <div className="text-xs opacity-60">Roster changes apply to the next run you start (a run in progress keeps its party).</div>
      </div>

      <div className="ff-window p-3">
        <ThemePreview />
      </div>
    </div>
  );
}
