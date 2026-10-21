import { achievements, challengeRoutes, effectivePrice, getRoute, isRoute, JOURNEYS, METRICS, metricDef, WORLDS, type RewardCard, type RewardOffer } from "@ffix-roguelike/game-core";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CONDITIONS,
  ACHIEVEMENT_STATS,
  bandStepsOf,
  BOON_STATS,
  CARD_TYPES,
  getCharacter,
  getItem,
  items,
  ROSTER,
  RARITIES,
  relicChanceOf,
  REWARD_SOURCES,
  ROLE_STATS,
  shopMarkupOf,
  shopPriceOf,
  type AchievementCategory,
  type AchievementCondition,
  type AchievementData,
  type AchievementStat,
  type GearAvailability,
  type RarityId,
  type RewardBoon,
  type RewardRarity,
  type RewardRole,
  type RewardSource,
  type RewardSourceId,
  type RewardTables,
  type StarterUpgrade,
} from "@ffix-roguelike/game-data";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FocusItem } from "@/features/input/focus";
import { ItemIcon } from "@/features/items/item-icon";
import { KIND_LABEL } from "@/features/run/item-info";
import { boonText } from "@/features/run/reward-cards";
import { trpc } from "@/utils/trpc";

import { BadgePicker, Check, Field, inputCls, Num, SaveButton, Select, Text, useSaved } from "./admin-fields";
import { JourneyGroupsTab } from "./journey-groups-admin";
import { RelicsTab, SynergiesTab } from "./relics-admin";
import { SettingsTab } from "./settings-admin";

/**
 * Admin: the reward and gear-availability tables (`.plans/rewards.md` §4) — what drops where, the gear catalog, the
 * reward cards' rules, the boons, the rarities, and what each character values. Every save goes live at once (the
 * next offer, drop pool and catalog use it). Export writes the tables into the repo's seed files to commit them.
 */
