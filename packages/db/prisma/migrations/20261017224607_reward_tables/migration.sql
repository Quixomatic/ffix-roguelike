-- AlterTable
ALTER TABLE "player_profile" ADD COLUMN     "rewardBans" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rewardRerolls" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reward_rarity" (
    "id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_rarity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_role" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_role_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "reward_source" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_boon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_boon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_availability" (
    "itemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gear_availability_pkey" PRIMARY KEY ("itemId")
);
