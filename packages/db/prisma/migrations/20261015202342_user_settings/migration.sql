-- CreateTable
CREATE TABLE "user_settings" (
    "userId" TEXT NOT NULL,
    "menuFont" TEXT NOT NULL DEFAULT 'rounded',
    "battleSpeed" INTEGER NOT NULL DEFAULT 1,
    "autoBattle" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
