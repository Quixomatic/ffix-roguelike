-- AlterTable
ALTER TABLE "player_profile" ADD COLUMN     "chaptersCleared" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "run" ADD COLUMN     "chapter" TEXT;

-- CreateTable
CREATE TABLE "chapter" (
    "id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapter_pkey" PRIMARY KEY ("id")
);
