import { actions, bestiary, characters, type FF9EnemyAction } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import initialMap from "./ability-effects.json";
import { EffectStage } from "./effect-stage";
import { monsterDefault, PARTY_ATTACK } from "./effect-recipes";
import { EFFECT_BASE } from "./ffrk-effect";
import { ALL_CANDIDATES } from "./move-candidates";
import { folderRecipe } from "./spell-candidates";

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
  /** A whole recipe (FFRK ability, candidate, a move's current effect) rather than one folder's files. */
  recipe: boolean;
  search: string;
  /** "Candidates" tab: the FF9 move name this candidate is for. */
  spell?: string;
}

/**
 * An FF9 move as the gallery maps it: one party ability, or every monster attack sharing a name (FF9 has many
 * same-named copies — each needs the assignment, keyed "e:<uid>").
 */
interface Move {
  id: string;
  name: string;
  kind: "Party" | "Enemy";
  keys: string[];
  /** Party: the command it's under ("Blue Magic", "Sword Art"…); enemies: "Monster". */
  group: string;
  /** A party command move (what the "To map" tab lists for the party; other actions are items and internals). */
  command: boolean;
  /** FF9's script-only staging moves (taunts, phase changes): nothing to play. */
  staging: boolean;
  enemy?: FF9EnemyAction;
}

type Status = "mapped" | "partial" | "default" | "missing" | "staging";
const STATUS: Record<Status, { label: string; className: string }> = {
  mapped: { label: "mapped", className: "text-emerald-300" },
  partial: { label: "partly mapped", className: "text-yellow-200" },
  default: { label: "generic default", className: "text-yellow-200" },
  missing: { label: "needs effect", className: "text-red-300" },
  staging: { label: "staging (plays nothing)", className: "opacity-50" },
};
/** Monster defaults by their hit folder, to say what a move falls back to. */
const DEFAULT_NAMES: Record<string, string> = { "30051": "claw swipe", "20302": "status sparkle", "50220": "bite" };

