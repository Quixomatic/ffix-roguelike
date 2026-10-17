import { z } from "zod";

import { publicProcedure, router } from "../index";
import { ensureFf9Content, ensureRewardContent, sceneScript } from "../services/content";

export const contentRouter = router({
  /** All FF9 data the rules need: game tables + bestiary (no AI scripts — fetched per battle). Static per deploy. */
  ff9: publicProcedure.query(({ ctx }) => ensureFf9Content(ctx.db)),
  /** The reward / gear-availability tables (drop pools, catalog, reward rules). Change when an admin edits them. */
  rewards: publicProcedure.query(({ ctx }) => ensureRewardContent(ctx.db)),
  /** One battle scene's FF9 AI script (base64), or null if it has none. */
  battleScript: publicProcedure.input(z.object({ scene: z.string().max(16) })).query(async ({ ctx, input }) => {
    const bytes = await sceneScript(ctx.db, input.scene.toUpperCase());
    return bytes ? Buffer.from(bytes).toString("base64") : null;
  }),
});
