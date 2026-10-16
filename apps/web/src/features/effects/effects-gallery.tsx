import { actions, bestiary } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import initialMap from "./ability-effects.json";
import { EffectStage } from "./effect-stage";
import { EFFECT_BASE } from "./ffrk-effect";
import { folderRecipe, SPELL_CANDIDATES } from "./spell-candidates";

/** `effects/index.json` (ffrk:effects): folder → its rig files, the effect art and sounds they use. */
type EffectIndex = Record<string, { files: string[]; images: string[]; sounds: string[] }>;
/** `effects/catalog.json` (ffrk:effect-names): FFRK effect id → names and the exact file per phase. */
type EffectCatalog = Record<string, { names: string[]; phases: Record<string, string> }>;

/** What an FF9 move plays: phase key ("launch", "shot", "hit", "hit_1"…) → rig path. */
export interface EffectAssignment {
  phases: Record<string, string>;
  /** Where it came from (FFRK name or folder), for reading the map. */
  from?: string;
}
type EffectMap = { abilities: Record<string, EffectAssignment> };

interface Item {
  key: string;
  label: string;
  sub: string;
  phases: Record<string, string>;
  /** A whole FFRK ability recipe (from captured game data) rather than a folder's files. */
  recipe: boolean;
  search: string;
  /** "FF9 spells" tab: the FF9 spell this candidate is for. */
  spell?: string;
}