type Tab = "settings" | "journeys" | "gear" | "starter" | "achievements" | "relics" | "synergies" | "boons" | "sources" | "rarities" | "roles" | "preview";
const TABS: { id: Tab; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "journeys", label: "Journey groupings" },
  { id: "gear", label: "Gear availability" },
  { id: "starter", label: "Starter gear" },
  { id: "achievements", label: "Achievements" },
  { id: "relics", label: "Relics" },
  { id: "synergies", label: "Synergies" },
  { id: "boons", label: "Boons" },
  { id: "sources", label: "Sources" },
  { id: "rarities", label: "Rarities" },
  { id: "roles", label: "Roles" },
  { id: "preview", label: "Preview" },
];
const CHARACTERS = [...ROSTER];

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
          <button className="ff-panel ff-btn ff-lift px-3 py-1 text-sm" disabled={exportSeeds.isPending} onClick={() => exportSeeds.mutate()}>
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
      ) : tab === "settings" ? (
        <SettingsTab tables={tables.data} />
      ) : tab === "journeys" ? (
        <JourneyGroupsTab tables={tables.data} />
      ) : tab === "gear" ? (
        <GearTab tables={tables.data} />
      ) : tab === "starter" ? (
        <StarterTab tables={tables.data} />
      ) : tab === "achievements" ? (
        <AchievementsTab tables={tables.data} />
      ) : tab === "relics" ? (
        <RelicsTab tables={tables.data} />
      ) : tab === "synergies" ? (
        <SynergiesTab tables={tables.data} />
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
      {source.id !== "shop" && (
        <Field label="Skip gil (× tier)">
          <Num value={d.skipGil} onChange={(v) => setD({ ...d, skipGil: v ?? 0 })} />
        </Field>
      )}
      <Field label="Relic chance % (0 = never)">
        <Num value={relicChanceOf(d)} step={1} onChange={(v) => setD({ ...d, relicChance: v ?? 0 })} />
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
    <div className="ff-window grid grid-cols-2 items-end gap-2 p-3 sm:grid-cols-11" style={{ borderColor: d.color }}>
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
      <Field label="Higher band %">
        <Num value={d.nextBand} onChange={(v) => setD({ ...d, nextBand: v ?? 0 })} />
      </Field>
      <Field label="Areas up">
        <Num value={d.bandSteps ?? bandStepsOf(d)} onChange={(v) => setD({ ...d, bandSteps: v ?? 0 })} />
      </Field>
      <Field label="Shop: gear × FF9 price">
        <Num value={shopMarkupOf(d)} step={0.05} onChange={(v) => setD({ ...d, shopMarkup: v ?? 1 })} />
      </Field>
      <Field label="Shop: other cards (× tier)">
        <Num value={shopPriceOf(d)} onChange={(v) => setD({ ...d, shopPrice: v ?? 0 })} />
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

// ── starting-gear upgrades ─────────────────────────────────────────────────────────────────────────────────────────

const SLOTS = ["weapon", "head", "wrist", "armor", "accessory"] as const;
type UpgradeSlot = (typeof SLOTS)[number];
const SLOT_LABEL: Record<UpgradeSlot, string> = { weapon: "Weapon", head: "Head", wrist: "Arm", armor: "Body", accessory: "Accessory" };
const TIER_DEFAULTS = { cp: [5, 10, 20], level: [5, 10, 15] };
type TierPick = { character: string; slot: UpgradeSlot; tier: number };

/** Gear a character can wear in a slot, weakest (cheapest) first. */
function wearable(character: string, slot: string) {
  return items.filter((i) => i.kind === slot && i.equippableBy.includes(character)).sort((a, b) => effectivePrice(a) - effectivePrice(b));
}

/** Each character's upgrade chains (`.plans/starter-upgrades.md`): pick a tier to edit, or add the next one. */
function StarterTab({ tables }: { tables: RewardTables }) {
  const [who, setWho] = useState("zidane");
  const [pick, setPick] = useState<TierPick | null>(null);
  const chain = (slot: UpgradeSlot) => (tables.starter ?? []).filter((u) => u.character === who && u.slot === slot).sort((a, b) => a.tier - b.tier);
  const ff9 = getCharacter(who).defaultEquipment;
  const current = pick ? (tables.starter ?? []).find((u) => u.character === pick.character && u.slot === pick.slot && u.tier === pick.tier) : undefined;
  const editing: StarterUpgrade | null = pick
    ? (current ?? {
        id: "",
        character: pick.character,
        slot: pick.slot,
        tier: pick.tier,
        itemId: wearable(pick.character, pick.slot)[0]?.id ?? 0,
        name: "",
        gil: 0,
        cp: TIER_DEFAULTS.cp[pick.tier - 1] ?? 20,
        minStartLevel: TIER_DEFAULTS.level[pick.tier - 1] ?? 15,
        requires: null,
        enabled: true,
      })
    : null;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="ff-window flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-1">
          {CHARACTERS.map((k) => (
            <FocusItem key={k}>
              <button
                className={`rounded px-2 py-0.5 text-sm ${who === k ? "bg-white/15 text-yellow-200" : "opacity-75 hover:bg-white/10"}`}
                onClick={() => {
                  setWho(k);
                  setPick(null);
                }}
              >
                {getCharacter(k).name}
              </button>
            </FocusItem>
          ))}
        </div>
        <div className="text-xs opacity-70">
          Tier I → II → III per slot, replacing the FF9 piece runs start with. A tier needs its item unlocked for good, the start level and any
          requirement, and costs banked gil plus the character&apos;s CP. Pick a tier to edit it, or + to add the next one.
        </div>
        {SLOTS.map((slot) => {
          const tiers = chain(slot);
          const first = ff9[slot];
          return (
            <div key={slot} className="flex items-center gap-2">
              <span className="ff-title w-20 shrink-0 text-sm">{SLOT_LABEL[slot]}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded border border-white/15 bg-black/30" title="FF9 starting piece">
                {first != null ? <ItemIcon itemId={first} size={32} /> : <span className="opacity-40">—</span>}
              </span>
              {tiers.map((u) => (
                <span key={u.id} className="flex items-center gap-2">
                  <span className="opacity-50">→</span>
                  <FocusItem>
                    <button
                      title={`Tier ${u.tier}: ${u.name} · ${u.gil} gil · ${u.cp} CP · Lv ${u.minStartLevel}`}
                      className={`flex h-11 w-11 items-center justify-center rounded border-2 bg-[#0c1238] ${
                        pick?.character === who && pick.slot === slot && pick.tier === u.tier ? "border-yellow-200" : "border-white/20"
                      } ${u.enabled ? "" : "opacity-40"}`}
                      onClick={() => setPick({ character: who, slot, tier: u.tier })}
                    >
                      <ItemIcon itemId={u.itemId} size={32} />
                    </button>
                  </FocusItem>
                </span>
              ))}
              <FocusItem>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded border-2 border-dashed border-white/25 text-xl opacity-70 hover:opacity-100"
                  title="Add the next tier"
                  onClick={() => setPick({ character: who, slot, tier: tiers.length + 1 })}
                >
                  +
                </button>
              </FocusItem>
            </div>
          );
        })}
      </div>
      {editing ? (
        <StarterEditor
          key={`${editing.character}:${editing.slot}:${editing.tier}`}
          upgrade={editing}
          isNew={!current}
          isLast={editing.tier === chain(editing.slot).length}
          onRemoved={() => setPick(null)}
        />
      ) : (
        <div className="ff-window p-4 text-sm opacity-70">Pick a tier to edit, or + to add one.</div>
      )}
    </div>
  );
}

