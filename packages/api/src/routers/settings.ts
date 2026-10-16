import { z } from "zod";

import { protectedProcedure, router } from "../index";

/** Menu font ids — must match the font sets in apps/web/src/index.css. */
export const MENU_FONTS = ["rounded", "classic", "pixel", "storybook"] as const;

const DEFAULTS = { menuFont: "rounded", battleSpeed: 1, autoBattle: false, musicVolume: 60, sfxVolume: 80 } as const;

const settingsInput = z.object({
  menuFont: z.enum(MENU_FONTS).optional(),
  battleSpeed: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
  autoBattle: z.boolean().optional(),
  musicVolume: z.number().int().min(0).max(100).optional(),
  sfxVolume: z.number().int().min(0).max(100).optional(),
});

type Row = { menuFont: string; battleSpeed: number; autoBattle: boolean; musicVolume: number; sfxVolume: number };
const view = (row: Row | null) => ({
  menuFont: row?.menuFont ?? DEFAULTS.menuFont,
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
