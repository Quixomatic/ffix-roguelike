/** Bun test preload: register the FF9 bestiary from the local import cache (the server uses Postgres). */
import { loadBestiaryCache } from "@ffix-roguelike/game-data/cache";

loadBestiaryCache();