function StarterEditor({ upgrade, isNew, isLast, onRemoved }: { upgrade: StarterUpgrade; isNew: boolean; isLast: boolean; onRemoved(): void }) {
  const options = wearable(upgrade.character, upgrade.slot);
  const [d, setD] = useState<StarterUpgrade>(() => (isNew && !upgrade.gil && upgrade.itemId ? { ...upgrade, gil: effectivePrice(getItem(upgrade.itemId)) * 3 } : upgrade));
  const label = `${getCharacter(upgrade.character).name} ${SLOT_LABEL[upgrade.slot]} tier ${upgrade.tier}`;
  const saved = useSaved(label);
  const save = useMutation(trpc.admin.saveStarterUpgrade.mutationOptions(saved));
  const remove = useMutation(
    trpc.admin.deleteStarterUpgrade.mutationOptions({
      ...saved,
      onSuccess: () => {
        saved.onSuccess();
        onRemoved();
      },
    }),
  );
  const item = d.itemId ? getItem(d.itemId) : null;
  return (
    <div className="ff-window flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        {item && <ItemIcon itemId={item.id} size={40} />}
        <div>
          <div className="ff-display text-lg">
            {label}
            {isNew && <span className="ml-2 text-xs text-yellow-200">new</span>}
          </div>
          {item && (
            <div className="text-xs opacity-70">
              {item.name} · {item.price} gil in FF9
            </div>
          )}
        </div>
      </div>
      <Field label="Item">
        <FocusItem>
          <select
            className={`${inputCls} w-full`}
            value={d.itemId}
            onChange={(e) => {
              const itemId = Number(e.target.value);
              setD({ ...d, itemId, gil: isNew ? effectivePrice(getItem(itemId)) * 3 : d.gil });
            }}
          >
            {options.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {effectivePrice(i)} gil
              </option>
            ))}
          </select>
        </FocusItem>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Gil (banked)">
          <Num value={d.gil} onChange={(v) => setD({ ...d, gil: v ?? 0 })} />
        </Field>
        <Field label="CP">
          <Num value={d.cp} onChange={(v) => setD({ ...d, cp: v ?? 0 })} />
        </Field>
        <Field label="Min start level">
          <Num value={d.minStartLevel} onChange={(v) => setD({ ...d, minStartLevel: v ?? 1 })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Requires journey cleared">
          <Select
            value={d.requires?.journey ?? "none"}
            options={["none", ...JOURNEYS.map((j) => j.id)]}
            onChange={(v) => setD({ ...d, requires: { ...d.requires, journey: v === "none" ? undefined : v } })}
          />
        </Field>
        <Field label="Requires achievement">
          <Select
            value={d.requires?.achievement ?? "none"}
            options={["none", ...achievements().map((a) => a.id)]}
            onChange={(v) => setD({ ...d, requires: { ...d.requires, achievement: v === "none" ? undefined : v } })}
          />
        </Field>
      </div>
      <Check label="Enabled" checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} />
      <Field label="Notes" wide>
        <Text value={d.notes} onChange={(notes) => setD({ ...d, notes: notes || undefined })} />
      </Field>
      <div className="flex gap-2">
        <SaveButton
          pending={save.isPending}
          label={isNew ? "Add tier" : "Save"}
          onClick={() =>
            save.mutate({
              character: d.character,
              slot: d.slot,
              tier: d.tier,
              itemId: d.itemId,
              gil: d.gil,
              cp: d.cp,
              minStartLevel: d.minStartLevel,
              requires: d.requires ?? null,
              enabled: d.enabled,
              notes: d.notes,
            })
          }
        />
        {!isNew && isLast && (
          <FocusItem>
            <button className="rounded px-3 py-1 text-sm text-red-300 hover:bg-red-900/30" disabled={remove.isPending} onClick={() => remove.mutate({ id: upgrade.id })}>
              Remove tier
            </button>
          </FocusItem>
        )}
      </div>
    </div>
  );
}

