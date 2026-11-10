-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackCustomerCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackSubscriptionCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackCustomerCode_key" ON "User"("paystackCustomerCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackSubscriptionCode_key" ON "User"("paystackSubscriptionCode");

-- CreateTable PaymentTransaction
CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "paystackCustomerCode" TEXT,
    "metadataPayload" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- Foreign Key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentTransaction_userId_fkey'
  ) THEN
    ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- Grant permissions to wellqc_api if role exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wellqc_api') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "PaymentTransaction" TO wellqc_api;
  END IF;
END
$$;

