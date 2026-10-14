-- CreateTable
CREATE TABLE "ff9_enemy" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "boss" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_enemy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_enemy_action" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_enemy_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_battle_scene" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "script" BYTEA,

    CONSTRAINT "ff9_battle_scene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ff9_enemy_name_idx" ON "ff9_enemy"("name");
