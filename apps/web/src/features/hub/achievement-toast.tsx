import { achievement, rewardItemIds, type AchievementDef } from "@ffix-roguelike/game-core";
import { getItem } from "@ffix-roguelike/game-data";
import { toast } from "sonner";

import { uiSound } from "@/features/audio/ui-sounds";

import { Badge } from "./badge";

/** What an achievement pays, in a line ("5,000 gil · +3 CP each · unlocks Ribbon"). */
export function achievementRewardText(a: AchievementDef): string {
  const items = rewardItemIds(a);
  return [
    a.reward.gil ? `${a.reward.gil.toLocaleString()} gil` : "",
    a.reward.cp ? `+${a.reward.cp} CP${a.reward.cpFor ? "" : " each"}` : "",
    a.reward.relicSlots ? `+${a.reward.relicSlots} relic slot${a.reward.relicSlots === 1 ? "" : "s"}` : "",
    items.length ? `unlocks ${items.map((id) => getItem(id).name).join(", ")}` : "",
    a.reward.supplies?.length ? `camp supplies: ${a.reward.supplies.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** One achievement's notification: an FF window with its badge, name, what it was for and what it pays. */
function AchievementToast({ a }: { a: AchievementDef }) {
  const reward = achievementRewardText(a);
  return (
    <div className="theme-ff ff-panel flex w-[22rem] items-center gap-3 rounded-md p-3">
      <Badge id={a.badge ?? 1} scale={1} />
      <div className="flex min-w-0 flex-col">
        <span className="ff-title text-[0.65rem] tracking-[0.2em] text-yellow-200">ACHIEVEMENT UNLOCKED</span>
        <span className="ff-display truncate text-lg leading-tight">{a.name}</span>
        <span className="text-xs text-[#c8d0ff]">{a.description}</span>
        {reward && <span className="text-xs text-green-300">{reward}</span>}
      </div>
    </div>
  );
}

/**
 * Show each newly earned achievement as its own notification (separate from the regular toasts: the game's FF window
 * look, the badge), with FF9's unlock sound. Staggered so several don't land at once.
 */
export function showAchievementToasts(ids: readonly string[]) {
  ids.forEach((id, i) => {
    const a = achievement(id);
    if (!a) return;
    setTimeout(() => {
      uiSound("unlock");
      toast.custom(() => <AchievementToast a={a} />, { duration: 7000, unstyled: true });
    }, i * 900);
  });
}
