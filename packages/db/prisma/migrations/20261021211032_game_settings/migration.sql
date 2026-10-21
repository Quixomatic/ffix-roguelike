-- CreateTable
CREATE TABLE "game_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_setting_pkey" PRIMARY KEY ("key")
);
