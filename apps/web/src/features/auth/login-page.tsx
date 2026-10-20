import { MAIN_CAST } from "@ffix-roguelike/game-data";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PixelIcon } from "@/components/pixel-icon";
import { ENV } from "@/env";
import { FocusItem } from "@/features/input/focus";
import { HeroSprite } from "@/features/sprites/hero-sprite";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";

type Mode = "signIn" | "signUp";
/** A username the server accepts (better-auth's username plugin: 3–20 letters, numbers, "_" and "."). */
export const USERNAME = /^[a-zA-Z0-9_.]{3,20}$/;
type Provider = "google" | "github";

const PROVIDER_NAME: Record<Provider, string> = { google: "Google", github: "GitHub" };
/** The providers' marks, small and in their own colours. */
const PROVIDER_ICON: Record<Provider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#fff"
        d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.6 4.9 18.6 5.2 18.6 5.2c.7 1.6.3 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"
      />
    </svg>
  ),
};

const INPUT = "w-full rounded border-2 border-white/25 bg-black/40 px-3 py-2.5 text-lg text-white placeholder:text-white/40 focus:border-yellow-300 focus:outline-none";

/**
 * Sign in / create an account (ChannelGuide's login, in FF9's look): an FF window over the title screen's backdrop,
 * the title, the cast, and the two forms. Afterwards: the page that sent you here (`?redirect=`, local paths only),
 * else home.
 */
export function LoginPage({ redirect }: { redirect?: string }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signIn");
  const [username, setUsername] = useState("");
  /** Sign up: the email. Sign in: the email or the username. */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dest = safeRedirect(redirect) ?? "/";
  // The social providers the server has set up (none: no buttons).
  const providers =
    useQuery({
      queryKey: ["auth-providers"],
      queryFn: async () => ((await (await fetch(`${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/api/auth-providers`)).json()) as { providers: Provider[] }).providers,
      staleTime: Infinity,
    }).data ?? [];

  /** Off to Google / GitHub; better-auth brings the player back to `dest` (a first sign-in creates the account). */
  const social = async (provider: Provider) => {
    setError(null);
    setBusy(true);
    const back = `${window.location.origin}${dest}`;
    const res = await authClient.signIn.social({ provider, callbackURL: back, newUserCallbackURL: back, errorCallbackURL: `${window.location.origin}/login` });
    if (res?.error) {
      setError(res.error.message || `Couldn't sign in with ${PROVIDER_NAME[provider]}.`);
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const user = username.trim();
    if (mode === "signUp" && !USERNAME.test(user)) return setError("Usernames are 3–20 letters, numbers, \"_\" or \".\".");
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    setBusy(true);
    try {
      const login = email.trim();
      const res =
        mode === "signUp"
          ? // The username is also the account's name (better-auth wants one); it's what other players see.
            await authClient.signUp.email({ email: login, password, name: user, username: user })
          : login.includes("@")
            ? await authClient.signIn.email({ email: login, password })
            : await authClient.signIn.username({ username: login, password });
      if (res?.error) {
        // Sign-up with an email or username that's taken: say so plainly (the email's owner can sign in, also with Google / GitHub).
        if (res.error.code === "USER_ALREADY_EXISTS" || res.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
          return setError("That email already has an account. Sign in instead (Google / GitHub with the same email works too).");
        if (res.error.code === "USERNAME_IS_ALREADY_TAKEN") return setError("That username is taken.");
        return setError(res.error.message || (mode === "signIn" ? "Wrong email, username or password." : "Couldn't create the account."));
      }
      navigate({ href: dest });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: Mode, label: string) => (
    <FocusItem>
      <button
        type="button"
        onClick={() => {
          setMode(m);
          setError(null);
        }}
        className={`flex-1 rounded border-2 px-3 py-1.5 text-base ${mode === m ? "border-yellow-300 bg-yellow-300/10 text-yellow-200" : "border-white/20 bg-black/25 hover:bg-white/10"}`}
      >
        {label}
      </button>
    </FocusItem>
  );

  return (
    <div className="flex min-h-[calc(100svh-2.5rem)] flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="ff-brand text-center text-white [text-shadow:3px_3px_0_#000]" style={{ fontWeight: 400 }}>
        <div className="ff-title text-sm tracking-[0.3em]">A ROGUELITE</div>
        <div className="text-4xl sm:text-5xl">
          FINAL FANTASY <span className="text-yellow-200">IX</span>
        </div>
      </div>

      <div className="ff-window flex w-full max-w-md flex-col gap-4 p-5">
        <div className="flex items-end justify-center gap-1">
          {MAIN_CAST.slice(0, 4).map((key, i) => (
            <div key={key} className="ff-hop" style={{ animationDelay: `${i * 140}ms`, animationIterationCount: "infinite", animationDuration: "1.6s" }}>
              <HeroSprite heroKey={key} size={48} />
            </div>
          ))}
        </div>
        {/* Google / GitHub (only the ones the server has set up): sign in, or create an account the first time. */}
        {providers.length > 0 && (
          <>
            <div className="flex flex-col gap-2">
              {providers.map((p) => (
                <FocusItem key={p}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => social(p)}
                    className="flex items-center justify-center gap-3 rounded border-2 border-white/25 bg-black/30 px-4 py-2.5 text-lg hover:border-white/50 hover:bg-black/45 disabled:opacity-50"
                  >
                    {PROVIDER_ICON[p]} Continue with {PROVIDER_NAME[p]}
                  </button>
                </FocusItem>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-[#c8d0ff]">
              <span className="h-px flex-1 bg-white/20" /> OR <span className="h-px flex-1 bg-white/20" />
            </div>
          </>
        )}
        <div className="flex gap-2">
          {tab("signIn", "Sign in")}
          {tab("signUp", "Create account")}
        </div>

        <form className="flex flex-col gap-3" onSubmit={submit}>
          {mode === "signUp" && (
            <label className="flex flex-col gap-1">
              <span className="ff-title text-xs">USERNAME</span>
              <FocusItem>
                <input className={INPUT} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="What other players see" required disabled={busy} />
              </FocusItem>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="ff-title text-xs">{mode === "signIn" ? "EMAIL OR USERNAME" : "EMAIL"}</span>
            <FocusItem>
              <input
                className={INPUT}
                type={mode === "signIn" ? "text" : "email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete={mode === "signIn" ? "username" : "email"}
                placeholder={mode === "signIn" ? "you@example.com or your username" : "you@example.com"}
                required
                disabled={busy}
              />
            </FocusItem>
          </label>
          <label className="flex flex-col gap-1">
            <span className="ff-title text-xs">PASSWORD</span>
            <FocusItem>
              <input
                className={INPUT}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                placeholder={mode === "signIn" ? "Your password" : "At least 8 characters"}
                required
                disabled={busy}
              />
            </FocusItem>
          </label>
          {error && <div className="rounded border border-red-300/40 bg-red-900/30 px-3 py-2 text-sm text-red-200">{error}</div>}
          <FocusItem>
            <button type="submit" disabled={busy} data-on="true" className="ff-panel ff-btn ff-lift mt-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xl">
              {busy ? (mode === "signIn" ? "Signing in…" : "Creating…") : mode === "signIn" ? "Sign in" : "Create account"}
              {!busy && <PixelIcon name="arrow-right" size={20} />}
            </button>
          </FocusItem>
        </form>
      </div>

      <FocusItem>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#c8d0ff] hover:text-white">
          <PixelIcon name="arrow-left" size={16} /> Back to the title screen
        </Link>
      </FocusItem>
    </div>
  );
}
