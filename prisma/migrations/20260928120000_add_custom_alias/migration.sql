-- CreateTable (idempotent: CustomAlias already exists in production,
-- created outside migrations; this makes fresh databases match)
CREATE TABLE IF NOT EXISTS "CustomAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "standardMnemonic" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomAlias_userId_idx" ON "CustomAlias"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomAlias_userEmail_idx" ON "CustomAlias"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomAlias_standardMnemonic_alias_userId_key" ON "CustomAlias"("standardMnemonic", "alias", "userId");