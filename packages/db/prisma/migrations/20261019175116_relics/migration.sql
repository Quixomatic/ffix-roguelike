-- AlterTable
ALTER TABLE "player_profile" ADD COLUMN     "relicsUnlocked" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "relic" (
    "id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synergy" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_tag" (
    "character" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_tag_pkey" PRIMARY KEY ("character")
);
