/*
  Warnings:

  - You are about to drop the column `routeTiers` on the `player_profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "player_profile" DROP COLUMN "routeTiers";

-- CreateTable
CREATE TABLE "player_route_tier" (
    "profileId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "bestTier" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_route_tier_pkey" PRIMARY KEY ("profileId","routeId")
);

-- CreateIndex
CREATE INDEX "player_route_tier_routeId_bestTier_idx" ON "player_route_tier"("routeId", "bestTier");

-- AddForeignKey
ALTER TABLE "player_route_tier" ADD CONSTRAINT "player_route_tier_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
