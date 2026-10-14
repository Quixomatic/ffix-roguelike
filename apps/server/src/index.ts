import { appRouter } from "@ffix-roguelike/api/routers/index";
import { seedFf9 } from "@ffix-roguelike/db/seed-ff9";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { auth, db } from "./services";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

// Load FF9's battle data into Postgres if it's missing or the seed files changed (idempotent, best-effort).
try {
  const result = await seedFf9(db);
  if (result === "seeded") console.log("FF9 battle data seeded");
} catch (err) {
  console.error("FF9 battle data seeding failed:", err);
}

export default app;
