-- AlterTable
ALTER TABLE "area" ADD COLUMN     "gearPriceHigh" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gearPriceLow" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "synthTier" INTEGER NOT NULL DEFAULT 32,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'grassland',
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "challenge" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "journeyId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "routeKind" TEXT NOT NULL DEFAULT 'areas',
ADD COLUMN     "subtitle" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "challenge_category" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "journey" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recruits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "subtitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "unlockAfterId" TEXT;

-- AlterTable
ALTER TABLE "journey_group" ADD COLUMN     "isChallenge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "subtitle" TEXT;

-- CreateTable
CREATE TABLE "journey_group_member" (
    "groupId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "journeyId" TEXT NOT NULL,

    CONSTRAINT "journey_group_member_pkey" PRIMARY KEY ("groupId","position")
);

-- CreateTable
CREATE TABLE "journey_area" (
    "journeyId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "journey_area_pkey" PRIMARY KEY ("journeyId","position")
);

-- CreateTable
CREATE TABLE "challenge_area" (
    "challengeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "challenge_area_pkey" PRIMARY KEY ("challengeId","position")
);

-- CreateIndex
CREATE INDEX "journey_group_member_journeyId_idx" ON "journey_group_member"("journeyId");

-- CreateIndex
CREATE INDEX "journey_area_areaId_idx" ON "journey_area"("areaId");

-- CreateIndex
CREATE INDEX "challenge_area_areaId_idx" ON "challenge_area"("areaId");

-- AddForeignKey
ALTER TABLE "journey_group_member" ADD CONSTRAINT "journey_group_member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "journey_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_group_member" ADD CONSTRAINT "journey_group_member_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_area" ADD CONSTRAINT "journey_area_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey_area" ADD CONSTRAINT "journey_area_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_area" ADD CONSTRAINT "challenge_area_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_area" ADD CONSTRAINT "challenge_area_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "challenge_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "journey_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "journey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey" ADD CONSTRAINT "journey_unlockAfterId_fkey" FOREIGN KEY ("unlockAfterId") REFERENCES "journey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
