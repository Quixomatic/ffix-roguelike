/**
 * Collecting metrics (`.plans/metrics.md`). A `MetricBag` is a flat map of metric entries — `key|subject|character` →
 * value — that adds up by each metric's aggregation (sum / max / min, from the registry). Battles fold their replayed
 * events into one (`battleMetrics`), runs keep theirs on the run state (`RunState.metrics`, the run's own summary), and
 * the server adds what's new to the player's lifetime totals (`player_metric`) in the same transaction that saves the
 * run. Everything here is pure: client and server compute the same numbers.
 */
import type { BattleEvent, BattleState, BattleUnit } from "../battle/types";
import type { Profile } from "../meta/profile";
import type { CharacterBuild } from "../stats";
import { metricDef } from "./registry";

/** `key|subject|character` → value. */
export type MetricBag = Record<string, number>;

export interface MetricEntry {
  key: string;
  /** "" = none (the metric's overall total). */
  subject: string;
  /** "" = the player. */
  character: string;
  value: number;
}

export const bagKey = (key: string, subject = "", character = "") => `${key}|${subject}|${character}`;
export function parseBagKey(k: string): Omit<MetricEntry, "value"> {
  const [key = "", subject = "", character = ""] = k.split("|");
  return { key, subject, character };
}

/** Fold one value into an entry, by the metric's aggregation. */
function put(bag: MetricBag, k: string, value: number) {
  const agg = metricDef(parseBagKey(k).key)?.agg ?? "sum";
  const cur = bag[k];
  bag[k] = cur === undefined ? value : agg === "sum" ? cur + value : agg === "max" ? Math.max(cur, value) : Math.min(cur, value);
}

/**
 * Record `value` for a metric: always the player's overall total, plus — when given — the per-subject and
 * per-character entries (and both together), as the registry says the metric keeps them.
 */
export function record(bag: MetricBag, key: string, value: number, o: { subject?: string | number; character?: string } = {}) {
  if (!value && metricDef(key)?.agg !== "min") return;
  const def = metricDef(key);
  const subject = o.subject != null && def?.subject ? String(o.subject) : "";
  const character = o.character && def?.perCharacter ? o.character : "";
  put(bag, bagKey(key), value);
  if (subject) put(bag, bagKey(key, subject), value);
  if (character) put(bag, bagKey(key, "", character), value);
  if (subject && character) put(bag, bagKey(key, subject, character), value);
}

/** Add one bag into another (by aggregation). */
export function mergeBags(into: MetricBag, add: MetricBag): MetricBag {
  for (const [k, v] of Object.entries(add)) put(into, k, v);
  return into;
}

/** What `after` adds over `before` (sums: the difference; records: the new value when it beats the old one). */
export function bagDelta(after: MetricBag | undefined, before: MetricBag | undefined): MetricBag {
  const out: MetricBag = {};
  for (const [k, v] of Object.entries(after ?? {})) {
    const was = before?.[k];
    const agg = metricDef(parseBagKey(k).key)?.agg ?? "sum";
    if (agg === "sum") {
      const d = v - (was ?? 0);
      if (d) out[k] = d;
    } else if (was === undefined || (agg === "max" ? v > was : v < was)) out[k] = v;
  }
  return out;
}

export const bagEntries = (bag: MetricBag): MetricEntry[] => Object.entries(bag).map(([k, value]) => ({ ...parseBagKey(k), value }));

/** One entry's value from a bag (0 when absent). */
export const bagValue = (bag: MetricBag | undefined, key: string, o: { subject?: string; character?: string } = {}) => bag?.[bagKey(key, o.subject ?? "", o.character ?? "")] ?? 0;

/**
 * A battle's metrics, from its replayed events. Each `actionStart` opens an action; the damage, heals, KOs, steals and
 * statuses that follow until the next one are its actor's. Enemies are counted by bestiary id; bosses by theirs.
 */
