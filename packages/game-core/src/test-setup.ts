/** Bun test preload: FF9 game tables, bestiary and battle AI scripts from the seed files (the server loads them from Postgres). */
import { loadBattleScriptCache, loadFf9Cache } from "@ffix-roguelike/game-data/cache";

import { registerBattleScripts } from "./battle/ai/registry";

loadFf9Cache();
registerBattleScripts(loadBattleScriptCache());
