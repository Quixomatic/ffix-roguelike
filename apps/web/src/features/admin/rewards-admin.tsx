import { WORLDS, type RewardCard, type RewardOffer } from "@ffix-roguelike/game-core";
import {
  BOON_STATS,
  CARD_TYPES,
  getCharacter,
  getItem,
  MAIN_CAST,
  RARITIES,
  REWARD_SOURCES,
  ROLE_STATS,
  type GearAvailability,
  type RarityId,
  type RewardBoon,
  type RewardRarity,
  type RewardRole,
  type RewardSource,
  type RewardSourceId,
  type RewardTables,
} from "@ffix-roguelike/game-data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { FocusItem } from "@/features/input/focus";
import { ItemIcon } from "@/features/items/item-icon";
import { KIND_LABEL } from "@/features/run/item-info";
import { boonText } from "@/features/run/reward-cards";
import { trpc } from "@/utils/trpc";

/**
 * Admin: the reward and gear-availability tables (`.plans/rewards.md` §4) — what drops where, the gear catalog, the
 * reward cards' rules, the boons, the rarities, and what each character values. Every save goes live at once (the
 * next offer, drop pool and catalog use it). Export writes the tables into the repo's seed files to commit them.
 */
type Tab = "gear" | "boons" | "sources" | "rarities" | "roles" | "preview";
const TABS: { id: Tab; label: string }[] = [
  { id: "gear", label: "Gear availability" },
  { id: "boons", label: "Boons" },
  { id: "sources", label: "Sources" },
  { id: "rarities", label: "Rarities" },
  { id: "roles", label: "Roles" },
  { id: "preview", label: "Preview" },
];
const CHARACTERS = [...MAIN_CAST, "beatrix", "blank"];

export function RewardsAdminPage() {
  const [tab, setTab] = useState<Tab>("gear");
  const tables = useQuery(trpc.admin.rewardTables.queryOptions());
  const exportSeeds = useMutation(
    trpc.admin.exportSeeds.mutationOptions({
      onSuccess: () => toast.success("Exported to packages/db/seed/rewards — commit them"),
      onError: (e) => toast.error(e.message),
    }),
  );
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-4">
      <div className="ff-window flex flex-wrap items-center justify-between gap-2 p-3">
        <div>
          <div className="ff-display text-2xl">Rewards & gear</div>
          <div className="text-xs opacity-70">Saves go live at once. Export writes the tables into the repo's seed files.</div>
        </div>
        <FocusItem>
          <button className="ff-panel ff-lift px-3 py-1 text-sm" disabled={exportSeeds.isPending} onClick={() => exportSeeds.mutate()}>
            Export to seed files
          </button>
        </FocusItem>
      </div>
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <FocusItem key={t.id}>
            <button
              className={`rounded-t px-3 py-1.5 text-sm ${tab === t.id ? "bg-white/15 text-yellow-200" : "opacity-75 hover:bg-white/10 hover:opacity-100"}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          </FocusItem>
        ))}
      </div>
      {!tables.data ? (
        <div className="ff-window p-4">{tables.error ? tables.error.message : "Loading…"}</div>
      ) : tab === "gear" ? (
        <GearTab tables={tables.data} />
      ) : tab === "boons" ? (
        <BoonsTab tables={tables.data} />
      ) : tab === "sources" ? (
        <SourcesTab tables={tables.data} />
      ) : tab === "rarities" ? (
        <RaritiesTab tables={tables.data} />
      ) : tab === "roles" ? (
        <RolesTab tables={tables.data} />
      ) : (
        <PreviewTab tables={tables.data} />
      )}
    </div>
  );
}

// ── shared bits ────────────────────────────────────────────────────────────────────────────────────────────────────

/** After a save: the admin view and the game's own copy of the tables. */
function useSaved(label: string) {
  const qc = useQueryClient();
  return {
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: trpc.admin.rewardTables.queryKey() });
      void qc.invalidateQueries({ queryKey: trpc.content.rewards.queryKey() });
      toast.success(`${label} saved`);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  };
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-0.5 text-xs ${wide ? "col-span-full" : ""}`}>
      <span className="opacity-70">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "rounded border border-white/20 bg-black/30 px-2 py-1 text-sm";

function Num({ value, onChange, step = 1 }: { value: number | null | undefined; onChange(v: number | null): void; step?: number }) {
  return (
    <FocusItem>
      <input type="number" step={step} className={`${inputCls} w-full`} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </FocusItem>
  );
}
function Text({ value, onChange }: { value: string | undefined; onChange(v: string): void }) {
  return (
    <FocusItem>
      <input className={`${inputCls} w-full`} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </FocusItem>
  );
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <FocusItem>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    </FocusItem>
  );
}
function Select<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange(v: T): void }) {
  return (
    <FocusItem>
      <select className={`${inputCls} w-full`} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FocusItem>
  );
}
function SaveButton({ pending, onClick, label = "Save" }: { pending: boolean; onClick(): void; label?: string }) {
  return (
    <FocusItem>
      <button className="ff-panel ff-lift px-4 py-1 text-sm" disabled={pending} onClick={onClick}>
        {pending ? "Saving…" : label}
      </button>
    </FocusItem>
  );
}