const PHASE_ORDER = ["launch", "shot", "hit"];
const phaseSort = (a: string, b: string) => {
  const ia = PHASE_ORDER.findIndex((p) => a.startsWith(p));
  const ib = PHASE_ORDER.findIndex((p) => b.startsWith(p));
  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b, undefined, { numeric: true });
};
const shortPath = (p: string) => p.replace(/^ab\/ability\//, "");
const folderOf = (p: string | undefined) => p?.match(/ab\/ability\/([^/]+)\//)?.[1] ?? "";

function useMoves(): Move[] {
  return useMemo(() => {
    const commandOf = new Map<number, string>();
    for (const c of characters) for (const cmd of c.commands ?? []) for (const id of cmd.actionIds ?? []) if (!commandOf.has(id)) commandOf.set(id, cmd.name);
    const party: Move[] = actions
      .filter((a) => a.name && a.name !== "—" && a.id !== PARTY_ATTACK)
      .map((a) => ({ id: `a:${a.id}`, name: a.name, kind: "Party", keys: [`a:${a.id}`], group: commandOf.get(a.id) ?? "Other", command: commandOf.has(a.id), staging: false }));
    const byName = new Map<string, FF9EnemyAction[]>();
    for (const a of bestiary.actions) if (a.name) byName.set(a.name, [...(byName.get(a.name) ?? []), a]);
    const enemy: Move[] = [...byName].map(([name, list]) => ({
      id: `e:${name}`,
      name,
      kind: "Enemy",
      keys: list.map((a) => `e:${a.uid}`),
      group: "Monster",
      command: false,
      staging: list.every((a) => !monsterDefault(a)),
      // Copies can differ (one staged, one real): show the one that plays something.
      enemy: list.find((a) => monsterDefault(a)) ?? list[0],
    }));
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

type Tab = "todo" | "spells" | "named" | "folders";
const TAB_LABEL: Record<Tab, string> = { todo: "To map", spells: "Candidates", named: "FFRK named", folders: "Folders" };

/**
 * Dev tool: map FF9 moves to FFRK effects. "To map" lists the moves themselves with what each plays now (mapped,
 * a generic default, or nothing) — pick one to make it the target; the other tabs browse FFRK's effects (candidates
 * per move, named abilities with the exact files the game used, every downloaded folder) to assign to it. Effects
 * loop on a target; assignments save to `src/features/effects/ability-effects.json` through the dev server.
 */
export function EffectsGallery() {
  const index = useJson<EffectIndex>("index.json");
  const catalog = useJson<EffectCatalog>("catalog.json");
  const moves = useMoves();
  const [map, setMap] = useState<EffectMap>(initialMap as EffectMap);
  const [tab, setTab] = useState<Tab>("todo");
  const [filter, setFilter] = useState("");
  const [onlyUnmapped, setOnlyUnmapped] = useState(true);
  const [side, setSide] = useState<"both" | "Party" | "Enemy">("both");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("hit");
  const [speed, setSpeed] = useState(1);
  const [moveFilter, setMoveFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const statusOf = (m: Move): Status => {
    const n = m.keys.filter((k) => map.abilities[k]).length;
    if (n === m.keys.length) return "mapped";
    if (n > 0) return "partial";
    if (m.staging) return "staging";
    return m.enemy && monsterDefault(m.enemy) ? "default" : "missing";
  };
  /** What a move plays now: its assignment, else (monsters) the generic default. */
  const currentRecipe = (m: Move): Record<string, string> | null =>
    m.keys.map((k) => map.abilities[k]?.phases).find(Boolean) ?? (m.enemy ? monsterDefault(m.enemy) : null);
  const describe = (m: Move): string => {
    const s = statusOf(m);
    if (s === "default") {
      const f = folderOf(currentRecipe(m)?.hit);
      return `generic default: ${DEFAULT_NAMES[f] ?? f}`;
    }
    if (s === "mapped" || s === "partial") return `${STATUS[s].label} · ${m.keys.map((k) => map.abilities[k]?.from).find(Boolean) ?? ""}`;
    return STATUS[s].label;
  };

  const todo = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rank: Record<Status, number> = { missing: 0, partial: 1, default: 2, mapped: 3, staging: 4 };
    return moves
      .filter((m) => (m.kind === "Party" ? m.command : true))
      .filter((m) => side === "both" || m.kind === side)
      .filter((m) => {
        const s = statusOf(m);
        return !onlyUnmapped || s === "missing" || s === "default" || s === "partial";
      })
      .filter((m) => !q || `${m.name} ${m.group} ${m.kind}`.toLowerCase().includes(q))
      .sort((a, b) => rank[statusOf(a)] - rank[statusOf(b)] || a.kind.localeCompare(b.kind) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves, map, filter, onlyUnmapped, side]);

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
    // Candidates for FF9 moves with no same-named FFRK ability: each folder as its own entry, to compare and pick.
    const spells: Item[] = ALL_CANDIDATES.flatMap((sp) =>
      sp.candidates.flatMap((cand, i) => {
        const phases = folderRecipe(cand.folder, idx[cand.folder]?.files ?? [], sp.school, cand.launch);
        if (!phases) return [];
        return [{ key: `s:${sp.name}:${cand.folder}`, label: `${sp.group ? `${sp.group} · ` : ""}${sp.name} — ${cand.folder}${i === 0 ? " (first pick)" : ""}`, sub: cand.why, phases, recipe: true, search: `${sp.group ?? ""} ${sp.name} ${cand.folder} ${cand.why}`.toLowerCase(), spell: sp.name }];
      }),
    );
    return { named, folders, spells };
  }, [index.data, catalog.data]);

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (tab === "spells" ? items.spells : tab === "named" ? items.named : items.folders).filter((i) => !q || i.search.includes(q));
  }, [items, tab, filter]);

  const target = moves.find((m) => m.id === targetId) ?? null;
  /** The target's current effect, as a selectable entry (so the stage plays it). */
  const targetItem: Item | null = useMemo(() => {
    if (!target) return null;
    const phases = currentRecipe(target);
    return phases ? { key: `m:${target.id}`, label: `${target.name} — now`, sub: describe(target), phases, recipe: true, search: "" } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, map]);
  const selected = useMemo(
    () => (targetItem && selectedKey === targetItem.key ? targetItem : [...items.spells, ...items.named, ...items.folders].find((i) => i.key === selectedKey) ?? null),
    [items, selectedKey, targetItem],
  );
  const phaseKeys = selected ? Object.keys(selected.phases).sort(phaseSort) : [];
  const path = selected?.phases[phase] ?? null;
  const moveName = (key: string) => moves.find((m) => m.keys.includes(key))?.name ?? key;
  const matchingMoves = moveFilter.trim() ? moves.filter((m) => m.name.toLowerCase().includes(moveFilter.trim().toLowerCase())).slice(0, 30) : [];
  /** Every move key with this name — party and monster — so one pick covers the move everywhere. */
  const keysNamed = (name: string) => moves.filter((m) => m.name === name).flatMap((m) => m.keys);
  const targetCandidates = target ? items.spells.filter((i) => i.spell === target.name) : [];

  function select(item: Item) {
    setSelectedKey(item.key);
    const keys = Object.keys(item.phases);
    setPhase(keys.find((k) => k === "hit") ?? keys.find((k) => k.startsWith("hit")) ?? keys.sort(phaseSort)[0] ?? "hit");
  }
  function pickTarget(m: Move) {
    setTargetId(m.id);
    const phases = currentRecipe(m);
    if (phases) select({ key: `m:${m.id}`, label: "", sub: "", phases, recipe: true, search: "" });
    else setSelectedKey(null);
  }
  function nextUnmapped() {
    const i = todo.findIndex((m) => m.id === targetId);
    const next = todo.slice(i + 1).find((m) => statusOf(m) !== "mapped") ?? todo.find((m) => m.id !== targetId && statusOf(m) !== "mapped");
    if (next) pickTarget(next);
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
  /** Assign the shown effect to these move keys: its whole recipe, or the shown file as one phase. */
  function assign(keys: string[], as: "recipe" | string) {
    if (!selected) return;
    const set: EffectMap["abilities"] = {};
    for (const k of keys) {
      const cur = map.abilities[k]?.phases ?? {};
      const phases = as === "recipe" ? { ...selected.phases } : path ? { ...cur, [as]: path } : cur;
      set[k] = { phases, from: selected.label.replace(" (first pick)", "") + (selected.spell ? ` — ${selected.sub}` : "") };
    }
    void save(set);
  }
  function unassign(keys: string[]) {
    void save({}, keys);
  }

  if (!import.meta.env.DEV) return <div className="p-6">The effects gallery only runs in development (it reads the downloaded FFRK library).</div>;

  const counts = (() => {
    const shown = moves.filter((m) => (m.kind === "Party" ? m.command : true));
    const c: Record<Status, number> = { mapped: 0, partial: 0, default: 0, missing: 0, staging: 0 };
    for (const m of shown) c[statusOf(m)]++;
    return c;
  })();
  const canAssign = !!selected && selected.key !== targetItem?.key;

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-[28rem_minmax(0,1fr)_30rem] gap-3 p-3">
      <div className="ff-window flex min-h-0 flex-col gap-2 p-2">
        <div className="flex gap-1">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} className="ff-option flex-1 px-1 text-xs data-[on=true]:text-yellow-200" data-on={tab === t} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <input
          className="rounded bg-black/40 px-2 py-1 text-sm"
          placeholder={tab === "todo" ? "Move name, command (Blue Magic…)" : tab === "named" ? "Fire, Cure, Jump, 11000…" : "folder id, art (fire, slash…)"}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {tab === "todo" ? (
          <>
            <div className="flex flex-wrap gap-1 text-xs">
              <button className="ff-option px-1.5 data-[on=true]:text-yellow-200" data-on={onlyUnmapped} onClick={() => setOnlyUnmapped(true)}>
                Unmapped
              </button>
              <button className="ff-option px-1.5 data-[on=true]:text-yellow-200" data-on={!onlyUnmapped} onClick={() => setOnlyUnmapped(false)}>
                All
              </button>
              <span className="mx-1 opacity-30">|</span>
              {(["both", "Party", "Enemy"] as const).map((s) => (
                <button key={s} className="ff-option px-1.5 data-[on=true]:text-yellow-200" data-on={side === s} onClick={() => setSide(s)}>
                  {s === "both" ? "Both" : s}
                </button>
              ))}
            </div>
            <div className="text-xs opacity-70">
              <span className={STATUS.missing.className}>{counts.missing} need an effect</span> · <span className={STATUS.default.className}>{counts.default} generic</span> · {counts.partial} partial ·{" "}
              <span className={STATUS.mapped.className}>{counts.mapped} mapped</span> · {todo.length} shown
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {todo.map((m) => (
                <button key={m.id} className="flex w-full flex-col rounded px-1.5 py-0.5 text-left hover:bg-white/10 data-[on=true]:bg-yellow-300/20" data-on={targetId === m.id} onClick={() => pickTarget(m)}>
                  <span className="truncate text-sm">
                    {m.name} <span className="text-xs opacity-50">{m.kind === "Party" ? m.group : `Monster${m.keys.length > 1 ? ` ×${m.keys.length}` : ""}`}</span>
                  </span>
                  <span className={`truncate text-xs ${STATUS[statusOf(m)].className}`}>{describe(m)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs opacity-70">{index.isLoading || catalog.isLoading ? "Loading…" : `${list.length} shown`}</div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {list.map((i) => (
                <button key={i.key} className="flex w-full flex-col rounded px-1.5 py-0.5 text-left hover:bg-white/10 data-[on=true]:bg-yellow-300/20" data-on={selectedKey === i.key} onClick={() => select(i)}>
                  <span className="truncate text-sm">{i.label}</span>
                  <span className="truncate text-xs opacity-60">{i.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="ff-window flex min-h-0 min-w-0 flex-col gap-2 p-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="ff-display mr-2 text-lg">{selected?.label || (target ? `${target.name} — plays nothing` : "Pick a move or an effect")}</span>
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
        {target ? (
          <div className="flex flex-col gap-1.5 rounded border border-yellow-300/40 bg-yellow-300/5 p-2">
            <div className="flex items-baseline gap-2">
              <span className="ff-display flex-1 text-lg">{target.name}</span>
              <button className="text-xs opacity-60 hover:opacity-100" onClick={nextUnmapped}>
                Next unmapped →
              </button>
              <button className="text-xs opacity-50 hover:opacity-100" onClick={() => setTargetId(null)} aria-label="Clear target">
                ✕
              </button>
            </div>
            <span className="text-xs opacity-70">
              {target.kind === "Party" ? target.group : `Monster move${target.keys.length > 1 ? ` (${target.keys.length} copies)` : ""}`}
              {keysNamed(target.name).length > target.keys.length ? " · also used by the other side — assigning covers both" : ""}
            </span>
            <span className={`text-xs ${STATUS[statusOf(target)].className}`}>{describe(target)}</span>
            {targetCandidates.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs opacity-60">Candidates</span>
                {targetCandidates.map((i) => (
                  <button key={i.key} className="rounded px-1.5 py-0.5 text-left text-xs hover:bg-white/10 data-[on=true]:bg-yellow-300/20" data-on={selectedKey === i.key} onClick={() => select(i)}>
                    {i.label.replace(/^.*? — /, "")} <span className="opacity-60">{i.sub}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="opacity-60">{canAssign ? "Use the shown effect:" : "Pick an effect (candidates above, or any tab) to assign"}</span>
              {canAssign && selected?.recipe && (
                <button className="ff-option px-1.5 text-yellow-200" onClick={() => assign(keysNamed(target.name), "recipe")}>
                  whole recipe
                </button>
              )}
              {canAssign &&
                ["launch", "shot", "hit"].map((p) => (
                  <button key={p} className="ff-option px-1.5 disabled:opacity-30" disabled={!path} onClick={() => assign(keysNamed(target.name), p)} title={`Use the shown file as ${target.name}'s ${p}`}>
                    as {p}
                  </button>
                ))}
              {(statusOf(target) === "mapped" || statusOf(target) === "partial") && (
                <button className="ml-auto opacity-50 hover:opacity-100" onClick={() => unassign(keysNamed(target.name).filter((k) => map.abilities[k]))}>
                  clear
                </button>
              )}
            </div>
          </div>
        ) : (
          selected?.spell && (
            <button className="ff-window px-3 py-2 text-left hover:brightness-125" onClick={() => assign(keysNamed(selected.spell!), "recipe")}>
              Use this for every FF9 <span className="text-yellow-200">{selected.spell}</span>
              <span className="block text-xs opacity-70">Now: {keysNamed(selected.spell).map((k) => map.abilities[k]?.from).find(Boolean) ?? "nothing"}</span>
            </button>
          )
        )}
        <div className="ff-title">Assign to an FF9 move {saving && <span className="text-xs opacity-60">saving…</span>}</div>
        <input className="rounded bg-black/40 px-2 py-1 text-sm" placeholder="Search FF9 moves (Fire, Cure, Goblin Punch…)" value={moveFilter} onChange={(e) => setMoveFilter(e.target.value)} />
        <div className="max-h-72 overflow-y-auto">
          {matchingMoves.map((m) => (
            <div key={m.id} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm hover:bg-white/5">
              <button className="flex-1 truncate text-left" onClick={() => pickTarget(m)} title="Make this the target">
                {m.name} <span className="text-xs opacity-50">{m.kind}</span>
              </button>
              {selected?.recipe && (
                <button className="ff-option px-1.5 text-xs" onClick={() => assign(m.keys, "recipe")} title="Use the shown effect's whole launch → shot → hit recipe">
                  recipe
                </button>
              )}
              {["launch", "shot", "hit"].map((p) => (
                <button key={p} className="ff-option px-1.5 text-xs disabled:opacity-30" disabled={!path} onClick={() => assign(m.keys, p)} title={`Use the shown file as this move's ${p}`}>
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
                  <button className="text-xs opacity-50 hover:opacity-100" onClick={() => unassign([k])} aria-label="Remove">
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
