/**
 * FFRK effect candidates for FF9's battle items, in the same shape as the spell and move candidates. FFRK keeps its
 * item and white-magic effects in one family (20xxx): 20000 / 20001 are the carele / carelela (ケアル / ケアルラ) heal
 * sprites — FFRK's own Hi-Potion uses 20001 — 20002 / 20003 the carelega tier, 20004–20006 light and water-drop cures,
 * 20010 / 20011 the raise-type heals with a flying shot, 2030x the status cures (20301 poisona ポイゾナ, 20302 is FFRK's
 * Eye Drops, 20303 stone art), 20400 its own art; 60015 is FFRK's Phoenix. Items are keyed "i:<item id>" in the
 * effect map; the first candidate is assigned by `scripts/seed-ability-effects.ts`, and the effects gallery's
 * "To map" tab lists the items to check and swap.
 */
import { c, type SpellCandidates } from "./spell-candidates";

export const ITEM_CANDIDATES: SpellCandidates[] = [
  { name: "Potion", school: "none", group: "Item", candidates: [c("20000", "carele heal sprite (ケアル): FFRK's potion-tier heal"), c("20010", "carele with a shot")] },
  { name: "Hi-Potion", school: "none", group: "Item", candidates: [c("20001", "FFRK's own Hi-Potion (carelela sprite)"), c("20011", "carelela with a shot")] },
  { name: "Ether", school: "none", group: "Item", candidates: [c("20004", "light cure, own launch/shot"), c("20005", "water-drop cure")] },
  { name: "Elixir", school: "none", group: "Item", candidates: [c("20003", "carelega hit with the big light burst"), c("20002", "carelega hit")] },
  { name: "Phoenix Down", school: "none", group: "Item", candidates: [c("20010", "raise-type heal with a shot"), c("20400", "own art"), c("20011", "raise-type with a shot")] },
  { name: "Echo Screen", school: "none", group: "Item", candidates: [c("20302", "FFRK's Eye Drops sparkle (status cure)"), c("20301", "poisona")] },
  { name: "Soft", school: "none", group: "Item", candidates: [c("20303", "stone art in the status-cure range")] },
  { name: "Antidote", school: "none", group: "Item", candidates: [c("20301", "poisona hit (ポイゾナ = cure poison)"), c("20302", "status-cure sparkle")] },
  { name: "Eye Drops", school: "none", group: "Item", candidates: [c("20302", "FFRK's own Eye Drops")] },
  { name: "Magic Tag", school: "none", group: "Item", candidates: [c("20302", "status-cure sparkle"), c("20310", "light lines")] },
  { name: "Vaccine", school: "none", group: "Item", candidates: [c("20301", "poisona-style cure"), c("20302", "status-cure sparkle")] },
  { name: "Remedy", school: "none", group: "Item", candidates: [c("20005", "water-drop cure (Esuna-like), own launch/shot"), c("20006", "water-drop cure")] },
  { name: "Annoyntment", school: "none", group: "Item", candidates: [c("20302", "status-cure sparkle"), c("20301", "poisona")] },
  { name: "Gysahl Greens", school: "none", group: "Item", candidates: [c("20302", "status-cure sparkle")] },
  { name: "Tent", school: "none", group: "Item", candidates: [c("20006", "water-drop cure"), c("20005", "water-drop cure")] },
  { name: "Dead Pepper", school: "none", group: "Item", candidates: [c("11001", "fire burst (it's a hot pepper)"), c("50889", "a blast")] },
  { name: "Ore", school: "none", group: "Item", candidates: [c("19020", "a falling rock (Comet)"), c("33052", "earth")] },
];
