import { hasBattleScript, registerBattleScript } from "@ffix-roguelike/game-core";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

/**
 * Make sure a battle's FF9 AI script is registered before its engine runs. Scripts come from the server one
 * battle at a time; a battle without a scene (crossover monsters) needs none.
 */
export function useBattleScript(scene: string | undefined): boolean {
  const id = scene?.replace(/^@/, "").split(/[#!]/)[0]?.toUpperCase();
  const needed = !!id && !hasBattleScript(id);
  const query = useQuery({ ...trpc.content.battleScript.queryOptions({ scene: id ?? "" }, { staleTime: Infinity }), enabled: needed });
  if (!needed) return true;
  if (query.data === undefined) return false;
  if (query.data) registerBattleScript(id!, query.data);
  return true;
}
