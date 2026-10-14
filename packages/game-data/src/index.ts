/**
 * FF9's game data. Stored in Postgres (ff9_* tables, seeded from packages/db/seed/ff9) and registered at runtime:
 * the server loads it from the DB at startup, the web app from the API, tests and the simulator from the seed
 * files (`@ffix-roguelike/game-data/cache`). Every table starts empty; never read it at module load.
 */
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

/** FF9's character, ability, item and system tables (Memoria CSV import, scripts/import-memoria.ts). */
export interface GameData {
  actions: ActionData[];
  characters: CharacterData[];
  items: ItemData[];
  leveling: LevelRow[];
  statuses: StatusInfo[];
  supportAbilities: SupportAbilityData[];
  synthesis: SynthesisRecipe[];
  shops: ShopData[];
}

export const actions: ActionData[] = [];
export const characters: CharacterData[] = [];
export const items: ItemData[] = [];
export const leveling: LevelRow[] = [];
export const statuses: StatusInfo[] = [];
export const supportAbilities: SupportAbilityData[] = [];
export const synthesis: SynthesisRecipe[] = [];
export const shops: ShopData[] = [];

/** FF9's real monsters, attacks and battle scenes (Memoria battle export, scripts/import-ff9-battles.ts). */
export const bestiary: FF9Bestiary = { enemies: [], actions: [], scenes: [] };

const fill = <T>(target: T[], source: T[]) => target.splice(0, target.length, ...source);

/** Load (or replace) the FF9 game tables. Arrays are replaced in place so existing references stay valid. */
export function registerGameData(data: GameData): void {
  fill(actions, data.actions);
  fill(characters, data.characters);
  fill(items, data.items);
  fill(leveling, data.leveling);
  fill(statuses, data.statuses);
  fill(supportAbilities, data.supportAbilities);
  fill(synthesis, data.synthesis);
  fill(shops, data.shops);
  gameDataVersion++;
}

/** Load (or replace) the FF9 bestiary. */
export function registerBestiary(data: FF9Bestiary): void {
  fill(bestiary.enemies, data.enemies);
  fill(bestiary.actions, data.actions);
  fill(bestiary.scenes, data.scenes);
  bestiaryVersion++;
}

/** Bumped by every register call (lets lookups elsewhere rebuild their caches). */
export let gameDataVersion = 0;
export let bestiaryVersion = 0;

/** An FF9 monster by name; with several versions, the one closest to `level`. */
export function ff9Enemy(name: string, level?: number): FF9Enemy {
  const all = bestiary.enemies.filter((e) => e.name === name);
  if (!all.length) throw new Error(`Unknown FF9 monster ${name}`);
  if (level == null) return all[0]!;
  return all.reduce((a, b) => (Math.abs(b.level - level) < Math.abs(a.level - level) ? b : a));
}

// Lookup maps, rebuilt after every registerGameData.
let indexed = -1;
let actionMap = new Map<number, ActionData>();
let characterMap = new Map<string, CharacterData>();
let itemMap = new Map<number, ItemData>();
let supportMap = new Map<number, SupportAbilityData>();
function index() {
  if (indexed === gameDataVersion) return;
  actionMap = new Map(actions.map((a) => [a.id, a]));
  characterMap = new Map(characters.map((c) => [c.key, c]));
  itemMap = new Map(items.map((i) => [i.id, i]));
  supportMap = new Map(supportAbilities.map((s) => [s.id, s]));
  indexed = gameDataVersion;
}

/** FF9's level cap. */
export const MAX_LEVEL = 99;

export function getAction(id: number): ActionData {
  index();
  const a = actionMap.get(id);
  if (!a) throw new Error(`Unknown action ${id}`);
  return a;
}

export function getCharacter(key: string): CharacterData {
  index();
  const c = characterMap.get(key);
  if (!c) throw new Error(`Unknown character ${key}`);
  return c;
}

export function getItem(id: number): ItemData {
  index();
  const i = itemMap.get(id);
  if (!i) throw new Error(`Unknown item ${id}`);
  return i;
}

export const findItem = (id: number): ItemData | undefined => {
  index();
  return itemMap.get(id);
};

export function getSupportAbility(id: number): SupportAbilityData {
  index();
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
