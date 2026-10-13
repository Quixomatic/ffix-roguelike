import { expForLevel, levelForExp, type MemberProgress, type RewardSummary } from "@ffix-roguelike/game-core";
import { abilityName, getCharacter, MAX_LEVEL } from "@ffix-roguelike/game-data";
import type { ReactNode } from "react";

import { itemName } from "@/features/run/item-info";
import { HeroSprite } from "@/features/sprites/hero-sprite";

import { useTween } from "./use-tween";

const BAR_MS = 1600;
const BAR_DELAY = 500;

/**
 * FF9-style battle results: the party lined up with EXP bars filling (LEVEL UP! as they cross a level),
 * AP filling toward each ability on their gear ("Learned!"), gil counting up and the spoils listed.
 */
export function VictoryScreen({ title, summary, children }: { title: string; summary: RewardSummary; children?: ReactNode }) {
  const gil = useTween(0, summary.gil, 1000, 300);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <div className="ff-window flex items-baseline justify-between px-5 py-3">
        <span className="ff-pop text-3xl">{title}</span>
        <span className="flex gap-6 text-lg">
          <span>EXP {summary.exp}</span>
          <span>AP {summary.ap}</span>
          <span className="tabular-nums text-yellow-200">+{Math.round(gil)} gil</span>
        </span>
      </div>

      <div className="flex flex-wrap justify-center gap-3 [&>*]:w-56">
        {summary.members.map((m, i) => (
          <MemberCard key={m.key} member={m} delay={BAR_DELAY + i * 150} />
        ))}
      </div>

      {summary.items.length > 0 && (
        <div className="ff-window flex flex-wrap items-center gap-2 px-4 py-2">
          <span className="ff-title">Spoils</span>
          {summary.items.map((id, i) => (
            <span key={i} className="ff-pop rounded border border-yellow-200/40 bg-black/20 px-2 py-0.5 text-sm" style={{ animationDelay: `${300 + i * 120}ms` }}>
              {itemName(id)}
            </span>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

function MemberCard({ member: m, delay }: { member: MemberProgress; delay: number }) {
  const exp = useTween(m.expBefore, m.expAfter, BAR_MS, delay);
  const level = Math.min(MAX_LEVEL, levelForExp(Math.floor(exp)));
  const lo = expForLevel(level);
  const hi = level >= MAX_LEVEL ? lo + 1 : expForLevel(level + 1);
  const pct = Math.max(0, Math.min(1, (exp - lo) / Math.max(1, hi - lo)));
  const leveled = level > m.levelBefore;
  const name = getCharacter(m.key).name;

  return (
    <div className="ff-window flex flex-col gap-2 p-3">
      <div className="flex items-end gap-3">
        <div className={`relative ${leveled ? "ff-hop" : ""}`} key={leveled ? `lv${level}` : "idle"}>
          <HeroSprite heroKey={m.key} size={72} ko={!m.alive} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg">{name}</div>
          <div className="ff-title">
            Lv {level}
            {leveled && <span className="ml-2 text-yellow-200">↑</span>}
          </div>
        </div>
      </div>

      {leveled ? (
        <div key={`up${level}`} className="ff-pop text-center text-lg text-yellow-200 [text-shadow:0_0_8px_#ffe066]">
          LEVEL UP!
        </div>
      ) : (
        <div className="h-7" />
      )}

      <div>
        <div className="flex justify-between text-xs opacity-80">
          <span>EXP</span>
          <span className="tabular-nums">{m.alive ? `${Math.max(0, hi - Math.floor(exp))} to next` : "KO — no EXP"}</span>
        </div>
        <div className="ff-gauge h-2.5">
          <div className="ff-gauge-fill" style={{ width: `${pct * 100}%`, background: "linear-gradient(90deg,#3a8ad8,#9ad0ff)" }} />
        </div>
      </div>

      {m.ap.slice(0, 4).map((a, i) => (
        <ApBar key={a.ref} ap={a} delay={delay + 300 + i * 120} />
      ))}
      {m.alive && !m.ap.length && <div className="text-xs opacity-50">No abilities to learn on current gear</div>}
    </div>
  );
}

function ApBar({ ap, delay }: { ap: MemberProgress["ap"][number]; delay: number }) {
  const v = useTween(ap.before, ap.after, BAR_MS, delay);
  const learned = v >= ap.cost;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="truncate">{abilityName(ap.ref)}</span>
        {learned ? (
          <span className="ff-pop text-pink-200">Learned!</span>
        ) : (
          <span className="tabular-nums opacity-80">
            {Math.floor(v)}/{ap.cost}
          </span>
        )}
      </div>
      <div className="ff-gauge h-1.5">
        <div
          className="ff-gauge-fill"
          style={{ width: `${(Math.min(v, ap.cost) / ap.cost) * 100}%`, background: learned ? "linear-gradient(90deg,#ff70c0,#ffd0f0)" : "linear-gradient(90deg,#b0306a,#ff70c0)" }}
        />
      </div>
    </div>
  );
}
