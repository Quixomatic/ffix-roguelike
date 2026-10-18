-- CreateTable
CREATE TABLE "achievement" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);
