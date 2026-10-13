/**
 * The run state machine. A run is three worlds of map stages ending in a boss each. All transitions are pure
 * functions over a JSON-serializable `RunState` — the server stores the state, applies player actions with
 * these functions, and verifies battles by replaying their input logs.
 *
 * Permanence: AP (mastered abilities) and FF9's growth pool are kept; levels reset and become Completion Points
 * (meta/profile.ts). Gear found in a run is kept only if the run is won; loadout gear you brought is always kept.
 */
import { findItem, getCharacter, getItem, itemByName, parseAbilityRef, synthesis, type AbilityRef, type EquipSlot } from "@ffix-roguelike/game-data";

import { createBattle, replayBattle } from "../battle/engine";
import type { BattleState, InputRecord } from "../battle/types";
import { enemyGroup, partyUnit } from "../battle/units";
import { WORLDS } from "../content/worlds";
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
  trimLoadout,
  type CharacterBuild,
} from "../stats";
import { EVENTS, eventById, type EventOutcome } from "./events";
import { battleRewards, pickEncounter, recipesUpTo, rollGear, sellPrice, shopStock, starterKit, synthShopName, type ShopEntry } from "./loot";
import { generateWorldMap, getNode, type NodeKind, type WorldMap } from "./map";

export class RunError extends Error {}

export interface GearInstance {
  uid: number;
  itemId: number;
  /** Brought in from your loadout — always kept. Gear found during a run is only kept if you win. */
  secured: boolean;
  holder: { key: string; slot: EquipSlot } | null;
}

export interface RunMember {
  build: CharacterBuild;
  hp: number;
  mp: number;
}

export interface RewardSummary {
  exp: number;
  gil: number;
  ap: number;
  items: number[];
  levelUps: { key: string; from: number; to: number }[];
  mastered: { key: string; ref: AbilityRef }[];
}

export type RunPhase =
  | { kind: "map" }
  | { kind: "battle"; nodeId: string; nodeKind: "battle" | "elite" | "boss"; enemies: string[]; battle: BattleState }
  | { kind: "rewards"; summary: RewardSummary; gearChoices: number[]; boss: boolean }
  | { kind: "treasure"; gearChoices: number[]; gil: number }
  | { kind: "shop"; name: string; stock: ShopEntry[]; sold: number[] }
  | { kind: "synth"; name: string; recipes: number[] }
  | { kind: "moogle" }
  | { kind: "event"; eventId: string; result: string | null }
  | { kind: "worldClear"; cleared: number }
  | { kind: "over"; won: boolean };

export interface RunStats {
  battles: number;
  bossKills: string[];
  eaten: number;
  steals: number;
}

export interface RunState {
  version: 1;
  seed: string;
  rng: number;
  tier: number;
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
}

export interface StartRunInput {
  seed: string;
  tier: number;
  /** Party builds as saved at camp. Gear in slots the character hasn't unlocked yet is left at camp. */
  party: CharacterBuild[];
}

// ── helpers ──────────────────────────────────────────────────────────────────
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
  }
}

const partyKeys = (run: RunState) => run.party.map((m) => m.build.key);

// ── lifecycle ────────────────────────────────────────────────────────────────
export function startRun(input: StartRunInput): RunState {
  if (!input.party.length || input.party.length > 4) throw new RunError("Pick 1–4 party members");
  const rng = Rng.fromSeed(input.seed);
  const gear: GearInstance[] = [];
  let uid = 1;
  const party = input.party.map((b) => {
    const build = structuredClone(b);
    // Every run starts at the character's start level, with exactly that level's EXP.
    build.exp = expForLevel(build.level);
    trimLoadout(build);
    for (const slot of EQUIP_SLOTS) {
      const id = build.equipment[slot];
      if (id != null) gear.push({ uid: uid++, itemId: id, secured: true, holder: { key: build.key, slot } });
    }
    const st = deriveStats(build);
    return { build, hp: st.maxHp, mp: st.maxMp };
  });
  const map = generateWorldMap(rng.fork("map0"), 0);
  return {
    version: 1,
    seed: input.seed,
    rng: rng.state,
    tier: input.tier,
    world: 0,
    map,
    position: map.startId,
    visited: [map.startId],
    party,
    consumables: starterKit(),
    gear,
    nextUid: uid,
    gil: 300,
    phase: { kind: "map" },
    stats: { battles: 0, bossKills: [], eaten: 0, steals: 0 },
  };
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
  enterNode(next, node.kind, node.depth, nodeId, rng);
  next.rng = rngOf(next).fork(`after:${nodeId}`).state;
  return next;
}

