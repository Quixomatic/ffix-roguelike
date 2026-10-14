import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
import { ensureFf9Content } from "./services/content";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

/** Game rules need FF9's battle data registered (loaded from the DB once per process). */
const withContent = t.middleware(async ({ ctx, next }) => {
  await ensureFf9Content(ctx.db);
  return next();
});

export const publicProcedure = t.procedure.use(withContent);

export const protectedProcedure = t.procedure.use(withContent).use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
