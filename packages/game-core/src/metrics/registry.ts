/**
 * Metrics (`.plans/metrics.md`): every number the game keeps about how you play — lifetime per player and per
 * character (the `player_metric` table) and per run (`RunState.metrics`). This registry names them: what each counts,
 * how it adds up (a running sum, or a record: the highest / lowest ever), whether it's kept per character, and what its
 * optional subject is (an enemy, item, ability, journey…). Achievements, the Stats page and the admin read it.
 */

export type MetricAgg = "sum" | "max" | "min";
/** What a metric's subject names: `enemies.killed` / `goblin`, `items.used` / `236`… */
export type MetricSubject = "enemy" | "item" | "ability" | "status" | "journey" | "stage" | "event" | "card" | "relic";
export type MetricSection = "battles" | "combat" | "support" | "runs" | "bosses" | "camp";

export interface MetricDef {
  key: string;
  label: string;
  description: string;
  section: MetricSection;
  agg: MetricAgg;
  /** Kept per character too (besides the player's total). */
  perCharacter: boolean;
  /** Also kept per subject (e.g. per enemy), besides the overall total. */
  subject?: MetricSubject;
  /** Shown as a duration in battle ticks (15 per second). */
  ticks?: boolean;
}

const m = (key: string, label: string, description: string, section: MetricSection, agg: MetricAgg, perCharacter: boolean, extra: Partial<MetricDef> = {}): MetricDef => ({
  key,
  label,
  description,
  section,
  agg,
  perCharacter,
  ...extra,
});

