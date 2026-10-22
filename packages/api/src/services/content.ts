/**
 * FF9 data from Postgres (ff9_* tables) into game-core's registry. Loaded once per server process on the first
 * request that needs game rules: the game tables (characters, abilities, items, shops…), the bestiary and every
 * battle AI script. The web app gets the same tables through `content.ff9` and scripts one battle at a time.
 */
import { registerBattleScripts } from "@ffix-roguelike/game-core";
import {
  registerBestiary,
  registerGameData,
  registerRewardTables,
  type AchievementData,
  type AreaData,
  type ChallengeCategoryData,
  type ChallengeData,
  type GameSettingData,
  type JourneyData,
  type RelicData,
  type JourneyGroupData,
  type SynergyData,
  type GearAvailability,
  type StarterUpgrade,
  type RewardBoon,
  type RewardRarity,
  type RewardRole,
  type RewardSource,
  type RewardTables,
  type ActionData,
  type CharacterData,
  type FF9Bestiary,
  type FF9Enemy,
  type FF9EnemyAction,
  type FF9Scene,
  type GameData,
  type ItemData,
  type LevelRow,
  type ShopData,
  type StatusInfo,
  type SupportAbilityData,
  type SynthesisRecipe,
} from "@ffix-roguelike/game-data";
import type { Database } from "@ffix-roguelike/db";
import { loadContent } from "@ffix-roguelike/db/content";
import { loadRewards } from "@ffix-roguelike/db/rewards";

export interface Ff9Content {
  game: GameData;
  bestiary: FF9Bestiary;
}

let loading: Promise<Ff9Content> | null = null;
const scripts = new Map<string, Uint8Array | null>();

const rows = <T>(list: { data: unknown }[]) => list.map((r) => r.data as T);

/** Load all FF9 data and register it. Safe to call on every request. */
export function ensureFf9Content(db: Database): Promise<Ff9Content> {
  loading ??= (async () => {
    const [actions, characters, items, leveling, statuses, supportAbilities, synthesis, shops, enemies, enemyActions, scenes] = await Promise.all([
      db.ff9Action.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9Character.findMany({ select: { data: true } }),
      db.ff9Item.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9Level.findMany({ orderBy: { level: "asc" }, select: { data: true } }),
      db.ff9Status.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9SupportAbility.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9Synthesis.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9Shop.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9Enemy.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9EnemyAction.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9BattleScene.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
    ]);
    if (!items.length || !enemies.length) throw new Error("FF9 data missing — restart the server (it seeds on boot) or run `pnpm -F @ffix-roguelike/db db:seed:ff9`");
    // Characters keep FF9's order (Zidane first), as in the seed file.
    const characterRows = rows<CharacterData>(characters).sort((a, b) => a.id - b.id);
    const game: GameData = {
      actions: rows<ActionData>(actions),
      characters: characterRows,
      items: rows<ItemData>(items),
      leveling: rows<LevelRow>(leveling),
      statuses: rows<StatusInfo>(statuses),
      supportAbilities: rows<SupportAbilityData>(supportAbilities),
      synthesis: rows<SynthesisRecipe>(synthesis),
      shops: rows<ShopData>(shops),
    };
    const bestiary: FF9Bestiary = { enemies: rows<FF9Enemy>(enemies), actions: rows<FF9EnemyAction>(enemyActions), scenes: rows<FF9Scene>(scenes) };
    registerGameData(game);
    registerBestiary(bestiary);
    // Every scene's AI script, so the server can create and replay any FF9 battle.
    const scriptRows = await db.ff9BattleScene.findMany({ where: { script: { not: null } }, select: { id: true, script: true } });
    registerBattleScripts(Object.fromEntries(scriptRows.map((r) => [r.id, new Uint8Array(r.script!)])));
    return { game, bestiary };
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

let rewardsLoading: Promise<RewardTables> | null = null;

/**
 * The reward / gear-availability tables from Postgres, registered (game rules read them: drop pools, the gear
 * catalog, reward offers). Loaded once per process; `reloadRewardContent` after an admin edit.
 */
export function ensureRewardContent(db: Database): Promise<RewardTables> {
  rewardsLoading ??= (async () => {
    const [rewards, characterTags, content, settings] = await Promise.all([
      // Reward tables, areas, journeys, groupings and challenges: columns + join rows, assembled into game-data's rows.
      loadRewards(db),
      db.characterTag.findMany({ orderBy: { character: "asc" }, select: { character: true, tags: true } }),
      loadContent(db),
      db.gameSetting.findMany({ select: { key: true, value: true } }),
    ]);
    if (!rewards.gear.length || !rewards.rarities.length || !content.areas.length || !content.journeys.length)
      throw new Error("Reward / content tables missing — restart the server (it seeds them on boot)");
    const tables: RewardTables = {
      rarities: rewards.rarities as unknown as RewardRarity[],
      roles: rewards.roles as unknown as RewardRole[],
      sources: rewards.sources as unknown as RewardSource[],
      boons: rewards.boons as unknown as RewardBoon[],
      gear: rewards.gear as unknown as GearAvailability[],
      starter: rewards.starter as unknown as StarterUpgrade[],
      achievements: rewards.achievements as unknown as AchievementData[],
      relics: rewards.relics as unknown as RelicData[],
      synergies: rewards.synergies as unknown as SynergyData[],
      characterTags,
      journeyGroups: content.journeyGroups as unknown as JourneyGroupData[],
      areas: content.areas as unknown as AreaData[],
      journeys: content.journeys as unknown as JourneyData[],
      challengeCategories: content.challengeCategories as unknown as ChallengeCategoryData[],
      challenges: content.challenges as unknown as ChallengeData[],
      // Game settings: read once here (and after admin edits), then served from memory.
      settings: settings.map((r) => ({ key: r.key, value: r.value as GameSettingData["value"] })),
    };
    registerRewardTables(tables);
    return tables;
  })().catch((err) => {
    rewardsLoading = null;
    throw err;
  });
  return rewardsLoading;
}

/** Re-read the reward tables (after an admin edit). */
export function reloadRewardContent(db: Database): Promise<RewardTables> {
  rewardsLoading = null;
  return ensureRewardContent(db);
}

/** A battle scene's compiled FF9 AI script (null if the scene has none). */
export async function sceneScript(db: Database, scene: string): Promise<Uint8Array | null> {
  if (scripts.has(scene)) return scripts.get(scene)!;
  const row = await db.ff9BattleScene.findUnique({ where: { id: scene }, select: { script: true } });
  const bytes = row?.script ? new Uint8Array(row.script) : null;
  scripts.set(scene, bytes);
  return bytes;
}