export function battleMetrics(initial: BattleState, events: BattleEvent[], final: BattleState, stage: string): MetricBag {
  const bag: MetricBag = {};
  const units = new Map<string, BattleUnit>([...initial.units, ...final.units].map((u) => [u.id, u]));
  const hero = (id: string | undefined) => {
    const u = id ? units.get(id) : undefined;
    return u?.side === "party" ? u.key : undefined;
  };
  const isEnemy = (id: string) => units.get(id)?.side === "enemy";
  let actor: string | undefined;
  let partyKos = 0;
  for (const e of events) {
    switch (e.type) {
      case "actionStart": {
        actor = e.actorId;
        const who = hero(actor);
        if (!who) break;
        record(bag, "actions.taken", 1, { character: who });
        if (e.kind === "ability" && e.actionId != null) record(bag, "abilities.used", 1, { character: who, subject: e.actionId });
        if (e.kind === "item" && e.itemId != null) record(bag, "items.used", 1, { character: who, subject: e.itemId });
        break;
      }
      case "damage": {
        if (e.mp || e.amount <= 0) break;
        const by = hero(actor);
        if (isEnemy(e.targetId) && by) {
          record(bag, "damage.dealt", e.amount, { character: by });
          record(bag, "damage.best_hit", e.amount, { character: by });
          if (e.crit) record(bag, "hits.critical", 1, { character: by });
        }
        const victim = hero(e.targetId);
        if (victim && actor && isEnemy(actor)) record(bag, "damage.taken", e.amount, { character: victim });
        break;
      }
      case "heal": {
        const by = hero(actor);
        if (!e.mp && by && hero(e.targetId)) record(bag, "healing.done", e.amount, { character: by });
        break;
      }
      case "ko": {
        const victim = hero(e.targetId);
        if (victim) {
          partyKos++;
          record(bag, "kos.suffered", 1, { character: victim });
        } else if (isEnemy(e.targetId)) {
          record(bag, "enemies.killed", 1, { character: hero(actor), subject: units.get(e.targetId)!.key });
        }
        break;
      }
      case "revive": {
        const by = hero(actor);
        if (by && hero(e.targetId)) record(bag, "revives.done", 1, { character: by });
        break;
      }
      case "steal": {
        const by = hero(e.actorId);
        if (e.itemId != null) record(bag, "steals.succeeded", 1, { character: by, subject: e.itemId });
        else record(bag, "steals.failed", 1, { character: by });
        break;
      }
      case "learn": {
        const by = hero(e.unitId);
        if (by) record(bag, "monsters.eaten", 1, { character: by });
        break;
      }
      case "tranceStart": {
        const by = hero(e.unitId);
        if (by) record(bag, "trances", 1, { character: by });
        break;
      }
      case "statusOn": {
        const by = hero(actor);
        if (by && isEnemy(e.targetId)) record(bag, "statuses.inflicted", 1, { character: by, subject: e.status });
        break;
      }
    }
  }
  // The battle as a whole, for the player and for everyone in the party.
  const party = final.units.filter((u) => u.side === "party").map((u) => u.key);
  const each = (key: string, value: number, subject?: string) => {
    record(bag, key, value, { subject });
    for (const k of party) for (const [kk, v] of Object.entries(single(key, value, k, subject))) bag[kk] = (bag[kk] ?? 0) + v;
  };
  each("battles.fought", 1);
  if (final.outcome === "victory") {
    each("battles.won", 1, stage);
    if (!partyKos) each("battles.flawless", 1);
    record(bag, "battles.fastest_win", final.tick);
    // Bosses: each boss unit, by id — for the player and for everyone in the party.
    for (const u of final.units) {
      if (u.side !== "enemy" || !u.boss) continue;
      record(bag, "bosses.defeated", 1, { subject: u.key });
      for (const k of party) for (const [kk, v] of Object.entries(single("bosses.defeated", 1, k, u.key))) bag[kk] = (bag[kk] ?? 0) + v;
    }
  }
  if (final.outcome === "defeat") each("battles.lost", 1);
  if (final.outcome === "fled") each("battles.fled", 1);
  if (final.start === "preemptive") record(bag, "battles.preemptive", 1);
  if (final.start === "back") record(bag, "battles.back_attack", 1);
  record(bag, "battles.ticks", final.tick);
  return bag;
}

/** Just the per-character entries of one value (the player's total is recorded once, not per member). */
function single(key: string, value: number, character: string, subject?: string): MetricBag {
  const def = metricDef(key);
  if (!def?.perCharacter) return {};
  const out: MetricBag = { [bagKey(key, "", character)]: value };
  if (subject && def.subject) out[bagKey(key, subject, character)] = value;
  return out;
}

/** A finished run's metrics: finished / won / lost by journey, for the player and each member, and levels gained. */
export function runEndMetrics(o: { journey: string; won: boolean; tier: number; gilEarned: number; builds: CharacterBuild[]; startLevels: Record<string, number>; relics?: string[] }): MetricBag {
  const bag: MetricBag = {};
  const outcome = o.won ? "runs.won" : "runs.lost";
  for (const key of ["runs.finished", outcome]) {
    record(bag, key, 1, { subject: o.journey });
    for (const b of o.builds) for (const [kk, v] of Object.entries(single(key, 1, b.key, o.journey))) bag[kk] = (bag[kk] ?? 0) + v;
  }
  if (o.won) record(bag, "runs.best_tier", o.tier);
  if (o.won) for (const id of o.relics ?? []) record(bag, "relics.runs_won", 1, { subject: id });
  record(bag, "runs.gil_earned", o.gilEarned);
  for (const b of o.builds) record(bag, "levels.gained", Math.max(0, b.level - (o.startLevels[b.key] ?? b.level)), { character: b.key });
  return bag;
}

/**
 * Camp spending, from the profile before and after a camp action: CP and gil spent, training ranks, slots, start
 * levels and starting-gear tiers bought (per character).
 */
export function campMetrics(before: Profile, after: Profile): MetricBag {
  const bag: MetricBag = {};
  record(bag, "camp.gil_spent", Math.max(0, before.gil - after.gil));
  for (const [key, a] of Object.entries(after.builds)) {
    const b = before.builds[key];
    if (!b) continue;
    const sum = (o: Record<string, number | undefined> | undefined) => Object.values(o ?? {}).reduce<number>((n, v) => n + (v ?? 0), 0);
    record(bag, "camp.cp_spent", Math.max(0, (b.points ?? 0) - (a.points ?? 0)), { character: key });
    record(bag, "camp.training_ranks", Math.max(0, sum(a.training) - sum(b.training)), { character: key });
    record(bag, "camp.slots_unlocked", Math.max(0, (a.unlockedSlots?.length ?? 0) - (b.unlockedSlots?.length ?? 0)), { character: key });
    record(bag, "camp.start_levels", Math.max(0, a.level - b.level), { character: key });
    record(bag, "camp.starter_tiers", Math.max(0, sum(a.starterTiers) - sum(b.starterTiers)), { character: key });
  }
  return bag;
}
