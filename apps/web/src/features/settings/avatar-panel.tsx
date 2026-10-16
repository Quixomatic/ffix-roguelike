import { useRef, useState } from "react";
import { toast } from "sonner";

import { ENV } from "@/env";
import { Panel } from "@/features/gear/character-panels";
import { authClient } from "@/lib/auth-client";
import { FocusItem } from "@/features/input/focus";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

/** The player's picture: upload to R2 through the server, then set it on the account with better-auth. */
export function AvatarPanel() {
  const { data: session, refetch } = authClient.useSession();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const user = session?.user;

  async function setImage(image: string | null) {
    const { error } = await authClient.updateUser({ image });
    if (error) throw new Error(error.message ?? "Couldn't update your picture");
    await authClient.getSession({ query: { disableCookieCache: true } });
    await refetch();
  }

  async function upload(file: File) {
    if (file.size > MAX_BYTES) return toast.error("Image too large (max 2 MB)");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/api/uploads/avatar`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed");
      await setImage(body.url);
      toast.success("Picture updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await setImage(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove your picture");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Avatar">
      <div className="flex items-center gap-3">
        <Avatar image={user?.image} name={user?.name} size={64} />
        <div className="flex flex-wrap gap-2">
          <FocusItem>
            <button
              className="rounded border border-white/20 bg-black/25 px-3 py-1 transition hover:brightness-125 disabled:opacity-50"
              disabled={busy || !user}
              onClick={() => input.current?.click()}
            >
              {busy ? "Saving…" : user?.image ? "Change" : "Upload"}
            </button>
          </FocusItem>
          {user?.image && (
            <FocusItem>
              <button
                className="rounded border border-white/20 bg-black/25 px-3 py-1 transition hover:brightness-125 disabled:opacity-50"
                disabled={busy}
                onClick={remove}
              >
                Remove
              </button>
            </FocusItem>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      <div className="text-xs opacity-70">PNG, JPEG, GIF or WebP, up to 2 MB.</div>
    </Panel>
  );
}

/** A user's picture, or their initial on a tile when they have none. */
export function Avatar({ image, name, size = 24 }: { image?: string | null; name?: string; size?: number }) {
  const style = { width: size, height: size };
  if (image) return <img src={image} alt="" style={style} className="shrink-0 rounded object-cover" />;
  return (
    <span
      style={{ ...style, fontSize: size * 0.5 }}
      className="ff-display flex shrink-0 items-center justify-center rounded bg-black/40 text-yellow-200"
    >
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
