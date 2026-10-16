/**
 * Asset packs: many game files in one download. Written by `pnpm -F web assets:pack` (scripts/pack-assets.ts),
 * read in the browser to fill the asset cache.
 *
 * Layout: `FFXP` · u32 format version · u32 header length · header JSON (UTF-8) · the files' bytes, back to back.
 * Integers are little-endian; each entry's `offset` is from the start of the data section.
 */
export const PACK_MAGIC = "FFXP";
export const PACK_VERSION = 1;

export interface PackEntry {
  /** Path under the asset base, e.g. "sprites/heroes/zidane.png", "effects/ab/ability/11000/11000_hit.json". */
  path: string;
  /** MIME type. */
  type: string;
  offset: number;
  size: number;
}

export interface PackHeader {
  /** Asset class and group, e.g. "heroes", "music/music006". */
  name: string;
  files: PackEntry[];
}

/** One pack in the manifest. */
export interface ManifestPack {
  /** File name under `packs/`, content-hashed: "heroes.3f9a1c2b7d4e.pack". */
  file: string;
  hash: string;
  bytes: number;
  files: number;
}

/** `manifest.json`: every pack by name ("heroes", "music/music006"…). */
export interface AssetManifest {
  version: typeof PACK_VERSION;
  generated: string;
  packs: Record<string, ManifestPack>;
}

/** Split a pack into its files. */
export function readPack(buf: ArrayBuffer): { header: PackHeader; file(entry: PackEntry): Uint8Array<ArrayBuffer> } {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  if (new TextDecoder().decode(bytes.subarray(0, 4)) !== PACK_MAGIC) throw new Error("Not an asset pack");
  const version = view.getUint32(4, true);
  if (version !== PACK_VERSION) throw new Error(`Unsupported asset pack version ${version}`);
  const headerLength = view.getUint32(8, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + headerLength))) as PackHeader;
  const data = 12 + headerLength;
  return { header, file: (e) => bytes.subarray(data + e.offset, data + e.offset + e.size) };
}
