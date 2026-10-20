import type { Profile } from "@ffix-roguelike/game-core";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { USERNAME } from "@/features/auth/login-page";
import { FocusItem } from "@/features/input/focus";
import { AvatarPanel } from "@/features/settings/avatar-panel";
import { authClient, playerName } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

import { MetricsOverview } from "./stats-page";

/**
 * The player's profile: who they are (name, email, avatar, sign out) and all their stats (every metric the game keeps,
 * the party side by side, the top tens). Reached from the player card at the bottom of the sidebar.
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (profile.isPending) return <div className="p-6">Loading…</div>;
  const p = (profile.data ?? null) as Profile | null;
  const user = session?.user;
  const since = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;
  const signOut = () => authClient.signOut({ fetchOptions: { onSuccess: () => navigate({ to: "/" }) } });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-24 pt-6">
      <div className="ff-window grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-center gap-1">
          <div className="ff-title text-xs tracking-[0.25em]">PROFILE</div>
          <div className="ff-display truncate text-4xl">{playerName(user) || "—"}</div>
          <div className="text-sm text-[#c8d0ff]">{user?.email}</div>
          <UsernameEditor current={playerName(user)} />
          {since && <div className="text-xs opacity-70">Playing since {since}</div>}
          {p && (
            <div className="mt-1 flex flex-wrap gap-2 text-sm">
              <span className="ff-chip">{p.gil.toLocaleString()} gil banked</span>
              <span className="ff-chip">{(p.achievements ?? []).length} achievements</span>
              <span className="ff-chip">{(p.journeysCleared ?? []).length} journeys cleared</span>
            </div>
          )}
          <div className="mt-2">
            <FocusItem>
              <button onClick={signOut} className="rounded border border-red-300/40 bg-red-900/20 px-4 py-1.5 text-sm text-red-100 hover:bg-red-900/40">
                Sign out
              </button>
            </FocusItem>
          </div>
        </div>
        <AvatarPanel />
      </div>

      <div className="ff-window flex flex-col gap-1 px-5 py-3">
        <div className="ff-display text-3xl">Stats</div>
        <div className="text-sm text-[#c8d0ff]">Counted from the server's verified battles. Who landed each hit, damage and steals count from v0.3.1 on.</div>
      </div>
      <MetricsOverview bag={p?.metrics ?? {}} characters={p?.unlocked ?? []} />
    </div>
  );
}

/** A placeholder username given at sign-up with Google / GitHub ("user482915730"). */
const isPlaceholder = (name: string) => /^user\d{9}$/.test(name);

/**
 * Change your username (what other players see): checked as you go (allowed characters, free), saved with better-auth's
 * username plugin. A placeholder from a Google / GitHub sign-up asks for a real one.
 */
function UsernameEditor({ current }: { current: string }) {
  const { refetch } = authClient.useSession();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const wanted = value.trim();
    if (!USERNAME.test(wanted)) return setError("3–20 letters, numbers, \"_\" or \".\".");
    if (wanted.toLowerCase() === current.toLowerCase() && wanted === current) return setEditing(false);
    setBusy(true);
    setError(null);
    try {
      if (wanted.toLowerCase() !== current.toLowerCase()) {
        const free = await authClient.isUsernameAvailable({ username: wanted });
        if (!free.data?.available) return setError("That username is taken.");
      }
      const res = await authClient.updateUser({ username: wanted, displayUsername: wanted });
      if (res.error) return setError(res.error.message || "Couldn't change it.");
      await authClient.getSession({ query: { disableCookieCache: true } });
      await refetch();
      setEditing(false);
      toast.success(`You're ${wanted} now`);
    } finally {
      setBusy(false);
    }
  };

  if (!editing)
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {isPlaceholder(current) && <span className="text-pink-200">That's a placeholder name: pick your own.</span>}
        <FocusItem>
          <button
            onClick={() => {
              setValue(current);
              setEditing(true);
            }}
            className="rounded border border-white/20 bg-black/25 px-3 py-1 hover:brightness-125"
          >
            Change username
          </button>
        </FocusItem>
      </div>
    );
  return (
    <form onSubmit={save} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <FocusItem>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            className="w-56 rounded border-2 border-white/25 bg-black/40 px-3 py-1.5 text-white focus:border-yellow-300 focus:outline-none"
          />
        </FocusItem>
        <FocusItem>
          <button type="submit" disabled={busy} data-on="true" className="ff-panel ff-btn px-4 py-1.5 text-sm">
            {busy ? "Saving…" : "Save"}
          </button>
        </FocusItem>
        <FocusItem>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-[#c8d0ff] hover:text-white">
            Cancel
          </button>
        </FocusItem>
      </div>
      {error && <span className="text-sm text-red-300">{error}</span>}
    </form>
  );
}