const PHASE_ORDER = ["launch", "shot", "hit"];
const phaseSort = (a: string, b: string) => {
  const ia = PHASE_ORDER.findIndex((p) => a.startsWith(p));
  const ib = PHASE_ORDER.findIndex((p) => b.startsWith(p));
  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b, undefined, { numeric: true });
};
const shortPath = (p: string) => p.replace(/^ab\/ability\//, "");

/** Every FF9 move an effect can be assigned to: party abilities ("a:<id>") and enemy attacks ("e:<uid>"). */
function useMoves() {
  return useMemo(() => {
    const party = actions.filter((a) => a.name && a.name !== "—").map((a) => ({ key: `a:${a.id}`, name: a.name, kind: "Party" as const }));
    const seen = new Set<string>();
    const enemy = bestiary.actions.filter((a) => a.name && !seen.has(a.name) && seen.add(a.name)).map((a) => ({ key: `e:${a.uid}`, name: a.name, kind: "Enemy" as const }));
    return [...party, ...enemy];
  }, []);
}

const useJson = <T,>(file: string) =>
  useQuery({
    queryKey: ["ffrk-effects", file],
    queryFn: async () => {
      const r = await fetch(`${EFFECT_BASE}/${file}`);
      return r.ok ? ((await r.json()) as T) : null;
    },
    enabled: import.meta.env.DEV,
    staleTime: Infinity,
  });

/**
 * Dev tool: browse FFRK's effects — its named abilities (with the exact launch/shot/hit files the game used) and
 * every downloaded effect folder — watch them loop on a target, and assign them to FF9 moves. Saves to
 * `src/features/effects/ability-effects.json` through the dev server.
 */
export function EffectsGallery() {
  const index = useJson<EffectIndex>("index.json");
  const catalog = useJson<EffectCatalog>("catalog.json");
  const moves = useMoves();
  const [map, setMap] = useState<EffectMap>(initialMap as EffectMap);
  const [tab, setTab] = useState<"spells" | "named" | "folders">("spells");
  const [filter, setFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("hit");
  const [speed, setSpeed] = useState(1);
  const [moveFilter, setMoveFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const items = useMemo(() => {
    const idx = index.data ?? {};
    const named: Item[] = Object.entries(catalog.data ?? {})
      .filter(([, e]) => e.names.length)
      .map(([id, e]) => {
        // No captured paths: fall back to the folder with the same id, if it was downloaded.
        const phases = Object.keys(e.phases).length ? e.phases : Object.fromEntries((idx[id]?.files ?? []).map((f) => [f.replace(/\.json$/, "").replace(`${id}_`, ""), `ab/ability/${id}/${f}`]));
        return { key: `n:${id}`, label: e.names.join(" / "), sub: `${id}${Object.keys(e.phases).length ? "" : " (guessed files)"}`, phases, recipe: !!Object.keys(e.phases).length, search: `${id} ${e.names.join(" ")}`.toLowerCase() };
      });
    const folders: Item[] = Object.entries(idx).map(([folder, e]) => ({
      key: `f:${folder}`,
      label: folder,
      sub: `${catalog.data?.[folder]?.names.join(" / ") ?? ""} ${e.images.map((i) => i.replace(/^img_(eff_)?/, "")).join(" ")}`.trim(),
      phases: Object.fromEntries(e.files.map((f) => [f.replace(/\.json$/, "").replace(`${folder}_`, ""), `ab/ability/${folder}/${f}`])),
      recipe: false,
      search: `${folder} ${catalog.data?.[folder]?.names.join(" ") ?? ""} ${e.images.join(" ")}`.toLowerCase(),
    }));
    // FF9 spells with no same-named FFRK ability: each candidate folder as its own entry, to compare and pick.
    const spells: Item[] = SPELL_CANDIDATES.flatMap((sp) =>
      sp.candidates.flatMap((cand, i) => {
        const phases = folderRecipe(cand.folder, idx[cand.folder]?.files ?? [], sp.school);
        if (!phases) return [];
        return [{ key: `s:${sp.name}:${cand.folder}`, label: `${sp.name} — ${cand.folder}${i === 0 ? " (first pick)" : ""}`, sub: cand.why, phases, recipe: true, search: `${sp.name} ${cand.folder} ${cand.why}`.toLowerCase(), spell: sp.name }];
      }),
    );
    return { named, folders, spells };
  }, [index.data, catalog.data]);

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (tab === "spells" ? items.spells : tab === "named" ? items.named : items.folders).filter((i) => !q || i.search.includes(q));
  }, [items, tab, filter]);

  const selected = useMemo(() => [...items.spells, ...items.named, ...items.folders].find((i) => i.key === selectedKey) ?? null, [items, selectedKey]);
  const phaseKeys = selected ? Object.keys(selected.phases).sort(phaseSort) : [];
  const path = selected?.phases[phase] ?? null;
  const moveName = (key: string) => moves.find((m) => m.key === key)?.name ?? key;
  const matchingMoves = moveFilter.trim() ? moves.filter((m) => m.name.toLowerCase().includes(moveFilter.trim().toLowerCase())).slice(0, 30) : [];

  function select(item: Item) {
    setSelectedKey(item.key);
    const keys = Object.keys(item.phases);
    setPhase(keys.find((k) => k === "hit") ?? keys.find((k) => k.startsWith("hit")) ?? keys.sort(phaseSort)[0] ?? "hit");
  }
  /** Sends only the changed moves; the dev server merges them into the file and returns the whole map, so a stale tab
   *  never overwrites assignments made elsewhere (e.g. by `effects:seed`). */
  async function save(set: EffectMap["abilities"], remove: string[] = []) {
    const abilities = { ...map.abilities, ...set };
    for (const key of remove) delete abilities[key];
    setMap({ abilities });
    setSaving(true);
    try {
      const res = await fetch(`${EFFECT_BASE}/__map`, { method: "PUT", body: JSON.stringify({ set, remove }) });
      if (res.ok) setMap((await res.json()) as EffectMap);
    } finally {
      setSaving(false);
    }
  }
  /** Assign the whole recipe (named FFRK ability) or the current file as one phase. */
  function assign(moveKey: string, as: "recipe" | string) {
    if (!selected) return;
    const cur = map.abilities[moveKey]?.phases ?? {};
    const phases = as === "recipe" ? { ...selected.phases } : path ? { ...cur, [as]: path } : cur;
    void save({ [moveKey]: { phases, from: selected.label } });
  }
  /** Assign the selected candidate's recipe to every FF9 move (party and monster) with this spell's name. */
  function useForSpell(spell: string) {
    if (!selected) return;
    const set: EffectMap["abilities"] = {};
    for (const m of moves.filter((m) => m.name === spell)) set[m.key] = { phases: { ...selected.phases }, from: `${spell}: ${selected.label.replace(" (first pick)", "")} — ${selected.sub}` };
    void save(set);
  }
  function unassign(moveKey: string) {
    void save({}, [moveKey]);
  }

  if (!import.meta.env.DEV) return <div className="p-6">The effects gallery only runs in development (it reads the downloaded FFRK library).</div>;

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[18rem_1fr_22rem] gap-3 p-3">
      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        <div className="flex gap-1">
          {(["spells", "named", "folders"] as const).map((t) => (
            <button key={t} className="ff-option flex-1 px-1 text-xs data-[on=true]:text-yellow-200" data-on={tab === t} onClick={() => setTab(t)}>
              {t === "spells" ? `FF9 spells (${SPELL_CANDIDATES.length})` : t === "named" ? `FFRK named (${items.named.length})` : `Folders (${items.folders.length})`}
            </button>
          ))}
        </div>
        <input className="rounded bg-black/40 px-2 py-1 text-sm" placeholder={tab === "named" ? "Fire, Cure, Jump, 11000…" : "folder id, art (fire, slash…)"} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="text-xs opacity-70">{index.isLoading || catalog.isLoading ? "Loading…" : `${list.length} shown`}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.map((i) => (
            <button key={i.key} className="flex w-full flex-col rounded px-1.5 py-0.5 text-left hover:bg-white/10 data-[on=true]:bg-yellow-300/20" data-on={selectedKey === i.key} onClick={() => select(i)}>
              <span className="truncate text-sm">{i.label}</span>
              <span className="truncate text-xs opacity-60">{i.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="ff-display mr-2 text-lg">{selected?.label ?? "Pick an effect"}</span>
          {phaseKeys.map((p) => (
            <button key={p} className="ff-option px-2 data-[on=true]:text-yellow-200" data-on={phase === p} onClick={() => setPhase(p)} title={selected?.phases[p]}>
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
        <EffectStage path={path} speed={speed} className="min-h-0 flex-1 overflow-hidden rounded" />
        <div className="text-xs opacity-70">{path ? shortPath(path) : "—"}</div>
      </div>

      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        {selected?.spell && (
          <button className="ff-window px-3 py-2 text-left hover:brightness-125" onClick={() => useForSpell(selected.spell!)}>
            Use this for every FF9 <span className="text-yellow-200">{selected.spell}</span>
            <span className="block text-xs opacity-70">Now: {moves.filter((m) => m.name === selected.spell).map((m) => map.abilities[m.key]?.from).find(Boolean) ?? "nothing"}</span>
          </button>
        )}
        <div className="ff-title">Assign to an FF9 move {saving && <span className="text-xs opacity-60">saving…</span>}</div>
        <input className="rounded bg-black/40 px-2 py-1 text-sm" placeholder="Search FF9 moves (Fire, Cure, Goblin Punch…)" value={moveFilter} onChange={(e) => setMoveFilter(e.target.value)} />
        <div className="max-h-72 overflow-y-auto">
          {matchingMoves.map((m) => (
            <div key={m.key} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm hover:bg-white/5">
              <span className="flex-1 truncate">
                {m.name} <span className="text-xs opacity-50">{m.kind}</span>
              </span>
              {selected?.recipe && (
                <button className="ff-option px-1.5 text-xs" onClick={() => assign(m.key, "recipe")} title="Use this FFRK ability's whole launch → shot → hit recipe">
                  recipe
                </button>
              )}
              {["launch", "shot", "hit"].map((p) => (
                <button key={p} className="ff-option px-1.5 text-xs disabled:opacity-30" disabled={!path} onClick={() => assign(m.key, p)} title={`Use the shown file as this move's ${p}`}>
                  {p}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="ff-title mt-2">Assigned ({Object.keys(map.abilities).length})</div>
        <div className="min-h-0 flex-1 overflow-y-auto text-sm">
          {Object.entries(map.abilities)
            .sort((a, b) => moveName(a[0]).localeCompare(moveName(b[0])))
            .map(([k, v]) => (
              <div key={k} className="border-b border-white/10 py-1">
                <div className="flex items-baseline gap-2">
                  <span className="flex-1">{moveName(k)}</span>
                  <span className="text-xs opacity-60">{v.from}</span>
                  <button className="text-xs opacity-50 hover:opacity-100" onClick={() => unassign(k)} aria-label="Remove">
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs opacity-80">
                  {Object.entries(v.phases)
                    .sort((a, b) => phaseSort(a[0], b[0]))
                    .map(([ph, p]) => (
                      <span key={ph}>
                        {ph}: {shortPath(p)}
                      </span>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
