import { synergyTable, type ModifierEffect } from "@ffix-roguelike/game-data";

const STAT_LABEL: Record<string, string> = {
  strength: "Strength",
  magic: "Magic",
  spirit: "Spirit",
  speed: "Speed",
  attack: "Attack",
  defence: "Defence",
  magicDefence: "Magic Defence",
  evade: "Evade",
  magicEvade: "Magic Evade",
};
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A synergy's colour (by id or tag); a calm blue for one without. */
export const synergyColor = (idOrTag: string) => synergyTable().find((s) => s.id === idOrTag || s.tag === idOrTag)?.color ?? "#5a8ad0";

/** A chip tinted with a synergy's colour: its colour as the fill (see-through) and the edge, white text. */
export const synergyChipStyle = (idOrTag: string) => {
  const c = synergyColor(idOrTag);
  return { background: `${c}59`, border: `1px solid ${c}`, color: "#fff" };
};

/** A synergy tag's display name ("tantalus" → "Tantalus", "summoner" → "Summoners"). */
export const tagName = (tag: string) => synergyTable().find((s) => s.tag === tag)?.name ?? cap(tag);

/** Who an effect covers, in words ("" for the whole party). */
function scopeText(e: ModifierEffect): string {
  const s = e.scope;
  if (!s || s.kind === "party") return "";
  if (s.kind === "character") return ` (${cap(s.character)})`;
  return ` (${tagName(s.tag)} members)`;
}

/** One relic / synergy effect in plain words: "+10% Strength", "Steal chances +100% (Tantalus members)". */
export function effectText(e: ModifierEffect): string {
  const who = scopeText(e);
  switch (e.kind) {
    case "stat":
      return `${e.pct > 0 ? "+" : ""}${e.pct}% ${STAT_LABEL[e.stat] ?? e.stat}${who}`;
    case "startStatus":
      return `Start battles with ${cap(e.status)}${who}`;
    case "trance":
      return `Trance starts ${e.startPct}% full${who}`;
    case "steal":
      return `Steal chances +${e.ratePct}%${who}`;
    case "mpDiscount":
      return `Abilities cost ${e.pct}% less MP${who}`;
    case "onKill":
      return `A killing blow restores ${[e.hpPct ? `${e.hpPct}% HP` : "", e.mpPct ? `${e.mpPct}% MP` : ""].filter(Boolean).join(" and ")}${who}`;
  }
}
