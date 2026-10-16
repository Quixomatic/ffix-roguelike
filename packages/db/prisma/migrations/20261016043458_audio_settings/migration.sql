-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "musicVolume" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "sfxVolume" INTEGER NOT NULL DEFAULT 80;
