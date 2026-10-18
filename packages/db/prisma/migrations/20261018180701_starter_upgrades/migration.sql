-- AlterTable
ALTER TABLE "player_character" ADD COLUMN     "starterTiers" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "starter_upgrade" (
    "id" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "starter_upgrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "starter_upgrade_character_idx" ON "starter_upgrade"("character");
