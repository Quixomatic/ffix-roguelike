import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GameDialog } from "@/components/game-dialog";
import { setMusicVolume } from "@/features/audio/music";

import { LIVE_BOSSES_KEY, liveBossesOn } from "@/features/battle/battle-scene";
import { Panel } from "@/features/gear/character-panels";
import { trpc } from "@/utils/trpc";
import { FocusItem } from "@/features/input/focus";

import { AvatarPanel } from "./avatar-panel";
import { ControllerPanel } from "./controller-panel";
import { FONT_LEVELS, FONTS } from "./fonts";
import { useSettings, type Settings } from "./use-settings";

/** General settings: menu font, battle presentation, battle mode. Saved to the player's account. */
export function SettingsPage() {
  const { saving } = useSettings();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3 p-4">
      <div className="ff-window flex items-center justify-between p-3">
        <span className="ff-display text-2xl">Settings</span>
        <span className="text-sm opacity-70">{saving ? "Saving…" : "Saved to your account"}</span>
      </div>
      <div className="ff-window p-3">
        <SettingsPanels />
      </div>
    </div>
  );
}

/**
 * Settings from anywhere (the floating ⚙ under the menu button, runs and battles included): the same panels in the
 * game's dialog window. It takes the controls while open; Escape / B closes it.
 */
export function SettingsDialog({ onClose }: { onClose(): void }) {
  const { saving } = useSettings();
  return (
    <GameDialog title="Settings" headerRight={<span className="text-sm opacity-70">{saving ? "Saving…" : "Saved to your account"}</span>} onClose={onClose}>
      <SettingsPanels />
    </GameDialog>
  );
}

/** Every setting, as panels in a grid (the Settings page and the Settings dialog). */
function SettingsPanels() {
  const { settings, update } = useSettings();
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
      <div className="grid gap-3 md:grid-cols-2">
        <AvatarPanel />

        <ControllerPanel />

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

        <LiveBossesPanel />

        <Panel title="Fonts" className="md:col-span-2">
          <div className="flex flex-col gap-3">
            {FONT_LEVELS.map(({ level, label, hint }) => (
              <div key={level} className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-base">{label}</span>
                  <span className="text-xs opacity-70">{hint}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FONTS.map((f) => (
                    <FocusItem key={f.id}>
                      <button
                        className={`rounded border px-3 py-1 text-lg transition hover:brightness-125 ${
                          settings[level] === f.id ? "border-yellow-300 bg-yellow-300/10 text-yellow-200" : "border-white/20 bg-black/25"
                        }`}
                        style={{ fontFamily: f.family, fontWeight: level === "bodyFont" || level === "numbersFont" ? f.weight : f.headingWeight }}
                        onClick={() => update({ [level]: f.id })}
                      >
                        {f.label}
                      </button>
                    </FocusItem>
                  ))}
                </div>
              </div>
            ))}
            <FontSample />
          </div>
        </Panel>
      </div>
  );
}

/**
 * Live boss animation: on unless turned off. Kept in this browser, not the account — it's about this device's
 * performance (a slow battle drops back to the baked sprites on its own too).
 */
function LiveBossesPanel() {
  const [on, setOn] = useState(liveBossesOn);
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(LIVE_BOSSES_KEY, v ? "1" : "0");
    } catch {
      /* not remembered */
    }
  };
  return (
    <Panel title="Live boss animation">
      <div className="flex gap-2">
        <Choice on={!on} onClick={() => set(false)}>
          Off
        </Choice>
        <Choice on={on} onClick={() => set(true)}>
          On
        </Choice>
      </div>
      <div className="text-xs opacity-70">
        Bosses animate live from FFRK's own rigs: smooth, every frame. Turn it off on a slow device. A battle that runs slowly switches to the simpler
        sprites by itself. Saved on this device.
      </div>
    </Panel>
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

/** The three levels together, in the fonts picked now. */
function FontSample() {
  return (
    <div className="flex flex-col gap-1 rounded bg-black/30 px-3 py-2">
      <span className="ff-brand text-2xl">
        FFIX <span className="text-yellow-200">Roguelike</span>
      </span>
      <span className="ff-display text-lg">Zidane — Lv 12</span>
      <span className="text-sm">Mage Masher · Atk 14 · Steal, Flee. HP 412/412</span>
      <span className="flex gap-4 text-2xl [text-shadow:2px_2px_0_#000]" style={{ fontFamily: "var(--ff-numbers-font)", fontWeight: "var(--ff-numbers-weight)" }}>
        <span>1,234</span>
        <span className="text-[#9cf0a0]">456</span>
        <span className="text-[#c8d0ff]">Miss</span>
      </span>
    </div>
  );
}
