-- CreateTable
CREATE TABLE "area" (
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey" (
    "id" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "area_index_key" ON "area"("index");
