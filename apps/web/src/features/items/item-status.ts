import { ACHIEVEMENTS, availableJourneys, getJourney, JOURNEYS, rewardItemIds, WORLDS, type Profile } from "@ffix-roguelike/game-core";
import { characters, gearAvailability, synthesis, type ItemData } from "@ffix-roguelike/game-data";

/**
 * Whether an item can turn up in your runs, and if not, how to get it — the gear-availability table read for one
 * player (`.plans/rewards.md` §3.4): gear in an area's map pool drops there without unlocking, but only once you can
 * play that area (it's on a journey you've unlocked); catalog gear and won-run / synthesized gear count once unlocked;
 * legendary gear comes from its achievement. Consumables are always around.
 */
export type ItemStatus =
  | { open: true; kind: "consumable" | "pool" | "unlocked" | "starter"; label: string }
  | { open: false; kind: "journey" | "catalog" | "legendary" | "nowhere"; label: string };

export function itemStatus(item: ItemData, profile: Profile | null): ItemStatus {
  if (item.kind === "item") return { open: true, kind: "consumable", label: "Shops and drops" };
  if ((profile?.gearUnlocked ?? []).includes(item.id)) return { open: true, kind: "unlocked", label: "Unlocked" };
  const a = gearAvailability(item.id);
  if (characters.some((c) => Object.values(c.defaultEquipment ?? {}).includes(item.id))) return { open: true, kind: "starter", label: "Starting gear" };
  if (a?.enabled && !a.legendary && a.mapPools.length) {
    // Only areas you can play: on a journey you've unlocked (signed out: all of them).
    const playable = profile ? new Set(availableJourneys(profile).flatMap((id) => getJourney(id).areas)) : null;
    const open = a.mapPools.filter((p) => !playable || playable.has(p.area));
    const names = (list: { area: string }[]) => list.map((p) => WORLDS.find((w) => w.id === p.area)?.name ?? p.area);
    const short = (list: string[]) => (list.length > 2 ? `${list.slice(0, 2).join(", ")} +${list.length - 2}` : list.join(", "));
    if (open.length) return { open: true, kind: "pool", label: `Drops in ${short(names(open))}` };
    // Its areas are on journeys you haven't opened yet: name the first journey that has one.
    const journey = JOURNEYS.find((j) => j.areas.some((id) => a.mapPools.some((p) => p.area === id)));
    return { open: false, kind: "journey", label: `Drops in ${short(names(a.mapPools))}${journey ? `: unlock the journey "${journey.name}" first` : ""}` };
  }
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