// ── gear availability ──────────────────────────────────────────────────────────────────────────────────────────────

type GearFilter = "all" | "map pool" | "catalog" | "legendary" | "disabled";
const gearStatus = (g: GearAvailability): Exclude<GearFilter, "all"> | "nowhere" =>
  !g.enabled ? "disabled" : g.legendary ? "legendary" : g.mapPools.length ? "map pool" : g.catalog ? "catalog" : "nowhere";

function GearTab({ tables }: { tables: RewardTables }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<GearFilter>("all");
  const [area, setArea] = useState("any");
  const [selected, setSelected] = useState<number | null>(null);
  const rows = useMemo(
    () =>
      tables.gear.filter(
        (g) =>
          (!q || g.name.toLowerCase().includes(q.toLowerCase())) &&
          (filter === "all" || gearStatus(g) === filter) &&
          (area === "any" || g.mapPools.some((p) => p.area === area)),
      ),
    [tables.gear, q, filter, area],
  );
  const current = tables.gear.find((g) => g.itemId === selected) ?? null;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="ff-window flex min-h-0 flex-col gap-2 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Search">
            <Text value={q} onChange={setQ} />
          </Field>
          <Field label="Status">
            <Select<GearFilter> value={filter} options={["all", "map pool", "catalog", "legendary", "disabled"] as const} onChange={setFilter} />
          </Field>
          <Field label="In the map pool of">
            <Select value={area} options={["any", ...WORLDS.map((w) => w.id)]} onChange={setArea} />
          </Field>
        </div>
        <div className="text-xs opacity-70">{rows.length} of {tables.gear.length} pieces</div>
        <div className="flex max-h-[65vh] flex-col gap-1 overflow-y-auto pr-1">
          {rows.map((g) => {
            const item = getItem(g.itemId);
            const s = gearStatus(g);
            return (
              <FocusItem key={g.itemId}>
                <button
                  className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-white/10 ${selected === g.itemId ? "bg-white/15" : "bg-black/20"}`}
                  onClick={() => setSelected(g.itemId)}
                >
                  <ItemIcon itemId={g.itemId} size={24} />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  <span className="text-xs opacity-60">{KIND_LABEL[item.kind] ?? item.kind}</span>
                  <span className={`w-24 text-right text-xs ${s === "nowhere" ? "text-red-300" : s === "legendary" ? "text-yellow-200" : s === "disabled" ? "opacity-50" : "text-[#c8d0ff]"}`}>
                    {s === "map pool" ? `${g.mapPools.length} area${g.mapPools.length > 1 ? "s" : ""}` : s === "catalog" ? `${g.catalogPrice} gil` : s}
                  </span>
                </button>
              </FocusItem>
            );
          })}
        </div>
      </div>
      {current ? <GearEditor key={current.itemId} gear={current} /> : <div className="ff-window p-4 text-sm opacity-70">Pick a piece to edit how it shows up in runs.</div>}
    </div>
  );
}

function GearEditor({ gear }: { gear: GearAvailability }) {
  const [d, setD] = useState<GearAvailability>(gear);
  const save = useMutation(trpc.admin.saveGear.mutationOptions(useSaved(gear.name)));
  const item = getItem(gear.itemId);
  const pool = (area: string) => d.mapPools.find((p) => p.area === area);
  const setPool = (area: string, on: boolean, bossOnly = false) =>
    setD({ ...d, mapPools: on ? [...d.mapPools.filter((p) => p.area !== area), { area, ...(bossOnly ? { bossOnly } : {}) }] : d.mapPools.filter((p) => p.area !== area) });
  return (
    <div className="ff-window flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <ItemIcon itemId={gear.itemId} size={40} />
        <div>
          <div className="ff-display text-lg">{gear.name}</div>
          <div className="text-xs opacity-70">
            {KIND_LABEL[item.kind]} · {item.price} gil in FF9 · {item.equippableBy.map((k) => getCharacter(k).name).join(", ")}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Check label="Enabled" checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} />
        <Check label="Legendary (achievements only)" checked={d.legendary} onChange={(legendary) => setD({ ...d, legendary })} />
      </div>
      <div className="flex flex-col gap-1">
        <div className="ff-title text-sm">Map pools: drops there without unlocking</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {WORLDS.map((w) => {
            const p = pool(w.id);
            return (
              <div key={w.id} className="flex items-center justify-between gap-1 text-sm">
                <Check label={w.name} checked={!!p} onChange={(on) => setPool(w.id, on)} />
                {p && (
                  <FocusItem>
                    <button className={`rounded px-1 text-[0.65rem] ${p.bossOnly ? "bg-red-900/60 text-red-200" : "bg-white/10 opacity-60"}`} onClick={() => setPool(w.id, true, !p.bossOnly)}>
                      boss only
                    </button>
                  </FocusItem>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-full">
          <Check label="In the gear catalog (buy at camp)" checked={d.catalog} onChange={(catalog) => setD({ ...d, catalog, catalogPrice: catalog ? (d.catalogPrice ?? item.price * 2) : d.catalogPrice })} />
        </div>
        <Field label="Catalog price">
          <Num value={d.catalogPrice} onChange={(catalogPrice) => setD({ ...d, catalogPrice })} />
        </Field>
        <Field label="From tier">
          <Num value={d.catalogFromTier} onChange={(v) => setD({ ...d, catalogFromTier: v ?? 0 })} />
        </Field>
      </div>
      <Field label="Notes" wide>
        <Text value={d.notes} onChange={(notes) => setD({ ...d, notes: notes || undefined })} />
      </Field>
      <SaveButton pending={save.isPending} onClick={() => save.mutate(d)} />
    </div>
  );
}

// ── boons ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const NEW_BOON: RewardBoon = { id: "", name: "", description: "", enabled: true, scope: "member", stat: "strength", amounts: { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 10 }, weight: 1, minTier: 0 };

function BoonsTab({ tables }: { tables: RewardTables }) {
  const [selected, setSelected] = useState<string | null>(tables.boons[0]?.id ?? null);
  const current = selected === "" ? NEW_BOON : (tables.boons.find((b) => b.id === selected) ?? null);
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="ff-window flex flex-col gap-1 p-3">
        {tables.boons.map((b) => (
          <FocusItem key={b.id}>
            <button className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-white/10 ${selected === b.id ? "bg-white/15" : "bg-black/20"} ${b.enabled ? "" : "opacity-50"}`} onClick={() => setSelected(b.id)}>
              <span>
                {b.name} <span className="text-xs opacity-60">{b.scope === "party" ? "· party" : ""}</span>
              </span>
              <span className="text-xs text-[#c8d0ff]">{RARITIES.filter((r) => b.amounts[r] != null).map((r) => boonText(b.stat, b.amounts[r]!)).join(" / ")}</span>
            </button>
          </FocusItem>
        ))}
        <FocusItem>
          <button className="mt-2 rounded border border-dashed border-white/30 px-2 py-1 text-sm hover:bg-white/10" onClick={() => setSelected("")}>
            + New boon
          </button>
        </FocusItem>
      </div>
      {current ? <BoonEditor key={selected ?? ""} boon={current} isNew={selected === ""} onSaved={(id) => setSelected(id)} /> : null}
    </div>
  );
}

