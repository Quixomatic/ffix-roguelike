import { protectedProcedure, publicProcedure, router } from "../index";
import { contentRouter } from "./content";
import { profileRouter } from "./profile";
import { runRouter } from "./run";
import { settingsRouter } from "./settings";
import { adminRouter } from "./admin";
import { devRouter } from "./dev";

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
  settings: settingsRouter,
  dev: devRouter,
  admin: adminRouter,
});
export type AppRouter = typeof appRouter;
