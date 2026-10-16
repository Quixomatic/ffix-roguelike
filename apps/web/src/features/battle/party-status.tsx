import { isShownUnit, TRANCE_MAX, type BattleUnit } from "@ffix-roguelike/game-core";

const SHOWN_STATUSES = ["poison", "venom", "blind", "silence", "sleep", "slow", "haste", "regen", "protect", "shell", "float", "berserk", "confuse", "doom", "mini", "reflect", "stop", "zombie"] as const;

/** HP/ATB last shown per hero, held while an effect is on its way (the engine has already applied the damage). */
const lastShown = new Map<string, { hp: number; atb: number }>();

export function PartyStatus({
  party,
  activeId,
  readyIds,
  incoming = () => false,
}: {
  party: BattleUnit[];
  activeId: string | null;
  readyIds: string[];
  incoming?: (id: string) => boolean;
}) {
  return (
    <div className="ff-window flex-1 p-2 text-base">
      <div className="grid grid-cols-[1fr_auto_auto_7rem] items-center gap-x-4 gap-y-1">
        <div className="ff-title">Name</div>
        <div className="ff-title text-right">HP</div>
        <div className="ff-title text-right">MP</div>
        <div className="ff-title">ATB</div>
        {party.map((u) => {
          if (!incoming(u.id)) lastShown.set(u.id, { hp: u.hp, atb: u.atb });
          const { hp, atb } = lastShown.get(u.id) ?? { hp: u.hp, atb: u.atb };
          const down = hp <= 0;
          const low = !down && hp < u.maxHp / 4;
          const trance = u.statuses.trance !== undefined;
          const statuses = SHOWN_STATUSES.filter((s) => u.statuses[s] !== undefined);
          return (
            <div key={u.id} className="contents">
              <div className={`flex items-center gap-1 truncate ${u.id === activeId ? "text-yellow-200" : ""}`}>
                {u.id === activeId ? "▶" : readyIds.includes(u.id) ? "•" : " "}
                <span>{u.name}</span>
                {statuses.length > 0 && <span className="truncate text-xs text-pink-200">{statuses.join(" ")}</span>}
              </div>
              <div className={`text-right tabular-nums ${down ? "text-red-400" : low ? "text-yellow-300" : ""}`}>
                {hp}
                <span className="text-xs opacity-60">/{u.maxHp}</span>
              </div>
              <div className="text-right tabular-nums">{u.mp}</div>
              <div className="flex flex-col gap-0.5">
                <div className="ff-gauge">
                  <div className="ff-gauge-fill" data-full={atb >= u.atbMax} style={{ width: `${(atb / u.atbMax) * 100}%` }} />
                </div>
                {u.tranceCommands.length > 0 && (
                  <div className="ff-gauge h-1">
                    <div className="ff-gauge-fill ff-trance" data-active={trance} style={{ width: `${(u.trance / TRANCE_MAX) * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ATB fill last shown per enemy, held while an effect is on its way (the engine zeroes a fallen unit's gauge). */
const lastAtb = new Map<string, number>();

/**
 * Enemies still standing with their ATB gauges. A unit an effect hasn't hit yet (`incoming`) stays listed as it was
 * until the hit lands.
 */
export function EnemyList({ enemies, incoming = () => false }: { enemies: BattleUnit[]; incoming?: (id: string) => boolean }) {
  const shown = enemies.filter((u) => isShownUnit(u) && ((u.hp > 0 && u.statuses.death === undefined) || incoming(u.id)));
  return (
    <div className="ff-window w-52 p-2 text-base">
      {!shown.length && <div className="py-0.5 opacity-60">No enemies left</div>}
      {shown
        .map((u) => {
          if (!incoming(u.id)) lastAtb.set(u.id, Math.min(1, u.atb / u.atbMax));
          const pct = lastAtb.get(u.id) ?? 0;
          return (
            <div key={u.id} className="flex flex-col gap-0.5 py-0.5">
              <span className="truncate">{u.name}</span>
              <div className="ff-gauge h-1.5">
                <div
                  className="ff-gauge-fill"
                  style={{ width: `${pct * 100}%`, background: pct > 0.8 ? "linear-gradient(90deg,#ff8a3a,#ff3030)" : "linear-gradient(90deg,#c86a2a,#ff8a3a)" }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