function BoonEditor({ boon, isNew, onSaved }: { boon: RewardBoon; isNew: boolean; onSaved(id: string): void }) {
  const [d, setD] = useState<RewardBoon>(boon);
  const saved = useSaved(boon.name || "Boon");
  const save = useMutation(trpc.admin.saveBoon.mutationOptions({ ...saved, onSuccess: () => (saved.onSuccess(), onSaved(d.id)) }));
  const remove = useMutation(trpc.admin.deleteBoon.mutationOptions({ ...useSaved("Boon"), onSuccess: () => onSaved("") }));
  return (
    <div className="ff-window grid grid-cols-2 gap-2 p-3">
      <Field label="Id (lowercase-dashes)">
        {isNew ? <Text value={d.id} onChange={(id) => setD({ ...d, id })} /> : <span className="py-1 text-sm">{d.id}</span>}
      </Field>
      <Field label="Name">
        <Text value={d.name} onChange={(name) => setD({ ...d, name })} />
      </Field>
      <Field label="Description" wide>
        <Text value={d.description} onChange={(description) => setD({ ...d, description })} />
      </Field>
      <Field label="Stat">
        <Select value={d.stat} options={BOON_STATS} onChange={(stat) => setD({ ...d, stat })} />
      </Field>
      <Field label="Scope">
        <Select value={d.scope} options={["member", "party"] as const} onChange={(scope) => setD({ ...d, scope })} />
      </Field>
      <div className="col-span-full grid grid-cols-5 gap-1">
        {RARITIES.map((r) => (
          <Field key={r} label={`${r} (empty = never)`}>
            <Num value={d.amounts[r]} onChange={(v) => setD({ ...d, amounts: { ...d.amounts, [r]: v ?? undefined } })} />
          </Field>
        ))}
      </div>
      <Field label="Weight">
        <Num value={d.weight} step={0.1} onChange={(v) => setD({ ...d, weight: v ?? 0 })} />
      </Field>
      <Field label="From tier">
        <Num value={d.minTier} onChange={(v) => setD({ ...d, minTier: v ?? 0 })} />
      </Field>
      <div className="col-span-full flex flex-col gap-1">
        <span className="text-xs opacity-70">Rolls more for (×2)</span>
        <div className="flex flex-wrap gap-2">
          {CHARACTERS.map((k) => (
            <Check
              key={k}
              label={getCharacter(k).name}
              checked={!!d.affinity?.includes(k)}
              onChange={(on) => setD({ ...d, affinity: on ? [...(d.affinity ?? []), k] : (d.affinity ?? []).filter((x) => x !== k) })}
            />
          ))}
        </div>
      </div>
      <div className="col-span-full flex items-center gap-3">
        <Check label="Enabled" checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} />
        <SaveButton
          pending={save.isPending}
          onClick={() => save.mutate({ ...d, amounts: Object.fromEntries(Object.entries(d.amounts).filter(([, v]) => v != null)) })}
        />
        {!isNew && (
          <FocusItem>
            <button className="ml-auto text-sm text-red-300 hover:underline" disabled={remove.isPending} onClick={() => confirm(`Delete ${d.name}?`) && remove.mutate({ id: d.id })}>
              Delete
            </button>
          </FocusItem>
        )}
      </div>
    </div>
  );
}

