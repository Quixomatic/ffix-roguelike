#!/usr/bin/env bun
/**
 * sim — server-side simulation of battles and runs with the real game-core engine (no browser).
 *
 *   pnpm sim battle  --party zidane:5,vivi:5 --enemies goblin,wolf [--world 0] [--seed 1] [--auto] [--script cmds.txt]
 *   pnpm sim balance [--world 0] [--levels 2,4,7] [--party zidane,vivi,steiner] [--n 40]
 *   pnpm sim run     [--journey evil-forest] [--seed s] [--party zidane] [--level 1] [--slots armor,head]
 *   pnpm sim runs    [--count 20] [--seed meta]
 *
 * `battle` is interactive: when a party member is ready you type a command (or pipe/script them):
 *   a <target>                attack            e.g. `a e0`
 *   s <ability> [target|all]  ability by name   e.g. `s fire e1`, `s cure p0`, `s fira all`
 *   i <item> <target>         use item          e.g. `i potion p1`
 *   d | f | c                 defend | flee | change row
 *   auto                      let the AI pick this turn       autoall — AI for the rest of the fight
 *   state                     print the battlefield           q — quit
 * Targets: e0/e1… (enemies), p0/p1… (party), or a unit name prefix.
 */
import { createInterface } from "node:readline";

import { findItem, getItem, itemByName, items } from "@ffix-roguelike/game-data";
import { loadBattleScriptCache, loadBestiaryCache } from "@ffix-roguelike/game-data/cache";

import {
  applyRunOutcome,
  registerBattleScripts,
  encounterNames,
  encounterUnits,
  isSceneRef,
  rollSceneGroup,
  starterGear,
  TICKS_PER_SECOND,
  availableJourneys,
  JOURNEYS,
  autoBattle,
  autoCommand,
  BattleEngine,
  buy,
  chooseEvent,
  claimReward,
  createBattle,
  dig,

  finishBattle,
  getBattleAction,
  getNode,
  leave,
  moveTo,
  newBuild,
  newProfile,
  nextSlotCost,
  nextWorld,
  optimizeParty,
  partyUnit,
  raiseStartLevel,
  Rng,
  runOutcome,
  startLevelCost,
  startRun,
  UNLOCKABLE_SLOTS,
  unlockSlot,
  WORLDS,
  type BattleCommand,
  type BattleEvent,
  type BattleState,
  type BattleUnit,
  type Profile,
  type RunState,
} from "../src/index";

// ── args ─────────────────────────────────────────────────────────────────────
const [cmd = "help", ...rest] = process.argv.slice(2);
// FF9 monsters, attacks and scenes from the local import cache (the server loads them from Postgres).
loadBestiaryCache();
registerBattleScripts(loadBattleScriptCache());

const args: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i]!;
  if (a.startsWith("--")) {
    const next = rest[i + 1];
    if (next && !next.startsWith("--")) {
      args[a.slice(2)] = next;
      i++;
    } else args[a.slice(2)] = "true";
  }
}
const num = (k: string, d: number) => (args[k] ? Number(args[k]) : d);
const list = (k: string, d: string) => (args[k] ?? d).split(",").map((s) => s.trim()).filter(Boolean);

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const potions = () => [
  { itemId: itemByName("Potion").id, count: 4 },
  { itemId: itemByName("Phoenix Down").id, count: 1 },
];

// ── battle printing ──────────────────────────────────────────────────────────
function bar(v: number, max: number, w = 10) {
  const n = Math.round((Math.max(0, v) / Math.max(1, max)) * w);
  return "█".repeat(n) + "·".repeat(w - n);
}

function printState(e: BattleEngine) {
  const s = e.state;
  console.log(c.dim(`── tick ${s.tick} (${(s.tick / TICKS_PER_SECOND).toFixed(1)}s) ──`));
  for (const u of s.units) {
    const st = Object.keys(u.statuses).join(",");
    const down = !e.isActive(u);
    const line = `${u.id.padEnd(3)} ${u.name.padEnd(12)} Lv${String(u.level).padEnd(3)} HP ${String(u.hp).padStart(5)}/${String(u.maxHp).padEnd(5)} MP ${String(u.mp).padStart(3)} ATB ${bar(u.atb, u.atbMax)}${u.side === "party" && u.tranceCommands.length ? ` TR ${bar(u.trance, 255, 5)}` : ""} ${st}`;
    console.log(down ? c.dim(line) : u.side === "enemy" ? c.red(line) : c.green(line));
  }
}

