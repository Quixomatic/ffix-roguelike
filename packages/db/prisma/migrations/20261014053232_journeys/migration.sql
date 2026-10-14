-- AlterTable
ALTER TABLE "player_profile" ADD COLUMN     "journeysCleared" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "run" ADD COLUMN     "journey" TEXT NOT NULL DEFAULT 'cornelia';
