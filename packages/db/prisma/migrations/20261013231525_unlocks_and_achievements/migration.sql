-- AlterTable
ALTER TABLE "player_character" DROP COLUMN "slots",
ADD COLUMN     "unlockedSlots" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "player_profile" ADD COLUMN     "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "gearUnlocked" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "legendClears" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "soloWins" TEXT[] DEFAULT ARRAY[]::TEXT[];