// ── sources ────────────────────────────────────────────────────────────────────────────────────────────────────────

function SourcesTab({ tables }: { tables: RewardTables }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {REWARD_SOURCES.map((id) => {
        const s = tables.sources.find((x) => x.id === id);
        return s ? <SourceEditor key={id} source={s} /> : null;
      })}
    </div>
  );
}

function SourceEditor({ source }: { source: RewardSource }) {
  const [d, setD] = useState<RewardSource>(source);
  const save = useMutation(trpc.admin.saveSource.mutationOptions(useSaved(source.id)));
  return (
    <div className="ff-window grid grid-cols-3 gap-2 p-3">
      <div className="ff-display col-span-full text-lg capitalize">{source.id}</div>
      <Field label="Cards">
        <Num value={d.cards} onChange={(v) => setD({ ...d, cards: v ?? 1 })} />
      </Field>
      <Field label="Guarantee">
        <Select value={d.guarantee} options={["none", "oneGear", "allGear"] as const} onChange={(guarantee) => setD({ ...d, guarantee })} />
      </Field>
      <Field label="Lowest rarity">
        <Select value={d.minRarity} options={RARITIES} onChange={(minRarity) => setD({ ...d, minRarity })} />
      </Field>
      <Field label="Upgrade threshold">
        <Num value={d.upgradeThreshold} step={0.5} onChange={(v) => setD({ ...d, upgradeThreshold: v ?? 0 })} />
      </Field>
      <Field label="Skip gil (× tier)">
        <Num value={d.skipGil} onChange={(v) => setD({ ...d, skipGil: v ?? 0 })} />
      </Field>
      {source.id === "surprise" && (
        <Field label="Chance % (plain battles)">
          <Num value={d.chance} step={0.5} onChange={(v) => setD({ ...d, chance: v ?? 0 })} />
        </Field>
      )}
      <div className="col-span-full grid grid-cols-5 gap-1">
        {RARITIES.map((r) => (
          <Field key={r} label={`${r} weight`}>
            <Num value={d.rarityWeights[r]} onChange={(v) => setD({ ...d, rarityWeights: { ...d.rarityWeights, [r]: v ?? 0 } })} />
          </Field>
        ))}
      </div>
      <div className="col-span-full grid grid-cols-5 gap-1">
        {CARD_TYPES.map((t) => (
          <Field key={t} label={`${t} weight`}>
            <Num value={d.typeWeights[t]} step={0.5} onChange={(v) => setD({ ...d, typeWeights: { ...d.typeWeights, [t]: v ?? 0 } })} />
          </Field>
        ))}
      </div>
      <div className="col-span-full">
        <SaveButton pending={save.isPending} onClick={() => save.mutate(d)} />
      </div>
    </div>
  );
}

