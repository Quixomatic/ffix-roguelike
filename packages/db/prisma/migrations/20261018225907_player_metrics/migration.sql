-- CreateTable
CREATE TABLE "player_metric" (
    "profileId" TEXT NOT NULL,
    "character" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_metric_pkey" PRIMARY KEY ("profileId","character","key","subject")
);

-- CreateIndex
CREATE INDEX "player_metric_key_subject_character_idx" ON "player_metric"("key", "subject", "character");

-- AddForeignKey
ALTER TABLE "player_metric" ADD CONSTRAINT "player_metric_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
