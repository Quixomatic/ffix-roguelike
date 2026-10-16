import { AVATAR_MAX_BYTES, AvatarError, uploadAvatar } from "@ffix-roguelike/api/services/avatar";
import { Hono } from "hono";

import { auth } from "./services";

/**
 * File uploads — multipart, so they can't go through tRPC (JSON-only). Thin: check the session, read the file,
 * hand the bytes to the api service. Cookie-authed like tRPC. Mounted at `/api/uploads`.
 */
export const uploadsApi = new Hono();

/** `POST /api/uploads/avatar` — form field `file`; returns `{ url }`; the client sets it with `authClient.updateUser({ image: url })`. */
uploadsApi.post("/avatar", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
  if (file.size > AVATAR_MAX_BYTES) return c.json({ error: "Image too large (max 2 MB)" }, 413);
  try {
    const url = await uploadAvatar(session.user.id, new Uint8Array(await file.arrayBuffer()));
    return c.json({ url });
  } catch (err) {
    if (err instanceof AvatarError) return c.json({ error: err.message }, err.status);
    throw err;
  }
});
