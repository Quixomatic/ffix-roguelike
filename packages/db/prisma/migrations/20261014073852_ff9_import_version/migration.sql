-- CreateTable
CREATE TABLE "ff9_import" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ff9_import_pkey" PRIMARY KEY ("id")
);
