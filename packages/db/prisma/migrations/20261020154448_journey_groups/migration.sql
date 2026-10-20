/*
  Warnings:

  - You are about to drop the column `chaptersCleared` on the `player_profile` table. All the data in the column will be lost.
  - You are about to drop the column `chapter` on the `run` table. All the data in the column will be lost.
  - You are about to drop the `chapter` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "player_profile" DROP COLUMN "chaptersCleared",
ADD COLUMN     "groupsCleared" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "run" DROP COLUMN "chapter",
ADD COLUMN     "journeyGroup" TEXT;

-- DropTable
DROP TABLE "chapter";

-- CreateTable
CREATE TABLE "journey_group" (
    "id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_group_pkey" PRIMARY KEY ("id")
);
