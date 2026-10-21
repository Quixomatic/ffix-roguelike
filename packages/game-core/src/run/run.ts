/**
 * The run state machine. A run is three worlds of map stages ending in a boss each. All transitions are pure
 * functions over a JSON-serializable `RunState` — the server stores the state, applies player actions with
 * these functions, and verifies battles by replaying their input logs.
 *
 * Permanence: AP (mastered abilities) and FF9's growth pool are kept; levels reset and become Completion Points
 * (meta/profile.ts). Gear found in a run is kept only if the run is won; loadout gear you brought is always kept.
 */
import { baseRelicSlots, findItem, getCharacter, getItem, itemByName, MAX_LEVEL, parseAbilityRef, relicById, setting, sourceOf, synthesis, type AbilityRef, type EquipSlot, type Status } from "@ffix-roguelike/game-data";

import { BATTLE_RULES, createBattle, isThrowable, replayBattle } from "../battle/engine";
import { relicModifiers, synergyModifiers } from "../battle/modifiers";
import type { BattleEvent, BattleState, BattleUnit, InputRecord } from "../battle/types";
import { battleMetrics, mergeBags, record, type MetricBag } from "../metrics/collect";

/** Count something in this run's metrics (`metrics/registry.ts`). */
const track = (run: RunState, key: string, value: number, o?: { subject?: string | number; character?: string }) => record((run.metrics ??= {}), key, value, o);
import { enemyGroup, LASTING_STATUSES, partyUnit } from "../battle/units";
import { encounterEnemies, isSceneRef, killKey, sceneGroup } from "../content/ff9-scenes";
import { getRoute, isRoute, type RouteDef } from "../content/journey-groups";
import { getArea, getJourney, JOURNEYS, WORLDS } from "../content/worlds";
import { Rng } from "../rng";
import {
  accrueGrowth,
  activeSupports,
  apCost,
  canEquip,
  deriveStats,
  EQUIP_SLOTS,
  gearAbilities,
  expForLevel,
  levelForExp,
  slotUnlocked,
  starterGear,
  type CharacterBuild,
} from "../stats";
import { EVENTS, eventAt, eventById, type EventOutcome } from "./events";
import { battleRewards, type BattleNodeKind, pickEncounter, recipesUpTo, sellPrice, shopStock, starterKit, synthShopName, type ShopEntry } from "./loot";
import { generateWorldMap, getNode, type NodeKind, type WorldMap } from "./map";
import { rollOffer, warePrice, type RewardCard, type RewardOffer } from "../rewards/cards";
import { chocoboDigs, chocoboSpots, stiltzkinOffers, type ChocoboSpot, type StiltzkinOffer } from "./specials";

export class RunError extends Error {}

export interface GearInstance {
  uid: number;
  itemId: number;
  /** Starter gear the character brought (true) vs gear found during the run (false). */
  secured: boolean;
  holder: { key: string; slot: EquipSlot } | null;
  /** Reward gear offered for one character: only they can equip it. Unset = anyone who can wear it. */
  boundTo?: string;
}

export interface RunMember {
  build: CharacterBuild;
  hp: number;
  mp: number;
  /** Statuses that outlast a battle in FF9 (Petrify, Venom, Virus, Silence, Blind, Trouble, Zombie). */
  statuses?: Status[];
}

export interface RewardSummary {
  exp: number;
  gil: number;
  ap: number;
  items: number[];
  levelUps: { key: string; from: number; to: number }[];
  mastered: { key: string; ref: AbilityRef }[];
  /** Per-member before/after values for the animated results screen. */
  members: MemberProgress[];
}

export interface MemberProgress {
  key: string;
  alive: boolean;
  levelBefore: number;
  levelAfter: number;
  expBefore: number;
  expAfter: number;
  ap: { ref: AbilityRef; before: number; after: number; cost: number }[];
}

/** The shop's wares: reward cards for sale (`warePrice` each, fixed when the shop is entered), and which are bought. */
export interface ShopWares {
  cards: RewardCard[];
  prices: number[];
  bought: number[];
}

export type RunPhase =
  | { kind: "map" }
  | { kind: "battle"; nodeId: string; nodeKind: BattleNodeKind; enemies: string[]; battle: BattleState }
  /** `offer`: the reward cards (pick one). `gearChoices`: the old pick-a-gear rewards (saved runs from before cards). */
  | { kind: "rewards"; summary: RewardSummary; gearChoices: number[]; boss: boolean; offer?: RewardOffer }
  | { kind: "treasure"; gearChoices: number[]; gil: number; offer?: RewardOffer }
  /**
   * `stock`: the shelf (consumables; gear too in shops entered before wares). `wares`: reward cards for sale, each
   * once (unset in shops entered before wares).
   */
  | { kind: "shop"; name: string; stock: ShopEntry[]; sold: number[]; wares?: ShopWares }
  | { kind: "synth"; name: string; recipes: number[] }
  | { kind: "stiltzkin"; offers: StiltzkinOffer[]; bought: number[] }
  | { kind: "chocobo"; spots: ChocoboSpot[]; digsLeft: number; dug: number[] }
  | { kind: "moogle" }
  | { kind: "event"; eventId: string; result: string | null }
  | { kind: "worldClear"; cleared: number }
  | { kind: "over"; won: boolean };

export interface RunStats {
  battles: number;
  bossKills: string[];
  eaten: number;
  steals: number;
  /** Dragons defeated (Freya's Dragon's Crest). */
  dragonKills?: number;
  tonberryKills?: number;
}

/** One journey of a run's route and the stage (`RunState.stage`) its last map is at. */
export interface RunLeg {
  journey: string;
  last: number;
}

/** The run's maps in order: its route's, or (older runs) its journey's. */
export const runAreas = (run: Pick<RunState, "areas" | "journey">): string[] => run.areas ?? getJourney(run.journey).areas;

/** The run's journeys and where each ends. */
export const runLegs = (run: Pick<RunState, "areas" | "legs" | "journey">): RunLeg[] => run.legs ?? [{ journey: run.journey, last: runAreas(run).length - 1 }];

/** The journey a stage of the run belongs to. */
export const journeyAtStage = (run: Pick<RunState, "areas" | "legs" | "journey">, stage: number): string =>
  runLegs(run).find((l) => stage <= l.last)?.journey ?? run.journey;

