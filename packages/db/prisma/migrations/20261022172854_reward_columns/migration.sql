-- AlterTable
ALTER TABLE "achievement" ADD COLUMN     "badge" INTEGER,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rewardItemIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "rewardSupplyIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "secret" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "gear_availability" ADD COLUMN     "catalog" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "catalogFromTier" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "catalogPrice" INTEGER,
ADD COLUMN     "legendary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "relic" ADD COLUMN     "badge" INTEGER,
ADD COLUMN     "cursed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "flavor" TEXT,
ADD COLUMN     "free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minTier" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "rarityId" TEXT NOT NULL DEFAULT 'common',
ADD COLUMN     "starter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unlockedById" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reward_boon" ADD COLUMN     "affinity" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "minTier" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'member',
ADD COLUMN     "stat" TEXT NOT NULL DEFAULT 'strength',
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "reward_rarity" ADD COLUMN     "apSurge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bandSteps" INTEGER,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#ffffff',
ADD COLUMN     "gil" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nextBand" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shopMarkup" DOUBLE PRECISION,
ADD COLUMN     "shopPrice" INTEGER,
ADD COLUMN     "supplies" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reward_role" ADD COLUMN     "abilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "preferredAbilities" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "reward_source" ADD COLUMN     "cards" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "chance" DOUBLE PRECISION,
ADD COLUMN     "guarantee" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "minRarity" TEXT NOT NULL DEFAULT 'common',
ADD COLUMN     "relicChance" DOUBLE PRECISION,
ADD COLUMN     "skipGil" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "upgradeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "starter_upgrade" ADD COLUMN     "cp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gil" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemId" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minStartLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "requiresAchievementId" TEXT,
ADD COLUMN     "requiresJourneyId" TEXT;

-- AlterTable
ALTER TABLE "synergy" ADD COLUMN     "badge" INTEGER,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tag" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "gear_map_pool" (
    "itemId" INTEGER NOT NULL,
    "areaId" TEXT NOT NULL,
    "bossOnly" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "gear_map_pool_pkey" PRIMARY KEY ("itemId","areaId")
);

-- CreateIndex
CREATE INDEX "gear_map_pool_areaId_idx" ON "gear_map_pool"("areaId");

-- CreateIndex
CREATE INDEX "relic_rarityId_idx" ON "relic"("rarityId");

-- CreateIndex
CREATE INDEX "relic_unlockedById_idx" ON "relic"("unlockedById");

-- AddForeignKey
ALTER TABLE "gear_map_pool" ADD CONSTRAINT "gear_map_pool_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "gear_availability"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_map_pool" ADD CONSTRAINT "gear_map_pool_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "starter_upgrade" ADD CONSTRAINT "starter_upgrade_requiresJourneyId_fkey" FOREIGN KEY ("requiresJourneyId") REFERENCES "journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "starter_upgrade" ADD CONSTRAINT "starter_upgrade_requiresAchievementId_fkey" FOREIGN KEY ("requiresAchievementId") REFERENCES "achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relic" ADD CONSTRAINT "relic_rarityId_fkey" FOREIGN KEY ("rarityId") REFERENCES "reward_rarity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relic" ADD CONSTRAINT "relic_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
