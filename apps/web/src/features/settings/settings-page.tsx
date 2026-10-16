import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { setMusicVolume } from "@/features/audio/music";

import { Panel } from "@/features/gear/character-panels";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

import { AvatarPanel } from "./avatar-panel";
import { MENU_FONTS, useSettings, type Settings } from "./use-settings";

/** General settings: menu font, battle presentation, battle mode. Saved to the player's account. */
export function SettingsPage() {
  const { settings, update, saving } = useSettings();
  const qc = useQueryClient();
  const profile = useQuery(trpc.profile.get.queryOptions());
  const battleMode = useMutation(
    trpc.profile.setBattleMode.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.profile.get.queryKey() }),
      onError: (e) => toast.error(e.message),
    }),
  );
  const mode = profile.data?.battleMode ?? "WAIT";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <div className="ff-window flex items-center justify-between p-3">
        <span className="ff-display text-2xl">Settings</span>
        <span className="text-sm opacity-70">{saving ? "Saving…" : "Saved to your account"}</span>
      </div>

      <div className="ff-window grid gap-3 p-3 md:grid-cols-2">
        <AvatarPanel />

        <Panel title="Menu font" className="md:col-span-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {MENU_FONTS.map((f) => (
              <FocusItem key={f.id}>
                <button
                  data-font-preview={f.id}
                  className={`flex flex-col gap-1 rounded border p-2 text-left transition hover:brightness-125 ${
                    settings.menuFont === f.id ? "border-yellow-300 bg-yellow-300/10" : "border-white/20 bg-black/25"
                  }`}
                  onClick={() => update({ menuFont: f.id })}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg">{f.label}</span>
                    {settings.menuFont === f.id && <span className="text-yellow-200">✓</span>}
                  </span>
                  <span className="text-xs opacity-70">{f.hint}</span>
                  <FontSample font={f.id} />
                </button>
              </FocusItem>
            ))}
          </div>
        </Panel>

        <Panel title="Battle mode">
          <div className="flex gap-2">
            {(["WAIT", "ACTIVE"] as const).map((m) => (
              <Choice key={m} on={mode === m} onClick={() => battleMode.mutate({ mode: m })}>
                {m === "WAIT" ? "Wait" : "Active"}
              </Choice>
            ))}
          </div>
          <div className="text-xs opacity-70">Wait: time stops while you choose a command. Active: monsters keep acting.</div>
        </Panel>

        <Panel title="Battle speed">
          <div className="flex gap-2">
            {([1, 2, 4] as Settings["battleSpeed"][]).map((s) => (
              <Choice key={s} on={settings.battleSpeed === s} onClick={() => update({ battleSpeed: s })}>
                ×{s}
              </Choice>
            ))}
          </div>
          <div className="text-xs opacity-70">The speed battles start at (you can still change it during a fight).</div>
        </Panel>

        <Panel title="Music">
          <div data-music>
            <Volume value={settings.musicVolume} onChange={(v) => update({ musicVolume: v })} />
          </div>
          <div className="text-xs opacity-70">FF9's own soundtrack. 0 turns it off.</div>
        </Panel>

        <Panel title="Sound effects">
          <Volume value={settings.sfxVolume} onChange={(v) => update({ sfxVolume: v })} />
          <div className="text-xs opacity-70">Spell and ability sounds. 0 turns them off.</div>
        </Panel>

        <Panel title="Auto battle">
          <div className="flex gap-2">
            <Choice on={!settings.autoBattle} onClick={() => update({ autoBattle: false })}>
              Off
            </Choice>
            <Choice on={settings.autoBattle} onClick={() => update({ autoBattle: true })}>
              On
            </Choice>
          </div>
          <div className="text-xs opacity-70">Start battles with Auto on (the party picks its own commands).</div>
        </Panel>
      </div>
    </div>
  );
}

/** A 0–100 volume slider; saves when released. */
function Volume({ value, onChange }: { value: number; onChange(v: number): void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="flex items-center gap-3">
      {/* ←/→ adjust it; ↑/↓ move the cursor on. */}
      <FocusItem onArrow={(d) => d === "up" || d === "down"}>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        className="flex-1 accent-yellow-300"
        onChange={(e) => {
          setV(Number(e.target.value));
          // Hear it as you drag (the saved value updates on release).
          if (e.target.closest("[data-music]")) setMusicVolume(Number(e.target.value));
        }}
        onPointerUp={() => onChange(v)}
        onKeyUp={() => onChange(v)}
      />
      </FocusItem>
      <span className="w-10 text-right tabular-nums">{v}</span>
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <FocusItem>
      <button
        className={`min-w-16 rounded border px-3 py-1 transition hover:brightness-125 ${on ? "border-yellow-300 bg-yellow-300/10 text-yellow-200" : "border-white/20 bg-black/25"}`}
        onClick={onClick}
      >
        {children}
      </button>
    </FocusItem>
  );
}

/** A line of sample text in a given font set, whatever font is active. */
function FontSample({ font }: { font: string }) {
  const families: Record<string, [string, string]> = {
    rounded: ['"Nunito", sans-serif', '"Pixelify Sans", monospace'],
    classic: ['"Pixelify Sans", monospace', '"Pixelify Sans", monospace'],
    pixel: ['"DotGothic16", monospace', '"Pixelify Sans", monospace'],
    storybook: ['"Alegreya Sans", serif', '"Cinzel", serif'],
  };
  const [body, display] = families[font] ?? families.rounded!;
  return (
    <span className="rounded bg-black/30 px-2 py-1">
      <span className="block text-base" style={{ fontFamily: display }}>
        Zidane — Lv 12
      </span>
      <span className="block text-sm" style={{ fontFamily: body }}>
        Mage Masher · Atk 14 · Steal, Flee. HP 412/412
      </span>
    </span>
  );
}