function describe(e: BattleEngine, ev: BattleEvent): string | null {
  const n = (id: string) => e.state.units.find((u) => u.id === id)?.name ?? id;
  switch (ev.type) {
    case "actionStart":
      return c.bold(`${n(ev.actorId)} → ${ev.name}${ev.targetIds.length ? ` on ${ev.targetIds.map(n).join(", ")}` : ""}`);
    case "damage":
      return `   ${n(ev.targetId)} takes ${ev.amount}${ev.mp ? " MP" : ""}${ev.crit ? " (critical!)" : ""}`;
    case "heal":
      return `   ${n(ev.targetId)} recovers ${ev.amount}${ev.mp ? " MP" : ""}`;
    case "miss":
      return `   ${n(ev.targetId)}: miss`;
    case "statusOn":
      return `   ${n(ev.targetId)} +${ev.status}`;
    case "statusOff":
      return c.dim(`   ${n(ev.targetId)} -${ev.status}`);
    case "ko":
      return c.red(`   ${n(ev.targetId)} is KO'd`);
    case "revive":
      return c.green(`   ${n(ev.targetId)} revived`);
    case "tranceStart":
      return c.yellow(`   ${n(ev.unitId)} enters TRANCE`);
    case "steal":
      return `   ${ev.itemId != null ? `stole ${findItem(ev.itemId)?.name}` : "steal failed"}`;
    case "learn":
      return c.yellow(`   ${n(ev.unitId)} learned ${getBattleAction(ev.actionId).name}`);
    case "message":
      return c.dim(`   ${ev.text}`);
    case "end":
      return c.bold(`== ${ev.outcome.toUpperCase()} ==`);
    default:
      return null;
  }
}

function resolveTarget(e: BattleEngine, _actor: BattleUnit, token: string | undefined): string[] {
  if (!token) return [];
  if (token === "all") return [];
  const exact = e.state.units.find((u) => u.id === token);
  if (exact) return [exact.id];
  const byName = e.state.units.find((u) => u.name.toLowerCase().startsWith(token.toLowerCase()) && e.isActive(u));
  return byName ? [byName.id] : [token];
}

/** Parse one command line into a BattleCommand for `actor`. */
function parseCommand(e: BattleEngine, actor: BattleUnit, line: string): BattleCommand | "auto" | "autoall" | "state" | "quit" | string {
  const [verb = "", ...words] = line.trim().split(/\s+/);
  const v = verb.toLowerCase();
  if (v === "auto") return "auto";
  if (v === "autoall") return "autoall";
  if (v === "state") return "state";
  if (v === "q" || v === "quit") return "quit";
  if (v === "a") return { actorId: actor.id, kind: "attack", targetIds: resolveTarget(e, actor, words[0]) };
  if (v === "d") return { actorId: actor.id, kind: "defend", targetIds: [] };
  if (v === "f") return { actorId: actor.id, kind: "flee", targetIds: [] };
  if (v === "c") return { actorId: actor.id, kind: "change", targetIds: [] };
  if (v === "s") {
    const targetToken = words.length > 1 ? words[words.length - 1] : undefined;
    const name = (targetToken ? words.slice(0, -1) : words).join(" ").toLowerCase();
    const ids = e.commandsOf(actor).flatMap((cmd) => cmd.actionIds);
    const action = ids.map(getBattleAction).find((a) => a.name.toLowerCase().startsWith(name));
    if (!action) return `no ability "${name}" — available: ${ids.map((id) => getBattleAction(id).name).join(", ")}`;
    let targetIds = resolveTarget(e, actor, targetToken);
    if (targetToken === "all") targetIds = e.opponents(actor).filter((u) => e.isActive(u)).map((u) => u.id);
    if (!targetIds.length && !action.targets.startsWith("all") && action.targets !== "self")
      targetIds = (action.defaultAlly ? [actor] : e.opponents(actor).filter((u) => e.isActive(u))).slice(0, 1).map((u) => u.id);
    return { actorId: actor.id, kind: "ability", actionId: action.id, targetIds };
  }
  if (v === "i") {
    const name = words.slice(0, -1).join(" ").toLowerCase() || words[0]!.toLowerCase();
    const stock = e.state.inventory.find((s) => s.count > 0 && findItem(s.itemId)?.name.toLowerCase().startsWith(name));
    if (!stock) return `no item "${name}" — have: ${e.state.inventory.map((s) => `${findItem(s.itemId)?.name}×${s.count}`).join(", ")}`;
    return { actorId: actor.id, kind: "item", itemId: stock.itemId, targetIds: resolveTarget(e, actor, words[words.length - 1]) };
  }
  return `unknown command "${line}"`;
}

