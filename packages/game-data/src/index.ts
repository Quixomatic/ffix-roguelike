import actionsJson from "./generated/actions.json";
import charactersJson from "./generated/characters.json";
import itemsJson from "./generated/items.json";
import levelingJson from "./generated/leveling.json";
import statusesJson from "./generated/statuses.json";
import supportJson from "./generated/support-abilities.json";
import type {
  AbilityRef,
  ActionData,
  CharacterData,
  ItemData,
  LevelRow,
  StatusInfo,
  SupportAbilityData,
} from "./types";

export * from "./types";

export const actions = actionsJson as ActionData[];
export const characters = charactersJson as CharacterData[];
export const items = itemsJson as ItemData[];
export const leveling = levelingJson as LevelRow[];
export const statuses = statusesJson as StatusInfo[];
export const supportAbilities = supportJson as SupportAbilityData[];

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