// ── achievements ───────────────────────────────────────────────────────────────────────────────────────────────────

const CONDITION_LABEL: Record<AchievementCondition["kind"], string> = {
  metric: "A lifetime metric reaches… (any of the tracked metrics)",
  stat: "A lifetime stat reaches…",
  journey: "Clear a journey",
  group: "Win a journey grouping (a challenge run) in one run",
  bosses: "Defeat bosses (all of them)",
  roster: "Roster size",
  heroes: "Recruit characters (all of them)",
  mastered: "Abilities learned",
  solo: "Solo late-game clear",
  legendClear: "Clear Terra & Memoria with…",
};
const STAT_LABEL: Record<AchievementStat, string> = {
  battles: "Battles won",
  runs: "Runs finished",
  wins: "Runs won",
  steals: "Items stolen",
  eaten: "Monsters eaten",
  highestTierWon: "Highest tier won",
};
/** A fresh condition of a kind (switching kinds in the editor). */
const blankCondition = (kind: AchievementCondition["kind"]): AchievementCondition =>
  kind === "metric"
    ? { kind, metric: "enemies.killed", min: 100 }
    : kind === "stat"
    ? { kind, stat: "battles", min: 10 }
    : kind === "journey"
      ? { kind, journey: JOURNEYS[0]!.id }
      : kind === "group"
        ? { kind, group: challengeRoutes()[0]?.id ?? "" }
      : kind === "bosses"
        ? { kind, bosses: [] }
        : kind === "heroes"
          ? { kind, heroes: [] }
          : kind === "roster" || kind === "mastered"
            ? { kind, min: 4 }
            : { kind: kind as "solo" | "legendClear", hero: "zidane" };
