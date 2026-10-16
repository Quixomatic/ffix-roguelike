/**
 * Object storage on Cloudflare R2 (S3-compatible), through Bun's built-in S3 client — no SDK dependency.
 * Used by build scripts (game assets → R2) and the API (user uploads such as avatars). One public bucket; keys are
 * namespaced by `KEYS`.
 *
 * Configured from the environment (`r2ConfigFromEnv`), same variable names as GuideEngine:
 * CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME,
 * CLOUDFLARE_R2_PUBLIC_URL (the bucket's public base URL, no trailing slash).
 */
import { S3Client } from "bun";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL objects are served from (r2.dev or a custom domain), no trailing slash. */
  publicUrl: string;
}

/** R2 settings from environment variables, or null when any is missing (storage not configured). */
export function r2ConfigFromEnv(env: Record<string, string | undefined> = process.env): R2Config | null {
  const cfg = {
    accountId: env.CLOUDFLARE_R2_ACCOUNT_ID ?? "",
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? "",
    bucket: env.CLOUDFLARE_R2_BUCKET_NAME ?? "",
    publicUrl: (env.CLOUDFLARE_R2_PUBLIC_URL ?? "").replace(/\/+$/, ""),
  };
  return Object.values(cfg).every(Boolean) ? cfg : null;
}

/** Key namespaces in the bucket. */
export const KEYS = {
  /** Game assets (sprites, effects, music) by their published path, e.g. "assets/<version>/music/music006.ogg". */
  asset: (path: string) => `assets/${path.replace(/^\/+/, "")}`,
  /** A user's avatar image. */
  userAvatar: (userId: string, ext: string) => `avatars/users/${userId}.${ext.replace(/^\./, "")}`,
};

export interface PutOptions {
  /** MIME type (default from the key's extension). */
  contentType?: string;
}

export interface Storage {
  readonly config: R2Config;
  /** Upload (create or replace) an object; returns its public URL. */
  put(key: string, body: Uint8Array | ArrayBuffer | string | Blob, opts?: PutOptions): Promise<string>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** Keys under a prefix (all pages). */
  list(prefix: string): Promise<string[]>;
  publicUrl(key: string): string;
}

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  json: "application/json",
  sajson: "application/json",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  js: "text/javascript",
  css: "text/css",
  txt: "text/plain",
};
export const contentTypeFor = (key: string) => TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

export function createStorage(config: R2Config): Storage {
  const client = new S3Client({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  });
  const publicUrl = (key: string) => `${config.publicUrl}/${key}`;
  return {
    config,
    publicUrl,
    async put(key, body, opts = {}) {
      await client.write(key, body, { type: opts.contentType ?? contentTypeFor(key) });
      return publicUrl(key);
    },
    exists: (key) => client.file(key).exists(),
    async delete(key) {
      await client.delete(key);
    },
    async list(prefix) {
      const keys: string[] = [];
      let startAfter: string | undefined;
      for (;;) {
        const page = await client.list({ prefix, startAfter, maxKeys: 1000 });
        const items = page.contents ?? [];
        keys.push(...items.map((o) => o.key));
        if (!page.isTruncated || !items.length) return keys;
        startAfter = items[items.length - 1]!.key;
      }
    },
  };
}

/** Storage from the environment, or null when R2 isn't configured. */
export function storageFromEnv(env?: Record<string, string | undefined>): Storage | null {
  const cfg = r2ConfigFromEnv(env);
  return cfg ? createStorage(cfg) : null;
}
