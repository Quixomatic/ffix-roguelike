/**
 * Admin → Relics and Synergies (`.plans/relics-and-synergies.md` phase 5): every relic and synergy as data — effects,
 * unlocks, badges, rarity, offer weights — and which characters carry which synergy tags. Saves go live at once (new
 * battles use them; battles already started keep their effects). Export writes them into the seed files.
 */
import {
  getCharacter,
  MODIFIER_KINDS,
  MODIFIER_STATS,
  RARITIES,
  STATUSES,
  type ModifierEffect,
  type ModifierKind,
  type ModifierScope,
  type RarityId,
  type RelicData,
  type RewardTables,
  type SynergyData,
} from "@ffix-roguelike/game-data";
import { MAIN_CAST } from "@ffix-roguelike/game-data";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/features/hub/badge";
import { effectText, tagName } from "@/features/hub/relic-text";
import { FocusItem } from "@/features/input/focus";
import { trpc } from "@/utils/trpc";

import { BadgePicker, Check, Field, Num, SaveButton, Select, Text, useSaved } from "./admin-fields";

const CHARACTERS = [...MAIN_CAST, "beatrix", "blank"];

const KIND_LABEL: Record<ModifierKind, string> = {
  stat: "Stat ±%",
  startStatus: "Start with a status",
  trance: "Trance head start",
  steal: "Steal chance +%",
  mpDiscount: "MP cost −%",
  onKill: "Killing blow restores",
};

/** A fresh effect of a kind, with sensible numbers. */
function blankEffect(kind: ModifierKind, scope?: ModifierScope): ModifierEffect {
  switch (kind) {
    case "stat":
      return { kind, stat: "strength", pct: 10, scope };
    case "startStatus":
      return { kind, status: "protect", scope };
    case "trance":
      return { kind, startPct: 25, scope };
    case "steal":
      return { kind, ratePct: 50, scope };
    case "mpDiscount":
      return { kind, pct: 15, scope };
    case "onKill":
      return { kind, hpPct: 5, scope };
  }
}

type ScopeKind = "party" | "tag" | "character";

