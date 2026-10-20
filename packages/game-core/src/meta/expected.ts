/**
 * Expected loadouts: what a character at some level can be expected to wear and know, for Practice and the sim, so a
 * fight or a journey can be judged at a realistic gearing instead of only in starting gear (FF9's damage is driven by
 * weapon power, not level).
 *
 *   - The areas a level has **reached**: every story area usually played at or below that level (`areaPartyLevel`).
 *   - **Expected gear:** the best piece per slot from those areas' FF9 shops (the stock their map pools are built from),
 *     picked by the reward cards' role-weighted upgrade score; every slot open.
 *   - **Expected abilities:** every ability that gear (and the starting gear) teaches the character is mastered, and
 *     support abilities are switched on within the magic-stone budget, the useful ones first.
 */
import { getCharacter, getItem, getSupportAbility, parseAbilityRef, shops, type EquipSlot } from "@ffix-roguelike/game-data";

import { JOURNEYS, WORLDS, type WorldDef } from "../content/worlds";
import { upgradeScore } from "../rewards/upgrade";
import { isGear } from "../run/loot";
import { encounterUnits, type RunState } from "../run/run";
import { accrueGrowth, deriveStats, EQUIP_SLOTS, gemsMax, newBuild, starterGear, type CharacterBuild } from "../stats";

export interface ExpectedOptions {
  /** Wear the best gear the areas reached by this level sell. */
  gear?: boolean;
  /** Master everything that gear teaches, with supports on. */
  abilities?: boolean;
}

const ALL_SLOTS: EquipSlot[] = ["head", "wrist", "armor", "accessory"];

const areaLevels = new Map<string, number>();
/** The strongest monster in an area's regular fights (its scenes' every pattern). */
function areaLevel(w: WorldDef): number {
  const known = areaLevels.get(w.id);
  if (known != null) return known;
  let top = 1;
  for (const group of w.encounters) {
    try {
      for (const u of encounterUnits(group, 0).units) if (!u.untargetable) top = Math.max(top, u.level);
    } catch {
      // A scene the loaded bestiary doesn't have: skip it.
    }
  }
  areaLevels.set(w.id, top);
  return top;
}

/**
 * The party level an area is usually played at. FF9's monsters sit well below the party (Cleyra's are Lv8–12 with a
 * party around Lv20), so about 1.5× its strongest regular monster, at most that + 15 (late areas' monsters catch up).
 */
export const areaPartyLevel = (w: WorldDef) => Math.round(Math.min(areaLevel(w) * 1.5, areaLevel(w) + 15));

/**
 * The story areas a party at `level` has reached: those usually played at or below it (the first one, always). The
 * side journeys' areas don't count: their shops follow the crossovers, not the story's gear curve.
 */
export function areasReachedAt(level: number): WorldDef[] {
  const story = new Set(JOURNEYS.filter((j) => j.category === "story").flatMap((j) => j.areas));
  const areas = WORLDS.filter((w) => story.has(w.id));
  const reached = areas.filter((w) => areaPartyLevel(w) <= level);
  return reached.length ? reached : areas.slice(0, 1);
}

/** Gear a party at `level` can expect to have found or bought: the FF9 shops of every area reached. */
export function expectedGearPool(level: number): number[] {
  const ids = new Set<number>();
  for (const w of areasReachedAt(level))
    for (const shopId of w.shops) for (const id of shops.find((s) => s.id === shopId)?.items ?? []) if (isGear(getItem(id))) ids.add(id);
  return [...ids];
}

/** Supports worth having on first, by name (the rest follow, cheapest first). */
const SUPPORT_PRIORITY = [
  "Auto-Haste", "Auto-Regen", "Auto-Life", "Auto-Reflect", "Auto-Float", "HP+20%", "HP+10%", "MP+20%", "MP+10%", "Ability Up",
  "Accuracy+", "Counter", "Eye 4 Eye", "Cover", "Protect Girls", "Auto-Potion", "Chemist", "Healer", "Concentrate", "Reflect-Null",
  "Return Magic", "Half MP", "Body Temp", "Insomniac", "Antibody", "Bright Eyes", "Loudmouth", "Clear Headed", "Jelly", "Locomotion",
  "Power Up", "MP Attack", "Bird Killer", "Bug Killer", "Stone Killer", "Undead Killer", "Dragon Killer", "Devil Killer", "Beast Killer",
  "Man Eater", "Long Reach", "Master Thief", "Bandit", "Initiative", "Alert", "Distract", "Add Status", "Gamble Defence",
];