/** What a condition asks, in a line (the list). */
function conditionText(c: AchievementCondition): string {
  switch (c.kind) {
    case "metric": {
      const who = !c.character ? "" : c.character === "any" ? " (any character)" : ` (${getCharacter(c.character).name})`;
      return `${metricDef(c.metric)?.label ?? c.metric}${c.subject ? ` · ${c.subject}` : ""}${who} ≥ ${c.min}`;
    }
    case "stat":
      return `${STAT_LABEL[c.stat]} ≥ ${c.min}`;
    case "journey":
      return `Clear ${isRoute(c.journey) ? getRoute(c.journey).name : c.journey}`;
    case "group":
      return `Win ${isRoute(c.group) ? getRoute(c.group).name : c.group} in one run`;
    case "bosses":
      return `Defeat ${c.bosses.join(", ") || "—"}`;
    case "roster":
      return `Roster ≥ ${c.min}`;
    case "heroes":
      return `Recruit ${c.heroes.map((k) => getCharacter(k).name).join(", ") || "—"}`;
    case "mastered":
      return `Learn ${c.min} abilities`;
    case "solo":
      return `Solo clear: ${getCharacter(c.hero).name}`;
    case "legendClear":
      return `Terra & Memoria with ${getCharacter(c.hero).name}`;
  }
}
/** A `metric` condition's fields: which metric (every registered one), its subject, for whom, and how many. */
function MetricConditionFields({
  c,
  onChange,
  heroes,
}: {
  c: Extract<AchievementCondition, { kind: "metric" }>;
  onChange(c: Extract<AchievementCondition, { kind: "metric" }>): void;
  heroes: string[];
}) {
  const def = metricDef(c.metric);
  const SUBJECT_HINT: Record<string, string> = {
    enemy: "an enemy's bestiary id (e.g. goblin, ff9-12), or empty for all",
    item: "an item id (e.g. 236 = Potion), or empty for all",
    ability: "an ability id (FF9 action id), or empty for all",
    status: "a status (e.g. poison, sleep), or empty for all",
    journey: "a journey id (e.g. evil-forest), or empty for all",
    stage: "a stage kind (battle, elite, semiboss, boss), or empty for all",
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Metric" wide>
        <FocusItem>
          <select
            className={`${inputCls} w-full`}
            value={c.metric}
            onChange={(e) => {
              const next = metricDef(e.target.value);
              onChange({ ...c, metric: e.target.value, subject: next?.subject ? c.subject : undefined, character: next?.perCharacter ? c.character : undefined });
            }}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} ({m.key}){m.agg !== "sum" ? ` · ${m.agg === "max" ? "highest" : "lowest"} ever` : ""}
              </option>
            ))}
          </select>
        </FocusItem>
      </Field>
      {def && <div className="col-span-full -mt-1 text-xs opacity-70">{def.description}</div>}
      {def?.subject && (
        <Field label={`Subject: ${SUBJECT_HINT[def.subject] ?? def.subject}`} wide>
          <Text value={c.subject} onChange={(subject) => onChange({ ...c, subject: subject.trim() || undefined })} />
        </Field>
      )}
      <Field label="Counted for">
        <Select
          value={c.character ?? "player"}
          options={def?.perCharacter ? ["player", "any", ...heroes] : ["player"]}
          onChange={(v) => onChange({ ...c, character: v === "player" ? undefined : v })}
        />
      </Field>
      <Field label="At least">
        <Num value={c.min} onChange={(v) => onChange({ ...c, min: v ?? 1 })} />
      </Field>
      <div className="col-span-full text-xs opacity-60">"player" = the player's total; "any" = the best of any one character.</div>
    </div>
  );
}

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const NEW_ACHIEVEMENT: AchievementData = {
  id: "",
  name: "",
  description: "",
  category: "milestone",
  sort: 0,
  enabled: true,
  condition: { kind: "stat", stat: "battles", min: 10 },
  reward: { gil: 1000 },
};

/** Every achievement (the `achievement` table): its condition, reward, category and order. Saves go live at once. */
function AchievementsTab({ tables }: { tables: RewardTables }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | AchievementCategory>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const all = useMemo(
    () =>
      [...(tables.achievements ?? [])].sort(
        (a, b) => ACHIEVEMENT_CATEGORIES.indexOf(a.category) - ACHIEVEMENT_CATEGORIES.indexOf(b.category) || a.sort - b.sort,
      ),
    [tables.achievements],
  );
  const rows = all.filter((a) => (cat === "all" || a.category === cat) && (!q || `${a.name} ${a.id} ${a.description}`.toLowerCase().includes(q.toLowerCase())));
  const current = selected === "" ? null : all.find((a) => a.id === selected);
  const editing = selected === "" ? { ...NEW_ACHIEVEMENT, sort: all.length } : current;
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_30rem]">
      <div className="ff-window flex min-h-0 flex-col gap-2 p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <Field label="Search">
            <Text value={q} onChange={setQ} />
          </Field>
          <Field label="Category">
            <Select<"all" | AchievementCategory> value={cat} options={["all", ...ACHIEVEMENT_CATEGORIES] as const} onChange={setCat} />
          </Field>
          <SaveButton pending={false} label="New achievement" onClick={() => setSelected("")} />
        </div>
        <div className="text-xs opacity-70">
          {rows.length} of {all.length} achievements
        </div>
        <div className="flex max-h-[65vh] flex-col gap-1 overflow-y-auto pr-1">
          {rows.map((a) => (
            <FocusItem key={a.id}>
              <button
                className={`flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-white/10 ${selected === a.id ? "bg-white/15" : "bg-black/20"} ${a.enabled ? "" : "opacity-50"}`}
                onClick={() => setSelected(a.id)}
              >
                <span className="w-20 shrink-0 text-xs opacity-60">{a.category}</span>
                <span className="min-w-0 flex-1 truncate">
                  {a.name}
                  {a.secret && <span className="ml-1 text-xs text-yellow-200">secret</span>}
                </span>
                <span className="w-56 truncate text-right text-xs text-[#c8d0ff]">{conditionText(a.condition)}</span>
              </button>
            </FocusItem>
          ))}
        </div>
      </div>
      {editing ? (
        <AchievementEditor key={selected || "new"} achievement={editing} isNew={selected === ""} onSaved={setSelected} onDeleted={() => setSelected(null)} />
      ) : (
        <div className="ff-window p-4 text-sm opacity-70">Pick an achievement to edit, or add a new one.</div>
      )}
    </div>
  );
}

