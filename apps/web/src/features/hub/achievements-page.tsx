import { ACHIEVEMENTS, rewardItemIds, type AchievementCategory, type AchievementDef, type Profile } from "@ffix-roguelike/game-core";
import { useQuery } from "@tanstack/react-query";

import { PixelIcon } from "@/components/pixel-icon";
import { FocusItem } from "@/features/input/focus";
import { itemName } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  story: "Story",
  milestone: "Milestones",
  boss: "Bosses",
  challenge: "Challenges",
  legend: "Legends",
};

/** An FF gauge (the battle's ATB look), full = white-gold. */
function Gauge({ have, need, className = "" }: { have: number; need: number; className?: string }) {
  const pct = need ? Math.min(100, (have / need) * 100) : 0;
  return (
    <div className={`ff-gauge ${className}`}>
      <div className="ff-gauge-fill" data-full={have >= need} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Every achievement, by category: each category with how many are earned (and a bar), each achievement with its
 * reward, and — for ones that count toward a number — a progress bar. Secret legends stay "???" until earned.
 */
export function AchievementsPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (profile.isPending) return <div className="p-6">Loading…</div>;
  const p = (profile.data ?? null) as Profile | null;
  const earned = new Set(p?.achievements ?? []);
  const total = ACHIEVEMENTS.length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-24 pt-6">
      <div className="ff-window flex flex-col gap-2 px-5 py-3">
        <div className="flex items-baseline justify-between">
          <div className="ff-display text-3xl">Achievements</div>
          <div className="text-lg">
            <span className="text-yellow-200">{earned.size}</span> / {total}
          </div>
        </div>
        <Gauge have={earned.size} need={total} className="h-2.5" />
      </div>
      {(Object.keys(CATEGORY_LABEL) as AchievementCategory[]).map((cat) => {
        const list = ACHIEVEMENTS.filter((a) => a.category === cat);
        const done = list.filter((a) => earned.has(a.id)).length;
        return (
          <section key={cat} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="ff-display text-2xl">{CATEGORY_LABEL[cat]}</span>
              <span className="text-sm opacity-80">
                <span className="text-yellow-200">{done}</span> / {list.length}
              </span>
              <Gauge have={done} need={list.length} className="w-40 shrink-0" />
              <span className="h-px flex-1 bg-white/20" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => (
                <AchievementCard key={a.id} a={a} done={earned.has(a.id)} profile={p} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AchievementCard({ a, done, profile }: { a: AchievementDef; done: boolean; profile: Profile | null }) {
  const hidden = a.secret && !done;
  const items = rewardItemIds(a);
  // How far along (only for ones that count toward a number, not yet earned, and not a hidden secret).
  const progress = !done && !hidden && profile && a.progress ? a.progress(profile) : null;
  const reward = [
    a.reward.gil ? `${a.reward.gil.toLocaleString()} gil` : "",
    a.reward.cp ? `+${a.reward.cp} CP${a.reward.cpFor ? "" : " each"}` : "",
    items.length ? (hidden ? "Unlocks legendary gear" : `Unlocks ${items.map(itemName).join(", ")}`) : "",
    a.reward.supplies?.length ? `Camp supplies: ${a.reward.supplies.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    // A cursor stop (keyboard / controller), so the cursor can walk the grid and scroll the page with it.
    <FocusItem>
      <button type="button" data-sound="none" className={`ff-window flex cursor-default flex-col gap-1 p-3 text-left ${done ? "" : "opacity-70"}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-lg">{hidden ? "???" : a.name}</span>
          {done ? <PixelIcon name="check" label="Earned" className="mt-1 shrink-0" /> : hidden && <PixelIcon name="lock" label="Secret" className="mt-1 shrink-0 opacity-80" />}
        </div>
        <div className="text-sm">{hidden ? "A legend yet untold." : a.description}</div>
        {progress && (
          <div className="flex items-center gap-2">
            <Gauge have={progress.have} need={progress.need} className="flex-1" />
            <span className="shrink-0 text-xs tabular-nums opacity-90">
              {progress.have.toLocaleString()} / {progress.need.toLocaleString()}
            </span>
          </div>
        )}
        {reward && <div className="text-xs text-yellow-200">{reward}</div>}
      </button>
    </FocusItem>
  );
}
