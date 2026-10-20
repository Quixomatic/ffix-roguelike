/**
 * The admin pages' shared form pieces: labelled fields, inputs, the save button, the after-save hook, and the badge
 * picker. Every input is a cursor stop (keyboard / controller).
 */
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge, useBadgeCatalog } from "@/features/hub/badge";
import { FocusItem } from "@/features/input/focus";
import { trpc } from "@/utils/trpc";

/** After a save: the admin view and the game's own copy of the tables. */
export function useSaved(label: string) {
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

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-0.5 text-xs ${wide ? "col-span-full" : ""}`}>
      <span className="opacity-70">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "rounded border border-white/20 bg-black/30 px-2 py-1 text-sm";

export function Num({ value, onChange, step = 1 }: { value: number | null | undefined; onChange(v: number | null): void; step?: number }) {
  return (
    <FocusItem>
      <input type="number" step={step} className={`${inputCls} w-full`} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </FocusItem>
  );
}
export function Text({ value, onChange }: { value: string | undefined; onChange(v: string): void }) {
  return (
    <FocusItem>
      <input className={`${inputCls} w-full`} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </FocusItem>
  );
}
export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <FocusItem>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
    </FocusItem>
  );
}
export function Select<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange(v: T): void }) {
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
export function SaveButton({ pending, onClick, label = "Save" }: { pending: boolean; onClick(): void; label?: string }) {
  return (
    <FocusItem>
      <button className="ff-panel ff-btn ff-lift px-4 py-1 text-sm" disabled={pending} onClick={onClick}>
        {pending ? "Saving…" : label}
      </button>
    </FocusItem>
  );
}

/** At most this many badges in the picker grid at once (the search narrows the rest). */
const BADGE_PICKER_MAX = 240;

/** A badge: the current one, and a grid of the badge set to pick from, searchable by name and tags. */
export function BadgePicker({ value, onChange }: { value?: number; onChange(badge: number | undefined): void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const catalog = useBadgeCatalog();
  const info = catalog.data?.find((b) => b.id === value);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (catalog.data ?? []).filter((b) => {
    const text = `${b.id} ${b.name ?? ""} ${(b.tags ?? []).join(" ")}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  return (
    <div className="flex flex-col gap-2 rounded border border-white/10 p-2">
      <div className="flex items-center gap-3">
        {value ? <Badge id={value} /> : <span className="flex h-20 w-20 items-center justify-center text-xs opacity-60">No badge</span>}
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="ff-title text-sm">Badge</span>
          <span className="truncate">{value ? `#${value}${info?.name ? ` · ${info.name}` : ""}` : "None yet"}</span>
          <div className="flex gap-2">
            <SaveButton pending={false} label={open ? "Close" : "Choose…"} onClick={() => setOpen(!open)} />
            {value && <SaveButton pending={false} label="Clear" onClick={() => onChange(undefined)} />}
          </div>
        </div>
      </div>
      {open && (
        <>
          <Field label={`Search badges (${matches.length} of ${catalog.data?.length ?? 0}): name, tags or number`}>
            <Text value={q} onChange={setQ} />
          </Field>
          <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1 overflow-y-auto pr-1">
            {matches.slice(0, BADGE_PICKER_MAX).map((b) => (
              <FocusItem key={b.id}>
                <button
                  title={`#${b.id} ${b.name ?? ""}${b.tags?.length ? ` (${b.tags.join(", ")})` : ""}`}
                  className={`flex items-center justify-center rounded p-0.5 hover:bg-white/15 ${b.id === value ? "bg-yellow-300/20 ring-1 ring-yellow-300" : "bg-black/20"}`}
                  onClick={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                >
                  <Badge id={b.id} scale={1} />
                </button>
              </FocusItem>
            ))}
          </div>
          {matches.length > BADGE_PICKER_MAX && <div className="text-xs opacity-70">Showing {BADGE_PICKER_MAX}; search to narrow it down.</div>}
        </>
      )}
    </div>
  );
}
