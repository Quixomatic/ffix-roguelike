-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('WAIT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'ABANDONED');

-- CreateEnum
CREATE TYPE "BattleOutcome" AS ENUM ('VICTORY', 'DEFEAT', 'FLED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_character" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3),
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "backRow" BOOLEAN NOT NULL DEFAULT false,
    "weaponId" INTEGER,
    "headId" INTEGER,
    "wristId" INTEGER,
    "armorId" INTEGER,
    "accessoryId" INTEGER,
    "supports" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_ability" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "ap" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "character_ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stash_item" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "stash_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gil" INTEGER NOT NULL DEFAULT 0,
    "maxTier" INTEGER NOT NULL DEFAULT 0,
    "battleMode" "BattleMode" NOT NULL DEFAULT 'WAIT',
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "battles" INTEGER NOT NULL DEFAULT 0,
    "eaten" INTEGER NOT NULL DEFAULT 0,
    "steals" INTEGER NOT NULL DEFAULT 0,
    "bestWorld" INTEGER NOT NULL DEFAULT 0,
    "highestTierWon" INTEGER NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boss_kill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "enemyId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "boss_kill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "status" "RunStatus" NOT NULL DEFAULT 'ACTIVE',
    "world" INTEGER NOT NULL DEFAULT 0,
    "party" TEXT[],
    "state" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "gilEarned" INTEGER,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_battle" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "world" INTEGER NOT NULL,
    "enemies" TEXT[],
    "seed" INTEGER NOT NULL,
    "outcome" "BattleOutcome" NOT NULL,
    "ticks" INTEGER NOT NULL,
    "inputs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_battle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "player_character_profileId_idx" ON "player_character"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "player_character_profileId_key_key" ON "player_character"("profileId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "character_ability_characterId_ref_key" ON "character_ability"("characterId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "stash_item_profileId_itemId_key" ON "stash_item"("profileId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "player_profile_userId_key" ON "player_profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "boss_kill_profileId_enemyId_key" ON "boss_kill"("profileId", "enemyId");

-- CreateIndex
CREATE INDEX "run_profileId_status_idx" ON "run"("profileId", "status");

-- CreateIndex
CREATE INDEX "run_battle_runId_idx" ON "run_battle"("runId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_character" ADD CONSTRAINT "player_character_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_ability" ADD CONSTRAINT "character_ability_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "player_character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stash_item" ADD CONSTRAINT "stash_item_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boss_kill" ADD CONSTRAINT "boss_kill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run" ADD CONSTRAINT "run_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "player_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_battle" ADD CONSTRAINT "run_battle_runId_fkey" FOREIGN KEY ("runId") REFERENCES "run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
