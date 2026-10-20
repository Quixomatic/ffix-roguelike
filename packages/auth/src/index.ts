import type { Database } from "@ffix-roguelike/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, username } from "better-auth/plugins";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

export type SocialProvider = "google" | "github";

/**
 * The social sign-in providers this server has (ChannelGuide's pattern): each one only when both its id and secret
 * are set. Unlike ChannelGuide's, they can create accounts (sign up), not only sign in.
 */
export function socialProviders(env: AuthConfig) {
  const out: Partial<Record<SocialProvider, { clientId: string; clientSecret: string }>> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  return out;
}

/**
 * A free placeholder username ("user482915730") for an account created without one (signing up with Google / GitHub),
 * until the player picks their own on the Profile page.
 */
export async function generatedUsername(database: Database): Promise<string> {
  for (;;) {
    const name = `user${Math.floor(100_000_000 + Math.random() * 900_000_000)}`;
    if (!(await database.user.findFirst({ where: { username: name }, select: { id: true } }))) return name;
  }
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = [],
) {
  const social = socialProviders(env);
  return betterAuth({
    databaseHooks: {
      user: {
        create: {
          // Every player has a username (it's what other players see): a sign-up without one gets a placeholder.
          before: async (user) => {
            const u = user as typeof user & { username?: string | null; displayUsername?: string | null };
            if (u.username) return;
            const username = await generatedUsername(database);
            return { data: { ...user, username, displayUsername: username } };
          },
        },
      },
    },
    database: prismaAdapter(database, {
      provider: "postgresql",
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    emailAndPassword: { enabled: true },
    ...(Object.keys(social).length > 0 && { socialProviders: social }),
    account: {
      // Signing in with Google / GitHub using the email of an existing account links them (one player, several ways in).
      // The provider proving the email is enough: our email + password accounts are never email-verified (no mail is
      // sent), and better-auth's default (requireLocalEmailVerified) refused to link them at all ("account_not_linked").
      accountLinking: { enabled: true, trustedProviders: ["google", "github"], requireLocalEmailVerified: false },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [
      // Roles (the ChannelGuide setup): built-in "admin" / "user". Admins manage the game's tables (rewards, gear
      // availability) and use the dev tools. Grant with `bun scripts/set-role.ts <email> admin` (apps/server).
      admin({
        defaultRole: "user",
        adminRoles: ["admin"],
      }),
      // Usernames: what other players see. Unique (stored lowercase, `displayUsername` keeps the casing), letters,
      // numbers, "_" and "."; sign in with email or username + password.
      username({ minUsernameLength: 3, maxUsernameLength: 20 }),
    ],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
