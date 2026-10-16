import { getBattleAction, isThrowable, type BattleCommand, type BattleEngine, type BattleUnit } from "@ffix-roguelike/game-core";
import { findItem, type TargetType } from "@ffix-roguelike/game-data";
import { useEffect, useMemo, useState } from "react";

import { HelpText, itemEffectText } from "@/features/run/item-info";

type Pending = Omit<BattleCommand, "targetIds"> & {
  label: string;
  targets: TargetType;
  forDead: boolean;
  defaultAlly: boolean;
  /** Double Black / Double White: pick a second spell after this one. */
  double?: { title: string; options: ListOption[] };
};
/** `help`: FF9's help line; `effect`: what an item does exactly (shown under the list for the highlighted option). */
type ListOption = { label: string; sub?: string; disabled?: boolean; pending: Pending; help?: string; effect?: string };

type Menu =
  | { level: "root" }
  | { level: "list"; title: string; options: ListOption[] }
  | { level: "target"; pending: Pending; side: "ally" | "foe" };

interface Props {
  engine: BattleEngine;
  actor: BattleUnit;
  onSubmit(cmd: BattleCommand): void;
  /**
   * Lets the battlefield mark candidate targets, point the glove at the aimed one(s), and route clicks and hovers on
   * units back here.
   */
  onTargeting(ids: string[], pick: ((id: string) => void) | null, aimed: string[], aim: ((id: string) => void) | null): void;
}

const NO_PICK: TargetType[] = ["self", "allAlly", "allEnemy", "everyone", "random", "randomAlly", "randomEnemy", "automatic", "all"];

