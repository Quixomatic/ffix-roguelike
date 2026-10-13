import type { Session } from "@ffix-roguelike/auth";
import type { Database } from "@ffix-roguelike/db";

export type Context = {
  session: Session | null;
  db: Database;
};