/** A list of effects: each one's kind, numbers and who it applies to (the party, a synergy tag, or one character). */
function EffectsEditor({ effects, tags, onChange }: { effects: ModifierEffect[]; tags: string[]; onChange(effects: ModifierEffect[]): void }) {
  const set = (i: number, e: ModifierEffect) => onChange(effects.map((x, j) => (j === i ? e : x)));
  return (
    <div className="flex flex-col gap-2">
      {effects.map((e, i) => {
        const scopeKind: ScopeKind = e.scope?.kind ?? "party";
        const setScope = (kind: ScopeKind) =>
          set(i, { ...e, scope: kind === "party" ? undefined : kind === "tag" ? { kind, tag: tags[0] ?? "" } : { kind, character: CHARACTERS[0]! } });
        return (
          <div key={i} className="grid grid-cols-2 gap-2 rounded bg-black/20 p-2 sm:grid-cols-4">
            <Field label="Effect">
              <Select<ModifierKind> value={e.kind} options={MODIFIER_KINDS} onChange={(kind) => set(i, blankEffect(kind, e.scope))} />
            </Field>
            {e.kind === "stat" && (
              <>
                <Field label="Stat">
                  <Select value={e.stat} options={MODIFIER_STATS} onChange={(stat) => set(i, { ...e, stat })} />
                </Field>
                <Field label="% (negative = a downside)">
                  <Num value={e.pct} onChange={(v) => set(i, { ...e, pct: v ?? 0 })} />
                </Field>
              </>
            )}
            {e.kind === "startStatus" && (
              <Field label="Status">
                <Select value={e.status} options={STATUSES} onChange={(status) => set(i, { ...e, status })} />
              </Field>
            )}
            {e.kind === "trance" && (
              <Field label="Starts % full">
                <Num value={e.startPct} onChange={(v) => set(i, { ...e, startPct: v ?? 0 })} />
              </Field>
            )}
            {e.kind === "steal" && (
              <Field label="Steal +%">
                <Num value={e.ratePct} onChange={(v) => set(i, { ...e, ratePct: v ?? 0 })} />
              </Field>
            )}
            {e.kind === "mpDiscount" && (
              <Field label="MP −% (max 90)">
                <Num value={e.pct} onChange={(v) => set(i, { ...e, pct: v ?? 0 })} />
              </Field>
            )}
            {e.kind === "onKill" && (
              <>
                <Field label="HP % of max">
                  <Num value={e.hpPct} onChange={(v) => set(i, { ...e, hpPct: v ?? undefined })} />
                </Field>
                <Field label="MP % of max">
                  <Num value={e.mpPct} onChange={(v) => set(i, { ...e, mpPct: v ?? undefined })} />
                </Field>
              </>
            )}
            <Field label="Applies to">
              <Select<ScopeKind> value={scopeKind} options={["party", "tag", "character"] as const} onChange={setScope} />
            </Field>
            {e.scope?.kind === "tag" && (
              <Field label="Tag">
                <Select value={e.scope.tag} options={tags} onChange={(tag) => set(i, { ...e, scope: { kind: "tag", tag } })} />
              </Field>
            )}
            {e.scope?.kind === "character" && (
              <Field label="Character">
                <Select value={e.scope.character} options={CHARACTERS} onChange={(character) => set(i, { ...e, scope: { kind: "character", character } })} />
              </Field>
            )}
            <div className="col-span-full flex items-center justify-between gap-2 text-xs">
              <span className="text-[#c8d0ff]">{effectText(e)}</span>
              <FocusItem>
                <button className="rounded px-2 text-red-300 hover:bg-red-900/30" onClick={() => onChange(effects.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </FocusItem>
            </div>
          </div>
        );
      })}
      <div>
        <SaveButton pending={false} label="+ Effect" onClick={() => onChange([...effects, blankEffect("stat")])} />
      </div>
    </div>
  );
}

// ── relics ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type RelicFilter = "all" | "starter" | "cursed" | "disabled";

const NEW_RELIC: RelicData = {
  id: "",
  name: "",
  description: "",
  rarity: "common",
  effects: [{ kind: "stat", stat: "strength", pct: 10 }],
  weight: 1,
  minTier: 0,
  sort: 0,
  enabled: true,
};

/** Every relic (the `relic` table) in collection order: its effects, unlock, badge, rarity and offer weight. */
export function RelicsTab({ tables }: { tables: RewardTables }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<RelicFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const all = useMemo(() => [...(tables.relics ?? [])].sort((a, b) => a.sort - b.sort), [tables.relics]);
  const achName = (id?: string) => (id ? (tables.achievements ?? []).find((a) => a.id === id)?.name ?? `${id} (missing!)` : null);
  const rows = all.filter(
    (r) =>
      (filter === "all" || (filter === "starter" && r.starter) || (filter === "cursed" && r.cursed) || (filter === "disabled" && !r.enabled)) &&
      (!q || `${r.name} ${r.id} ${r.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const rarityColor = (id: RarityId) => tables.rarities.find((r) => r.id === id)?.color ?? "#ccc";
  const editing = selected === "" ? { ...NEW_RELIC, sort: (all.at(-1)?.sort ?? 0) + 1 } : all.find((r) => r.id === selected);
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_34rem]">
      <div className="ff-window flex min-h-0 flex-col gap-2 p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <Field label="Search">
            <Text value={q} onChange={setQ} />
          </Field>
          <Field label="Show">
            <Select<RelicFilter> value={filter} options={["all", "starter", "cursed", "disabled"] as const} onChange={setFilter} />
          </Field>
          <SaveButton pending={false} label="New relic" onClick={() => setSelected("")} />
        </div>
        <div className="text-xs opacity-70">
          {rows.length} of {all.length} relics
        </div>
        <div className="flex max-h-[65vh] flex-col gap-1 overflow-y-auto pr-1">
          {rows.map((r) => (
            <FocusItem key={r.id}>
              <button
                className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-white/10 ${selected === r.id ? "bg-white/15" : "bg-black/20"} ${r.enabled ? "" : "opacity-50"}`}
                onClick={() => setSelected(r.id)}
              >
                <span className="w-10 shrink-0 text-xs tabular-nums opacity-60">{String(r.sort).padStart(3, "0")}</span>
                <Badge id={r.badge ?? 1} scale={0.5} />
                <span className="min-w-0 flex-1 truncate" style={{ color: rarityColor(r.rarity) }}>
                  {r.name}
                  {r.cursed && <span className="ml-1 text-xs text-purple-300">cursed</span>}
                  {r.starter && <span className="ml-1 text-xs text-sky-300">starter</span>}
                </span>
                <span className="w-44 truncate text-right text-xs text-[#c8d0ff]">{r.free ? "free" : achName(r.unlockedBy) ?? "no unlock"}</span>
              </button>
            </FocusItem>
          ))}
        </div>
      </div>
      {editing ? (
        <RelicEditor key={selected || "new"} relic={editing} isNew={selected === ""} tables={tables} onSaved={setSelected} onDeleted={() => setSelected(null)} />
      ) : (
        <div className="ff-window p-4 text-sm opacity-70">Pick a relic to edit, or add a new one.</div>
      )}
    </div>
  );
}