async function battleCmd() {
  const party = list("party", "zidane:5,vivi:5,steiner:5").map((p, i) => {
    const [key, lv] = p.split(":");
    const b = newBuild(key!, Number(lv ?? 5));
    return partyUnit({ ...b, equipment: starterGear(b) }, i);
  });
  const world = num("world", 0);
  const enemyIds = list("enemies", WORLDS[world]!.encounters[0]!.join(","));
  const seed = num("seed", Date.now() % 1_000_000);
  // FF9 scenes: --enemies @EF_E009 (main group) or @EF_R004#2 (a pattern).
  const enc = encounterUnits(enemyIds, num("tier", 0));
  const engine = new BattleEngine(createBattle({ seed, party, enemies: enc.units, inventory: potions(), ...(enc.scene ? { scene: enc.scene } : {}) }));
  console.log(c.cyan(`Battle seed ${seed}: ${party.map((u) => u.name).join(", ")} vs ${enemyIds.join(", ")}`));
  printState(engine);

  const scripted = args.script ? (await Bun.file(args.script).text()).split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")) : null;
  const piped = !process.stdin.isTTY && !scripted;
  const lines: string[] = scripted ?? [];
  let autoAll = args.auto === "true";
  let pipedDone = false;
  const rl = piped || !scripted ? createInterface({ input: process.stdin, output: process.stdout, terminal: !piped }) : null;
  const iter = rl?.[Symbol.asyncIterator]();
  const nextLine = async (prompt: string): Promise<string | null> => {
    if (scripted) return lines.shift() ?? null;
    if (!piped) process.stdout.write(prompt);
    const r = await iter!.next();
    if (r.done) {
      pipedDone = true;
      return null;
    }
    return r.value;
  };

  while (!engine.state.outcome) {
    for (const actor of engine.readyUnits()) {
      for (;;) {
        if (autoAll || pipedDone) {
          const res = engine.submit(autoCommand(engine, actor));
          if (!res.ok) engine.submit({ actorId: actor.id, kind: "defend", targetIds: [] });
          break;
        }
        const line = await nextLine(c.yellow(`${actor.name} (${actor.id}) ready > `));
        if (line == null) {
          autoAll = true;
          continue;
        }
        const parsed = parseCommand(engine, actor, line);
        if (parsed === "quit") process.exit(0);
        if (parsed === "state") {
          printState(engine);
          continue;
        }
        if (parsed === "autoall") {
          autoAll = true;
          continue;
        }
        const command = parsed === "auto" ? autoCommand(engine, actor) : parsed;
        if (typeof command === "string") {
          console.log(c.red(`  ${command}`));
          continue;
        }
        const res = engine.submit(command);
        if (!res.ok) {
          console.log(c.red(`  rejected: ${res.error}`));
          continue;
        }
        break;
      }
    }
    for (const ev of engine.step()) {
      const text = describe(engine, ev);
      if (text) console.log(text);
    }
  }
  printState(engine);
  console.log(c.dim(`inputs: ${engine.state.inputs.length} · stolen: ${engine.state.stolen.map((id) => getItem(id).name).join(", ") || "—"}`));
  rl?.close();
}

