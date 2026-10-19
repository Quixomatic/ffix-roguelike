import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { preloadCoreMusic, setMusicVolume, setSfxVolume } from "@/features/audio/music";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import { applyFonts, DEFAULT_FONTS, type FontPicks } from "./fonts";

export interface Settings extends FontPicks {
  battleSpeed: 1 | 2 | 4;
  autoBattle: boolean;
  /** 0–100. */
  musicVolume: number;
  /** 0–100. */
  sfxVolume: number;
}

export const DEFAULT_SETTINGS: Settings = { ...DEFAULT_FONTS, battleSpeed: 1, autoBattle: false, musicVolume: 25, sfxVolume: 25 };

const picksOf = (s: Settings): FontPicks => ({ titleFont: s.titleFont, headingFont: s.headingFont, bodyFont: s.bodyFont });

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
    if (patch.titleFont || patch.headingFont || patch.bodyFont) applyFonts(picksOf({ ...settings, ...patch }));
    if (patch.musicVolume != null) setMusicVolume(patch.musicVolume);
    if (patch.sfxVolume != null) setSfxVolume(patch.sfxVolume);
    if (session) mutation.mutate(patch);
  };
  return { settings, loaded: query.isSuccess, signedIn: !!session, update, saving: mutation.isPending };
}

/** Mounted once in the root: applies the account's saved fonts and volumes when settings load. */
export function SettingsSync() {
  const { settings, loaded } = useSettings();
  useEffect(() => {
    if (loaded) applyFonts(picksOf(settings));
  }, [loaded, settings.titleFont, settings.headingFont, settings.bodyFont]);
  useEffect(() => {
    setMusicVolume(settings.musicVolume);
  }, [settings.musicVolume]);
  useEffect(() => {
    setSfxVolume(settings.sfxVolume);
  }, [settings.sfxVolume]);
  // Warm the asset cache with the tracks every session plays.
  useEffect(() => preloadCoreMusic(), []);
  return null;
}
