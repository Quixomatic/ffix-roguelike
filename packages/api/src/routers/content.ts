import { z } from "zod";

import { publicProcedure, router } from "../index";
import { ensureFf9Content, sceneScript } from "../services/content";

export const contentRouter = router({
  /** FF9's monsters, attacks and battle scenes (no AI scripts — fetched per battle). Static per deploy. */
  bestiary: publicProcedure.query(({ ctx }) => ensureFf9Content(ctx.db)),
  /** One battle scene's FF9 AI script (base64), or null if it has none. */
  battleScript: publicProcedure.input(z.object({ scene: z.string().max(16) })).query(async ({ ctx, input }) => {
    const bytes = await sceneScript(ctx.db, input.scene.toUpperCase());
    return bytes ? Buffer.from(bytes).toString("base64") : null;
  }),
});