/** The best piece per slot from `pool` for this build: greedy by the upgrade score, a few passes so each slot settles. */
function bestGear(base: CharacterBuild, pool: number[]): CharacterBuild["equipment"] {
  const b: CharacterBuild = { ...base, equipment: { ...base.equipment } };
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const id of pool) {
      const e = upgradeScore(b, id);
      if (e && e.score > 0) {
        b.equipment = { ...b.equipment, [e.change.slot]: id };
        changed = true;
      }
    }
    if (!changed) break;
  }
  return b.equipment;
}

/** Whether a build's growth pool has anything in it (a run's level-ups, or a profile's carried growth). */
const hasGrown = (b: CharacterBuild) => !!b.growth && Object.values(b.growth).some((v) => v > 0);

/**
 * A character at `level` with the expected gear and / or abilities (`base`: a build to start from, e.g. one with
 * training; else a fresh one). Without either option it's the base build in its starting gear.
 */
export function expectedBuild(key: string, level: number, opts: ExpectedOptions = {}, base?: CharacterBuild): CharacterBuild {
  const b: CharacterBuild = structuredClone(base ?? newBuild(key, level));
  b.level = level;
  if (opts.gear || opts.abilities) b.unlockedSlots = [...new Set([...(b.unlockedSlots ?? []), ...ALL_SLOTS])];
  b.equipment = starterGear(b);
  const pool = expectedGearPool(level).filter((id) => getItem(id).equippableBy.includes(key));
  const character = getCharacter(key);

  if (opts.abilities) {
    // Master what the reachable gear and the starting gear teach (only abilities this character can learn).
    const taught = new Set<string>();
    for (const id of [...pool, ...EQUIP_SLOTS.map((s) => b.equipment[s]).filter((x): x is number => x != null)]) for (const ref of getItem(id).abilities) taught.add(ref);
    b.ap = { ...b.ap };
    for (const a of character.abilities) if (taught.has(a.ref)) b.ap[a.ref] = Math.max(b.ap[a.ref] ?? 0, a.ap);
  }

  if (opts.gear) {
    // FF9's growth pool: every level-up adds Str/Mag +3, Spirit +1, stones +5 and the worn gear's stat bonuses
    // (accrueGrowth), a large part of a late character's HP and Strength. Grown here as a character reaching this
    // level would have, wearing each stretch's expected gear; only for a build that hasn't grown yet (a run's own
    // growth is never counted twice).
    if (!hasGrown(b)) {
      const STEP = 5;
      for (let lv = 1; lv < level; lv += STEP) {
        const stage: CharacterBuild = { ...b, level: Math.min(level, lv + STEP), equipment: bestGear(b, expectedGearPool(lv).filter((id) => getItem(id).equippableBy.includes(key))) };
        accrueGrowth(stage, lv);
        b.growth = stage.growth;
      }
    }
    b.equipment = bestGear(b, pool);
  }

  if (opts.abilities) {
    // Supports: everything mastered (or on the gear worn), the useful ones first, within the stone budget.
    const supports = character.abilities
      .map((a) => ({ ref: a.ref, p: parseAbilityRef(a.ref) }))
      .filter(({ ref, p }) => p.kind === "support" && ((b.ap[ref] ?? 0) >= (character.abilities.find((x) => x.ref === ref)?.ap ?? Infinity) || EQUIP_SLOTS.some((s) => b.equipment[s] != null && getItem(b.equipment[s]!).abilities.includes(ref))))
      .map(({ p }) => getSupportAbility(p.id));
    const rank = (name: string) => {
      const i = SUPPORT_PRIORITY.indexOf(name);
      return i < 0 ? SUPPORT_PRIORITY.length : i;
    };
    supports.sort((x, y) => rank(x.name) - rank(y.name) || x.gems - y.gems);
    let budget = gemsMax(b);
    b.supports = [];
    for (const s of supports)
      if (s.gems <= budget) {
        b.supports.push(s.id);
        budget -= s.gems;
      }
  }
  return b;
}

/**
 * A run's party with the expected loadouts at each member's level (the sim's `--gear expected` / `--abilities
 * expected`): their gear replaces what they wear (the bag is untouched), and HP / MP are topped up.
 */
export function withExpectedLoadouts(run: RunState, opts: ExpectedOptions): RunState {
  if (!opts.gear && !opts.abilities) return run;
  const next = structuredClone(run);
  next.gear = next.gear.filter((g) => !g.holder);
  for (const m of next.party) {
    m.build = expectedBuild(m.build.key, m.build.level, opts, m.build);
    for (const slot of EQUIP_SLOTS) {
      const id = m.build.equipment[slot];
      if (id != null) next.gear.push({ uid: next.nextUid++, itemId: id, secured: true, holder: { key: m.build.key, slot } });
    }
    const st = deriveStats(m.build);
    m.hp = st.maxHp;
    m.mp = st.maxMp;
  }
  return next;
}