/** What the run is called: its grouping's name (while it still exists), else its journey's. */
export const runName = (run: Pick<RunState, "journeyGroup" | "journey">): string =>
  run.journeyGroup && isRoute(run.journeyGroup) ? getRoute(run.journeyGroup).name : getJourney(run.journey).name;

/** A route's journeys and the stage each ends on. */
export function routeLegs(route: RouteDef): RunLeg[] {
  let last = -1;
  return route.journeys.map((journey) => ({ journey, last: (last += getJourney(journey).areas.length) }));
}

export interface RunState {
  version: 1;
  seed: string;
  rng: number;
  tier: number;
  /** The journey the current map belongs to (content/worlds.ts JOURNEYS). */
  journey: string;
  /** Position within the run's maps (`runAreas`): across every journey of a grouping. */
  stage: number;
  /** Journey grouping played (content/journey-groups.ts), when the run plays one; missing for a single journey. */
  journeyGroup?: string;
  /**
   * The run's maps (area ids) end to end, and its journeys with the stage each one ends on: snapshotted at the start,
   * so regrouping journeys never changes a run in progress. Missing (older runs): the journey's own maps.
   */
  areas?: string[];
  legs?: RunLeg[];
  /** Journeys whose final boss this run has beaten, in order. They count as cleared when the run ends, won or lost. */
  cleared?: string[];
  /** Current area index into WORLDS (also the loot tier). */
  world: number;
  map: WorldMap;
  position: string;
  visited: string[];
  party: RunMember[];
  consumables: { itemId: number; count: number }[];
  gear: GearInstance[];
  nextUid: number;
  gil: number;
  phase: RunPhase;
  stats: RunStats;
  /**
   * This run's metrics (`metrics/registry.ts`): its battles' kills, damage, steals… per character, and how it ended —
   * the run's own summary (MVP, run history). The server adds what's new to the player's lifetime metrics.
   */
  metrics?: MetricBag;
  /** Gear the player has unlocked into drop pools (snapshot at run start). */
  unlockedGear: number[];
  /** Gear synthesized this run (item ids): unlocked when the run ends, won or lost. */
  synthesized?: number[];
  /** Reward rerolls left this run (not used yet — .plans/rewards.md §3.9). */
  rewardRerollsLeft?: number;
  /** Boon / item ids banned from reward offers this run (not used yet). */
  rewardBans?: string[];
  /** Wait (time stops while choosing) or Active battles — the player's setting; missing = wait. */
  battleMode?: "wait" | "active";
  /** Relics held, in rack order (`.plans/relics-and-synergies.md`): their effects apply in every battle. */
  relics?: string[];
  /** Rack size for this run (3 + achievements' extra slots, at run start). */
  relicSlots?: number;
  /** Relics the player has unlocked (snapshot at run start): what relic cards can offer. */
  unlockedRelics?: string[];
}