// ── rarities ───────────────────────────────────────────────────────────────────────────────────────────────────────

function RaritiesTab({ tables }: { tables: RewardTables }) {
  return (
    <div className="flex flex-col gap-2">
      {tables.rarities.map((r) => (
        <RarityEditor key={r.id} rarity={r} />
      ))}
    </div>
  );
}

function RarityEditor({ rarity }: { rarity: RewardRarity }) {
  const [d, setD] = useState<RewardRarity>(rarity);
  const save = useMutation(trpc.admin.saveRarity.mutationOptions(useSaved(rarity.name)));
  return (
    <div className="ff-window grid grid-cols-2 items-end gap-2 p-3 sm:grid-cols-8" style={{ borderColor: d.color }}>
      <Field label="Name">
        <Text value={d.name} onChange={(name) => setD({ ...d, name })} />
      </Field>
      <Field label="Colour">
        <FocusItem>
          <input type="color" className="h-8 w-full rounded bg-transparent" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
        </FocusItem>
      </Field>
      <Field label="AP surge">
        <Num value={d.apSurge} onChange={(v) => setD({ ...d, apSurge: v ?? 0 })} />
      </Field>
      <Field label="Gil (× tier)">
        <Num value={d.gil} onChange={(v) => setD({ ...d, gil: v ?? 0 })} />
      </Field>
      <Field label="Supplies">
        <Num value={d.supplies} onChange={(v) => setD({ ...d, supplies: v ?? 0 })} />
      </Field>
      <Field label="Next band %">
        <Num value={d.nextBand} onChange={(v) => setD({ ...d, nextBand: v ?? 0 })} />
      </Field>
      <Field label="Sort">
        <Num value={d.sort} onChange={(v) => setD({ ...d, sort: v ?? 0 })} />
      </Field>
      <SaveButton pending={save.isPending} onClick={() => save.mutate(d)} />
    </div>
  );
}

// ── roles ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function RolesTab({ tables }: { tables: RewardTables }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs opacity-70">
        Weight per point of stat change when judging gear (HP / MP move in tens to hundreds, so they weigh little per point). Ability weight: each
        unmastered ability the gear would teach.
      </div>
      {tables.roles.map((r) => (
        <RoleEditor key={r.key} role={r} />
      ))}
    </div>
  );
}

