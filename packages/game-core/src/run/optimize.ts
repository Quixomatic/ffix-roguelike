/** "Optimize" — equip each party member's strongest available gear (also used by balance sims). */
import { getItem, type ItemData } from "@ffix-roguelike/game-data";

import { canEquip, EQUIP_SLOTS } from "../stats";
import { equip, type RunState } from "./run";

export function gearScore(item: ItemData): number {
  const b = item.bonus;
  const stats = b ? (b.speed + b.strength + b.magic + b.spirit) * 3 : 0;
  if (item.weapon) return item.weapon.power * 4 + stats;
  const a = item.armor;
  return (a ? a.defence * 3 + a.magicDefence * 3 + a.evade + a.magicEvade : 0) + stats + item.price / 2000;
}

export function optimizeParty(run: RunState): RunState {
  let next = run;
  for (const m of run.party) {
    const key = m.build.key;
    for (const slot of EQUIP_SLOTS) {
      const current = next.gear.find((g) => g.holder?.key === key && g.holder.slot === slot);
      const best = next.gear
        .filter((g) => (!g.holder || g === current) && canEquip(key, getItem(g.itemId), slot))
        .sort((a, b) => gearScore(getItem(b.itemId)) - gearScore(getItem(a.itemId)))[0];
      if (best && best !== current) next = equip(next, key, slot, best.uid);
    }
  }
  return next;
}
