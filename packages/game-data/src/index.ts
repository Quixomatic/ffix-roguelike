import actionsJson from "./generated/actions.json";
import charactersJson from "./generated/characters.json";
import itemsJson from "./generated/items.json";
import levelingJson from "./generated/leveling.json";
import statusesJson from "./generated/statuses.json";
import shopsJson from "./generated/shops.json";
import supportJson from "./generated/support-abilities.json";
import synthesisJson from "./generated/synthesis.json";
import type {
  AbilityRef,
  ActionData,
  CharacterData,
  FF9Bestiary,
  FF9Enemy,
  ItemData,
  LevelRow,
  ShopData,
  StatusInfo,
  SynthesisRecipe,
  SupportAbilityData,
} from "./types";

export * from "./types";

export const actions = actionsJson as ActionData[];
export const characters = charactersJson as CharacterData[];
export const items = itemsJson as ItemData[];
export const leveling = levelingJson as LevelRow[];
export const statuses = statusesJson as StatusInfo[];
export const supportAbilities = supportJson as SupportAbilityData[];
export const synthesis = synthesisJson as SynthesisRecipe[];
export const shops = shopsJson as ShopData[];
/**
 * FF9's real monsters, attacks and battle scenes. Stored in Postgres (ff9_* tables) and registered at runtime:
 * the server loads them from the DB at startup, the client from the API, tests and the simulator from the local
 * import cache (.cache/ff9). Empty until `registerBestiary` runs.
 */
export const bestiary: FF9Bestiary = { enemies: [], actions: [], scenes: [] };

/** Load (or replace) the FF9 bestiary. Arrays are replaced in place so existing references stay valid. */
export function registerBestiary(data: FF9Bestiary): void {
  bestiary.enemies.splice(0, bestiary.enemies.length, ...data.enemies);
  bestiary.actions.splice(0, bestiary.actions.length, ...data.actions);
  bestiary.scenes.splice(0, bestiary.scenes.length, ...data.scenes);
  bestiaryVersion++;
}

/** Bumped by every registerBestiary call (lets lookups rebuild their caches). */
export let bestiaryVersion = 0;

/** An FF9 monster by name; with several versions, the one closest to `level`. */
export function ff9Enemy(name: string, level?: number): FF9Enemy {
  const all = bestiary.enemies.filter((e) => e.name === name);
  if (!all.length) throw new Error(`Unknown FF9 monster ${name}`);
  if (level == null) return all[0]!;
  return all.reduce((a, b) => (Math.abs(b.level - level) < Math.abs(a.level - level) ? b : a));
}

const actionMap = new Map(actions.map((a) => [a.id, a]));
const characterMap = new Map(characters.map((c) => [c.key, c]));
const itemMap = new Map(items.map((i) => [i.id, i]));
const supportMap = new Map(supportAbilities.map((s) => [s.id, s]));

export const MAX_LEVEL = leveling.length;

export function getAction(id: number): ActionData {
  const a = actionMap.get(id);
  if (!a) throw new Error(`Unknown action ${id}`);
  return a;
}

export function getCharacter(key: string): CharacterData {
  const c = characterMap.get(key);
  if (!c) throw new Error(`Unknown character ${key}`);
  return c;
}

export function getItem(id: number): ItemData {
  const i = itemMap.get(id);
  if (!i) throw new Error(`Unknown item ${id}`);
  return i;
}

export const findItem = (id: number): ItemData | undefined => itemMap.get(id);

export function getSupportAbility(id: number): SupportAbilityData {
  const s = supportMap.get(id);
  if (!s) throw new Error(`Unknown support ability ${id}`);
  return s;
}

export function parseAbilityRef(ref: AbilityRef): { kind: "active" | "support"; id: number } {
  return { kind: ref.startsWith("AA:") ? "active" : "support", id: Number(ref.slice(3)) };
}

export function abilityName(ref: AbilityRef): string {
  const { kind, id } = parseAbilityRef(ref);
  return kind === "active" ? getAction(id).name : getSupportAbility(id).name;
}

/** Find an item by its display name (case-insensitive). Handy for authoring content tables. */
export function itemByName(name: string): ItemData {
  const lower = name.toLowerCase();
  const i = items.find((x) => x.name.toLowerCase() === lower);
  if (!i) throw new Error(`Unknown item "${name}"`);
  return i;
}

export function actionByName(name: string): ActionData {
  const lower = name.toLowerCase();
  const a = actions.find((x) => x.name.toLowerCase() === lower);
  if (!a) throw new Error(`Unknown action "${name}"`);
  return a;
}

/** The eight main party members, in the order they can be unlocked. */
export const MAIN_CAST = ["zidane", "vivi", "steiner", "garnet", "freya", "quina", "eiko", "amarant"] as const;
export type MainCastKey = (typeof MAIN_CAST)[number];