function AchievementEditor({
  achievement: a,
  isNew,
  onSaved,
  onDeleted,
}: {
  achievement: AchievementData;
  isNew: boolean;
  onSaved(id: string): void;
  onDeleted(): void;
}) {
  const [d, setD] = useState<AchievementData>(a);
  // Comma lists are edited as text and parsed on save.
  const [itemsText, setItemsText] = useState((a.reward.items ?? []).join(", "));
  const [suppliesText, setSuppliesText] = useState((a.reward.supplies ?? []).join(", "));
  const [bossesText, setBossesText] = useState(a.condition.kind === "bosses" ? a.condition.bosses.join(", ") : "");
  const saved = useSaved(d.name || "Achievement");
  const save = useMutation(trpc.admin.saveAchievement.mutationOptions({ ...saved, onSuccess: () => (saved.onSuccess(), onSaved(d.id)) }));
  const remove = useMutation(trpc.admin.deleteAchievement.mutationOptions({ ...saved, onSuccess: () => (saved.onSuccess(), onDeleted()) }));
  const c = d.condition;
  const setC = (condition: AchievementCondition) => setD({ ...d, condition });
  const setReward = (reward: Partial<AchievementData["reward"]>) => setD({ ...d, reward: { ...d.reward, ...reward } });
  const heroOptions = CHARACTERS;
  const toggleHero = (k: string) => c.kind === "heroes" && setC({ ...c, heroes: c.heroes.includes(k) ? c.heroes.filter((x) => x !== k) : [...c.heroes, k] });
  const submit = () => {
    const condition: AchievementCondition = c.kind === "bosses" ? { kind: "bosses", bosses: list(bossesText) } : c;
    save.mutate({ ...d, condition, reward: { ...d.reward, items: list(itemsText), supplies: list(suppliesText) } } as never);
  };
  return (
    <div className="ff-window flex flex-col gap-3 p-3">
      <div className="ff-display text-lg">
        {isNew ? "New achievement" : d.name}
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
        <Field label="Category">
          <Select<AchievementCategory> value={d.category} options={ACHIEVEMENT_CATEGORIES} onChange={(category) => setD({ ...d, category })} />
        </Field>
        <Field label="Description" wide>
          <Text value={d.description} onChange={(description) => setD({ ...d, description })} />
        </Field>
        <Field label="Order in category">
          <Num value={d.sort} onChange={(v) => setD({ ...d, sort: v ?? 0 })} />
        </Field>
        <div className="flex items-end gap-3 pb-1">
          <Check label="Enabled" checked={d.enabled} onChange={(enabled) => setD({ ...d, enabled })} />
          <Check label="Secret (???)" checked={!!d.secret} onChange={(secret) => setD({ ...d, secret: secret || undefined })} />
        </div>
      </div>

      <BadgePicker value={d.badge} onChange={(badge) => setD({ ...d, badge })} />

      <div className="flex flex-col gap-2 rounded border border-white/10 p-2">
        <div className="ff-title text-sm">Condition</div>
        <Select<AchievementCondition["kind"]>
          value={c.kind}
          options={ACHIEVEMENT_CONDITIONS}
          onChange={(kind) => {
            setC(blankCondition(kind));
            setBossesText("");
          }}
        />
        <div className="text-xs opacity-70">{CONDITION_LABEL[c.kind]}</div>
        {c.kind === "metric" && (
          <MetricConditionFields
            c={c}
            onChange={(next) => setC(next)}
            heroes={heroOptions}
          />
        )}
        {c.kind === "stat" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Stat">
              <Select<AchievementStat> value={c.stat} options={ACHIEVEMENT_STATS} onChange={(stat) => setC({ ...c, stat })} />
            </Field>
            <Field label={`At least (${STAT_LABEL[c.stat].toLowerCase()})`}>
              <Num value={c.min} onChange={(v) => setC({ ...c, min: v ?? 1 })} />
            </Field>
          </div>
        )}
        {(c.kind === "roster" || c.kind === "mastered") && (
          <Field label="At least">
            <Num value={c.min} onChange={(v) => setC({ ...c, min: v ?? 1 })} />
          </Field>
        )}
        {c.kind === "journey" && (
          <Field label="Journey or challenge">
            <Select value={c.journey} options={[...JOURNEYS.map((j) => j.id), ...challengeRoutes().map((r) => r.id)]} onChange={(journey) => setC({ ...c, journey })} />
          </Field>
        )}
        {c.kind === "group" && (
          <Field label="Challenge (won in one run)">
            <Select value={c.group} options={challengeRoutes().filter((r) => r.grouped).map((g) => g.id)} onChange={(group) => setC({ ...c, group })} />
          </Field>
        )}
        {c.kind === "bosses" && (
          <Field label="Boss ids, comma separated (as recorded in boss kills: garland, ozma…)">
            <Text value={bossesText} onChange={setBossesText} />
          </Field>
        )}
        {c.kind === "heroes" && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {heroOptions.map((k) => (
              <Check key={k} label={getCharacter(k).name} checked={c.heroes.includes(k)} onChange={() => toggleHero(k)} />
            ))}
          </div>
        )}
        {(c.kind === "solo" || c.kind === "legendClear") && (
          <Field label="Character">
            <Select value={c.hero} options={heroOptions} onChange={(hero) => setC({ ...c, hero })} />
          </Field>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded border border-white/10 p-2">
        <div className="ff-title text-sm">Reward (once)</div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Gil (banked)">
            <Num value={d.reward.gil} onChange={(v) => setReward({ gil: v ?? undefined })} />
          </Field>
          <Field label="CP">
            <Num value={d.reward.cp} onChange={(v) => setReward({ cp: v ?? undefined })} />
          </Field>
          <Field label="CP for">
            <Select value={d.reward.cpFor ?? "everyone"} options={["everyone", ...heroOptions]} onChange={(v) => setReward({ cpFor: v === "everyone" ? undefined : v })} />
          </Field>
        </div>
        <Field label="Gear unlocked (item names, comma separated: legendary gear only drops this way)" wide>
          <Text value={itemsText} onChange={setItemsText} />
        </Field>
        <Field label="Best-in-slot armour for">
          <Select value={d.reward.bestInSlotFor ?? "none"} options={["none", ...heroOptions]} onChange={(v) => setReward({ bestInSlotFor: v === "none" ? undefined : v })} />
        </Field>
        <Field label="Camp supplies unlocked (item names, comma separated)" wide>
          <Text value={suppliesText} onChange={setSuppliesText} />
        </Field>
      </div>

      <Field label="Notes" wide>
        <Text value={d.notes} onChange={(notes) => setD({ ...d, notes: notes || undefined })} />
      </Field>
      <div className="flex gap-2">
        <SaveButton pending={save.isPending} label={isNew ? "Add achievement" : "Save"} onClick={submit} />
        {!isNew && (
          <FocusItem>
            <button
              className="rounded px-3 py-1 text-sm text-red-300 hover:bg-red-900/30"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`Delete "${d.name}"? Players who earned it keep it in their profile, but it won't be listed.`)) remove.mutate({ id: d.id });
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
