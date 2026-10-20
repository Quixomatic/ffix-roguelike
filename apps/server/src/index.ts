import { appRouter } from "@ffix-roguelike/api/routers/index";
import { socialProviders } from "@ffix-roguelike/auth";
import { seedFf9 } from "@ffix-roguelike/db/seed-ff9";
import { seedRewards } from "@ffix-roguelike/db/seed-rewards";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { auth, db } from "./services";
import { uploadsApi } from "./uploads";

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

// The social sign-in providers this server has (their id and secret set): the login page shows a button for each.
app.get("/api/auth-providers", (c) => c.json({ providers: Object.keys(socialProviders(ENV)) }));

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

// Multipart uploads (avatars); everything else about them is tRPC.
app.route("/api/uploads", uploadsApi);

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
// Reward / gear-availability tables: insert rows the database doesn't have yet (edits are never overwritten).
try {
  const added = await seedRewards(db);
  const total = Object.values(added).reduce((a, b) => a + b, 0);
  if (total) console.log(`Reward tables seeded: ${Object.entries(added).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ")}`);
} catch (err) {
  console.error("Reward tables seeding failed:", err);
}

export default app;
