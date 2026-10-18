import { describe, expect, test } from "bun:test";

import { itemByName } from "@ffix-roguelike/game-data";

import { record } from "../metrics/collect";
import { achievement, achievementMet, achievementProgress, achievements, awardAchievements, legendaryItems, type AchievementDef } from "./achievements";
import { newProfile } from "./profile";

describe("achievements (from the achievement table)", () => {
  test("the seeded table is loaded, in category order", () => {
    const all = achievements();
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(all[0]!.category).toBe("story");
    expect(achievement("veteran")?.condition).toEqual({ kind: "stat", stat: "battles", min: 100 });
  });

  test("conditions are data: stats, journeys, bosses, roster, heroes", () => {
    const p = newProfile();
    expect(achievementMet(achievement("veteran")!, p)).toBe(false);
    p.stats.battles = 100;
    expect(achievementMet(achievement("veteran")!, p)).toBe(true);
    expect(achievementMet(achievement("story-evil-forest")!, p)).toBe(false);
    p.journeysCleared = ["evil-forest"];
    expect(achievementMet(achievement("story-evil-forest")!, p)).toBe(true);
    p.stats.bossKills.garland = 1;
    expect(achievementMet(achievement("boss-garland")!, p)).toBe(true);
    p.unlocked = ["zidane", "vivi", "steiner", "garnet"];
    expect(achievementMet(achievement("fellowship")!, p)).toBe(true);
    expect(achievementMet(achievement("all-together")!, p)).toBe(false);
  });

  test("counting conditions give progress; yes / no ones and counts of one don't", () => {
    const p = newProfile();
    p.stats.battles = 37;
    expect(achievementProgress(achievement("veteran")!, p)).toEqual({ have: 37, need: 100 });
    p.stats.battles = 500;
    expect(achievementProgress(achievement("veteran")!, p)).toEqual({ have: 100, need: 100 });
    p.unlocked = ["zidane", "vivi"];
    expect(achievementProgress(achievement("all-together")!, p)).toEqual({ have: 2, need: 8 });
    expect(achievementProgress(achievement("story-dali")!, p)).toBeNull();
    expect(achievementProgress(achievement("first-victory")!, p)).toBeNull();
  });

  test("metric conditions: the player, any one character, a given one, a subject", () => {
    const p = newProfile();
    p.metrics = {};
    record(p.metrics, "enemies.killed", 60, { character: "zidane", subject: "goblin" });
    record(p.metrics, "enemies.killed", 50, { character: "vivi" });
    const a = (condition: AchievementDef["condition"]): AchievementDef => ({ id: "t", name: "t", description: "", category: "milestone", sort: 0, enabled: true, condition, reward: {} });
    expect(achievementMet(a({ kind: "metric", metric: "enemies.killed", min: 100 }), p)).toBe(true); // 110 total
    expect(achievementMet(a({ kind: "metric", metric: "enemies.killed", character: "any", min: 100 }), p)).toBe(false); // best is 60
    expect(achievementProgress(a({ kind: "metric", metric: "enemies.killed", character: "any", min: 100 }), p)).toEqual({ have: 60, need: 100 });
    expect(achievementMet(a({ kind: "metric", metric: "enemies.killed", character: "vivi", min: 50 }), p)).toBe(true);
    expect(achievementMet(a({ kind: "metric", metric: "enemies.killed", subject: "goblin", min: 60 }), p)).toBe(true);
    expect(achievementMet(a({ kind: "metric", metric: "enemies.killed", subject: "goblin", character: "vivi", min: 1 }), p)).toBe(false);
  });

  test("awarding pays once and unlocks legendary gear", () => {
    const p = newProfile();
    p.stats.bossKills.ozma = 1;
    const gil = p.gil;
    expect(awardAchievements(p)).toContain("legend-ozma");
    expect(p.gearUnlocked).toContain(itemByName("Ultima Weapon").id);
    expect(awardAchievements(p)).not.toContain("legend-ozma");
    expect(p.gil).toBeGreaterThanOrEqual(gil);
    expect(legendaryItems().has(itemByName("Ultima Weapon").id)).toBe(true);
  });
});
