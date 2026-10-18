/**
 * Metrics (`.plans/metrics.md`): every number the game keeps about how you play — lifetime per player and per
 * character (the `player_metric` table) and per run (`RunState.metrics`). This registry names them: what each counts,
 * how it adds up (a running sum, or a record: the highest / lowest ever), whether it's kept per character, and what its
 * optional subject is (an enemy, item, ability, journey…). Achievements, the Stats page and the admin read it.
 */

export type MetricAgg = "sum" | "max" | "min";
/** What a metric's subject names: `enemies.killed` / `goblin`, `items.used` / `236`… */
export type MetricSubject = "enemy" | "item" | "ability" | "status" | "journey" | "stage";
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
  m("levels.gained", "Levels gained", "Levels gained in runs.", "runs", "sum", true),
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
