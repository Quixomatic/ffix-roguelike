import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [adminClient()],
});

/**
 * The session, for the routes' sign-in guards, waiting out a server that's briefly unreachable. In development the API
 * restarts whenever a workspace package changes, and a page reloading meanwhile got "Failed to fetch" from its guard.
 * Network failures are retried for about 8 seconds (then thrown as before); an answer (signed in or not) returns at once.
 */
export async function getSessionRetrying(): Promise<Awaited<ReturnType<typeof authClient.getSession>>> {
  const delays = [250, 500, 1000, 2000, 4000];
  for (let i = 0; ; i++) {
    try {
      return await authClient.getSession();
    } catch (err) {
      if (!(err instanceof TypeError) || i >= delays.length) throw err;
      await new Promise((r) => setTimeout(r, delays[i]));
    }
  }
}

/** The signed-in user has the admin role (better-auth's admin plugin). For showing admin pages; the server checks too. */
export const isAdminUser = (user: { role?: string | null } | null | undefined) => (user?.role ?? null) === "admin";
