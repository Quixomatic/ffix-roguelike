import { checkSetting, SETTINGS, type RewardTables, type SettingDef, type SettingKey, type SettingValue } from "@ffix-roguelike/game-data";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FocusItem } from "@/features/input/focus";
import { trpc } from "@/utils/trpc";

import { inputCls, Num, SaveButton, Select, useSaved } from "./admin-fields";

/**
 * Admin → Settings: every game setting (game-data `SETTINGS`: our balance numbers), by group. Each row shows what it
 * does, its value (the database's, else the built-in default) and an editor for its kind; Save checks it against the
 * definition (here and on the server) and it's live at once. "Default" puts the built-in value back.
 */
export function SettingsTab({ tables }: { tables: RewardTables }) {
  const stored = useMemo(() => new Map((tables.settings ?? []).map((s) => [s.key, s.value])), [tables.settings]);
  const [filter, setFilter] = useState("");
  const keys = (Object.keys(SETTINGS) as SettingKey[]).filter((k) => {
    const d = SETTINGS[k];
    const q = filter.trim().toLowerCase();
    return !q || k.toLowerCase().includes(q) || d.label.toLowerCase().includes(q) || d.group.toLowerCase().includes(q);
  });
  const groups = [...new Set(keys.map((k) => SETTINGS[k].group))];
  return (
    <div className="ff-window flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-3xl text-sm opacity-80">
          Every balance number of the game. Saves are checked and go <span className="text-yellow-200">live at once</span> (the server keeps them in
          memory; players see new values when they next load the game). Export to seed files to commit them.
        </div>
        <FocusItem>
          <input className={`${inputCls} w-64`} placeholder="Search settings…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </FocusItem>
      </div>
      {groups.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <h3 className="ff-display text-lg text-[#c8d0ff]">{group}</h3>
          {keys
            .filter((k) => SETTINGS[k].group === group)
            .map((k) => (
              <SettingRow key={k} settingKey={k} stored={stored.get(k)} />
            ))}
        </section>
      ))}
    </div>
  );
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One setting: label and description, its editor, Save and Default. */
function SettingRow({ settingKey, stored }: { settingKey: SettingKey; stored: SettingValue | undefined }) {
  const def: SettingDef = SETTINGS[settingKey];
  const current = stored !== undefined && checkSetting(settingKey, stored) === null ? stored : def.default;
  const [draft, setDraft] = useState<SettingValue>(current);
  const save = useMutation(trpc.admin.saveSetting.mutationOptions(useSaved(def.label)));
  const reset = useMutation(trpc.admin.resetSetting.mutationOptions(useSaved(def.label)));
  const problem = checkSetting(settingKey, draft);
  const changed = !same(draft, current);
  const isDefault = same(current, def.default);
  return (
    <div className="grid gap-2 rounded border border-white/10 bg-black/20 p-2 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm">
          {def.label} {!isDefault && <span className="text-xs text-yellow-200">· changed</span>}
        </span>
        <span className="text-xs opacity-60">{def.description}</span>
        <code className="text-[0.65rem] opacity-40">{settingKey}</code>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <SettingEditor def={def} value={draft} onChange={setDraft} />
        {problem && <span className="text-xs text-red-300">{problem}</span>}
        {!isDefault && <span className="text-xs opacity-50">Default: {show(def.default)}</span>}
      </div>
      <div className="flex gap-2">
        <SaveButton pending={save.isPending} label={changed ? "Save" : "Saved"} onClick={() => !problem && changed && save.mutate({ key: settingKey, value: draft })} />
        {!isDefault && (
          <FocusItem>
            <button
              className="ff-panel ff-btn ff-lift px-3 py-1 text-sm"
              disabled={reset.isPending}
              onClick={() => {
                setDraft(def.default);
                reset.mutate({ key: settingKey });
              }}
            >
              Default
            </button>
          </FocusItem>
        )}
      </div>
    </div>
  );
}

/** A value in a line of text. */
function show(v: SettingValue): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return Object.entries(v).map(([k, n]) => `${k} ${n}`).join(", ");
  return String(v);
}

/** The editor for a setting's kind. */
function SettingEditor({ def, value, onChange }: { def: SettingDef; value: SettingValue; onChange(v: SettingValue): void }) {
  switch (def.kind) {
    case "number":
      return <Num value={value as number} step={def.integer ? 1 : 0.05} onChange={(v) => onChange(v ?? 0)} />;
    case "numbers":
      return <ListInput value={(value as number[]).join(", ")} onChange={(s) => onChange(s.split(",").map((x) => x.trim()).filter(Boolean).map(Number))} />;
    case "names":
      return <ListInput value={(value as string[]).join(", ")} onChange={(s) => onChange(s.split(",").map((x) => x.trim()).filter(Boolean))} />;
    case "choice":
      return <Select value={value as string} options={def.options} onChange={onChange} />;
    case "weights":
      return <WeightsEditor keys={def.keys} value={value as Record<string, number>} onChange={onChange} />;
  }
}

/** A comma-separated list, edited as text and parsed on every change. */
function ListInput({ value, onChange }: { value: string; onChange(s: string): void }) {
  const [text, setText] = useState(value);
  return (
    <FocusItem>
      <input
        className={`${inputCls} w-full`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
      />
    </FocusItem>
  );
}

/**
 * Name → number pairs. With fixed keys (stat names, stage kinds): one number per key. Otherwise (item names): rows
 * that can be renamed, added and removed.
 */
function WeightsEditor({ keys, value, onChange }: { keys?: readonly string[]; value: Record<string, number>; onChange(v: Record<string, number>): void }) {
  if (keys)
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
        {keys.map((k) => (
          <label key={k} className="flex flex-col gap-0.5 text-xs">
            <span className="opacity-70">{k}</span>
            <Num value={value[k] ?? 0} step={0.05} onChange={(v) => onChange({ ...value, [k]: v ?? 0 })} />
          </label>
        ))}
      </div>
    );
  const rows = Object.entries(value);
  const setRows = (next: [string, number][]) => onChange(Object.fromEntries(next.filter(([k]) => k.trim())));
  return (
    <div className="flex flex-col gap-1">
      {rows.map(([k, n], i) => (
        <div key={i} className="flex gap-1">
          <FocusItem>
            <input className={`${inputCls} flex-1`} value={k} onChange={(e) => setRows(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} />
          </FocusItem>
          <div className="w-24">
            <Num value={n} onChange={(v) => setRows(rows.map((r, j) => (j === i ? [r[0], v ?? 0] : r)))} />
          </div>
          <FocusItem>
            <button className="px-2 text-sm opacity-70 hover:opacity-100" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove">
              ✕
            </button>
          </FocusItem>
        </div>
      ))}
      <FocusItem>
        <button className="w-fit text-xs text-yellow-200 opacity-80 hover:opacity-100" onClick={() => setRows([...rows, ["New item", 1]])}>
          + Add
        </button>
      </FocusItem>
    </div>
  );
}
