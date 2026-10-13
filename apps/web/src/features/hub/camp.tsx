import { deriveStats, MAX_TIER } from "@ffix-roguelike/game-core";
import { getCharacter } from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { itemName } from "@/features/run/item-info";

import { LoadoutSheet } from "./loadout";
import { trpc } from "@/utils/trpc";

/** Between runs: the roster, party picker, difficulty tier and lifetime stats. */
export function Camp() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [party, setParty] = useState<string[]>([]);
  const [tier, setTier] = useState(0);
  const [loadout, setLoadout] = useState<string | null>(null);

  const start = useMutation(
    trpc.run.start.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: trpc.run.active.queryKey() });
        await qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() });
        navigate({ to: "/run" });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (profile.isPending) return <div className="p-6">Loading…</div>;
  if (!profile.data) return null;
  const p = profile.data;
  const chosen = party.length ? party : p.unlocked.slice(0, 4);

  const toggle = (key: string) =>
    setParty((cur) => {
      const base = cur.length ? cur : p.unlocked.slice(0, 4);
      if (base.includes(key)) return base.filter((k) => k !== key);
      return base.length >= 4 ? base : [...base, key];
    });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="ff-window flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <div className="text-2xl">Camp</div>
          <div className="ff-title">
            Runs {p.stats.runs} · Wins {p.stats.wins} · Battles {p.stats.battles} · {p.gil} gil banked
          </div>
        </div>
        {p.activeRunId ? (
          <Link to="/run" className="ff-window px-6 py-2 text-xl">
            Continue run ▶
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Tier
              <select className="rounded bg-[#0c1238] px-2 py-1" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
                {Array.from({ length: Math.min(MAX_TIER, p.maxTier) + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "Tier 0 (Normal)" : `Tier ${i}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ff-window px-6 py-2 text-xl disabled:opacity-50"
              disabled={!chosen.length || start.isPending}
              onClick={() => start.mutate({ party: chosen, tier })}
            >
              Begin run ▶
            </button>
          </div>
        )}
      </div>

      <div className="ff-title px-1 text-base">Party — pick up to 4 {p.activeRunId ? "(after this run)" : ""}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {p.unlocked.map((key) => {
          const b = p.builds[key]!;
          const st = deriveStats(b);
          const inParty = chosen.includes(key);
          return (
            <button
              key={key}
              className="ff-window flex flex-col gap-1 p-3 text-left enabled:hover:brightness-125 data-[on=true]:outline data-[on=true]:outline-2 data-[on=true]:outline-yellow-300"
              data-on={inParty}
              disabled={!!p.activeRunId}
              onClick={() => toggle(key)}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xl">{getCharacter(key).name}</span>
                <span className="ff-title">Lv {b.level}</span>
              </div>
              <div className="text-sm">
                HP {st.maxHp} · MP {st.maxMp}
              </div>
              <div className="text-xs text-[#c8d0ff]">
                {[b.equipment.weapon, b.equipment.armor].filter((x): x is number => x != null).map(itemName).join(" · ")}
              </div>
              <div className="text-xs opacity-70">{Object.values(b.ap).filter(Boolean).length} abilities in progress</div>
              {!p.activeRunId && (
                <span
                  role="button"
                  className="mt-1 self-start rounded border border-white/40 px-2 text-xs hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLoadout(key);
                  }}
                >
                  Loadout
                </span>
              )}
            </button>
          );
        })}
        {p.locked.map((l) => (
          <div key={l.key} className="ff-window flex flex-col gap-1 p-3 opacity-60">
            <span className="text-xl">???</span>
            <span className="text-sm">Unlock: {l.hint}</span>
          </div>
        ))}
      </div>

      {Object.keys(p.stash).length > 0 && (
        <div className="ff-window p-3">
          <div className="ff-title mb-1">Stash (gear you own)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {Object.entries(p.stash).map(([id, n]) => (
              <span key={id}>
                {itemName(Number(id))} ×{n}
              </span>
            ))}
          </div>
        </div>
      )}

      {loadout && <LoadoutSheet build={p.builds[loadout]!} stash={p.stash} onClose={() => setLoadout(null)} />}

      <div className="ff-window p-3 text-sm leading-relaxed">
        <div className="ff-title mb-1">How runs work</div>
        Cross three worlds — Cornelia, Baron and the World of Ruin — to the boss castle at the end of each map. You start alone with Zidane;
        companions join your roster as you progress. Levels are permanent, and leveling up unlocks gear slots you can pre-equip from your stash
        before a run. Gear teaches abilities while equipped — fill their AP to master them forever (equip support abilities with magic stones,
        which grow with level). Gear you find is only yours for keeps once a Moogle mails it home, or you win. Fall, and you start again — stronger.
      </div>
    </div>
  );
}
