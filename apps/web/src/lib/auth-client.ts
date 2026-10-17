import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [adminClient()],
});

/** The signed-in user has the admin role (better-auth's admin plugin). For showing admin pages; the server checks too. */
export const isAdminUser = (user: { role?: string | null } | null | undefined) => (user?.role ?? null) === "admin";
