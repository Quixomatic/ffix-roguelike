import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { setMusicVolume, setSfxVolume } from "@/features/audio/music";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

/** Menu fonts (CSS font sets in index.css). */
export const MENU_FONTS = [
  { id: "rounded", label: "Rounded", hint: "Nunito text, pixel headings — easiest to read" },
  { id: "classic", label: "Classic pixel", hint: "Pixelify Sans everywhere (the original look)" },
  { id: "pixel", label: "Retro JRPG", hint: "DotGothic16 text, pixel headings" },
  { id: "storybook", label: "Storybook", hint: "Alegreya Sans text, Cinzel headings" },
] as const;
export type MenuFont = (typeof MENU_FONTS)[number]["id"];

export interface Settings {
  menuFont: MenuFont;
  battleSpeed: 1 | 2 | 4;
  autoBattle: boolean;
  /** 0–100. */
  musicVolume: number;
  /** 0–100. */
  sfxVolume: number;
}

export const DEFAULT_SETTINGS: Settings = { menuFont: "rounded", battleSpeed: 1, autoBattle: false, musicVolume: 60, sfxVolume: 80 };

/**
 * Apply a menu font now and cache it in the browser, so index.html can apply it before the first paint next time
 * (the account's saved choice syncs in once settings load).
 */
export function applyMenuFont(font: string) {
  document.documentElement.dataset.font = font;
  try {
    localStorage.setItem("ff-font", font);
  } catch {
    // storage blocked: the account setting still applies after load
  }
}

/** The signed-in player's settings (defaults when signed out or still loading) and a function to change them. */
export function useSettings() {
  const { data: session } = authClient.useSession();
  const qc = useQueryClient();
  const query = useQuery({ ...trpc.settings.get.queryOptions(), enabled: !!session, staleTime: Infinity });
  const mutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: (next) => qc.setQueryData(trpc.settings.get.queryKey(), next),
    }),
  );
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(query.data as Partial<Settings> | undefined) };
  const update = (patch: Partial<Settings>) => {
    if (patch.menuFont) applyMenuFont(patch.menuFont);
    if (patch.musicVolume != null) setMusicVolume(patch.musicVolume);
    if (patch.sfxVolume != null) setSfxVolume(patch.sfxVolume);
    if (session) mutation.mutate(patch);
  };
  return { settings, loaded: query.isSuccess, signedIn: !!session, update, saving: mutation.isPending };
}

/** Mounted once in the root: applies the account's saved menu font and volumes when settings load. */
export function SettingsSync() {
  const { settings, loaded } = useSettings();
  useEffect(() => {
    if (loaded) applyMenuFont(settings.menuFont);
  }, [loaded, settings.menuFont]);
  useEffect(() => {
    setMusicVolume(settings.musicVolume);
  }, [settings.musicVolume]);
  useEffect(() => {
    setSfxVolume(settings.sfxVolume);
  }, [settings.sfxVolume]);
  return null;
}
