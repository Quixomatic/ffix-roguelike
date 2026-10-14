/**
 * Battle AI script registry: scene id → FF9 battle script (.eb bytes). game-core never ships the scripts; the
 * server fills this from the database and tests/sim from the local FF9 cache. A battle whose scene has no
 * registered script falls back to the AiRule behaviour.
 */
import { parseScript, type EbScript } from "./disasm";

const raw = new Map<string, Uint8Array>();
const parsed = new Map<string, EbScript>();

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const key = (scene: string) => scene.toUpperCase().replace(/^EVT_BATTLE_/, "");

/** Register one scene's script (raw bytes or base64). */
export function registerBattleScript(scene: string, bytes: Uint8Array | string) {
  const k = key(scene);
  raw.set(k, typeof bytes === "string" ? decodeBase64(bytes) : bytes);
  parsed.delete(k);
}

/** Register many scripts at once: { "EF_E009": <base64 or bytes>, … }. */
export function registerBattleScripts(map: Record<string, Uint8Array | string>) {
  for (const [scene, bytes] of Object.entries(map)) registerBattleScript(scene, bytes);
}

export function clearBattleScripts() {
  raw.clear();
  parsed.clear();
}

export function hasBattleScript(scene: string): boolean {
  return raw.has(key(scene));
}

export function registeredBattleScenes(): string[] {
  return [...raw.keys()];
}

/** The parsed script for a scene, or undefined if none is registered. */
export function getBattleScript(scene: string): EbScript | undefined {
  const k = key(scene);
  const cached = parsed.get(k);
  if (cached) return cached;
  const bytes = raw.get(k);
  if (!bytes) return undefined;
  const script = parseScript(bytes);
  parsed.set(k, script);
  return script;
}
