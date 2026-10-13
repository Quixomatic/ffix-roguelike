import { createAuth } from "@ffix-roguelike/auth";
import { createPrismaClient } from "@ffix-roguelike/db";

import { ENV } from "./env.server";

export const db = createPrismaClient(ENV);
export const auth = createAuth(ENV, db);
