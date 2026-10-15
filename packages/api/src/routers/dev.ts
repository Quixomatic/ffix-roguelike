import { type Profile } from "@ffix-roguelike/game-core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { loadProfile, saveProfile } from "../services/profile";

/** Dev/admin tools: on unless the server runs with NODE_ENV=production (deploys must set it). */
export const devToolsEnabled = () => process.env.NODE_ENV !== "production";

const devProcedure = protectedProcedure.use(({ next }) => {
  if (!devToolsEnabled()) throw new TRPCError({ code: "FORBIDDEN", message: "Dev tools are disabled in production" });
  return next();
});

async function changeProfile(db: Parameters<typeof loadProfile>[0], userId: string, change: (p: Profile) => Profile) {
  const loaded = await loadProfile(db, userId);
  const next = change(loaded.profile);
  await db.$transaction((tx) => saveProfile(tx, loaded.id, next));
}

/** Testing aids on your own profile: unlock/relock characters, grant Completion Points and banked gil. */
export const devRouter = router({
  enabled: protectedProcedure.query(() => devToolsEnabled()),

  /** Put a character on the roster or take them off it (Zidane always stays). */
  setUnlocked: devProcedure.input(z.object({ key: z.string(), unlocked: z.boolean() })).mutation(({ ctx, input }) =>
    changeProfile(ctx.db, ctx.session.user.id, (p) => {
      if (!p.builds[input.key]) throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown character ${input.key}` });
      if (input.key === "zidane" && !input.unlocked) throw new TRPCError({ code: "BAD_REQUEST", message: "Zidane always stays on the roster" });
      const unlocked = input.unlocked ? [...new Set([...p.unlocked, input.key])] : p.unlocked.filter((k) => k !== input.key);
      return { ...p, unlocked };
    }),
  ),

  /** Give Completion Points to one character, or to everyone on the roster. */
  grantPoints: devProcedure.input(z.object({ key: z.string().optional(), points: z.number().int().min(-999).max(999) })).mutation(({ ctx, input }) =>
    changeProfile(ctx.db, ctx.session.user.id, (p) => {
      const keys = input.key ? [input.key] : p.unlocked;
      const builds = { ...p.builds };
      for (const k of keys) if (builds[k]) builds[k] = { ...builds[k]!, points: Math.max(0, (builds[k]!.points ?? 0) + input.points) };
      return { ...p, builds };
    }),
  ),

  /** Add (or take away) banked gil. */
  grantGil: devProcedure.input(z.object({ gil: z.number().int().min(-999999).max(999999) })).mutation(({ ctx, input }) =>
    changeProfile(ctx.db, ctx.session.user.id, (p) => ({ ...p, gil: Math.max(0, p.gil + input.gil) })),
  ),
});