// ── balance ──────────────────────────────────────────────────────────────────
function balanceCmd() {
  const worlds = args.world ? [num("world", 0)] : WORLDS.map((w) => w.index);
  const levels = list("levels", "").map(Number);
  const keys = list("party", "zidane,vivi,steiner");
  const n = num("n", 30);
  for (const wi of worlds) {
    const w = WORLDS[wi]!;
    const lvls = levels.length ? levels : [[2, 4, 7], [8, 12, 16], [16, 20, 26]][wi] ?? [5];
    console.log(c.bold(`\n${w.name} — party ${keys.join("/")}, ${n} fights each`));
    const groups: [string, string[]][] = [
      ...w.encounters.map((g): [string, string[]] => ["battle", g]),
      ...w.elites.map((g): [string, string[]] => ["elite", g]),
      ["boss", w.boss],
    ];
    console.log(c.dim(`${"encounter".padEnd(34)} ${lvls.map((l) => `Lv${l}`.padStart(16)).join("")}`));
    for (const [kind, g] of groups) {
      const cells = lvls.map((lv) => {
        let wins = 0;
        let secs = 0;
        for (let i = 0; i < n; i++) {
          const party = keys.map((k, j) => {
            const b = newBuild(k, lv);
            return partyUnit({ ...b, equipment: starterGear(b) }, j);
          });
          // FF9 scenes roll their group like a real run would (same party-size cap).
          const cap = keys.length <= 1 ? 1 : keys.length + 1;
          const rolled = g.map((t) => (isSceneRef(t) && !t.includes("#") ? rollSceneGroup(Rng.fromSeed(`bal:${i}`), t, kind === "boss" ? 8 : cap) : t));
          const enc = encounterUnits(rolled, 0);
          const st = autoBattle(new BattleEngine(createBattle({ seed: 7000 + i, party, enemies: enc.units, inventory: potions(), ...(enc.scene ? { scene: enc.scene } : {}) }))).state;
          if (st.outcome === "victory") wins++;
          secs += st.tick / TICKS_PER_SECOND;
        }
        const pct = (wins / n) * 100;
        const txt = `${pct.toFixed(0)}% ${(secs / n).toFixed(0)}s`.padStart(16);
        return pct >= 80 ? c.green(txt) : pct >= 40 ? c.yellow(txt) : c.red(txt);
      });
      console.log(`${`[${kind}] ${encounterNames(g).join(",")}`.padEnd(34)} ${cells.join("")}`);
    }
  }
}

// ── runs ─────────────────────────────────────────────────────────────────────
function playRun(start: RunState, seed: string, log: boolean): RunState {
  let run = start;
  const rng = Rng.fromSeed(`choices:${seed}`);
  const say = (s: string) => log && console.log(s);
  for (let step = 0; step < 600 && run.phase.kind !== "over"; step++) {
    const p = run.phase;
    switch (p.kind) {
      case "map": {
        run = optimizeParty(run);
        const to = rng.pick(getNode(run.map, run.position).next);
        const node = getNode(run.map, to);
        say(c.dim(`${WORLDS[run.world]!.name} col${node.col} → ${node.kind}`));
        run = moveTo(run, to);
        break;
      }
      case "battle": {
        const st: BattleState = autoBattle(new BattleEngine(structuredClone(p.battle))).state;
        say(`   ${p.nodeKind} vs ${p.enemies.join(",")}: ${st.outcome} in ${(st.tick / TICKS_PER_SECOND).toFixed(0)}s · party HP ${st.units.filter((u) => u.side === "party").map((u) => `${u.hp}/${u.maxHp}`).join(" ")}`);
        run = finishBattle(run, st.inputs);
        break;
      }
      case "rewards":
      case "treasure":
        run = claimReward(run, p.gearChoices.length ? 0 : null);
        break;
      case "shop": {
        const idx = p.stock.findIndex((x) => x.itemId === itemByName("Potion").id);
        while (idx >= 0 && run.gil > 300) run = buy(run, idx);
        run = leave(run);
        break;
      }
      case "chocobo":
        while (run.phase.kind === "chocobo" && run.phase.digsLeft > 0) run = dig(run, run.phase.spots.findIndex((_, i) => run.phase.kind === "chocobo" && !run.phase.dug.includes(i)));
        run = leave(run);
        break;
      case "event":
        run = p.result ? leave(run) : chooseEvent(run, 1);
        break;
      case "worldClear":
        say(c.green(`== ${WORLDS[run.world]!.name} cleared ==`));
        run = nextWorld(run);
        break;
      default:
        run = leave(run);
    }
  }
  return run;
}

