-- CreateTable
CREATE TABLE "ff9_character" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_character_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ff9_action" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_item" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_support_ability" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_support_ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_synthesis" (
    "id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_synthesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_shop" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_status" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ff9_level" (
    "level" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "ff9_level_pkey" PRIMARY KEY ("level")
);

-- CreateIndex
CREATE INDEX "ff9_item_kind_idx" ON "ff9_item"("kind");