function enterNode(run: RunState, kind: NodeKind, depth: number, nodeId: string, rng: Rng) {
  switch (kind) {
    case "battle":
    case "elite":
    case "boss":
      return startBattle(run, nodeId, kind, pickEncounter(rng, run.world, depth, kind, run.party.length), rng);
    case "treasure":
      run.phase = { kind: "treasure", gearChoices: rollGear(rng, run.world, partyKeys(run), 3, 10), gil: rng.int(80, 160) * (run.world + 1) };
      return;
    case "shop": {
      const visit = shopStock(rng, run.world, partyKeys(run));
      run.phase = { kind: "shop", name: visit.name, stock: visit.stock, sold: [] };
      return;
    }
    case "synth":
      run.phase = { kind: "synth", name: synthShopName(run.world), recipes: recipesUpTo(WORLDS[run.world]!.synthTier).map((r) => r.id) };
      return;
    case "moogle":
      healParty(run, 100, true);
      run.phase = { kind: "moogle" };
      return;
    case "event": {
      const pool = EVENTS.filter((e) => e.worlds.includes(run.world));
      run.phase = { kind: "event", eventId: rng.pick(pool).id, result: null };
      return;
    }
    case "start":
      run.phase = { kind: "map" };
  }
}

function startBattle(run: RunState, nodeId: string, nodeKind: "battle" | "elite" | "boss", enemies: string[], rng: Rng) {
  const living = run.party.map((m, i) => partyUnit(m.build, i, { hp: m.hp, mp: m.mp }));
  const battle = createBattle({
    seed: rng.int(1, 2 ** 31 - 1),
    party: living,
    enemies: enemyGroup(enemies, run.tier),
    inventory: run.consumables.filter((c) => c.count > 0),
    canFlee: nodeKind === "battle",
  });
  run.phase = { kind: "battle", nodeId, nodeKind, enemies, battle };
}

// ── battles ──────────────────────────────────────────────────────────────────
/** Verify a finished battle by replaying its inputs, then apply the result. */
export function finishBattle(run: RunState, inputs: InputRecord[]): RunState {
  if (run.phase.kind !== "battle") throw new RunError("Not in a battle");
  const phase = run.phase;
  let final: BattleState;
  try {
    final = replayBattle(phase.battle, inputs);
  } catch (e) {
    throw new RunError(`Battle log rejected: ${(e as Error).message}`);
  }
  if (!final.outcome) throw new RunError("Battle isn't finished");
  const next = structuredClone(run);
  next.stats.battles++;
  next.stats.steals += final.stolen.length;
  next.stats.eaten += final.learned.length;
  // Carry HP/MP and consumables out of the fight.
  for (const u of final.units.filter((x) => x.side === "party")) {
    const m = next.party.find((p) => p.build.key === u.key)!;
    m.hp = u.statuses.petrify ? 0 : u.hp;
    m.mp = u.mp;
  }
  next.consumables = final.inventory.filter((c) => c.count > 0);

  if (final.outcome === "defeat") {
    next.phase = { kind: "over", won: false };
    return next;
  }
  if (final.outcome === "fled") {
    next.phase = { kind: "map" };
    return next;
  }

  const rng = rngOf(next).fork(`rewards:${phase.nodeId}:${next.stats.battles}`);
  const rewards = battleRewards(rng, phase.enemies, next.tier, final);
  const summary = applyRewards(next, rewards, final);
  const boss = phase.nodeKind === "boss";
  if (boss) next.stats.bossKills.push(...phase.enemies);
  const gearChoices = phase.nodeKind === "battle" ? [] : rollGear(rng, next.world, partyKeys(next), 3, boss ? 60 : 20);
  next.phase = { kind: "rewards", summary, gearChoices, boss };
  next.rng = rng.state;
  return next;
}