function RelicEditor({
  relic,
  isNew,
  tables,
  onSaved,
  onDeleted,
}: {
  relic: RelicData;
  isNew: boolean;
  tables: RewardTables;
  onSaved(id: string): void;
  onDeleted(): void;
}) {
  const [d, setD] = useState<RelicData>(relic);
  const saved = useSaved(d.name || "Relic");
  const save = useMutation(trpc.admin.saveRelic.mutationOptions({ ...saved, onSuccess: () => (saved.onSuccess(), onSaved(d.id)) }));
  const remove = useMutation(trpc.admin.deleteRelic.mutationOptions({ ...saved, onSuccess: () => (saved.onSuccess(), onDeleted()) }));
  const tags = (tables.synergies ?? []).map((s) => s.tag);
  const achievements = [...(tables.achievements ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const unlock = d.free ? "(free)" : d.unlockedBy ?? "(none)";
  return (
    <div className="ff-window flex flex-col gap-3 p-3">
      <div className="ff-display text-lg">
        {isNew ? "New relic" : d.name}
        {!isNew && <span className="ml-2 text-xs opacity-60">{d.id}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isNew && (
          <Field label="Id (a-z, 0-9, -)" wide>
            <Text value={d.id} onChange={(id) => setD({ ...d, id })} />
          </Field>
        )}
        <Field label="Name">
          <Text value={d.name} onChange={(name) => setD({ ...d, name })} />
        </Field>
        <Field label="Rarity">
          <Select<RarityId> value={d.rarity} options={RARITIES} onChange={(rarity) => setD({ ...d, rarity })} />
        </Field>
        <Field label="Description" wide>
          <Text value={d.description} onChange={(description) => setD({ ...d, description })} />
        </Field>
        <Field label="Flavour line (collection page)" wide>
          <Text value={d.flavor} onChange={(flavor) => setD({ ...d, flavor: flavor || undefined })} />
        </Field>
        <Field label="Collection number">
          <Num value={d.sort} onChange={(v) => setD({ ...d, sort: v ?? 0 })} />
        </Field>
        <Field label="From difficulty tier">
          <Num value={d.minTier} onChange={(v) => setD({ ...d, minTier: v ?? 0 })} />
        </Field>
        <Field label="Offer weight (0 = never offered)">
          <Num value={d.weight} step={0.5} onChange={(v) => setD({ ...d, weight: v ?? 0 })} />
        </Field>
        <div className="flex flex-wrap items-end gap-3 pb-1">
          <Check label="Enabled" checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} />
          <Check label="Starter" checked={!!d.starter} onChange={(starter) => setD({ ...d, starter: starter || undefined })} />
          <Check label="Cursed" checked={!!d.cursed} onChange={(cursed) => setD({ ...d, cursed: cursed || undefined })} />
        </div>
        <Field label="Unlocked by" wide>
          <Select
            value={unlock}
            options={["(free)", "(none)", ...achievements.map((a) => a.id)]}
            onChange={(v) => setD({ ...d, free: v === "(free)" || undefined, unlockedBy: v.startsWith("(") ? undefined : v })}
          />
        </Field>
        {d.unlockedBy && <div className="col-span-full -mt-1 text-xs opacity-70">{achievements.find((a) => a.id === d.unlockedBy)?.name ?? "Unknown achievement"}</div>}
      </div>

      <BadgePicker value={d.badge} onChange={(badge) => setD({ ...d, badge })} />

      <div className="flex flex-col gap-2 rounded border border-white/10 p-2">
        <div className="ff-title text-sm">Effects</div>
        <EffectsEditor effects={d.effects} tags={tags} onChange={(effects) => setD({ ...d, effects })} />
      </div>

      <Field label="Notes" wide>
        <Text value={d.notes} onChange={(notes) => setD({ ...d, notes: notes || undefined })} />
      </Field>
      <div className="flex gap-2">
        <SaveButton pending={save.isPending} label={isNew ? "Add relic" : "Save"} onClick={() => save.mutate(d as never)} />
        {!isNew && (
          <FocusItem>
            <button
              className="rounded px-3 py-1 text-sm text-red-300 hover:bg-red-900/30"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`Delete "${d.name}"? Runs holding it lose its effects; collections keep it unlisted.`)) remove.mutate({ id: d.id });
              }}
            >
              Delete
            </button>
          </FocusItem>
        )}
      </div>
    </div>
  );
}

