import { ACHIEVEMENTS, rewardItemIds, type AchievementCategory } from "@ffix-roguelike/game-core";
import { useQuery } from "@tanstack/react-query";

import { itemName } from "@/features/run/item-info";
import { trpc } from "@/utils/trpc";

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  milestone: "Milestones",
  boss: "Bosses",
  challenge: "Challenges",
  legend: "Legends",
};

/** Every achievement: earned ones lit with their reward; secret legends stay "???" until earned. */
export function AchievementsPage() {
  const profile = useQuery(trpc.profile.get.queryOptions());
  if (profile.isPending) return <div className="p-6">Loading…</div>;
  const earned = new Set(profile.data?.achievements ?? []);
  const total = ACHIEVEMENTS.length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <div className="ff-window flex items-baseline justify-between px-5 py-3">
        <div className="text-2xl">Achievements</div>
        <div className="text-lg">
          {earned.size}/{total}
        </div>
      </div>
      {(Object.keys(CATEGORY_LABEL) as AchievementCategory[]).map((cat) => (
        <div key={cat} className="flex flex-col gap-2">
          <div className="ff-title px-1 text-base">{CATEGORY_LABEL[cat]}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
              const done = earned.has(a.id);
              const hidden = a.secret && !done;
              const items = rewardItemIds(a);
              return (
                <div key={a.id} className={`ff-window flex flex-col gap-1 p-3 ${done ? "" : "opacity-60"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg">{hidden ? "???" : a.name}</span>
                    <span className="text-xl">{done ? "🏆" : "·"}</span>
                  </div>
                  <div className="text-sm">{hidden ? "A legend yet untold." : a.description}</div>
                  <div className="text-xs text-yellow-200">
                    {[
                      a.reward.gil ? `${a.reward.gil.toLocaleString()} gil` : "",
                      a.reward.cp ? `+${a.reward.cp} CP${a.reward.cpFor ? "" : " each"}` : "",
                      items.length ? (hidden ? "Unlocks legendary gear" : `Unlocks ${items.map(itemName).join(", ")}`) : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
