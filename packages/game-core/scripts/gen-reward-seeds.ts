/**
 * Writes the default reward / gear-availability seed files (packages/db/seed/rewards) — the starting point the admin
 * page tunes. Gear availability is derived from the rules as they were before the table existed (map pools = each
 * area's FF9 shop stock, catalog = priced gear in no map pool, legendary = achievement gear), so seeding it changes
 * nothing in game. Rarities, roles, sources and boons are first guesses (see .plans/rewards.md).
 *
 * Refuses to overwrite an existing file unless --force (the files may hold tuning exported from the admin page).
 * Run: bun packages/game-core/scripts/gen-reward-seeds.ts [--force] [file…]
 *   (files: rarities roles sources boons gear starter achievements)
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REWARD_CACHE_DIR, REWARD_SEED_FILES, loadGameDataCache } from "@ffix-roguelike/game-data/cache";
import type {
  AchievementCategory,
  AchievementCondition,
  AchievementData,
  GearAvailability,
  RarityId,
  RewardBoon,
  RewardRarity,
  RewardRole,
  RewardSource,
  StarterUpgrade,
} from "@ffix-roguelike/game-data";
import { characters, items, MAIN_CAST } from "@ffix-roguelike/game-data";

import { rewardItemIds } from "../src/meta/achievements";
import { WORLDS } from "../src/content/worlds";
import { effectivePrice, isGear } from "../src/run/loot";
import { shops } from "@ffix-roguelike/game-data";

loadGameDataCache();

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const amounts = (c: number, u: number, r: number, e: number, l: number): Record<RarityId, number> => ({ common: c, uncommon: u, rare: r, epic: e, legendary: l });

const rarities: RewardRarity[] = [
  { id: "common", name: "Common", color: "#e8e8f4", sort: 0, apSurge: 5, gil: 150, supplies: 1, nextBand: 0, bandSteps: 0 },
  { id: "uncommon", name: "Uncommon", color: "#6ee07a", sort: 1, apSurge: 10, gil: 300, supplies: 2, nextBand: 10, bandSteps: 1 },
  { id: "rare", name: "Rare", color: "#5aa0ff", sort: 2, apSurge: 15, gil: 500, supplies: 3, nextBand: 25, bandSteps: 1 },
  { id: "epic", name: "Epic", color: "#c07aff", sort: 3, apSurge: 25, gil: 800, supplies: 4, nextBand: 60, bandSteps: 2 },
  { id: "legendary", name: "Legendary", color: "#ffd34a", sort: 4, apSurge: 40, gil: 1500, supplies: 6, nextBand: 100, bandSteps: 3 },
];

// Stat weights per point of change. HP / MP changes are in the tens to hundreds, so they weigh little per point.
const fighter = { strength: 3, attack: 3, speed: 2, defence: 1.5, evade: 1, magicDefence: 1, maxHp: 0.06, gemsMax: 0.5 };
const mage = { magic: 4, spirit: 2, speed: 2, magicDefence: 2, magicEvade: 1.5, defence: 1, maxMp: 0.15, maxHp: 0.05, gemsMax: 0.5 };
const healer = { magic: 3, spirit: 3, speed: 2, magicDefence: 2, magicEvade: 1.5, defence: 1, maxMp: 0.15, maxHp: 0.05, gemsMax: 0.5 };
const roles: RewardRole[] = [
  { key: "zidane", weights: { ...fighter, speed: 4, evade: 2 }, abilityWeight: 6, preferredAbilities: [], notes: "Thief: speed, strength, evade" },
  { key: "vivi", weights: mage, abilityWeight: 8, preferredAbilities: [], notes: "Black mage: magic first" },
  { key: "garnet", weights: healer, abilityWeight: 8, preferredAbilities: [], notes: "White magic and summons" },
  { key: "steiner", weights: { ...fighter, strength: 4, defence: 2.5, maxHp: 0.08, speed: 1.5 }, abilityWeight: 6, preferredAbilities: [], notes: "Knight: strength, defence, HP" },
  { key: "freya", weights: { ...fighter, speed: 2.5 }, abilityWeight: 6, preferredAbilities: [], notes: "Dragoon" },
  { key: "quina", weights: { magic: 3, strength: 2, spirit: 1.5, defence: 1.5, magicDefence: 1.5, maxHp: 0.08, gemsMax: 0.5 }, abilityWeight: 6, preferredAbilities: [], notes: "Blue mage: magic and bulk" },
  { key: "eiko", weights: healer, abilityWeight: 8, preferredAbilities: [], notes: "White magic and summons" },
  { key: "amarant", weights: { ...fighter, speed: 3, evade: 2, spirit: 1.5 }, abilityWeight: 6, preferredAbilities: [], notes: "Monk: speed, strength" },
  { key: "beatrix", weights: { ...fighter, strength: 3.5, defence: 2, magic: 1.5 }, abilityWeight: 6, preferredAbilities: [], notes: "Holy knight" },
  { key: "blank", weights: { ...fighter, speed: 3 }, abilityWeight: 6, preferredAbilities: [], notes: "Thief / fighter" },
  { key: "marcus", weights: fighter, abilityWeight: 6, preferredAbilities: [], notes: "Fighter" },
  { key: "cinna", weights: fighter, abilityWeight: 6, preferredAbilities: [], notes: "Fighter" },
];

const rarityWeights = amounts;
const sources: RewardSource[] = [
  { id: "surprise", cards: 2, chance: 3, rarityWeights: rarityWeights(0, 55, 30, 12, 3), typeWeights: { gear: 3, boon: 3, ap: 2, supplies: 1, gil: 1 }, upgradeThreshold: 2, guarantee: "none", minRarity: "uncommon", skipGil: 50 },
  { id: "elite", cards: 3, rarityWeights: rarityWeights(50, 30, 14, 5, 1), typeWeights: { gear: 4, boon: 3, ap: 2, supplies: 1, gil: 1 }, upgradeThreshold: 2, guarantee: "oneGear", minRarity: "common", skipGil: 100 },
  { id: "treasure", cards: 2, rarityWeights: rarityWeights(55, 28, 12, 4, 1), typeWeights: { gear: 3, boon: 2, ap: 1, supplies: 2, gil: 1 }, upgradeThreshold: 1.5, guarantee: "none", minRarity: "common", skipGil: 80 },
  { id: "semiboss", cards: 3, rarityWeights: rarityWeights(0, 0, 70, 25, 5), typeWeights: { gear: 1, boon: 0, ap: 0, supplies: 0, gil: 0 }, upgradeThreshold: 4, guarantee: "allGear", minRarity: "rare", skipGil: 200 },
  { id: "boss", cards: 3, rarityWeights: rarityWeights(0, 0, 60, 32, 8), typeWeights: { gear: 1, boon: 0, ap: 0, supplies: 0, gil: 0 }, upgradeThreshold: 5, guarantee: "allGear", minRarity: "rare", skipGil: 300 },
];

const boon = (id: string, name: string, description: string, stat: RewardBoon["stat"], a: Partial<Record<RarityId, number>>, extra: Partial<RewardBoon> = {}): RewardBoon => ({
  id,
  name,
  description,
  enabled: true,
  scope: "member",
  stat,
  amounts: a,
  weight: 1,
  minTier: 0,
  ...extra,
});
const boons: RewardBoon[] = [
  boon("thiefs-vigor", "Thief's Vigor", "Strength for the rest of the run.", "strength", amounts(1, 2, 3, 5, 10), { affinity: ["zidane", "blank", "amarant", "steiner", "freya", "beatrix"] }),
  boon("black-mages-focus", "Black Mage's Focus", "Magic for the rest of the run.", "magic", amounts(1, 2, 3, 5, 10), { affinity: ["vivi", "quina", "garnet", "eiko"] }),
  boon("summoners-calm", "Summoner's Calm", "Spirit for the rest of the run.", "spirit", amounts(1, 2, 3, 5, 10), { affinity: ["garnet", "eiko", "amarant"] }),
  boon("winds-step", "Wind's Step", "Speed for the rest of the run.", "speed", amounts(1, 1, 2, 3, 5)),
  boon("dragons-edge", "Dragon's Edge", "Attack for the rest of the run.", "attack", amounts(2, 3, 5, 8, 15), { affinity: ["freya", "zidane", "steiner"] }),
  boon("knights-bulwark", "Knight's Bulwark", "Defence for the rest of the run.", "defence", amounts(1, 2, 3, 5, 8), { affinity: ["steiner", "beatrix"] }),
  boon("mirage-veil", "Mirage Veil", "Evade for the rest of the run.", "evade", amounts(2, 3, 5, 8, 12)),
  boon("mystic-ward", "Mystic Ward", "Magic defence for the rest of the run.", "magicDefence", amounts(1, 2, 3, 5, 8)),
  boon("elusive-mind", "Elusive Mind", "Magic evade for the rest of the run.", "magicEvade", amounts(2, 3, 5, 8, 12)),
  boon("vital-spring", "Vital Spring", "Max HP (%) for the rest of the run.", "maxHpPct", amounts(5, 8, 12, 18, 30)),
  boon("ether-spring", "Ether Spring", "Max MP (%) for the rest of the run.", "maxMpPct", amounts(5, 8, 12, 18, 30), { affinity: ["vivi", "garnet", "eiko", "quina"] }),
  boon("burst-of-growth", "Burst of Growth", "Real level-ups (FF9's growth and all).", "levels", amounts(1, 1, 2, 3, 5), { weight: 0.8 }),
  boon("moogle-blessing", "Moogle Blessing", "Max HP (%) for the whole party, for the rest of the run.", "maxHpPct", { uncommon: 3, rare: 5, epic: 8, legendary: 12 }, { scope: "party", weight: 0.5 }),
  boon("party-training", "Party Training", "Level-ups for the whole party.", "levels", { rare: 1, epic: 1, legendary: 2 }, { scope: "party", weight: 0.4 }),
];

// Gear availability: exactly the rules the game used before the table (so seeding changes nothing).
// Achievements (the definitions that lived in game-core/meta/achievements.ts until they moved to the table), with
// their conditions as data. Order within a category is the order here.
type Ach = Omit<AchievementData, "sort" | "enabled">;
const ach = (
  id: string,
  name: string,
  description: string,
  category: AchievementCategory,
  condition: AchievementCondition,
  reward: AchievementData["reward"],
  secret?: boolean,
): Ach => ({ id, name, description, category, condition, reward, ...(secret ? { secret } : {}) });
const MAIN_HEROES = ["zidane", "vivi", "garnet", "steiner", "freya", "quina", "eiko", "amarant"];
const SUPERBOSSES = ["soulcage", "deathguise", "kuja", "hades", "ozma", "necron"];
const heroName = (key: string) => key[0]!.toUpperCase() + key.slice(1);
const achievementList: Ach[] = [
  // story: clearing FF9's journeys (they also open camp supplies, roughly when FF9's shops start selling them)
  ach("story-evil-forest", "Out of the Forest", "Clear The Evil Forest", "story", { kind: "journey", journey: "evil-forest" }, { gil: 1000, supplies: ["Hi-Potion", "Soft"] }),
  ach("story-ice-cavern", "Through the Ice", "Clear The Ice Cavern", "story", { kind: "journey", journey: "ice-cavern" }, { gil: 1500, supplies: ["Magic Tag", "Vaccine"] }),
  ach("story-dali", "The Secret Under Dali", "Clear Dali", "story", { kind: "journey", journey: "dali" }, { gil: 2000, supplies: ["Tent", "Annoyntment"] }),
  ach("story-lindblum", "Hunter's Chance", "Clear Lindblum", "story", { kind: "journey", journey: "lindblum" }, { gil: 3000, supplies: ["Ether"] }),
  ach("story-gizamaluke", "The Bell Tolls", "Clear Gizamaluke's Grotto", "story", { kind: "journey", journey: "gizamaluke" }, { gil: 4000, cp: 3 }),
  // milestones
  ach("first-victory", "First Blood", "Win a battle", "milestone", { kind: "stat", stat: "battles", min: 1 }, { gil: 300 }),
  ach("first-run", "The Journey Begins", "Finish a run", "milestone", { kind: "stat", stat: "runs", min: 1 }, { gil: 500, cp: 2 }),
  ach("first-win", "Triumph", "Win a run", "milestone", { kind: "stat", stat: "wins", min: 1 }, { gil: 2000, cp: 3, supplies: ["Remedy"] }),
  ach("veteran", "Veteran", "Win 100 battles", "milestone", { kind: "stat", stat: "battles", min: 100 }, { gil: 5000, cp: 5 }),
  ach("fellowship", "Fellowship", "Have 4 characters on your roster", "milestone", { kind: "roster", min: 4 }, { gil: 2000, cp: 3 }),
  ach("all-together", "All Together Now", "Unlock all eight heroes", "milestone", { kind: "heroes", heroes: MAIN_HEROES }, { gil: 10000, cp: 10 }),
  ach("studious", "Studious", "Learn 10 abilities across your roster", "milestone", { kind: "mastered", min: 10 }, { gil: 2000, cp: 3 }),
  ach("scholar", "Scholar", "Learn 50 abilities across your roster", "milestone", { kind: "mastered", min: 50 }, { gil: 8000, cp: 8 }),
  ach("master-thief", "Master Thief", "Steal 25 items", "milestone", { kind: "stat", stat: "steals", min: 25 }, { gil: 4000 }),
  ach("gourmand", "Gourmand", "Eat 10 monsters with Quina", "milestone", { kind: "stat", stat: "eaten", min: 10 }, { gil: 3000, cp: 3 }),
  // bosses
  ach("boss-garland", "Light of Cornelia", "Defeat Garland", "boss", { kind: "bosses", bosses: ["garland"] }, { gil: 1500, cp: 3 }),
  ach("boss-golbez", "Red Wings Grounded", "Defeat Golbez", "boss", { kind: "bosses", bosses: ["golbez"] }, { gil: 4000, cp: 5 }),
  ach("boss-kefka", "The Light Returns", "Defeat Kefka and win a run", "boss", { kind: "bosses", bosses: ["kefka"] }, { gil: 10000, cp: 10 }),
  // challenges
  ...MAIN_HEROES.map((key) =>
    ach(`solo-${key}`, `${heroName(key)} Alone`, `Clear a late-game journey with ${heroName(key)} as your only party member (+25 CP for ${heroName(key)})`, "challenge", { kind: "solo", hero: key }, {
      gil: 8000,
      cp: 25,
      cpFor: key,
    }),
  ),
  ach("tier-1", "Tougher Stuff", "Win a run on Tier 1", "challenge", { kind: "stat", stat: "highestTierWon", min: 1 }, { gil: 6000, cp: 8 }),
  ach("tier-3", "Iron Will", "Win a run on Tier 3", "challenge", { kind: "stat", stat: "highestTierWon", min: 3 }, { gil: 15000, cp: 15, supplies: ["Elixir"] }),
  ach("tier-5", "Unbreakable", "Win a run on Tier 5", "challenge", { kind: "stat", stat: "highestTierWon", min: 5 }, { gil: 30000, cp: 25 }),
  // legends (Terra & Memoria superbosses: the ultimate weapons)
  ach("legend-soulcage", "Roots of the Tree", "Defeat Soulcage at the Iifa Tree", "legend", { kind: "bosses", bosses: ["soulcage"] }, { items: ["Gastro Fork"] }, true),
  ach("legend-deathguise", "Death's Disguise", "Defeat Deathguise", "legend", { kind: "bosses", bosses: ["deathguise"] }, { items: ["Dragon's Hair"] }, true),
  ach("legend-kuja", "Angel of Death", "Defeat Trance Kuja", "legend", { kind: "bosses", bosses: ["kuja"] }, { items: ["Rune Claws"] }, true),
  ach("legend-hades", "The Underworld's Smith", "Defeat Hades", "legend", { kind: "bosses", bosses: ["hades"] }, { items: ["Mace of Zeus"] }, true),
  ach("legend-ozma", "Beyond the Sphere", "Defeat Ozma", "legend", { kind: "bosses", bosses: ["ozma"] }, { items: ["Ultima Weapon"] }, true),
  ach("legend-necron", "Eternal Darkness", "Defeat Necron and clear Terra & Memoria", "legend", { kind: "bosses", bosses: ["necron"] }, { items: ["Excalibur II"] }, true),
  ...MAIN_CAST.map((key) =>
    ach(
      `legend-set-${key}`,
      `Legend of ${heroName(key)}`,
      `Clear Terra & Memoria with ${heroName(key)} in the party — awards their best-in-slot armour`,
      "legend",
      { kind: "legendClear", hero: key },
      { bestInSlotFor: key },
      true,
    ),
  ),
  ach("legend-all", "Final Fantasy", "Defeat every superboss", "legend", { kind: "bosses", bosses: SUPERBOSSES }, { items: ["Whale Whisker", "Tiger Racket"] }, true),
];
const achievements: AchievementData[] = achievementList.map((a, i) => ({ ...a, sort: i, enabled: true }));

// Legendary gear = what achievements award (the tables aren't loaded here, so from the list above).
const legendary = new Set(achievements.flatMap(rewardItemIds));
const shopIds = (worldShops: number[]) => new Set(worldShops.flatMap((id) => shops.find((s) => s.id === id)?.items ?? []));
const poolsOf = new Map<number, string[]>();
for (const w of WORLDS) for (const id of shopIds(w.shops)) if (!legendary.has(id)) poolsOf.set(id, [...(poolsOf.get(id) ?? []), w.id]);
const bandTopByTier = (t: number) => Math.max(...WORLDS.filter((w) => w.tier <= t).map((w) => w.gearPrice[1]));
const maxTier = Math.max(...WORLDS.map((w) => w.tier));
const gear: GearAvailability[] = items.filter(isGear).map((i) => {
  const pools = poolsOf.get(i.id) ?? [];
  const isLegendary = legendary.has(i.id);
  const catalog = !pools.length && !isLegendary && i.price > 0;
  let fromTier = 0;
  while (fromTier < maxTier && bandTopByTier(fromTier) < effectivePrice(i)) fromTier++;
  return {
    itemId: i.id,
    name: i.name,
    mapPools: pools.map((area) => ({ area })),
    catalog,
    catalogPrice: catalog ? effectivePrice(i) * 2 : null,
    catalogFromTier: catalog && bandTopByTier(fromTier) >= effectivePrice(i) ? fromTier : catalog ? 99 : 0,
    legendary: isLegendary,
    enabled: true,
  };
});

// Starting-gear upgrade chains (.plans/starter-upgrades.md §5): per character and slot, tier I → II → III by item name.
// Cost: gil = 3× the piece's FF9 price, CP 5 / 10 / 20; start level 5 / 10 / 15 (James, 2026-10-18).
const CHAINS: Record<string, Partial<Record<StarterUpgrade["slot"], string[]>>> = {
  zidane: {
    weapon: ["Mage Masher", "Mythril Dagger", "Butterfly Sword"],
    head: ["Feather Hat", "Headgear", "Bandana"],
    wrist: ["Leather Wrist", "Glass Armlet", "Mythril Armlet"],
    armor: ["Bronze Vest", "Chain Plate", "Mythril Vest"],
    accessory: ["Glass Buckle", "Desert Boots", "Yellow Scarf"],
  },
  vivi: {
    weapon: ["Ice Staff", "Flame Staff", "Lightning Staff"],
    head: ["Feather Hat", "Magus Hat", "Mage's Hat"],
    wrist: ["Leather Wrist", "Glass Armlet", "Magic Armlet"],
    armor: ["Silk Shirt", "Bronze Vest", "Magician Cloak"],
    accessory: ["Glass Buckle", "Gold Choker"],
  },
  garnet: {
    weapon: ["Air Racket", "Mythril Rod", "Stardust Rod"],
    head: ["Steepled Hat", "Bandana", "Lamia's Tiara"],
    wrist: ["Glass Armlet", "Mythril Armlet", "Magic Armlet"],
    armor: ["Bronze Vest", "Mythril Vest", "Magician Cloak"],
    accessory: ["Desert Boots", "Cachusha"],
  },
  steiner: {
    weapon: ["Iron Sword", "Mythril Sword", "Blood Sword"],
    head: ["Iron Helm", "Barbut", "Mythril Helm"],
    wrist: ["Bronze Gloves", "Silver Gloves", "Mythril Gloves"],
    armor: ["Linen Cuirass", "Chain Mail", "Mythril Armor"],
    accessory: ["Glass Buckle", "Yellow Scarf"],
  },
  freya: {
    weapon: ["Mythril Spear", "Partisan"],
    head: ["Bronze Helm", "Iron Helm", "Barbut"],
    wrist: ["Silver Gloves", "Mythril Gloves"],
    armor: ["Chain Mail", "Mythril Armor"],
    accessory: ["Glass Buckle", "Coral Ring"],
  },
  quina: {
    weapon: ["Needle Fork", "Mythril Fork"],
    head: ["Feather Hat", "Bandana", "Mage's Hat"],
    wrist: ["Glass Armlet", "Bone Wrist", "Magic Armlet"],
    armor: ["Bronze Vest", "Mythril Vest", "Magician Cloak"],
    accessory: ["Glass Buckle", "Yellow Scarf"],
  },
  eiko: {
    weapon: ["Lamia's Flute", "Fairy Flute"],
    head: ["Steepled Hat", "Lamia's Tiara", "Mage's Hat"],
    wrist: ["Mythril Armlet", "Magic Armlet"],
    armor: ["Bronze Vest", "Mythril Vest", "Magician Cloak"],
    accessory: ["Anklet", "Pearl Rouge"],
  },
  amarant: {
    weapon: ["Poison Knuckles", "Mythril Claws"],
    head: ["Headgear", "Bandana", "Ritual Hat"],
    wrist: ["Bone Wrist", "Mythril Armlet", "Chimera Armlet"],
    armor: ["Survival Vest", "Brigandine"],
    accessory: ["Coral Ring", "Power Belt"],
  },
  beatrix: {
    head: ["Barbut", "Mythril Helm", "Gold Helm"],
    wrist: ["Thunder Gloves", "Diamond Gloves"],
    armor: ["Mythril Armor", "Plate Mail"],
    accessory: ["Coral Ring", "Power Belt"],
  },
  blank: {
    weapon: ["Iron Sword", "Mythril Sword", "Blood Sword"],
    head: ["Headgear", "Bandana", "Ritual Hat"],
    wrist: ["Leather Wrist", "Bone Wrist", "Mythril Armlet"],
    armor: ["Leather Plate", "Bronze Vest", "Chain Plate"],
    accessory: ["Glass Buckle", "Yellow Scarf"],
  },
};
const TIER_CP = [5, 10, 20];
const TIER_LEVEL = [5, 10, 15];
const starter: StarterUpgrade[] = [];
for (const [key, slots] of Object.entries(CHAINS)) {
  const ch = characters.find((c) => c.key === key);
  if (!ch) throw new Error(`Unknown character ${key}`);
  for (const [slot, names] of Object.entries(slots) as [StarterUpgrade["slot"], string[]][]) {
    names.forEach((name, i) => {
      const item = items.find((x) => x.name === name);
      if (!item) throw new Error(`Unknown item ${name}`);
      if (item.kind !== slot || !item.equippableBy.includes(key)) throw new Error(`${ch.name} can't wear ${name} as ${slot}`);
      starter.push({
        id: `${key}:${slot}:${i + 1}`,
        character: key,
        slot,
        tier: i + 1,
        itemId: item.id,
        name,
        gil: effectivePrice(item) * 3,
        cp: TIER_CP[i] ?? 20,
        minStartLevel: TIER_LEVEL[i] ?? 15,
        requires: null,
        enabled: true,
      });
    });
  }
}

const files: Record<keyof typeof REWARD_SEED_FILES, unknown> = { rarities, roles, sources, boons, gear, starter, achievements };
mkdirSync(REWARD_CACHE_DIR, { recursive: true });
for (const [k, data] of Object.entries(files) as [keyof typeof REWARD_SEED_FILES, unknown][]) {
  if (only.length && !only.includes(k)) continue;
  const path = join(REWARD_CACHE_DIR, REWARD_SEED_FILES[k]);
  if (existsSync(path) && !force) {
    console.log(`skip ${REWARD_SEED_FILES[k]} (exists; --force to overwrite)`);
    continue;
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${REWARD_SEED_FILES[k]} (${Array.isArray(data) ? data.length : 0} rows)`);
}
