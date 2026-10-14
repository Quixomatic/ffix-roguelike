import { TRANCE_MAX, type BattleUnit } from "@ffix-roguelike/game-core";

const SHOWN_STATUSES = ["poison", "venom", "blind", "silence", "sleep", "slow", "haste", "regen", "protect", "shell", "float", "berserk", "confuse", "doom", "mini", "reflect", "stop", "zombie"] as const;

export function PartyStatus({ party, activeId, readyIds }: { party: BattleUnit[]; activeId: string | null; readyIds: string[] }) {
  return (
    <div className="ff-window flex-1 p-2 text-base">
      <div className="grid grid-cols-[1fr_auto_auto_7rem] items-center gap-x-4 gap-y-1">
        <div className="ff-title">Name</div>
        <div className="ff-title text-right">HP</div>
        <div className="ff-title text-right">MP</div>
        <div className="ff-title">ATB</div>
        {party.map((u) => {
          const down = u.hp <= 0;
          const low = !down && u.hp < u.maxHp / 4;
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
                {u.hp}
                <span className="text-xs opacity-60">/{u.maxHp}</span>
              </div>
              <div className="text-right tabular-nums">{u.mp}</div>
              <div className="flex flex-col gap-0.5">
                <div className="ff-gauge">
                  <div className="ff-gauge-fill" data-full={u.atb >= u.atbMax} style={{ width: `${(u.atb / u.atbMax) * 100}%` }} />
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

export function EnemyList({ enemies }: { enemies: BattleUnit[] }) {
  return (
    <div className="ff-window w-52 p-2 text-base">
      {enemies
        .filter((u) => u.hp > 0 && u.statuses.death === undefined)
        .map((u) => {
          const pct = Math.min(1, u.atb / u.atbMax);
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