export const METRICS: MetricDef[] = [
  // ── battles ──
  m("battles.fought", "Battles fought", "Battles started and finished (won, lost or fled).", "battles", "sum", true),
  m("battles.won", "Battles won", "Battles won.", "battles", "sum", true, { subject: "stage" }),
  m("battles.lost", "Battles lost", "Battles lost.", "battles", "sum", true),
  m("battles.fled", "Battles fled", "Battles run away from.", "battles", "sum", true),
  m("battles.flawless", "Flawless wins", "Battles won without anyone in the party being KO'd.", "battles", "sum", true),
  m("battles.preemptive", "Preemptive strikes", "Battles that started with a preemptive strike.", "battles", "sum", false),
  m("battles.back_attack", "Back attacks", "Battles that started with a back attack.", "battles", "sum", false),
  m("battles.ticks", "Time in battle", "Total time spent in battles.", "battles", "sum", false, { ticks: true }),
  m("battles.fastest_win", "Fastest win", "The shortest battle won.", "battles", "min", false, { ticks: true }),
  // ── combat (per character) ──
  m("enemies.killed", "Enemies defeated", "Enemies finished off.", "combat", "sum", true, { subject: "enemy" }),
  m("damage.dealt", "Damage dealt", "HP damage dealt to enemies.", "combat", "sum", true),
  m("damage.taken", "Damage taken", "HP damage taken from enemies.", "combat", "sum", true),
  m("damage.best_hit", "Biggest hit", "The most HP damage dealt in one hit.", "combat", "max", true),
  m("hits.critical", "Critical hits", "Critical hits landed.", "combat", "sum", true),
  m("actions.taken", "Actions taken", "Commands carried out in battle.", "combat", "sum", true),
  m("abilities.used", "Abilities used", "Abilities and spells used.", "combat", "sum", true, { subject: "ability" }),
  m("statuses.inflicted", "Statuses inflicted", "Statuses landed on enemies.", "combat", "sum", true, { subject: "status" }),
  m("kos.suffered", "Times KO'd", "Times knocked out.", "combat", "sum", true),
  m("trances", "Trances", "Times entering Trance.", "combat", "sum", true),
  // ── support (per character) ──
  m("healing.done", "Healing done", "HP restored to allies.", "support", "sum", true),
  m("revives.done", "Revives", "Allies brought back from KO.", "support", "sum", true),
  m("items.used", "Items used", "Items used in battle.", "support", "sum", true, { subject: "item" }),
  m("steals.succeeded", "Steals", "Items stolen.", "support", "sum", true, { subject: "item" }),
  m("steals.failed", "Missed steals", "Steal attempts that came away empty.", "support", "sum", true),
  m("monsters.eaten", "Monsters eaten", "Monsters eaten (Quina), learning their Blue Magic.", "support", "sum", true),
  // ── runs ──
  m("runs.finished", "Runs finished", "Runs ended: won, lost or abandoned.", "runs", "sum", true, { subject: "journey" }),
  m("runs.won", "Runs won", "Runs won.", "runs", "sum", true, { subject: "journey" }),
  m("runs.lost", "Runs lost", "Runs lost or abandoned.", "runs", "sum", true, { subject: "journey" }),
  m("runs.best_tier", "Highest tier won", "The highest difficulty tier a run was won on.", "runs", "max", false),
  m("runs.gil_earned", "Gil earned", "Gil brought home from runs.", "runs", "sum", false),
  m("runs.win_streak", "Best win streak", "The most runs won in a row.", "runs", "max", false),
  m("levels.gained", "Levels gained", "Levels gained in runs.", "runs", "sum", true),
  m("stages.entered", "Stages entered", "Stages entered on the map, by kind (battle, shop, Moogle…).", "runs", "sum", false, { subject: "stage" }),
  m("shop.purchases", "Things bought", "Purchases in run shops and from Stiltzkin.", "runs", "sum", false),
  m("shop.gil_spent", "Gil spent in runs", "Gil spent in run shops, at Stiltzkin and on synthesis.", "runs", "sum", false),
  m("gear.synthesized", "Synthesized", "Items made at synthesis shops.", "runs", "sum", false, { subject: "item" }),
  m("gear.sold", "Gear sold", "Gear sold in runs.", "runs", "sum", false),
  m("gear.sell_gil", "Gil from selling", "Gil from gear sold in runs.", "runs", "sum", false),
  m("relics.taken", "Relics taken", "Relics taken in runs (the starting relic and reward cards), by relic.", "runs", "sum", false, { subject: "relic" }),
  m("relics.runs_won", "Runs won with a relic", "Runs won holding each relic.", "runs", "sum", false, { subject: "relic" }),
  m("events.chosen", "Event choices", "Choices made at ? events, by event.", "runs", "sum", false, { subject: "event" }),
  m("chocobo.digs", "Chocobo digs", "Spots dug in Chocobo Hot & Cold.", "runs", "sum", false),
  m("rewards.taken", "Reward cards taken", "Reward cards taken, by kind (gear, boon, AP…).", "runs", "sum", false, { subject: "card" }),
  m("rewards.skipped", "Reward cards skipped", "Reward offers skipped for gil.", "runs", "sum", false),
  m("items.used_field", "Items used on the map", "Items used outside battle.", "support", "sum", true, { subject: "item" }),
  // ── bosses ──
  m("bosses.defeated", "Bosses defeated", "Bosses (and semi-bosses) defeated.", "bosses", "sum", true, { subject: "enemy" }),
  // ── camp ──
  m("camp.cp_spent", "CP spent", "Completion Points spent at camp.", "camp", "sum", true),
  m("camp.gil_spent", "Gil spent at camp", "Banked gil spent at camp (catalog, supplies, upgrades).", "camp", "sum", false),
  m("camp.training_ranks", "Training ranks", "Training ranks bought.", "camp", "sum", true),
  m("camp.slots_unlocked", "Gear slots unlocked", "Gear slots unlocked.", "camp", "sum", true),
  m("camp.starter_tiers", "Starting-gear tiers", "Starting-gear upgrade tiers bought.", "camp", "sum", true),
  m("camp.start_levels", "Start levels raised", "Start levels bought.", "camp", "sum", true),
];

const byKey = new Map(METRICS.map((d) => [d.key, d]));
export const metricDef = (key: string): MetricDef | undefined => byKey.get(key);

export const METRIC_SECTIONS: { id: MetricSection; label: string }[] = [
  { id: "battles", label: "Battles" },
  { id: "combat", label: "Combat" },
  { id: "support", label: "Support" },
  { id: "runs", label: "Runs" },
  { id: "bosses", label: "Bosses" },
  { id: "camp", label: "Camp" },
];
