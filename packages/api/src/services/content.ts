/**
 * FF9 battle data from Postgres (ff9_* tables) into game-core's registry. Loaded once per server process on the
 * first request that needs game rules: monsters, attacks, scenes and every battle AI script. The client gets
 * scripts one battle at a time (sceneScript).
 */
import { registerBattleScripts } from "@ffix-roguelike/game-core";
import { registerBestiary, type FF9Bestiary, type FF9Enemy, type FF9EnemyAction, type FF9Scene } from "@ffix-roguelike/game-data";
import type { Database } from "@ffix-roguelike/db";

let loading: Promise<FF9Bestiary> | null = null;
const scripts = new Map<string, Uint8Array | null>();

/** Load the bestiary and all battle AI scripts and register them. Safe to call on every request. */
export function ensureFf9Content(db: Database): Promise<FF9Bestiary> {
  loading ??= (async () => {
    const [enemies, actions, scenes] = await Promise.all([
      db.ff9Enemy.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9EnemyAction.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
      db.ff9BattleScene.findMany({ orderBy: { id: "asc" }, select: { data: true } }),
    ]);
    if (!enemies.length) throw new Error("FF9 battle data missing — run `pnpm -F @ffix-roguelike/db db:seed:ff9`");
    const data: FF9Bestiary = {
      enemies: enemies.map((e) => e.data as unknown as FF9Enemy),
      actions: actions.map((a) => a.data as unknown as FF9EnemyAction),
      scenes: scenes.map((s) => s.data as unknown as FF9Scene),
    };
    registerBestiary(data);
    // Every scene's AI script, so the server can create and replay any FF9 battle.
    const scriptRows = await db.ff9BattleScene.findMany({ where: { script: { not: null } }, select: { id: true, script: true } });
    registerBattleScripts(Object.fromEntries(scriptRows.map((r) => [r.id, new Uint8Array(r.script!)])));
    return data;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** A battle scene's compiled FF9 AI script (null if the scene has none). */
export async function sceneScript(db: Database, scene: string): Promise<Uint8Array | null> {
  if (scripts.has(scene)) return scripts.get(scene)!;
  const row = await db.ff9BattleScene.findUnique({ where: { id: scene }, select: { script: true } });
  const bytes = row?.script ? new Uint8Array(row.script) : null;
  scripts.set(scene, bytes);
  return bytes;
}
