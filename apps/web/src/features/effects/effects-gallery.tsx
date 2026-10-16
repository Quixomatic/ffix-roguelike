import { actions, bestiary } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import initialMap from "./ability-effects.json";
import { EffectStage } from "./effect-stage";
import { EFFECT_BASE, type EffectPhase } from "./ffrk-effect";

interface IndexEntry {
  phases: EffectPhase[];
  images: string[];
  sounds: string[];
}
export interface EffectAssignment {
  hit?: number;
  launch?: number;
  shot?: number;
  note?: string;
}
type EffectMap = { abilities: Record<string, EffectAssignment> };

/** Every FF9 move an effect can be assigned to: party abilities ("a:<id>") and enemy attacks ("e:<uid>"). */
function useMoves() {
  return useMemo(() => {
    const party = actions.filter((a) => a.name && a.name !== "—").map((a) => ({ key: `a:${a.id}`, name: a.name, kind: "Party" as const }));
    const seen = new Set<string>();
    const enemy = bestiary.actions
      .filter((a) => a.name && !seen.has(a.name) && seen.add(a.name))
      .map((a) => ({ key: `e:${a.uid}`, name: a.name, kind: "Enemy" as const }));
    return [...party, ...enemy];
  }, []);
}

/**
 * Dev tool: browse every downloaded FFRK effect, watch it loop on a target, and assign it to FF9 moves. Saves to
 * `src/features/effects/ability-effects.json` through the dev server.
 */
export function EffectsGallery() {
  const index = useQuery({
    queryKey: ["ffrk-effects-index"],
    queryFn: async () => (await (await fetch(`${EFFECT_BASE}/index.json`)).json()) as Record<string, IndexEntry>,
    enabled: import.meta.env.DEV,
    staleTime: Infinity,
  });
  const moves = useMoves();
  const [map, setMap] = useState<EffectMap>(initialMap as EffectMap);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [phase, setPhase] = useState<EffectPhase>("hit");
  const [speed, setSpeed] = useState(1);
  const [moveFilter, setMoveFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const used = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const [k, v] of Object.entries(map.abilities)) for (const id of [v.hit, v.launch, v.shot]) if (id != null) m.set(id, [...(m.get(id) ?? []), k]);
    return m;
  }, [map]);
  const moveName = (key: string) => moves.find((m) => m.key === key)?.name ?? key;

  const ids = useMemo(() => {
    const all = Object.entries(index.data ?? {});
    const q = filter.trim().toLowerCase();
    return all
      .filter(([id, e]) => !q || id.startsWith(q) || e.images.some((i) => i.toLowerCase().includes(q)) || (used.get(Number(id)) ?? []).some((k) => moveName(k).toLowerCase().includes(q)))
      .map(([id, e]) => ({ id: Number(id), ...e }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index.data, filter, used]);

  const entry = selected != null ? index.data?.[selected] : undefined;
  const matchingMoves = moveFilter.trim() ? moves.filter((m) => m.name.toLowerCase().includes(moveFilter.trim().toLowerCase())).slice(0, 30) : [];

  async function save(next: EffectMap) {
    setMap(next);
    setSaving(true);
    await fetch(`${EFFECT_BASE}/__map`, { method: "PUT", body: `${JSON.stringify(next, null, 2)}\n` });
    setSaving(false);
  }
  function assign(key: string) {
    if (selected == null) return;
    const cur = map.abilities[key] ?? {};
    void save({ abilities: { ...map.abilities, [key]: { ...cur, [phase]: selected } } });
  }
  function unassign(key: string, ph: EffectPhase) {
    const cur = { ...map.abilities[key] };
    delete cur[ph];
    const abilities = { ...map.abilities };
    if (cur.hit == null && cur.launch == null && cur.shot == null) delete abilities[key];
    else abilities[key] = cur;
    void save({ abilities });
  }

  if (!import.meta.env.DEV) return <div className="p-6">The effects gallery only runs in development (it reads the downloaded FFRK library).</div>;

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[16rem_1fr_20rem] gap-3 p-3">
      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        <input className="rounded bg-black/40 px-2 py-1 text-sm" placeholder="id, art (fire, cure…), or move" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="text-xs opacity-70">{index.isLoading ? "Loading index…" : `${ids.length} effects`}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {ids.map((e) => (
            <button
              key={e.id}
              className="flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left text-sm hover:bg-white/10 data-[on=true]:bg-yellow-300/20"
              data-on={selected === e.id}
              onClick={() => {
                setSelected(e.id);
                setPhase(e.phases.includes("hit") ? "hit" : e.phases[0]!);
              }}
            >
              <span className="tabular-nums">{e.id}</span>
              <span className="truncate text-xs opacity-60">{(used.get(e.id) ?? []).map(moveName).join(", ") || e.images.map((i) => i.replace(/^img_(eff_)?/, "")).join(" ")}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="ff-display text-lg">{selected ?? "Pick an effect"}</span>
          {entry?.phases.map((p) => (
            <button key={p} className="ff-option px-2 data-[on=true]:text-yellow-200" data-on={phase === p} onClick={() => setPhase(p)}>
              {p}
            </button>
          ))}
          <span className="ml-auto">Speed</span>
          {[0.25, 0.5, 1, 2].map((s) => (
            <button key={s} className="ff-option px-2 data-[on=true]:text-yellow-200" data-on={speed === s} onClick={() => setSpeed(s)}>
              ×{s}
            </button>
          ))}
        </div>
        <EffectStage id={selected} phase={phase} speed={speed} className="min-h-0 flex-1 overflow-hidden rounded" />
        {entry && <div className="text-xs opacity-70">Art: {entry.images.join(", ") || "—"} · Sounds: {entry.sounds.join(", ") || "—"}</div>}
      </div>

      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        <div className="ff-title">Assign {selected != null ? `${selected} (${phase})` : ""} to a move {saving && <span className="text-xs opacity-60">saving…</span>}</div>
        <input className="rounded bg-black/40 px-2 py-1 text-sm" placeholder="Search FF9 moves (Fire, Cure, Goblin Punch…)" value={moveFilter} onChange={(e) => setMoveFilter(e.target.value)} />
        <div className="max-h-64 overflow-y-auto">
          {matchingMoves.map((m) => (
            <button key={m.key} className="flex w-full justify-between rounded px-1.5 py-0.5 text-left text-sm hover:bg-white/10 disabled:opacity-40" disabled={selected == null} onClick={() => assign(m.key)}>
              <span>{m.name}</span>
              <span className="text-xs opacity-60">
                {m.kind} {map.abilities[m.key]?.[phase] != null ? `· ${phase} ${map.abilities[m.key]![phase]}` : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="ff-title mt-2">Assigned ({Object.keys(map.abilities).length})</div>
        <div className="min-h-0 flex-1 overflow-y-auto text-sm">
          {Object.entries(map.abilities)
            .sort((a, b) => moveName(a[0]).localeCompare(moveName(b[0])))
            .map(([k, v]) => (
              <div key={k} className="flex flex-wrap items-baseline gap-1.5 border-b border-white/10 py-0.5">
                <span className="flex-1">{moveName(k)}</span>
                {(["launch", "shot", "hit"] as const).map((ph) =>
                  v[ph] != null ? (
                    <span key={ph} className="flex items-center gap-0.5 text-xs">
                      <button className="underline decoration-dotted" onClick={() => (setSelected(v[ph]!), setPhase(ph))}>
                        {ph} {v[ph]}
                      </button>
                      <button className="opacity-50 hover:opacity-100" onClick={() => unassign(k, ph)} aria-label="Remove">
                        ✕
                      </button>
                    </span>
                  ) : null,
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
