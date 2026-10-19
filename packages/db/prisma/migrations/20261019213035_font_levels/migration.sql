/*
  Warnings:

  - You are about to drop the column `menuFont` on the `user_settings` table. All the data in the column will be lost.
  - You are about to drop the column `pixelFont` on the `user_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_settings" DROP COLUMN "menuFont",
DROP COLUMN "pixelFont",
ADD COLUMN     "bodyFont" TEXT NOT NULL DEFAULT 'nunito',
ADD COLUMN     "headingFont" TEXT NOT NULL DEFAULT 'pixelify',
ADD COLUMN     "titleFont" TEXT NOT NULL DEFAULT 'pixelify';
