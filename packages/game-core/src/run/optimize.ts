/** "Optimize" — equip each party member's strongest available gear (also used by balance sims). */
import { getItem } from "@ffix-roguelike/game-data";

import { canEquip, EQUIP_SLOTS, gearScore, slotUnlocked } from "../stats";
import { equip, type RunState } from "./run";

export function optimizeParty(run: RunState): RunState {
  let next = run;
  for (const m of run.party) {
    const key = m.build.key;
    for (const slot of EQUIP_SLOTS) {
      if (!slotUnlocked(m.build, slot)) continue;
      const current = next.gear.find((g) => g.holder?.key === key && g.holder.slot === slot);
      const best = next.gear
        .filter((g) => (!g.holder || g === current) && canEquip(key, getItem(g.itemId), slot))
        .sort((a, b) => gearScore(getItem(b.itemId)) - gearScore(getItem(a.itemId)))[0];
      if (best && best !== current) next = equip(next, key, slot, best.uid);
    }
  }
  return next;
}