export function CommandMenu({ engine, actor, onSubmit, onTargeting }: Props) {
  const [menu, setMenu] = useState<Menu>({ level: "root" });
  const [cursor, setCursor] = useState(0);
  /** First half of a Double Black / Double White cast. */
  const [first, setFirst] = useState<{ actionId: number; targetIds: string[]; label: string } | null>(null);

  useEffect(() => {
    setMenu({ level: "root" });
    setCursor(0);
    setFirst(null);
  }, [actor.id]);

  const reset = () => {
    setMenu({ level: "root" });
    setCursor(0);
    setFirst(null);
  };

  const finish = (p: Pending, targetIds: string[]) => {
    onTargeting([], null, [], null);
    if (p.double && !first) {
      // Pick the second spell (MP for both must be available).
      const left = actor.mp - engine.mpCost(actor, getBattleAction(p.actionId!));
      setFirst({ actionId: p.actionId!, targetIds, label: p.label });
      setMenu({
        level: "list",
        title: `${p.double.title} — 2nd`,
        options: p.double.options.map((o) => ({ ...o, disabled: o.disabled || engine.mpCost(actor, getBattleAction(o.pending.actionId!)) > left })),
      });
      setCursor(0);
      return;
    }
    if (first) onSubmit({ actorId: actor.id, kind: "ability", actionId: first.actionId, targetIds: first.targetIds, second: { actionId: p.actionId!, targetIds } });
    else onSubmit({ actorId: actor.id, kind: p.kind, actionId: p.actionId, itemId: p.itemId, targetIds });
    reset();
  };

  const choose = (p: Pending) => {
    if (NO_PICK.includes(p.targets)) return finish(p, []);
    const allyFirst = p.defaultAlly || p.targets.endsWith("Ally");
    setMenu({ level: "target", pending: p, side: allyFirst ? "ally" : "foe" });
    setCursor(0);
  };

  const candidates = useMemo(() => {
    if (menu.level !== "target") return [];
    const { pending, side } = menu;
    const pool = side === "ally" ? engine.allies(actor) : engine.opponents(actor);
    return pool.filter((u) => (pending.forDead ? !u.removed && !u.statuses.jump : engine.isTargetable(u)));
  }, [menu, engine, actor, engine.state.tick]);

  const canAll = menu.level === "target" && menu.pending.targets.startsWith("many");
  const canSwap = menu.level === "target" && (menu.pending.targets.endsWith("Any") || menu.pending.targets === "singleAny");

  useEffect(() => {
    if (menu.level !== "target") {
      onTargeting([], null, [], null);
      return;
    }
    const ids = candidates.map((c) => c.id);
    onTargeting(
      ids,
      (id) => finish(menu.pending, [id]),
      cursor >= candidates.length ? (canAll ? ids : []) : [candidates[cursor]!.id],
      (id) => {
        const i = ids.indexOf(id);
        if (i >= 0) setCursor(i);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, cursor, canAll, candidates.map((c) => c.id).join()]);

  const rootOptions = useMemo(() => {
    const cmds = engine.commandsOf(actor);
    const out: { label: string; disabled?: boolean; run: () => void }[] = [
      {
        label: "Attack",
        run: () => choose({ kind: "attack", label: "Attack", targets: "singleEnemy", forDead: false, defaultAlly: false, actorId: actor.id }),
      },
    ];
    for (const cmd of cmds) {
      if (cmd.id === 15) {
        // Amarant's Throw: weapons from the bag.
        const throwable = engine.state.inventory.filter((s) => s.count > 0 && isThrowable(s.itemId));
        out.push({
          label: cmd.name,
          disabled: !throwable.length,
          run: () => {
            setMenu({
              level: "list",
              title: cmd.name,
              options: throwable.map((s) => {
                const item = findItem(s.itemId)!;
                return {
                  label: item.name,
                  sub: `×${s.count}`,
                  pending: { kind: "throw", itemId: item.id, label: `Throw ${item.name}`, targets: "singleEnemy", forDead: false, defaultAlly: false, actorId: actor.id },
                };
              }),
            });
            setCursor(0);
          },
        });
        continue;
      }
      if (!cmd.actionIds.length) {
        out.push({ label: cmd.name, disabled: true, run: () => {} });
        continue;
      }
      if (cmd.actionIds.length === 1) {
        const a = getBattleAction(cmd.actionIds[0]!);
        out.push({
          label: cmd.name,
          disabled: a.mp > actor.mp,
          run: () => choose({ kind: "ability", actionId: a.id, label: a.name, targets: a.targets, forDead: a.forDead, defaultAlly: a.defaultAlly, actorId: actor.id }),
        });
        continue;
      }
      out.push({
        label: cmd.name,
        run: () => {
          const silenced = actor.statuses.silence !== undefined;
          const options: ListOption[] = cmd.actionIds.map((id) => {
            const a = getBattleAction(id);
            const mp = engine.mpCost(actor, a);
            return {
              label: a.name,
              sub: mp ? `${mp} MP` : "",
              help: a.help,
              disabled: mp > actor.mp || (silenced && engine.isMagical(a)) || (a.scriptId === 63 && !engine.magicSwordReady(actor)),
              pending: { kind: "ability", actionId: a.id, label: a.name, targets: a.targets, forDead: a.forDead, defaultAlly: a.defaultAlly, actorId: actor.id },
            };
          });
          // Double Black (23) / Double White (21): two spells per turn.
          if (cmd.id === 21 || cmd.id === 23) for (const o of options) o.pending.double = { title: cmd.name, options };
          setMenu({ level: "list", title: cmd.name, options });
          setCursor(0);
        },
      });
    }
    const usable = engine.state.inventory.filter((s) => s.count > 0 && findItem(s.itemId)?.effect);
    out.push({
      label: "Item",
      disabled: !usable.length,
      run: () => {
        setMenu({
          level: "list",
          title: "Item",
          options: usable.map((s) => {
            const item = findItem(s.itemId)!;
            const fx = item.effect!;
            return {
              label: item.name,
              sub: `×${s.count}`,
              help: item.help,
              effect: itemEffectText(item),
              pending: { kind: "item", itemId: item.id, label: item.name, targets: fx.targets, forDead: fx.forDead, defaultAlly: true, actorId: actor.id },
            };
          }),
        });
        setCursor(0);
      },
    });
    out.push({ label: "Defend", run: () => finish({ kind: "defend", label: "Defend", targets: "self", forDead: false, defaultAlly: true, actorId: actor.id }, []) });
    out.push({ label: actor.backRow ? "Front Row" : "Back Row", run: () => finish({ kind: "change", label: "Change", targets: "self", forDead: false, defaultAlly: true, actorId: actor.id }, []) });
    if (engine.state.canFlee) out.push({ label: "Flee", run: () => finish({ kind: "flee", label: "Flee", targets: "self", forDead: false, defaultAlly: true, actorId: actor.id }, []) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, engine, engine.state.tick, actor.mp]);

  // Keyboard: arrows move, Enter/Space confirm, Escape/Backspace cancel, Tab swaps side when targeting.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const len = menu.level === "root" ? rootOptions.length : menu.level === "list" ? menu.options.length : candidates.length + (canAll ? 1 : 0);
      if (["ArrowDown", "ArrowRight"].includes(ev.key)) setCursor((c) => (c + 1) % Math.max(1, len));
      else if (["ArrowUp", "ArrowLeft"].includes(ev.key)) setCursor((c) => (c - 1 + len) % Math.max(1, len));
      else if (ev.key === "Escape" || ev.key === "Backspace") {
        reset();
      } else if (ev.key === "Tab" && menu.level === "target" && canSwap) {
        ev.preventDefault();
        setMenu({ ...menu, side: menu.side === "ally" ? "foe" : "ally" });
        setCursor(0);
      } else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (menu.level === "root") {
          const o = rootOptions[cursor];
          if (o && !o.disabled) o.run();
        } else if (menu.level === "list") {
          const o = menu.options[cursor];
          if (o && !o.disabled) choose(o.pending);
        } else if (cursor < candidates.length) finish(menu.pending, [candidates[cursor]!.id]);
        else if (canAll) finish(menu.pending, candidates.map((c) => c.id));
      } else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="ff-window flex min-h-40 w-56 flex-col gap-0.5 p-2 text-lg">
      {menu.level === "root" && (
        <>
          <div className="ff-title">{actor.name}</div>
          {rootOptions.map((o, i) => (
            <button key={o.label} className="ff-option" data-active={i === cursor} disabled={o.disabled} onMouseEnter={() => setCursor(i)} onClick={o.run}>
              {o.label}
            </button>
          ))}
        </>
      )}
      {menu.level === "list" && (
        <>
          <div className="ff-title flex justify-between">
            <span>{menu.title}</span>
            <button className="text-sm opacity-70" onClick={reset}>
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto pr-1">
            {menu.options.map((o, i) => (
              <button
                key={`${o.label}-${i}`}
                className="ff-option flex w-full justify-between"
                data-active={i === cursor}
                disabled={o.disabled}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(o.pending)}
              >
                <span>{o.label}</span>
                <span className="text-sm opacity-80">{o.sub}</span>
              </button>
            ))}
            {!menu.options.length && <div className="opacity-60">Nothing learned yet</div>}
          </div>
          {(menu.options[cursor]?.effect || menu.options[cursor]?.help) && (
            <div className="mt-1 border-t border-white/15 pt-1 text-xs">
              {menu.options[cursor]!.effect && <div className="text-[#c8d0ff]">{menu.options[cursor]!.effect}</div>}
              <HelpText text={menu.options[cursor]!.help} className="opacity-80" />
            </div>
          )}
        </>
      )}
      {menu.level === "target" && (
        <>
          <div className="ff-title flex justify-between">
            <span>{menu.pending.label}</span>
            <button className="text-sm opacity-70" onClick={reset}>
              ✕
            </button>
          </div>
          {candidates.map((u, i) => (
            <button key={u.id} className="ff-option" data-active={i === cursor} onMouseEnter={() => setCursor(i)} onClick={() => finish(menu.pending, [u.id])}>
              {u.name}
            </button>
          ))}
          {canAll && (
            <button
              className="ff-option"
              data-active={cursor === candidates.length}
              onMouseEnter={() => setCursor(candidates.length)}
              onClick={() => finish(menu.pending, candidates.map((c) => c.id))}
            >
              All
            </button>
          )}
          {canSwap && (
            <button className="mt-1 text-sm opacity-80" onClick={() => setMenu({ ...menu, side: menu.side === "ally" ? "foe" : "ally" })}>
              ⇄ {menu.side === "ally" ? "Target enemies" : "Target allies"} (Tab)
            </button>
          )}
        </>
      )}
    </div>
  );
}
