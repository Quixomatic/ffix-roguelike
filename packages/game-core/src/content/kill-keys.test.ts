/** Boss kill keys: FF9 bosses by name, kept apart from crossover bosses of the same name. */
import { describe, expect, test } from "bun:test";

import { bestiary } from "@ffix-roguelike/game-data";

import { eventAt, EVENTS } from "../run/events";
import { ff9EnemyId, killKey } from "./ff9-scenes";

const uidOf = (name: string) => bestiary.enemies.findIndex((m) => m.name === name);

describe("kill keys", () => {
  test("FF9's Garland is apart from FF1's; other FF9 bosses keep their names", () => {
    expect(killKey(ff9EnemyId(uidOf("Garland")))).toBe("garland-ff9");
    expect(killKey("garland")).toBe("garland"); // the crossover boss
    expect(killKey(ff9EnemyId(uidOf("Plant Brain")))).toBe("plant-brain");
  });
});

describe("late progression tiers", () => {
  test("every tier up to 5 has events (an event's highest tier reaches every later one)", () => {
    for (let tier = 0; tier <= 5; tier++) expect(EVENTS.filter((e) => eventAt(e, tier)).length).toBeGreaterThan(0);
  });
});