export interface StartRunInput {
  seed: string;
  tier: number;
  /** Party builds as saved at camp. Gear beyond a character's bought gear slots is left at camp. */
  party: CharacterBuild[];
  /** Consumables bought at camp (itemId → count), packed on top of the starter kit. */
  supplies?: Record<number, number>;
  /** Gear unlocked into the drop pool (camp catalog, achievements, won runs). */
  unlockedGear?: number[];
  /**
   * What to play (content/journey-groups.ts): a journey grouping's id, or a journey's (default: the first journey).
   * A journey id plays that journey alone, even if it's in a grouping (tests, the sim's single-journey reads).
   */
  journey?: string;
  /** Wait or Active battles (default wait). */
  battleMode?: "wait" | "active";
  /** The starting relic (must be unlocked and a starter). */
  relic?: string;
  /** Relics the player has unlocked (game-core meta/relics `unlockedRelics`). */
  unlockedRelics?: string[];
  /** Relic rack size (meta/relics `relicSlotCount`; default the `relics.baseSlots` setting). */
  relicSlots?: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────
/** The current area's progression tier (0 early, 1 mid, 2 late) — scales events, treasure gil and specials. */
const tierOf = (run: RunState) => WORLDS[run.world]?.tier ?? 0;

function rngOf(run: RunState) {
  return new Rng(run.rng);
}

function member(run: RunState, key: string): RunMember {
  const m = run.party.find((p) => p.build.key === key);
  if (!m) throw new RunError(`${key} is not in the party`);
  return m;
}

function addConsumable(run: RunState, itemId: number, count = 1) {
  const s = run.consumables.find((c) => c.itemId === itemId);
  if (s) s.count += count;
  else run.consumables.push({ itemId, count });
}

function addLoot(run: RunState, itemId: number) {
  const item = getItem(itemId);
  if (item.effect && item.kind === "item") addConsumable(run, itemId);
  else run.gear.push({ uid: run.nextUid++, itemId, secured: false, holder: null });
}

function syncEquipment(run: RunState) {
  for (const m of run.party) {
    for (const slot of EQUIP_SLOTS) m.build.equipment[slot] = run.gear.find((g) => g.holder?.key === m.build.key && g.holder.slot === slot)?.itemId ?? null;
  }
}

function clampVitals(m: RunMember) {
  const st = deriveStats(m.build);
  m.hp = Math.min(m.hp, st.maxHp);
  m.mp = Math.min(m.mp, st.maxMp);
}

function healParty(run: RunState, percent: number, revive: boolean) {
  for (const m of run.party) {
    const st = deriveStats(m.build);
    if (m.hp <= 0 && !revive) continue;
    m.hp = Math.min(st.maxHp, Math.max(m.hp, 1) + Math.ceil((st.maxHp * percent) / 100));
    m.mp = Math.min(st.maxMp, m.mp + Math.ceil((st.maxMp * percent) / 100));
    // A full rest (Moogle) cures lasting statuses, like an FF9 inn or tent.
    if (revive) m.statuses = [];
  }
}

const partyKeys = (run: RunState) => run.party.map((m) => m.build.key);

// ── lifecycle ────────────────────────────────────────────────────────────────
/** Switch Wait/Active battles for the rest of the run (from the next battle; a fight in progress keeps its mode). */
export function setRunBattleMode(run: RunState, mode: "wait" | "active"): RunState {
  return { ...run, battleMode: mode };
}

export function startRun(input: StartRunInput): RunState {
  if (!input.party.length || input.party.length > 4) throw new RunError("Pick 1–4 party members");
  const rng = Rng.fromSeed(input.seed);
  const gear: GearInstance[] = [];
  let uid = 1;
  const party = input.party.map((b) => {
    const build = structuredClone(b);
    // Every run starts at the character's start level (up to today's cap: a lowered cap counts less, the bought level
    // is kept on the profile), with exactly that level's EXP.
    build.level = Math.max(1, Math.min(setting("startLevel.max"), build.level));
    build.exp = expForLevel(build.level);
    build.equipment = starterGear(build);
    for (const slot of EQUIP_SLOTS) {
      const id = build.equipment[slot];
      if (id != null) gear.push({ uid: uid++, itemId: id, secured: true, holder: { key: build.key, slot } });
    }
    const st = deriveStats(build);
    return { build, hp: st.maxHp, mp: st.maxMp };
  });
  const route = getRoute(input.journey ?? JOURNEYS[0]!.id);
  const legs = routeLegs(route);
  const firstArea = getArea(route.areas[0]!).index;
  const map = generateWorldMap(rng.fork("map0"), firstArea);
  const unlockedRelics = [...(input.unlockedRelics ?? [])];
  if (input.relic && (!unlockedRelics.includes(input.relic) || !relicById(input.relic)?.starter)) throw new RunError("That relic can't start a run");
  const run: RunState = {
    version: 1,
    seed: input.seed,
    rng: rng.state,
    tier: input.tier,
    journey: legs[0]!.journey,
    stage: 0,
    // The route played, when it's more than one journey on its own (a grouping or a challenge), so its clear is recorded.
    ...(route.grouped || route.id !== legs[0]!.journey ? { journeyGroup: route.id } : {}),
    areas: route.areas,
    legs,
    cleared: [],
    world: firstArea,
    map,
    position: map.startId,
    visited: [map.startId],
    party,
    consumables: withSupplies(starterKit(), input.supplies ?? {}),
    gear,
    nextUid: uid,
    gil: setting("run.startingGil"),
    phase: { kind: "map" },
    stats: { battles: 0, bossKills: [], eaten: 0, steals: 0 },
    unlockedGear: [...(input.unlockedGear ?? [])],
    battleMode: input.battleMode ?? "wait",
    relics: input.relic ? [input.relic] : [],
    relicSlots: Math.max(1, input.relicSlots ?? baseRelicSlots()),
    unlockedRelics,
  };
  if (input.relic) track(run, "relics.taken", 1, { subject: input.relic });
  return run;
}

function withSupplies(kit: { itemId: number; count: number }[], supplies: Record<number, number>) {
  const out = kit.map((k) => ({ ...k }));
  for (const [id, n] of Object.entries(supplies)) {
    if (n <= 0) continue;
    const have = out.find((k) => k.itemId === Number(id));
    if (have) have.count += n;
    else out.push({ itemId: Number(id), count: n });
  }
  return out;
}

export function isOver(run: RunState) {
  return run.phase.kind === "over";
}

export function abandonRun(run: RunState): RunState {
  const next = structuredClone(run);
  next.phase = { kind: "over", won: false };
  return next;
}

// ── map movement ─────────────────────────────────────────────────────────────
export function moveTo(run: RunState, nodeId: string): RunState {
  if (run.phase.kind !== "map") throw new RunError("Finish the current stage first");
  const here = getNode(run.map, run.position);
  if (!here.next.includes(nodeId)) throw new RunError("You can't reach that stage from here");
  const next = structuredClone(run);
  const node = getNode(next.map, nodeId);
  const rng = rngOf(next).fork(`node:${nodeId}`);
  next.position = nodeId;
  next.visited.push(nodeId);
  track(next, "stages.entered", 1, { subject: node.kind });
  enterNode(next, node.kind, node.depth, nodeId, rng);
  next.rng = rngOf(next).fork(`after:${nodeId}`).state;
  return next;
}

function enterNode(run: RunState, kind: NodeKind, depth: number, nodeId: string, rng: Rng) {
  switch (kind) {
    case "battle":
    case "elite":
    case "semiboss":
    case "boss":
      return startBattle(run, nodeId, kind, pickEncounter(rng, run.world, depth, kind, run.party.length), rng);
    case "treasure": {
      const [lo, hi] = setting("run.treasureGil");
      run.phase = { kind: "treasure", gearChoices: [], gil: rng.int(lo ?? 80, hi ?? lo ?? 160) * (tierOf(run) + 1), offer: rollOffer(run, "treasure", rng) };
      return;
    }
    case "shop": {
      // The shelf: the area's consumables (unlimited). The rest of the counter is six wares: reward cards for one
      // member each, bought rather than picked (`buyWare`).
      const visit = shopStock(rng, run.world, partyKeys(run));
      const offer = rollOffer(run, "shop", rng);
      run.phase = {
        kind: "shop",
        name: visit.name,
        stock: visit.stock.filter((e) => isConsumable(e.itemId)),
        sold: [],
        wares: { cards: offer.cards, prices: offer.cards.map((c) => warePrice(c, run.tier)), bought: [] },
      };
      return;
    }
    case "synth":
      run.phase = { kind: "synth", name: synthShopName(run.world), recipes: recipesUpTo(WORLDS[run.world]!.synthTier).map((r) => r.id) };
      return;
    case "stiltzkin":
      run.phase = { kind: "stiltzkin", offers: stiltzkinOffers(rng, run.world, partyKeys(run), run.unlockedGear), bought: [] };
      return;
    case "chocobo":
      run.phase = { kind: "chocobo", spots: chocoboSpots(rng, run.world, partyKeys(run), run.unlockedGear), digsLeft: chocoboDigs(), dug: [] };
      return;
    case "moogle":
      healParty(run, 100, true);
      run.phase = { kind: "moogle" };
      return;
    case "event": {
      const pool = EVENTS.filter((e) => eventAt(e, tierOf(run)));
      run.phase = { kind: "event", eventId: rng.pick(pool).id, result: null };
      return;
    }
    case "start":
      run.phase = { kind: "map" };
  }
}

/**
 * Battle units for an encounter. An FF9 scene token ("@EF_R004#2") becomes that scene's group: every spawn tagged
 * with its FF9 type and spawn slot (the scene's AI script addresses monsters by slot), untargetable pieces
 * included. `scene` is the token createBattle needs to run the scene's script.
 */
export function encounterUnits(group: string[], tier: number): { units: BattleUnit[]; scene?: string } {
  const ids: string[] = [];
  const tags: (Partial<BattleUnit> | null)[] = [];
  let scene: string | undefined;
  for (const t of group) {
    if (!isSceneRef(t)) {
      ids.push(t);
      tags.push(null);
      continue;
    }
    scene ??= t.split("!")[0];
    for (const s of sceneGroup(t).spawns) {
      ids.push(s.id);
      tags.push({ ff9Type: s.type, ff9Slot: s.slot, ...(s.targetable ? {} : { untargetable: true }) });
    }
  }
  const units = enemyGroup(ids, tier).map((u, i) => (tags[i] ? Object.assign(u, tags[i]) : u));
  return { units, scene };
}

function startBattle(run: RunState, nodeId: string, nodeKind: BattleNodeKind, enemies: string[], rng: Rng) {
  const living = run.party.map((m, i) => partyUnit(m.build, i, { hp: m.hp, mp: m.mp, statuses: m.statuses }));
  const encounter = encounterUnits(enemies, run.tier);
  const battle = createBattle({
    seed: rng.int(1, 2 ** 31 - 1),
    party: living,
    enemies: encounter.units,
    ...(encounter.scene ? { scene: encounter.scene } : {}),
    inventory: [...run.consumables.filter((c) => c.count > 0), ...throwables(run)],
    mode: run.battleMode ?? "wait",
    canFlee: nodeKind === "battle",
    noSurprise: nodeKind !== "battle",
    bossFight: nodeKind === "boss" || nodeKind === "semiboss",
    // The run's relics and its party's synergies (the whole run party is the active party: at most four).
    modifiers: [...relicModifiers(run.relics ?? []), ...synergyModifiers(run.party.map((m) => m.build.key))],
    meta: { gil: run.gil, thefts: run.stats.steals, dragonKills: run.stats.dragonKills ?? 0, tonberryKills: run.stats.tonberryKills ?? 0 },
  });
  run.phase = { kind: "battle", nodeId, nodeKind, enemies, battle };
}

/** Spare weapons Amarant can Throw (unequipped gear), as battle inventory. */
function throwables(run: RunState): { itemId: number; count: number }[] {
  if (!run.party.some((m) => getCharacter(m.build.key).commands.some((c) => c.id === 15))) return [];
  const counts = new Map<number, number>();
  for (const g of run.gear) if (!g.holder && isThrowable(g.itemId)) counts.set(g.itemId, (counts.get(g.itemId) ?? 0) + 1);
  return [...counts].map(([itemId, count]) => ({ itemId, count }));
}

// ── battles ──────────────────────────────────────────────────────────────────
/** Verify a finished battle by replaying its inputs, then apply the result. */
export function finishBattle(run: RunState, inputs: InputRecord[]): RunState {
  if (run.phase.kind !== "battle") throw new RunError("Not in a battle");
  const phase = run.phase;
  let final: BattleState;
  const events: BattleEvent[] = [];
  try {
    final = replayBattle(phase.battle, inputs, undefined, (e) => events.push(...e));
  } catch (e) {
    throw new RunError(`Battle log rejected: ${(e as Error).message}`);
  }
  if (!final.outcome) throw new RunError("Battle isn't finished");
  const next = structuredClone(run);
  // The verified replay's metrics join the run's (kills, damage, steals… per character).
  next.metrics = mergeBags(next.metrics ?? {}, battleMetrics(phase.battle, events, final, phase.nodeKind));
  next.stats.steals += final.stolen.length;
  next.stats.eaten += final.learned.length;
  // Carry HP/MP and consumables out of the fight.
  for (const u of final.units.filter((x) => x.side === "party")) {
    const m = next.party.find((p) => p.build.key === u.key)!;
    m.hp = u.statuses.petrify ? 0 : u.hp;
    m.mp = u.mp;
    m.statuses = m.hp > 0 ? LASTING_STATUSES.filter((s) => u.statuses[s] && s !== "petrify") : [];
  }
  // Thrown weapons are gone; the rest of the battle inventory is consumables.
  const thrownStock = new Map(throwables(run).map((t) => [t.itemId, t.count]));
  for (const [itemId, had] of thrownStock) {
    let thrown = had - (final.inventory.find((c) => c.itemId === itemId)?.count ?? 0);
    next.gear = next.gear.filter((g) => !(thrown > 0 && !g.holder && g.itemId === itemId && thrown-- > 0));
  }
  next.consumables = final.inventory.filter((c) => c.count > 0 && !thrownStock.has(c.itemId));
  next.gil = Math.max(0, next.gil - (final.gilSpent ?? 0));
  if (final.outcome === "victory") next.stats.dragonKills = (next.stats.dragonKills ?? 0) + final.units.filter((u) => u.side === "enemy" && (u.enemyCategory & 8) !== 0).length;

  if (final.outcome === "defeat") {
    next.phase = { kind: "over", won: false };
    return next;
  }
  if (final.outcome === "fled") {
    // Flee-Gil: running away by luck still pays a tenth of the enemies' gil.
    if (final.fledByLuck && next.party.some((m) => activeSupports(m.build).has(46))) {
      next.gil += Math.floor(battleRewards(rngOf(next).fork("fleegil"), phase.enemies, next.tier).gil / 10);
    }
    next.phase = { kind: "map" };
    return next;
  }
  next.stats.battles++; // victories only — drives "win N battles" unlocks

  const rng = rngOf(next).fork(`rewards:${phase.nodeId}:${next.stats.battles}`);
  const rewards = battleRewards(rng, phase.enemies, next.tier, final);
  const summary = applyRewards(next, rewards, final);
  const boss = phase.nodeKind === "boss";
  if (boss) next.stats.bossKills.push(...encounterEnemies(phase.enemies).map(killKey));
  // Reward cards: elites, the semi-boss and bosses always; a plain battle now and then (a surprise).
  const source = phase.nodeKind === "battle" ? (rng.chance(sourceOf("surprise").chance ?? 0) ? "surprise" : null) : phase.nodeKind;
  const offer = source ? rollOffer(next, source, rng) : undefined;
  next.phase = { kind: "rewards", summary, gearChoices: [], boss, offer };
  next.rng = rng.state;
  return next;
}

function applyRewards(run: RunState, r: { exp: number; ap: number; gil: number; items: number[] }, final: BattleState): RewardSummary {
  const alive = run.party.filter((m) => m.hp > 0);
  // Virus / Zombie: no EXP or AP (FF9 DisableRewards).
  const blocked = (m: RunMember) => (m.statuses ?? []).some((s) => s === "virus" || s === "zombie");
  const summary: RewardSummary = { exp: r.exp, gil: r.gil, ap: r.ap, items: r.items, levelUps: [], mastered: [], members: [] };
  const supportsOf = (m: RunMember) => activeSupports(m.build);
  const gilMult = Math.max(1, ...run.party.map((m) => (supportsOf(m).has(45) ? 1.5 : 1)));
  run.gil += Math.round(r.gil * gilMult);
  summary.gil = Math.round(r.gil * gilMult);
  for (const id of r.items) addLoot(run, id);

  for (const m of run.party) {
    if (m.hp <= 0) summary.members.push({ key: m.build.key, alive: false, levelBefore: m.build.level, levelAfter: m.build.level, expBefore: m.build.exp, expAfter: m.build.exp, ap: [] });
  }
  for (const m of alive) {
    if (blocked(m)) {
      summary.members.push({ key: m.build.key, alive: true, levelBefore: m.build.level, levelAfter: m.build.level, expBefore: m.build.exp, expAfter: m.build.exp, ap: [] });
      continue;
    }
    const sup = supportsOf(m);
    const share = Math.floor((r.exp / Math.max(1, alive.length)) * (sup.has(43) ? 1.5 : 1));
    const before = m.build.level;
    const expBefore = m.build.exp;
    const oldMax = deriveStats(m.build);
    const member: MemberProgress = { key: m.build.key, alive: true, levelBefore: before, levelAfter: before, expBefore, expAfter: expBefore, ap: [] };
    summary.members.push(member);
    m.build.exp += share;
    m.build.level = levelForExp(m.build.exp);
    if (m.build.level > before) {
      accrueGrowth(m.build, before);
      const st = deriveStats(m.build);
      m.hp += st.maxHp - oldMax.maxHp;
      m.mp += st.maxMp - oldMax.maxMp;
      summary.levelUps.push({ key: m.build.key, from: before, to: m.build.level });
    }
    const character = getCharacter(m.build.key);
    const apGain = r.ap * (sup.has(44) ? 2 : 1);
    for (const ref of gearAbilities(m.build)) {
      const cost = apCost(character, ref);
      const had = m.build.ap[ref] ?? 0;
      if (had >= cost) continue;
      m.build.ap[ref] = Math.min(cost, had + apGain);
      member.ap.push({ ref, before: had, after: m.build.ap[ref]!, cost });
      if (m.build.ap[ref]! >= cost) summary.mastered.push({ key: m.build.key, ref });
    }
    member.levelAfter = m.build.level;
    member.expAfter = m.build.exp;
    clampVitals(m);
  }

  // Blue Magic learned by eating.
  for (const l of final.learned) {
    const unit = final.units.find((u) => u.id === l.unitId);
    if (!unit) continue;
    const m = run.party.find((p) => p.build.key === unit.key);
    if (!m) continue;
    const ref = `AA:${l.actionId}` as AbilityRef;
    const cost = apCost(getCharacter(m.build.key), ref);
    if (cost > 0 && (m.build.ap[ref] ?? 0) < cost) {
      m.build.ap[ref] = cost;
      summary.mastered.push({ key: m.build.key, ref });
    }
  }
  return summary;
}

/**
 * Take one of the offered cards / gear pieces (or null to skip) and continue. A relic card when the rack is full needs
 * `replace`: the held relic it takes the place of.
 */
export function claimReward(run: RunState, choice: number | null, replace?: string): RunState {
  const p = run.phase;
  if (p.kind !== "rewards" && p.kind !== "treasure") throw new RunError("No reward to claim");
  let next = structuredClone(run);
  if (p.offer) {
    // Reward cards: take one (it applies at once), or skip for a little gil.
    if (choice == null) {
      next.gil += p.offer.cards.length ? p.offer.skipGil : 0;
      track(next, "rewards.skipped", 1);
    } else {
      const card = p.offer.cards[choice];
      if (!card) throw new RunError("Invalid choice");
      track(next, "rewards.taken", 1, { subject: card.kind });
      next = applyCard(next, card, replace);
    }
  } else if (choice != null) {
    const itemId = p.gearChoices[choice];
    if (itemId == null) throw new RunError("Invalid choice");
    addLoot(next, itemId);
  }
  if (p.kind === "treasure") next.gil += p.gil;
  if (p.kind === "rewards" && p.boss) {
    // A journey's final boss clears it (counted when the run ends, won or lost). The run's last map's boss wins the
    // run; otherwise travel on to the next map, in this journey or the next journey of the grouping.
    const leg = runLegs(next).find((l) => l.last === next.stage);
    if (leg && !(next.cleared ?? []).includes(leg.journey)) next.cleared = [...(next.cleared ?? []), leg.journey];
    if (next.stage >= runAreas(next).length - 1) next.phase = { kind: "over", won: true };
    else next.phase = { kind: "worldClear", cleared: next.world };
  } else next.phase = { kind: "map" };
  return next;
}

/** Level-ups outside battle (level boons): FF9's growth pool and HP / MP rise as from EXP. */
function gainLevels(m: RunMember, levels: number) {
  if (levels <= 0) return;
  const before = m.build.level;
  const target = Math.min(MAX_LEVEL, before + levels);
  if (target <= before) return;
  const oldMax = deriveStats(m.build);
  m.build.exp = Math.max(m.build.exp, expForLevel(target));
  m.build.level = levelForExp(m.build.exp);
  accrueGrowth(m.build, before);
  const st = deriveStats(m.build);
  if (m.hp > 0) m.hp += st.maxHp - oldMax.maxHp;
  m.mp += st.maxMp - oldMax.maxMp;
  clampVitals(m);
}

/**
 * Apply a reward card. Gear goes on the member it was for (bound to them; what it replaces goes to the bag), boons
 * stack on the member (or everyone), AP goes to the ability, supplies and gil to the bag.
 */
export function applyCard(run: RunState, card: RewardCard, replace?: string): RunState {
  let next = structuredClone(run);
  switch (card.kind) {
    case "relic": {
      // Into a free slot, or in place of the held relic the player gave up for it (swap only: no selling).
      const rack = (next.relics ??= []);
      if (rack.includes(card.relicId)) throw new RunError("You already have that relic");
      if (rack.length < (next.relicSlots ?? baseRelicSlots())) rack.push(card.relicId);
      else {
        const at = replace ? rack.indexOf(replace) : -1;
        if (at < 0) throw new RunError("Your relics are full: choose one to give up");
        rack[at] = card.relicId;
      }
      track(next, "relics.taken", 1, { subject: card.relicId });
      return next;
    }
    case "gear": {
      const uid = next.nextUid++;
      next.gear.push({ uid, itemId: card.itemId, secured: false, holder: null, boundTo: card.key });
      // Equip it straight away when the slot is open (it always is when offered).
      if (slotUnlocked(member(next, card.key).build, card.slot)) next = equip(next, card.key, card.slot, uid);
      return next;
    }
    case "boon": {
      const targets = card.key ? [member(next, card.key)] : next.party;
      for (const m of targets) {
        const oldMax = deriveStats(m.build);
        (m.build.boons ??= []).push({ boonId: card.boonId, name: card.name, stat: card.stat, amount: card.amount, rarity: card.rarity });
        if (card.stat === "levels") gainLevels(m, card.amount);
        else {
          // Max HP / MP boons raise the current values too.
          const st = deriveStats(m.build);
          if (m.hp > 0) m.hp += Math.max(0, st.maxHp - oldMax.maxHp);
          m.mp += Math.max(0, st.maxMp - oldMax.maxMp);
          clampVitals(m);
        }
      }
      return next;
    }
    case "ap": {
      const m = member(next, card.key);
      const cost = apCost(getCharacter(card.key), card.ref);
      m.build.ap[card.ref] = Math.min(cost, (m.build.ap[card.ref] ?? 0) + card.amount);
      return next;
    }
    case "supplies":
      addConsumable(next, card.itemId, card.count);
      return next;
    case "gil":
      next.gil += card.amount;
      return next;
  }
}

/** After a world's boss: travel to the next world (full heal). */
export function nextWorld(run: RunState): RunState {
  if (run.phase.kind !== "worldClear") throw new RunError("The world isn't cleared yet");
  const next = structuredClone(run);
  next.stage++;
  next.journey = journeyAtStage(next, next.stage);
  next.world = getArea(runAreas(next)[next.stage]!).index;
  next.map = generateWorldMap(rngOf(next).fork(`map${next.stage}`), next.world);
  next.position = next.map.startId;
  next.visited = [next.map.startId];
  healParty(next, 100, true);
  next.phase = { kind: "map" };
  return next;
}

// ── shops, events, moogles ───────────────────────────────────────────────────
/** A consumable (it has a use effect): what a shop's shelf sells, without limit. */
const isConsumable = (itemId: number) => !!(findItem(itemId)?.effect && findItem(itemId)?.kind === "item");

export function buy(run: RunState, index: number): RunState {
  if (run.phase.kind !== "shop") throw new RunError("Not in a shop");
  const entry = run.phase.stock[index];
  if (!entry) throw new RunError("No such item");
  const isGearEntry = !isConsumable(entry.itemId);
  if (isGearEntry && run.phase.sold.includes(index)) throw new RunError("Sold out");
  if (run.gil < entry.price) throw new RunError("Not enough gil");
  const next = structuredClone(run);
  next.gil -= entry.price;
  track(next, "shop.purchases", 1);
  track(next, "shop.gil_spent", entry.price);
  addLoot(next, entry.itemId);
  if (isGearEntry && next.phase.kind === "shop") next.phase.sold.push(index);
  return next;
}

/**
 * Buy one of the shop's wares: pay its price and apply the card as if taken from a reward (gear is equipped on and
 * bound to its member, boons and AP surges land at once, a relic goes on the rack, `replace` naming the relic to give
 * up when the rack is full). Each ware sells once; buy as many as the gil allows.
 */
export function buyWare(run: RunState, index: number, replace?: string): RunState {
  if (run.phase.kind !== "shop" || !run.phase.wares) throw new RunError("Not in a shop");
  const wares = run.phase.wares;
  const card = wares.cards[index];
  const price = wares.prices[index];
  if (!card || price == null) throw new RunError("No such ware");
  if (wares.bought.includes(index)) throw new RunError("Sold out");
  if (run.gil < price) throw new RunError("Not enough gil");
  let next = structuredClone(run);
  next.gil -= price;
  track(next, "shop.purchases", 1);
  track(next, "shop.gil_spent", price);
  track(next, "rewards.taken", 1, { subject: card.kind });
  next = applyCard(next, card, replace);
  if (next.phase.kind === "shop" && next.phase.wares) next.phase.wares.bought.push(index);
  return next;
}

/**
 * Synthesize at a synthesis shop: pay gil and consume the ingredients (unequipped gear or consumables). The
 * result is kept after a loss only if every gear ingredient was your own loadout gear.
 */
export function synthesize(run: RunState, recipeId: number): RunState {
  if (run.phase.kind !== "synth") throw new RunError("Not at a synthesis shop");
  if (!run.phase.recipes.includes(recipeId)) throw new RunError("That recipe isn't sold here");
  const recipe = synthesis.find((r) => r.id === recipeId)!;
  if (run.gil < recipe.price) throw new RunError("Not enough gil");
  const next = structuredClone(run);
  let secured = true;
  for (const id of recipe.ingredients) {
    const stock = next.consumables.find((c) => c.itemId === id && c.count > 0);
    if (stock) {
      stock.count--;
      continue;
    }
    // Prefer pieces found this run over your own loadout gear.
    const inst = next.gear.filter((g) => g.itemId === id && !g.holder).sort((a, b) => Number(a.secured) - Number(b.secured))[0];
    if (!inst) throw new RunError(`Missing ${getItem(id).name} (unequip it first if it's being worn)`);
    secured &&= inst.secured;
    next.gear = next.gear.filter((g) => g !== inst);
  }
  next.consumables = next.consumables.filter((c) => c.count > 0);
  next.gil -= recipe.price;
  track(next, "gear.synthesized", 1, { subject: recipe.result });
  track(next, "shop.gil_spent", recipe.price);
  addLoot(next, recipe.result);
  const made = next.gear.at(-1);
  if (made && made.itemId === recipe.result) made.secured = secured;
  // Synthesizing is hard enough to earn the unlock by itself: it's kept whether the run is won or lost.
  if (!getItem(recipe.result).effect) next.synthesized = [...new Set([...(next.synthesized ?? []), recipe.result])];
  return next;
}

/** Sell an unequipped piece of gear for half its price (shops, synthesis shops and Moogles). */
export function sell(run: RunState, uid: number): RunState {
  if (!["shop", "synth", "moogle"].includes(run.phase.kind)) throw new RunError("Nobody here to sell to");
  const inst = run.gear.find((g) => g.uid === uid);
  if (!inst) throw new RunError("You don't have that");
  if (inst.holder) throw new RunError("Unequip it first");
  const next = structuredClone(run);
  next.gear = next.gear.filter((g) => g.uid !== uid);
  next.gil += sellPrice(inst.itemId);
  track(next, "gear.sold", 1);
  track(next, "gear.sell_gil", sellPrice(inst.itemId));
  return next;
}

/** Buy one of Stiltzkin's deals (each once). */
export function buyOffer(run: RunState, index: number): RunState {
  if (run.phase.kind !== "stiltzkin") throw new RunError("Stiltzkin isn't here");
  const offer = run.phase.offers[index];
  if (!offer) throw new RunError("No such deal");
  if (run.phase.bought.includes(index)) throw new RunError("Already bought, kupo!");
  if (run.gil < offer.price) throw new RunError("Not enough gil");
  const next = structuredClone(run);
  next.gil -= offer.price;
  track(next, "shop.purchases", 1);
  track(next, "shop.gil_spent", offer.price);
  for (const id of offer.items) addLoot(next, id);
  if (next.phase.kind === "stiltzkin") next.phase.bought.push(index);
  return next;
}

/** Chocobo Hot & Cold: dig one of the spots. */
export function dig(run: RunState, index: number): RunState {
  if (run.phase.kind !== "chocobo") throw new RunError("No chocobo here");
  const spot = run.phase.spots[index];
  if (!spot) throw new RunError("No such spot");
  if (run.phase.digsLeft <= 0) throw new RunError("Choco is tired — no digs left");
  if (run.phase.dug.includes(index)) throw new RunError("Already dug there");
  const next = structuredClone(run);
  if (next.phase.kind !== "chocobo") return next;
  next.phase.digsLeft--;
  next.phase.dug.push(index);
  track(next, "chocobo.digs", 1);
  if (spot.type === "gil") next.gil += spot.amount;
  if (spot.type === "item") addLoot(next, spot.itemId);
  return next;
}

/** Leave a shop / moogle / finished event / special stage and return to the map. */
export function leave(run: RunState): RunState {
  const k = run.phase.kind;
  if (k === "event" && run.phase.kind === "event" && !run.phase.result) throw new RunError("Make a choice first");
  if (!["shop", "synth", "moogle", "event", "stiltzkin", "chocobo"].includes(k)) throw new RunError("Nothing to leave");
  const next = structuredClone(run);
  next.phase = { kind: "map" };
  return next;
}

export function chooseEvent(run: RunState, index: number): RunState {
  if (run.phase.kind !== "event" || run.phase.result) throw new RunError("No event choice pending");
  const def = eventById(run.phase.eventId);
  const choice = def.choices[index];
  if (!choice) throw new RunError("Invalid choice");
  if (choice.cost && run.gil < choice.cost) throw new RunError("Not enough gil");
  const next = structuredClone(run);
  const rng = rngOf(next).fork(`event:${next.position}:${index}`);
  next.gil -= choice.cost ?? 0;
  track(next, "events.chosen", 1, { subject: def.id });
  const rolled = rng.weighted(choice.outcomes.map((o) => ({ weight: o.weight, value: o })));
  next.phase = { kind: "event", eventId: def.id, result: rolled.text };
  applyOutcome(next, rolled.outcome, rng);
  next.rng = rng.state;
  return next;
}

function applyOutcome(run: RunState, o: EventOutcome, rng: Rng) {
  switch (o.type) {
    case "gil":
      run.gil += o.amount * (tierOf(run) + 1);
      return;
    case "heal":
      healParty(run, o.percent, false);
      return;
    case "damage":
      for (const m of run.party) if (m.hp > 0) m.hp = Math.max(1, m.hp - Math.ceil((deriveStats(m.build).maxHp * o.percent) / 100));
      return;
    case "item":
      for (let i = 0; i < o.count; i++) addLoot(run, findItemByName(o.name));
      return;
    case "gear":
      run.phase = { kind: "treasure", gearChoices: [], gil: 0, offer: rollOffer(run, "treasure", rng) };
      return;
    case "exp": {
      const alive = run.party.filter((m) => m.hp > 0);
      applyRewards(run, { exp: o.amount * (tierOf(run) + 1) * alive.length, ap: 0, gil: 0, items: [] }, emptyBattle());
      return;
    }
    case "battle":
      startBattle(run, run.position, "battle", o.enemies, rng);
      if (run.phase.kind === "battle") run.phase.battle.canFlee = false;
      return;
    case "nothing":
      return;
  }
}

const findItemByName = (name: string) => itemByName(name).id;

function emptyBattle(): BattleState {
  return createBattle({ seed: 1, party: [], enemies: [], inventory: [] });
}

// ── party management (allowed on the map) ────────────────────────────────────
function assertCanManage(run: RunState) {
  if (!["map", "moogle", "shop", "synth", "stiltzkin", "chocobo", "rewards", "treasure", "worldClear"].includes(run.phase.kind)) throw new RunError("Can't change gear right now");
}

/** Whether `key` may wear this gear instance in `slot`: they can equip the item, and it isn't bound to someone else. */
export function canWearInstance(key: string, inst: GearInstance, slot: EquipSlot): boolean {
  return (!inst.boundTo || inst.boundTo === key) && canEquip(key, getItem(inst.itemId), slot);
}

/** Equip a gear instance (or clear the slot with uid = null). */
export function equip(run: RunState, key: string, slot: EquipSlot, uid: number | null): RunState {
  assertCanManage(run);
  if (!slotUnlocked(member(run, key).build, slot)) throw new RunError(`${getCharacter(key).name}'s ${slot} slot is locked — unlock it with Completion Points`);
  const next = structuredClone(run);
  const m = member(next, key);
  const current = next.gear.find((g) => g.holder?.key === key && g.holder.slot === slot);
  if (uid == null) {
    if (slot === "weapon") throw new RunError("A weapon is required");
    if (current) current.holder = null;
  } else {
    const inst = next.gear.find((g) => g.uid === uid);
    if (!inst) throw new RunError("You don't have that");
    if (!canEquip(key, getItem(inst.itemId), slot)) throw new RunError(`${getCharacter(key).name} can't equip that there`);
    if (inst.boundTo && inst.boundTo !== key) throw new RunError(`That was found for ${getCharacter(inst.boundTo).name}`);
    if (inst.holder && inst.holder.key !== key) {
      // Swap: the other character gets this character's current piece if they can wear it, else empties.
      const other = inst.holder;
      if (current && canWearInstance(other.key, current, other.slot)) current.holder = { ...other };
      else if (current) current.holder = null;
    } else if (current) current.holder = null;
    inst.holder = { key, slot };
  }
  syncEquipment(next);
  // Supports that no longer fit are switched off.
  m.build.supports = m.build.supports.filter((id) => activeSupports(m.build).has(id));
  clampVitals(m);
  return next;
}

export function setSupports(run: RunState, key: string, supports: number[]): RunState {
  assertCanManage(run);
  const next = structuredClone(run);
  const m = member(next, key);
  const candidate = { ...m.build, supports: [...new Set(supports)] };
  const active = activeSupports(candidate);
  if (active.size !== candidate.supports.length) throw new RunError("Not enough magic stones, or ability not available");
  m.build.supports = candidate.supports;
  clampVitals(m);
  return next;
}

/** Use a consumable outside battle (Potion, Ether, Phoenix Down, Elixir, Tent, Remedy…). */
export function useConsumable(run: RunState, itemId: number, key: string): RunState {
  assertCanManage(run);
  const stock = run.consumables.find((c) => c.itemId === itemId && c.count > 0);
  const fx = findItem(itemId)?.effect;
  if (!stock || !fx) throw new RunError("You don't have that");
  const next = structuredClone(run);
  const m = member(next, key);
  track(next, "items.used_field", 1, { subject: itemId, character: key });
  const st = deriveStats(m.build);
  const dead = m.hp <= 0;
  switch (fx.scriptId) {
    case 69:
      if (dead) throw new RunError("They're knocked out");
      m.hp = Math.min(st.maxHp, m.hp + fx.power * 10);
      break;
    case 70:
      if (dead) throw new RunError("They're knocked out");
      m.mp = Math.min(st.maxMp, m.mp + fx.power * 10);
      break;
    case 71:
      if (dead) throw new RunError("They're knocked out");
      m.hp = st.maxHp;
      m.mp = st.maxMp;
      break;
    case 72:
      if (!dead) throw new RunError("They're not knocked out");
      m.hp = Math.max(1, Math.floor(st.maxHp / 10));
      break;
    case 76:
      if (dead) throw new RunError("They're knocked out");
      m.hp = Math.min(st.maxHp, m.hp + Math.ceil(st.maxHp / 2));
      m.mp = Math.min(st.maxMp, m.mp + Math.ceil(st.maxMp / 2));
      break;
    default:
      throw new RunError("That can only be used in battle");
  }
  next.consumables.find((c) => c.itemId === itemId)!.count--;
  next.consumables = next.consumables.filter((c) => c.count > 0);
  return next;
}

// ── end of run ───────────────────────────────────────────────────────────────
export interface RunOutcome {
  won: boolean;
  builds: CharacterBuild[];
  /** Gear found this run (item ids, unique). Unlocked into future drop pools if the run was won. */
  foundGear: number[];
  /** Gear synthesized this run: unlocked whether the run was won or lost. */
  synthesized?: number[];
  gilEarned: number;
  stats: RunStats;
  worldReached: number;
  /** The journey the run ended in. */
  journey: string;
  /** The journey grouping played, if any (a won run records it in `groupsCleared`). */
  journeyGroup?: string;
  /** Journeys whose final boss the run beat, won or lost: each counts as cleared. */
  cleared: string[];
}

/** What the player keeps when the run ends. */
export function runOutcome(run: RunState): RunOutcome {
  if (run.phase.kind !== "over") throw new RunError("The run isn't over");
  const won = run.phase.won;
  const builds = run.party.map((m) => {
    const b = structuredClone(m.build);
    // Equipment isn't carried between runs — every run starts with starter gear in unlocked slots. Boons are this run's only.
    b.equipment = starterGear(b);
    delete b.boons;
    b.supports = b.supports.filter((id) => activeSupports(b).has(id));
    return b;
  });
  return {
    won,
    builds,
    foundGear: [...new Set(run.gear.filter((g) => !g.secured).map((g) => g.itemId))],
    synthesized: run.synthesized ?? [],
    gilEarned: won ? run.gil : Math.floor(run.gil * setting("run.lossGilKept")),
    stats: run.stats,
    worldReached: WORLDS[run.world]?.tier ?? 0,
    journey: run.journey,
    ...(run.journeyGroup ? { journeyGroup: run.journeyGroup } : {}),
    // A won run has cleared the journey it ended in (runs from before groupings record only that).
    cleared: [...new Set([...(run.cleared ?? []), ...(won ? [run.journey] : [])])],
  };
}

/** Ability refs on a character's learn list that are active (for menus). */
export function learnedActive(build: CharacterBuild): AbilityRef[] {
  return getCharacter(build.key).abilities.map((a) => a.ref).filter((ref) => parseAbilityRef(ref).kind === "active");
}

/** Bring a stored RunState from an older version up to date (fields added since it was saved). */
export function upgradeRunState(run: RunState): RunState {
  // A fight saved under older battle rules can't be replayed exactly by this engine: start that fight over.
  if (run.phase.kind === "battle" && run.phase.battle.rules !== BATTLE_RULES) {
    const next = structuredClone(run);
    const p = next.phase as Extract<RunState["phase"], { kind: "battle" }>;
    const rng = rngOf(next).fork(`upgrade:${p.nodeId}`);
    startBattle(next, p.nodeId, p.nodeKind, p.enemies, rng);
    next.rng = rng.state;
    return upgradeRunState(next);
  }
  // A run with its route snapshotted (journey groupings) keeps it as it was: regrouping never moves a run.
  if (run.areas) return run;
  const known = JOURNEYS.some((j) => j.id === run.journey);
  if (known && run.stage != null && run.unlockedGear) {
    // A journey that gained a map since the run started (Disc 1's third maps): its stage follows the area it's in.
    const at = getJourney(run.journey).areas.indexOf(WORLDS[run.world]?.id ?? "");
    return at >= 0 && at !== run.stage ? { ...run, stage: at } : run;
  }
  // Unknown/missing journey (older saves): the journey that contains the current area, at that area's stage.
  const area = WORLDS[run.world];
  const journey = known ? getJourney(run.journey) : (JOURNEYS.find((j) => area && j.areas.includes(area.id)) ?? JOURNEYS[0]!);
  return {
    ...run,
    journey: journey.id,
    stage: known && run.stage != null ? run.stage : Math.max(0, journey.areas.indexOf(area?.id ?? "")),
    unlockedGear: run.unlockedGear ?? [],
  };
}
