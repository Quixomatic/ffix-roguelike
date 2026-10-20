/**
 * Maps the relational player tables to game-core's `Profile` and back. game-core owns the rules; this module
 * only loads, creates and persists.
 */
import { bagKey, newProfile, type CharacterBuild, type Profile } from "@ffix-roguelike/game-core";
import type { AbilityRef, EquipSlot } from "@ffix-roguelike/game-data";
import type { Database } from "@ffix-roguelike/db";

type Tx = Parameters<Parameters<Database["$transaction"]>[0]>[0];
type Client = Database | Tx;

const include = {
  characters: { include: { abilities: true } },
  stash: true,
  bossKills: true,
  // Lifetime metrics (read-only on the profile; `services/metrics.ts` adds to them).
  metrics: { select: { character: true, key: true, subject: true, value: true } },
} as const;

export interface LoadedProfile {
  id: string;
  battleMode: "WAIT" | "ACTIVE";
  profile: Profile;
}

/** Load the player's profile, creating it (with the starting cast) on first visit. */
export async function loadProfile(db: Client, userId: string): Promise<LoadedProfile> {
  let row = await db.playerProfile.findUnique({ where: { userId }, include });
  if (!row) {
    const fresh = newProfile();
    row = await db.playerProfile.create({
      data: {
        userId,
        characters: {
          create: Object.values(fresh.builds).map((b) => ({
            key: b.key,
            unlocked: fresh.unlocked.includes(b.key),
            unlockedAt: fresh.unlocked.includes(b.key) ? new Date() : null,
            ...buildColumns(b),
          })),
        },
      },
      include,
    });
  }
  const base = newProfile();
  const builds: Record<string, CharacterBuild> = { ...base.builds };
  for (const c of row.characters) {
    builds[c.key] = {
      key: c.key,
      level: c.level,
      exp: c.exp,
      backRow: c.backRow,
      supports: c.supports,
      equipment: { weapon: c.weaponId, head: c.headId, wrist: c.wristId, armor: c.armorId, accessory: c.accessoryId },
      ap: Object.fromEntries(c.abilities.map((a) => [a.ref as AbilityRef, a.ap])),
      growth: { speed: c.growthSpeed, strength: c.growthStrength, magic: c.growthMagic, spirit: c.growthSpirit, gems: c.growthGems },
      record: { runs: c.runs, wins: c.wins, bossKills: c.bossKills },
      points: c.points,
      unlockedSlots: c.unlockedSlots as EquipSlot[],
      training: (c.training ?? {}) as CharacterBuild["training"],
      starterTiers: (c.starterTiers ?? {}) as CharacterBuild["starterTiers"],
      starterPicks: (c.starterPicks ?? {}) as CharacterBuild["starterPicks"],
    };
  }
  return {
    id: row.id,
    battleMode: row.battleMode,
    profile: {
      gil: row.gil,
      maxTier: row.maxTier,
      achievements: row.achievements,
      gearUnlocked: row.gearUnlocked,
      relicsUnlocked: row.relicsUnlocked,
      supplyRanks: (row.supplyRanks ?? {}) as Record<number, number>,
      journeysCleared: row.journeysCleared,
      groupsCleared: row.groupsCleared,
      unlocked: row.characters.filter((c) => c.unlocked).map((c) => c.key),
      builds,
      stash: Object.fromEntries(row.stash.filter((s) => s.count > 0).map((s) => [s.itemId, s.count])),
      stats: {
        runs: row.runs,
        wins: row.wins,
        battles: row.battles,
        eaten: row.eaten,
        steals: row.steals,
        bestWorld: row.bestWorld,
        highestTierWon: row.highestTierWon,
        soloWins: row.soloWins,
        legendClears: row.legendClears,
        bossKills: Object.fromEntries(row.bossKills.map((b) => [b.enemyId, b.count])),
      },
      metrics: Object.fromEntries(row.metrics.map((m) => [bagKey(m.key, m.subject, m.character), m.value])),
    },
  };
}

function buildColumns(b: CharacterBuild) {
  return {
    level: b.level,
    exp: b.exp,
    backRow: b.backRow,
    supports: b.supports,
    weaponId: b.equipment.weapon,
    headId: b.equipment.head,
    wristId: b.equipment.wrist,
    armorId: b.equipment.armor,
    accessoryId: b.equipment.accessory,
    growthSpeed: b.growth?.speed ?? 0,
    growthStrength: b.growth?.strength ?? 0,
    growthMagic: b.growth?.magic ?? 0,
    growthSpirit: b.growth?.spirit ?? 0,
    growthGems: b.growth?.gems ?? 0,
    runs: b.record?.runs ?? 0,
    wins: b.record?.wins ?? 0,
    bossKills: b.record?.bossKills ?? 0,
    points: b.points ?? 0,
    unlockedSlots: b.unlockedSlots ?? [],
    training: (b.training ?? {}) as object,
    starterTiers: (b.starterTiers ?? {}) as object,
    starterPicks: (b.starterPicks ?? {}) as object,
  };
}

/** Persist a whole profile (call inside a transaction). */
export async function saveProfile(tx: Tx, profileId: string, p: Profile) {
  await tx.playerProfile.update({
    where: { id: profileId },
    data: {
      gil: p.gil,
      maxTier: p.maxTier,
      runs: p.stats.runs,
      wins: p.stats.wins,
      battles: p.stats.battles,
      eaten: p.stats.eaten,
      steals: p.stats.steals,
      bestWorld: p.stats.bestWorld,
      highestTierWon: p.stats.highestTierWon,
      soloWins: p.stats.soloWins ?? [],
      legendClears: p.stats.legendClears ?? [],
      achievements: p.achievements ?? [],
      gearUnlocked: p.gearUnlocked ?? [],
      relicsUnlocked: p.relicsUnlocked ?? [],
      supplyRanks: p.supplyRanks ?? {},
      journeysCleared: p.journeysCleared ?? [],
      groupsCleared: p.groupsCleared ?? [],
    },
  });
  for (const b of Object.values(p.builds)) {
    const unlocked = p.unlocked.includes(b.key);
    const row = await tx.playerCharacter.upsert({
      where: { profileId_key: { profileId, key: b.key } },
      create: { profileId, key: b.key, unlocked, unlockedAt: unlocked ? new Date() : null, ...buildColumns(b) },
      update: { unlocked, ...buildColumns(b) },
    });
    if (unlocked && !row.unlockedAt) await tx.playerCharacter.update({ where: { id: row.id }, data: { unlockedAt: new Date() } });
    await tx.characterAbility.deleteMany({ where: { characterId: row.id } });
    const abilities = Object.entries(b.ap).filter(([, ap]) => (ap ?? 0) > 0);
    if (abilities.length) await tx.characterAbility.createMany({ data: abilities.map(([ref, ap]) => ({ characterId: row.id, ref, ap: ap ?? 0 })) });
  }
  await tx.stashItem.deleteMany({ where: { profileId } });
  const stash = Object.entries(p.stash).filter(([, n]) => n > 0);
  if (stash.length) await tx.stashItem.createMany({ data: stash.map(([itemId, count]) => ({ profileId, itemId: Number(itemId), count })) });
  for (const [enemyId, count] of Object.entries(p.stats.bossKills)) {
    await tx.bossKill.upsert({
      where: { profileId_enemyId: { profileId, enemyId } },
      create: { profileId, enemyId, count },
      update: { count },
    });
  }
}
