import { publicProcedure, router } from "../index";
import { ensureFf9Content } from "../services/content";

export const contentRouter = router({
  /** FF9's monsters, attacks and battle scenes (no AI scripts — each battle carries its own). Static per deploy. */
  bestiary: publicProcedure.query(({ ctx }) => ensureFf9Content(ctx.db)),
});