function runCmd() {
  const profile = newProfile();
  const keys = list("party", "zidane");
  const slots = list("slots", "");
  const party = keys.map((k) => ({ ...profile.builds[k]!, level: num("level", 1), unlockedSlots: slots as never }));
  const seed = args.seed ?? `run-${Date.now()}`;
  const run = playRun(startRun({ seed, tier: num("tier", 0), party, journey: args.journey ?? JOURNEYS[0]!.id }), seed, true);
  const won = run.phase.kind === "over" && run.phase.won;
  console.log(c.bold(`\n${won ? "WON" : "LOST"} in ${WORLDS[run.world]!.name} · ${run.stats.battles} wins · levels ${run.party.map((m) => `${m.build.key}:${m.build.level}`).join(" ")}`));
}

/** Simple CP strategy: unlock Body first, then alternate start level / slots. */
function spendCp(p: Profile): Profile {
  for (const key of p.unlocked) {
    for (;;) {
      const b = p.builds[key]!;
      const cp = b.points ?? 0;
      const slotCost = nextSlotCost(b);
      const nextSlot = UNLOCKABLE_SLOTS.find((s) => !(b.unlockedSlots ?? []).includes(s));
      if (slotCost != null && nextSlot && cp >= slotCost && slotCost <= startLevelCost(b.level) * 2) {
        p = unlockSlot(p, key, nextSlot);
        continue;
      }
      if (cp >= startLevelCost(b.level)) {
        p = raiseStartLevel(p, key);
        continue;
      }
      break;
    }
  }
  return p;
}

function runsCmd() {
  let profile = newProfile();
  const count = num("count", 20);
  const base = args.seed ?? "meta";
  for (let i = 0; i < count; i++) {
    profile = spendCp(profile);
    const keys = profile.unlocked.slice(0, 4);
    const seed = `${base}-${i}`;
    // Next uncleared story journey first, then any uncleared one, else the latest.
    const open = availableJourneys(profile);
    const fresh = open.filter((id) => !(profile.journeysCleared ?? []).includes(id));
    const journey = fresh.find((id) => JOURNEYS.find((j) => j.id === id)?.category === "story") ?? fresh[0] ?? open.at(-1)!;
    const run = playRun(startRun({ seed, tier: 0, party: keys.map((k) => profile.builds[k]!), unlockedGear: profile.gearUnlocked, journey }), seed, false);
    const startLv = keys.map((k) => profile.builds[k]!.level).join("/");
    const peak = Math.max(...run.party.map((m) => m.build.level));
    const rep = applyRunOutcome(profile, runOutcome(run), 0);
    profile = rep.profile;
    const won = run.phase.kind === "over" && run.phase.won;
    console.log(
      `run ${String(i + 1).padStart(2)}: ${keys.join("/").padEnd(28)} start ${startLv.padEnd(12)} peak ${String(peak).padEnd(3)} ${WORLDS[run.world]!.name.padEnd(22)}${won ? c.green(" WON") : "    "} | CP +${Object.values(rep.points).join("/")} | gil ${profile.gil} | slots ${keys.map((k) => 1 + (profile.builds[k]!.unlockedSlots ?? []).length).join("/")}${rep.newlyUnlocked.length ? c.yellow(` | +${rep.newlyUnlocked.join(",")}`) : ""}${rep.achievements.length ? c.cyan(` | 🏆 ${rep.achievements.join(",")}`) : ""}`,
    );
  }
  console.log(c.dim(`\nunlocked gear: ${(profile.gearUnlocked ?? []).length} · achievements: ${(profile.achievements ?? []).length} · items in game: ${items.length}`));
}

switch (cmd) {
  case "battle":
    await battleCmd();
    break;
  case "balance":
    balanceCmd();
    break;
  case "run":
    runCmd();
    break;
  case "runs":
    runsCmd();
    break;
  default:
    console.log((await Bun.file(import.meta.path).text()).split("*/")[0]!.replace(/^#!.*\n\/\*\*\n/, "").replace(/^ \* ?/gm, ""));
}
