import { getBattleAction, type BattleCommand, type BattleEngine, type BattleUnit } from "@ffix-roguelike/game-core";
import { findItem, type TargetType } from "@ffix-roguelike/game-data";
import { useEffect, useMemo, useState } from "react";

type Pending = Omit<BattleCommand, "targetIds"> & { label: string; targets: TargetType; forDead: boolean; defaultAlly: boolean };

type Menu =
  | { level: "root" }
  | { level: "list"; title: string; options: { label: string; sub?: string; disabled?: boolean; pending: Pending }[] }
  | { level: "target"; pending: Pending; side: "ally" | "foe" };

interface Props {
  engine: BattleEngine;
  actor: BattleUnit;
  onSubmit(cmd: BattleCommand): void;
  /** Lets the battlefield highlight candidate targets and route clicks back here. */
  onTargeting(ids: string[], pick: ((id: string) => void) | null): void;
}

const NO_PICK: TargetType[] = ["self", "allAlly", "allEnemy", "everyone", "random", "randomAlly", "randomEnemy", "automatic", "all"];

export function CommandMenu({ engine, actor, onSubmit, onTargeting }: Props) {
  const [menu, setMenu] = useState<Menu>({ level: "root" });
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    setMenu({ level: "root" });
    setCursor(0);
  }, [actor.id]);

  const finish = (p: Pending, targetIds: string[]) => {
    onTargeting([], null);
    onSubmit({ actorId: actor.id, kind: p.kind, actionId: p.actionId, itemId: p.itemId, targetIds });
    setMenu({ level: "root" });
    setCursor(0);
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
    return pool.filter((u) => (pending.forDead ? true : engine.isActive(u)));
  }, [menu, engine, actor, engine.state.tick]);

  const canAll = menu.level === "target" && menu.pending.targets.startsWith("many");
  const canSwap = menu.level === "target" && (menu.pending.targets.endsWith("Any") || menu.pending.targets === "singleAny");

  useEffect(() => {
    if (menu.level !== "target") {
      onTargeting([], null);
      return;
    }
    onTargeting(
      candidates.map((c) => c.id),
      (id) => finish(menu.pending, [id]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, candidates.map((c) => c.id).join()]);

  const rootOptions = useMemo(() => {
    const cmds = engine.commandsOf(actor);
    const out: { label: string; disabled?: boolean; run: () => void }[] = [
      {
        label: "Attack",
        run: () => choose({ kind: "attack", label: "Attack", targets: "singleEnemy", forDead: false, defaultAlly: false, actorId: actor.id }),
      },
    ];
    for (const cmd of cmds) {
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
          setMenu({
            level: "list",
            title: cmd.name,
            options: cmd.actionIds.map((id) => {
              const a = getBattleAction(id);
              const mp = engine.mpCost(actor, a);
              return {
                label: a.name,
                sub: mp ? `${mp} MP` : "",
                disabled: mp > actor.mp || (silenced && engine.isMagical(a)),
                pending: { kind: "ability", actionId: a.id, label: a.name, targets: a.targets, forDead: a.forDead, defaultAlly: a.defaultAlly, actorId: actor.id },
              };
            }),
          });
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
        setMenu({ level: "root" });
        setCursor(0);
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
            <button className="text-sm opacity-70" onClick={() => setMenu({ level: "root" })}>
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
        </>
      )}
      {menu.level === "target" && (
        <>
          <div className="ff-title flex justify-between">
            <span>{menu.pending.label}</span>
            <button className="text-sm opacity-70" onClick={() => setMenu({ level: "root" })}>
              ✕
            </button>
          </div>
          {candidates.map((u, i) => (
            <button key={u.id} className="ff-option" data-active={i === cursor} onMouseEnter={() => setCursor(i)} onClick={() => finish(menu.pending, [u.id])}>
              {u.name}
            </button>
          ))}
          {canAll && (
            <button className="ff-option" data-active={cursor === candidates.length} onClick={() => finish(menu.pending, candidates.map((c) => c.id))}>
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
