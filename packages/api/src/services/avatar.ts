import { KEYS, storageFromEnv } from "@ffix-roguelike/storage";

/**
 * Player avatar files in R2, under `avatars/users/<userId>.<ext>`. Uploads arrive as multipart on the Hono route
 * (`POST /api/uploads/avatar` — tRPC is JSON-only), which returns the public URL; the client then sets it as the
 * user's image through better-auth (`authClient.updateUser({ image })`), so `user.image` stays better-auth's.
 */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const FORMATS = [
  { ext: "png", type: "image/png", is: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "jpg", type: "image/jpeg", is: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "gif", type: "image/gif", is: (b: Uint8Array) => ascii(b, 0, 4) === "GIF8" },
  { ext: "webp", type: "image/webp", is: (b: Uint8Array) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
] as const;

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** An upload the player can fix (shown to them as is), with the HTTP status for the route. */
export class AvatarError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 503,
  ) {
    super(message);
  }
}

/**
 * Store a new avatar and return its public URL (`?v=` stamped — the key is the same on every upload, so the
 * stamp is what makes browsers and the CDN fetch the new one). The format is read from the bytes, not trusted
 * from the client; an older avatar in another format is deleted.
 */
export async function uploadAvatar(userId: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > AVATAR_MAX_BYTES) throw new AvatarError("Image too large (max 2 MB)", 413);
  const format = FORMATS.find((f) => f.is(bytes));
  if (!format) throw new AvatarError("Use a PNG, JPEG, GIF or WebP image", 400);
  const storage = storageFromEnv();
  if (!storage) throw new AvatarError("Uploads aren't configured on this server", 503);
  const key = KEYS.userAvatar(userId, format.ext);
  await Promise.all(
    FORMATS.map((f) => KEYS.userAvatar(userId, f.ext))
      .filter((k) => k !== key)
      .map((k) => storage.delete(k)),
  );
  return `${await storage.put(key, bytes, { contentType: format.type })}?v=${Date.now()}`;
}
