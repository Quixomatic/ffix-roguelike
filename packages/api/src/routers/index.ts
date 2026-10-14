import { protectedProcedure, publicProcedure, router } from "../index";
import { contentRouter } from "./content";
import { profileRouter } from "./profile";
import { runRouter } from "./run";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  content: contentRouter,
  profile: profileRouter,
  run: runRouter,
});
export type AppRouter = typeof appRouter;