function applyRewards(run: RunState, r: { exp: number; ap: number; gil: number; items: number[] }, final: BattleState): RewardSummary {
  const alive = run.party.filter((m) => m.hp > 0);
  const summary: RewardSummary = { exp: r.exp, gil: r.gil, ap: r.ap, items: r.items, levelUps: [], mastered: [] };
  const supportsOf = (m: RunMember) => activeSupports(m.build);
  const gilMult = Math.max(1, ...run.party.map((m) => (supportsOf(m).has(45) ? 1.5 : 1)));
  run.gil += Math.round(r.gil * gilMult);
  summary.gil = Math.round(r.gil * gilMult);
  for (const id of r.items) addLoot(run, id);

  for (const m of alive) {
    const sup = supportsOf(m);
    const share = Math.floor((r.exp / Math.max(1, alive.length)) * (sup.has(43) ? 1.5 : 1));
    const before = m.build.level;
    const oldMax = deriveStats(m.build);
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
      if (m.build.ap[ref]! >= cost) summary.mastered.push({ key: m.build.key, ref });
    }
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

/** Take one of the offered gear pieces (or null to skip) and continue. */
export function claimReward(run: RunState, choice: number | null): RunState {
  const p = run.phase;
  if (p.kind !== "rewards" && p.kind !== "treasure") throw new RunError("No reward to claim");
  const next = structuredClone(run);
  if (choice != null) {
    const itemId = p.gearChoices[choice];
    if (itemId == null) throw new RunError("Invalid choice");
    addLoot(next, itemId);
  }
  if (p.kind === "treasure") next.gil += p.gil;
  if (p.kind === "rewards" && p.boss) {
    if (next.world >= WORLDS.length - 1) next.phase = { kind: "over", won: true };
    else next.phase = { kind: "worldClear", cleared: next.world };
  } else next.phase = { kind: "map" };
  return next;
}

/** After a world's boss: travel to the next world (full heal). */
export function nextWorld(run: RunState): RunState {
  if (run.phase.kind !== "worldClear") throw new RunError("The world isn't cleared yet");
  const next = structuredClone(run);
  next.world++;
  next.map = generateWorldMap(rngOf(next).fork(`map${next.world}`), next.world);
  next.position = next.map.startId;
  next.visited = [next.map.startId];
  healParty(next, 100, true);
  next.phase = { kind: "map" };
  return next;
}

// ── shops, events, moogles ───────────────────────────────────────────────────
export function buy(run: RunState, index: number): RunState {
  if (run.phase.kind !== "shop") throw new RunError("Not in a shop");
  const entry = run.phase.stock[index];
  if (!entry) throw new RunError("No such item");
  const isGearEntry = !(findItem(entry.itemId)?.effect && findItem(entry.itemId)?.kind === "item");
  if (isGearEntry && run.phase.sold.includes(index)) throw new RunError("Sold out");
  if (run.gil < entry.price) throw new RunError("Not enough gil");
  const next = structuredClone(run);
  next.gil -= entry.price;
  addLoot(next, entry.itemId);
  if (isGearEntry && next.phase.kind === "shop") next.phase.sold.push(index);
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
  addLoot(next, recipe.result);
  const made = next.gear.at(-1);
  if (made && made.itemId === recipe.result) made.secured = secured;
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
  return next;
}

/** Leave a shop / moogle / finished event and return to the map. */
export function leave(run: RunState): RunState {
  const k = run.phase.kind;
  if (k === "event" && run.phase.kind === "event" && !run.phase.result) throw new RunError("Make a choice first");
  if (k !== "shop" && k !== "synth" && k !== "moogle" && k !== "event") throw new RunError("Nothing to leave");
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
  const rolled = rng.weighted(choice.outcomes.map((o) => ({ weight: o.weight, value: o })));
  next.phase = { kind: "event", eventId: def.id, result: rolled.text };
  applyOutcome(next, rolled.outcome, rng);
  next.rng = rng.state;
  return next;
}

function applyOutcome(run: RunState, o: EventOutcome, rng: Rng) {
  switch (o.type) {
    case "gil":
      run.gil += o.amount * (run.world + 1);
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
      run.phase = { kind: "treasure", gearChoices: rollGear(rng, run.world, partyKeys(run), 3, 25), gil: 0 };
      return;
    case "exp": {
      const alive = run.party.filter((m) => m.hp > 0);
      applyRewards(run, { exp: o.amount * (run.world + 1) * alive.length, ap: 0, gil: 0, items: [] }, emptyBattle());
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
  if (!["map", "moogle", "shop", "synth", "rewards", "treasure", "worldClear"].includes(run.phase.kind)) throw new RunError("Can't change gear right now");
}

/** Equip a gear instance (or clear the slot with uid = null). */
export function equip(run: RunState, key: string, slot: EquipSlot, uid: number | null): RunState {
  assertCanManage(run);
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
    if (inst.holder && inst.holder.key !== key) {
      // Swap: the other character gets this character's current piece if they can wear it, else empties.
      const other = inst.holder;
      if (current && canEquip(other.key, getItem(current.itemId), other.slot)) current.holder = { ...other };
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
  /** Gear to add to the stash: itemId → count. */
  stash: Record<number, number>;
  gearLost: number[];
  gilEarned: number;
  stats: RunStats;
  worldReached: number;
}

/** What the player keeps when the run ends. */
export function runOutcome(run: RunState): RunOutcome {
  if (run.phase.kind !== "over") throw new RunError("The run isn't over");
  const won = run.phase.won;
  const kept = run.gear.filter((g) => g.secured || won);
  const lost = run.gear.filter((g) => !(g.secured || won));
  const builds = run.party.map((m) => {
    const b = structuredClone(m.build);
    for (const slot of EQUIP_SLOTS) b.equipment[slot] = kept.find((g) => g.holder?.key === b.key && g.holder.slot === slot)?.itemId ?? null;
    // Back at camp, gear beyond the loadout budget goes to the stash.
    for (const slot of trimLoadout(b)) {
      const inst = kept.find((g) => g.holder?.key === b.key && g.holder.slot === slot);
      if (inst) inst.holder = null;
    }
    if (b.equipment.weapon == null) b.equipment.weapon = getCharacter(b.key).defaultEquipment.weapon;
    b.supports = b.supports.filter((id) => activeSupports(b).has(id));
    return b;
  });
  const stash: Record<number, number> = {};
  for (const g of kept.filter((x) => !x.holder)) stash[g.itemId] = (stash[g.itemId] ?? 0) + 1;
  return {
    won,
    builds,
    stash,
    gearLost: lost.map((g) => g.itemId),
    gilEarned: won ? run.gil : Math.floor(run.gil / 2),
    stats: run.stats,
    worldReached: run.world,
  };
}

/** Ability refs on a character's learn list that are active (for menus). */
export function learnedActive(build: CharacterBuild): AbilityRef[] {
  return getCharacter(build.key).abilities.map((a) => a.ref).filter((ref) => parseAbilityRef(ref).kind === "active");
}
