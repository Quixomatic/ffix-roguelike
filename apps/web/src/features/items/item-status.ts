import { ACHIEVEMENTS, rewardItemIds, WORLDS, type Profile } from "@ffix-roguelike/game-core";
import { characters, gearAvailability, synthesis, type ItemData } from "@ffix-roguelike/game-data";

/**
 * Whether an item can turn up in your runs, and if not, how to get it — the gear-availability table read for one
 * player (`.plans/rewards.md` §3.4): gear in an area's map pool drops without unlocking; catalog gear and won-run /
 * synthesized gear count once unlocked; legendary gear comes from its achievement. Consumables are always around.
 */
export type ItemStatus =
  | { open: true; kind: "consumable" | "pool" | "unlocked" | "starter"; label: string }
  | { open: false; kind: "catalog" | "legendary" | "nowhere"; label: string };

export function itemStatus(item: ItemData, profile: Profile | null): ItemStatus {
  if (item.kind === "item") return { open: true, kind: "consumable", label: "Shops and drops" };
  if ((profile?.gearUnlocked ?? []).includes(item.id)) return { open: true, kind: "unlocked", label: "Unlocked" };
  const a = gearAvailability(item.id);
  if (a?.enabled && !a.legendary && a.mapPools.length) {
    const areas = a.mapPools.map((p) => WORLDS.find((w) => w.id === p.area)?.name ?? p.area);
    return { open: true, kind: "pool", label: `Drops in ${areas.length > 2 ? `${areas.slice(0, 2).join(", ")} +${areas.length - 2}` : areas.join(", ")}` };
  }
  if (characters.some((c) => Object.values(c.defaultEquipment ?? {}).includes(item.id))) return { open: true, kind: "starter", label: "Starting gear" };
  if (a?.legendary) {
    const ach = ACHIEVEMENTS.find((x) => rewardItemIds(x).includes(item.id));
    return { open: false, kind: "legendary", label: ach ? `Achievement: ${ach.name} (${ach.description})` : "An achievement" };
  }
  const synth = synthesis.some((r) => r.result === item.id) ? " · or synthesize it" : "";
  if (a?.enabled && a.catalog && a.catalogPrice != null) {
    const reached = (profile?.stats.bestWorld ?? 0) >= a.catalogFromTier;
    return { open: false, kind: "catalog", label: `Gear catalog: ${a.catalogPrice.toLocaleString()} gil${reached ? "" : " (once you reach further)"}${synth}` };
  }
  return { open: false, kind: "nowhere", label: synth ? "Synthesize it in a run" : "Not in runs yet" };
}
