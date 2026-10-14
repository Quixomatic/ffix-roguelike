/** Bun test preload: FF9 bestiary + battle AI scripts from the seed files (the server loads them from Postgres). */
import { loadBattleScriptCache, loadBestiaryCache } from "@ffix-roguelike/game-data/cache";

import { registerBattleScripts } from "./battle/ai/registry";

loadBestiaryCache();
registerBattleScripts(loadBattleScriptCache());