function RoleEditor({ role }: { role: RewardRole }) {
  const [d, setD] = useState<RewardRole>(role);
  const save = useMutation(trpc.admin.saveRole.mutationOptions(useSaved(getCharacter(role.key).name)));
  return (
    <div className="ff-window grid grid-cols-3 items-end gap-1.5 p-3 sm:grid-cols-7">
      <div className="ff-display col-span-full flex items-baseline gap-2 text-lg">
        {getCharacter(role.key).name} <span className="text-xs opacity-60">{d.notes}</span>
      </div>
      {ROLE_STATS.map((s) => (
        <Field key={s} label={s}>
          <Num value={d.weights[s] ?? 0} step={0.05} onChange={(v) => setD({ ...d, weights: { ...d.weights, [s]: v ?? 0 } })} />
        </Field>
      ))}
      <Field label="Ability weight">
        <Num value={d.abilityWeight} onChange={(v) => setD({ ...d, abilityWeight: v ?? 0 })} />
      </Field>
      <SaveButton pending={save.isPending} onClick={() => save.mutate(d)} />
    </div>
  );
}

// ── preview ────────────────────────────────────────────────────────────────────────────────────────────────────────

function PreviewTab({ tables }: { tables: RewardTables }) {
  const [source, setSource] = useState<RewardSourceId>("boss");
  const [world, setWorld] = useState(WORLDS.findIndex((w) => w.id === "evil-forest"));
  const [party, setParty] = useState<string[]>(["zidane", "vivi", "steiner"]);
  const [level, setLevel] = useState(8);
  const [seed, setSeed] = useState("preview");
  const preview = useQuery({ ...trpc.admin.preview.queryOptions({ source, world, party, level, seed, count: 8 }), enabled: party.length > 0 });
  const color = (r: RarityId) => tables.rarities.find((x) => x.id === r)?.color;
  return (
    <div className="flex flex-col gap-3">
      <div className="ff-window grid gap-2 p-3 sm:grid-cols-5">
        <Field label="Source">
          <Select<RewardSourceId> value={source} options={REWARD_SOURCES} onChange={setSource} />
        </Field>
        <Field label="Area">
          <Select value={WORLDS[world]!.id} options={WORLDS.map((w) => w.id)} onChange={(id) => setWorld(WORLDS.findIndex((w) => w.id === id))} />
        </Field>
        <Field label="Level (all slots open)">
          <Num value={level} onChange={(v) => setLevel(Math.max(1, v ?? 1))} />
        </Field>
        <Field label="Seed">
          <Text value={seed} onChange={setSeed} />
        </Field>
        <div className="col-span-full flex flex-wrap gap-2">
          {CHARACTERS.map((k) => (
            <Check
              key={k}
              label={getCharacter(k).name}
              checked={party.includes(k)}
              onChange={(on) => setParty(on ? [...party, k].slice(0, 4) : party.filter((x) => x !== k))}
            />
          ))}
        </div>
      </div>
      {preview.error && <div className="ff-window p-3 text-red-300">{preview.error.message}</div>}
      <div className="flex flex-col gap-2">
        {(preview.data as RewardOffer[] | undefined)?.map((offer, i) => (
          <div key={i} className="ff-window flex flex-wrap items-stretch gap-2 p-2">
            {offer.cards.map((c, j) => (
              <div key={j} className="min-w-48 flex-1 rounded border-2 bg-black/25 px-2 py-1 text-sm" style={{ borderColor: color(c.rarity) }}>
                <PreviewCard card={c} />
              </div>
            ))}
            <div className="self-center text-xs opacity-60">skip +{offer.skipGil}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewCard({ card }: { card: RewardCard }) {
  const who = "key" in card ? (card.key ? getCharacter(card.key).name : "Party") : "";
  switch (card.kind) {
    case "gear":
      return (
        <span className="flex items-center gap-1.5">
          <ItemIcon itemId={card.itemId} size={20} />
          {who}: {getItem(card.itemId).name} <span className="opacity-60">({card.score})</span>
        </span>
      );
    case "boon":
      return (
        <span>
          {who}: {card.name} {boonText(card.stat, card.amount)}
        </span>
      );
    case "ap":
      return (
        <span>
          {who}: +{card.amount} AP
        </span>
      );
    case "supplies":
      return (
        <span>
          {getItem(card.itemId).name} ×{card.count}
        </span>
      );
    case "gil":
      return <span>+{card.amount} gil</span>;
  }
}
