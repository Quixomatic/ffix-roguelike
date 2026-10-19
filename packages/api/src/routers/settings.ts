import { z } from "zod";

import { protectedProcedure, router } from "../index";

/** Font ids — must match FONTS in apps/web/src/features/settings/fonts.ts. */
export const FONT_IDS = ["pixelify", "silkscreen", "jersey", "dotgothic", "nunito", "alegreya", "cinzel"] as const;

const DEFAULTS = {
  titleFont: "pixelify",
  headingFont: "pixelify",
  bodyFont: "nunito",
  battleSpeed: 1,
  autoBattle: false,
  musicVolume: 25,
  sfxVolume: 25,
} as const;

const settingsInput = z.object({
  titleFont: z.enum(FONT_IDS).optional(),
  headingFont: z.enum(FONT_IDS).optional(),
  bodyFont: z.enum(FONT_IDS).optional(),
  battleSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
  autoBattle: z.boolean().optional(),
  musicVolume: z.number().int().min(0).max(100).optional(),
  sfxVolume: z.number().int().min(0).max(100).optional(),
});

type Row = { titleFont: string; headingFont: string; bodyFont: string; battleSpeed: number; autoBattle: boolean; musicVolume: number; sfxVolume: number };
const view = (row: Row | null) => ({
  titleFont: row?.titleFont ?? DEFAULTS.titleFont,
  headingFont: row?.headingFont ?? DEFAULTS.headingFont,
  bodyFont: row?.bodyFont ?? DEFAULTS.bodyFont,
  battleSpeed: row?.battleSpeed ?? DEFAULTS.battleSpeed,
  autoBattle: row?.autoBattle ?? DEFAULTS.autoBattle,
  musicVolume: row?.musicVolume ?? DEFAULTS.musicVolume,
  sfxVolume: row?.sfxVolume ?? DEFAULTS.sfxVolume,
});

/** The player's preferences (user_settings; a missing row means defaults). Battle mode stays on the profile. */
export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.userSettings.findUnique({ where: { userId: ctx.session.user.id } });
    return view(row);
  }),

  /** Change any subset of the settings. */
  update: protectedProcedure.input(settingsInput).mutation(async ({ ctx, input }) => {
    const row = await ctx.db.userSettings.upsert({
      where: { userId: ctx.session.user.id },
      create: { userId: ctx.session.user.id, ...DEFAULTS, ...input },
      update: input,
    });
    return view(row);
  }),
});
