import { METRICS, metricDef } from "@ffix-roguelike/game-core";
import { getCharacter, MAIN_CAST } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FocusItem } from "@/features/input/focus";
import { formatMetric, MetricsOverview } from "@/features/hub/stats-page";
import { trpc } from "@/utils/trpc";

const CHARACTERS = [...MAIN_CAST, "beatrix", "blank"];
const inputCls = "rounded border border-white/20 bg-black/30 px-2 py-1 text-sm";

/**
 * Admin: metrics across players (`.plans/metrics.md`) — a leaderboard for any metric (the player's total, the best
 * single character, or one character; overall or one subject), and any player's stats as they see them.
 */
export function MetricsAdminPage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-4">
      <div className="ff-window p-3">
        <div className="ff-display text-2xl">Metrics</div>
        <div className="text-xs opacity-70">Lifetime metrics from verified battles, runs and camp. Pick a player in the leaderboard (or the list) to see their stats.</div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[30rem_minmax(0,1fr)]">
        <Leaderboard onPick={setProfileId} />
        <PlayerStats profileId={profileId} onPick={setProfileId} />
      </div>
    </div>
  );
}

function Leaderboard({ onPick }: { onPick(profileId: string): void }) {
  const [key, setKey] = useState("enemies.killed");
  const [subject, setSubject] = useState("");
  const [character, setCharacter] = useState("");
  const [limit, setLimit] = useState(20);
  const def = metricDef(key);
  const board = useQuery(
    trpc.admin.metricLeaderboard.queryOptions({ key, subject: def?.subject ? subject.trim() || undefined : undefined, character: def?.perCharacter ? character || undefined : undefined, limit }),
  );
  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="ff-display text-lg">Leaderboard</div>
      <label className="flex flex-col gap-0.5 text-xs">
        <span className="opacity-70">Metric</span>
        <FocusItem>
          <select className={inputCls} value={key} onChange={(e) => setKey(e.target.value)}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} ({m.key}){m.agg === "min" ? " · lowest first" : ""}
              </option>
            ))}
          </select>
        </FocusItem>
      </label>
      {def && <div className="text-xs opacity-70">{def.description}</div>}
      <div className="grid grid-cols-3 gap-2">
        {def?.subject && (
          <label className="col-span-3 flex flex-col gap-0.5 text-xs">
            <span className="opacity-70">Subject ({def.subject}; empty = all)</span>
            <FocusItem>
              <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </FocusItem>
          </label>
        )}
        <label className="col-span-2 flex flex-col gap-0.5 text-xs">
          <span className="opacity-70">Counted for</span>
          <FocusItem>
            <select className={inputCls} value={def?.perCharacter ? character : ""} disabled={!def?.perCharacter} onChange={(e) => setCharacter(e.target.value)}>
              <option value="">The player's total</option>
              <option value="any">Best single character</option>
              {CHARACTERS.map((k) => (
                <option key={k} value={k}>
                  {getCharacter(k).name}
                </option>
              ))}
            </select>
          </FocusItem>
        </label>
        <label className="flex flex-col gap-0.5 text-xs">
          <span className="opacity-70">Top</span>
          <FocusItem>
            <select className={inputCls} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </FocusItem>
        </label>
      </div>
      <div className="flex flex-col">
        {board.isPending ? (
          <div className="py-2 text-sm opacity-60">Loading…</div>
        ) : !board.data?.length ? (
          <div className="py-2 text-sm opacity-60">Nobody has this one yet.</div>
        ) : (
          board.data.map((r) => (
            <FocusItem key={`${r.profileId}-${r.rank}`}>
              <button className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-white/10" onClick={() => onPick(r.profileId)}>
                <span className={`w-7 shrink-0 tabular-nums ${r.rank <= 3 ? "text-yellow-200" : "opacity-60"}`}>{r.rank}.</span>
                <span className="min-w-0 flex-1 truncate">
                  {r.name}
                  <span className="ml-1 text-xs opacity-50">{r.email}</span>
                  {r.character && <span className="ml-1 text-xs text-[#c8d0ff]">({getCharacter(r.character).name})</span>}
                </span>
                <span className="tabular-nums text-yellow-200">{formatMetric(def, r.value)}</span>
              </button>
            </FocusItem>
          ))
        )}
      </div>
    </div>
  );
}

function PlayerStats({ profileId, onPick }: { profileId: string | null; onPick(profileId: string): void }) {
  const players = useQuery(trpc.admin.players.queryOptions());
  const stats = useQuery({ ...trpc.admin.playerMetrics.queryOptions({ profileId: profileId ?? "" }), enabled: !!profileId });
  const current = players.data?.find((p) => p.profileId === profileId);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="ff-window flex flex-wrap items-center gap-2 p-3">
        <span className="ff-display text-lg">Player</span>
        <FocusItem>
          <select className={`${inputCls} min-w-64`} value={profileId ?? ""} onChange={(e) => onPick(e.target.value)}>
            <option value="" disabled>
              Pick a player…
            </option>
            {(players.data ?? []).map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.name} · {p.email} · {p.runs} runs
              </option>
            ))}
          </select>
        </FocusItem>
        {current && <span className="text-xs opacity-70">{current.runs} runs</span>}
      </div>
      {!profileId ? (
        <div className="ff-window p-4 text-sm opacity-70">Pick a player to see their stats.</div>
      ) : !stats.data ? (
        <div className="ff-window p-4 text-sm opacity-70">Loading…</div>
      ) : (
        <MetricsOverview bag={stats.data.metrics} characters={stats.data.unlocked} />
      )}
    </div>
  );
}