// ── synergies ──────────────────────────────────────────────────────────────────────────────────────────────────────

const NEW_SYNERGY: SynergyData = {
  id: "",
  name: "",
  tag: "",
  tiers: [{ count: 2, text: "", effects: [{ kind: "stat", stat: "strength", pct: 10 }] }],
  enabled: true,
};

/** Every party synergy (tiers by members sharing its tag), and which characters carry which tags. */
export function SynergiesTab({ tables }: { tables: RewardTables }) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = tables.synergies ?? [];
  const editing = selected === "" ? NEW_SYNERGY : all.find((s) => s.id === selected);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_34rem]">
        <div className="ff-window flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <span className="ff-title text-sm">{all.length} synergies</span>
            <SaveButton pending={false} label="New synergy" onClick={() => setSelected("")} />
          </div>
          {all.map((s) => (
            <FocusItem key={s.id}>
              <button
                className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-white/10 ${selected === s.id ? "bg-white/15" : "bg-black/20"} ${s.enabled ? "" : "opacity-50"}`}
                onClick={() => setSelected(s.id)}
              >
                {s.badge && <Badge id={s.badge} scale={0.5} />}
                <span className="min-w-0 flex-1 truncate" style={{ color: s.color }}>
                  {s.name}
                </span>
                <span className="text-xs opacity-70">
                  tag {s.tag} · {s.tiers.map((t) => t.count).join(" / ")}
                </span>
              </button>
            </FocusItem>
          ))}
        </div>
        {editing ? (
          <SynergyEditor key={selected || "new"} synergy={editing} isNew={selected === ""} tables={tables} onSaved={setSelected} />
        ) : (
          <div className="ff-window p-4 text-sm opacity-70">Pick a synergy to edit, or add a new one.</div>
        )}
      </div>
      <CharacterTagsEditor tables={tables} />
    </div>
  );
}

function SynergyEditor({ synergy, isNew, tables, onSaved }: { synergy: SynergyData; isNew: boolean; tables: RewardTables; onSaved(id: string): void }) {
  const [d, setD] = useState<SynergyData>(synergy);
  const saved = useSaved(d.name || "Synergy");
  const save = useMutation(trpc.admin.saveSynergy.mutationOptions({ ...saved, onSuccess: () => (saved.onSuccess(), onSaved(d.id)) }));
  const tags = [...new Set([...(tables.synergies ?? []).map((s) => s.tag), d.tag].filter(Boolean))];
  const setTier = (i: number, t: SynergyData["tiers"][number]) => setD({ ...d, tiers: d.tiers.map((x, j) => (j === i ? t : x)) });
  return (
    <div className="ff-window flex flex-col gap-3 p-3">
      <div className="ff-display text-lg" style={{ color: d.color }}>
        {isNew ? "New synergy" : d.name}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isNew && (
          <Field label="Id (a-z, 0-9, -)">
            <Text value={d.id} onChange={(id) => setD({ ...d, id })} />
          </Field>
        )}
        <Field label="Tag (what characters carry)">
          <Text value={d.tag} onChange={(tag) => setD({ ...d, tag })} />
        </Field>
        <Field label="Name">
          <Text value={d.name} onChange={(name) => setD({ ...d, name })} />
        </Field>
        <Field label="Colour">
          <FocusItem>
            <input type="color" className="h-8 w-full rounded bg-transparent" value={d.color ?? "#c8d0ff"} onChange={(e) => setD({ ...d, color: e.target.value })} />
          </FocusItem>
        </Field>
        <Field label="Description" wide>
          <Text value={d.description} onChange={(description) => setD({ ...d, description: description || undefined })} />
        </Field>
        <Check label="Enabled" checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} />
      </div>
      <BadgePicker value={d.badge} onChange={(badge) => setD({ ...d, badge })} />
      {d.tiers.map((t, i) => (
        <div key={i} className="flex flex-col gap-2 rounded border border-white/10 p-2">
          <div className="grid grid-cols-[8rem_1fr_auto] items-end gap-2">
            <Field label="Members needed">
              <Num value={t.count} onChange={(v) => setTier(i, { ...t, count: v ?? 1 })} />
            </Field>
            <Field label="What it says (players read this)">
              <Text value={t.text} onChange={(text) => setTier(i, { ...t, text })} />
            </Field>
            <FocusItem>
              <button className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-900/30" onClick={() => setD({ ...d, tiers: d.tiers.filter((_, j) => j !== i) })}>
                Remove tier
              </button>
            </FocusItem>
          </div>
          <EffectsEditor effects={t.effects} tags={tags} onChange={(effects) => setTier(i, { ...t, effects })} />
        </div>
      ))}
      <div className="flex gap-2">
        <SaveButton
          pending={false}
          label="+ Tier"
          onClick={() => setD({ ...d, tiers: [...d.tiers, { count: (d.tiers.at(-1)?.count ?? 1) + 1, text: "", effects: [] }] })}
        />
        <SaveButton pending={save.isPending} label={isNew ? "Add synergy" : "Save"} onClick={() => save.mutate(d as never)} />
      </div>
    </div>
  );
}

/** Which synergy tags each character carries (the `character_tag` table): toggle a tag, then save that character. */
function CharacterTagsEditor({ tables }: { tables: RewardTables }) {
  const tags = (tables.synergies ?? []).map((s) => s.tag);
  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="ff-title text-sm">Character tags</div>
      <div className="grid gap-2 md:grid-cols-2">
        {CHARACTERS.map((key) => (
          <CharacterTagRow key={key} character={key} tags={tags} current={(tables.characterTags ?? []).find((c) => c.character === key)?.tags ?? []} />
        ))}
      </div>
    </div>
  );
}

function CharacterTagRow({ character, tags, current }: { character: string; tags: string[]; current: string[] }) {
  const [d, setD] = useState<string[]>(current);
  const save = useMutation(trpc.admin.saveCharacterTags.mutationOptions(useSaved(getCharacter(character).name)));
  const changed = d.join() !== current.join();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-black/20 px-2 py-1">
      <span className="ff-display w-20 text-sm">{getCharacter(character).name}</span>
      {tags.map((t) => (
        <Check key={t} label={tagName(t)} checked={d.includes(t)} onChange={(on) => setD(on ? [...d, t] : d.filter((x) => x !== t))} />
      ))}
      {changed && <SaveButton pending={save.isPending} onClick={() => save.mutate({ character, tags: d })} />}
    </div>
  );
}
