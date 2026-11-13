"""
Database Schema Migration & Compatibility Service.

Ensures all required tables, columns, and indexes exist in production PostgreSQL.
Each statement is executed in its own isolated transaction so that a failure in one
statement never rolls back or blocks subsequent migration steps.
"""

import sys
import logging
from sqlalchemy import text
from backend.app.core.database import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("wellqc.migrate")

DDL_STATEMENTS = [
    # 1. User table schema additions (email verification & Paystack)
    (
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;',
        'Add isEmailVerified column to User'
    ),
    (
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);',
        'Add emailVerifiedAt column to User'
    ),
    (
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackCustomerCode" TEXT;',
        'Add paystackCustomerCode column to User'
    ),
    (
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paystackSubscriptionCode" TEXT;',
        'Add paystackSubscriptionCode column to User'
    ),
    (
        'CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackCustomerCode_key" ON "User"("paystackCustomerCode");',
        'Create unique index on User(paystackCustomerCode)'
    ),
    (
        'CREATE UNIQUE INDEX IF NOT EXISTS "User_paystackSubscriptionCode_key" ON "User"("paystackSubscriptionCode");',
        'Create unique index on User(paystackSubscriptionCode)'
    ),

    # 2. PaymentTransaction table & indexes
    (
        '''
        CREATE TABLE IF NOT EXISTS "PaymentTransaction" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
            "reference" TEXT NOT NULL UNIQUE,
            "amount" INTEGER NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'NGN',
            "plan" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'PENDING',
            "channel" TEXT,
            "paystackCustomerCode" TEXT,
            "metadataPayload" JSONB,
            "paidAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ''',
        'Create PaymentTransaction table'
    ),
    (
        'CREATE INDEX IF NOT EXISTS "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");',
        'Create index on PaymentTransaction(userId)'
    ),
    (
        'CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");',
        'Create unique index on PaymentTransaction(reference)'
    ),
    (
        'CREATE INDEX IF NOT EXISTS "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");',
        'Create index on PaymentTransaction(status)'
    ),
    (
        'ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "paystackCustomerCode" TEXT;',
        'Ensure paystackCustomerCode exists on PaymentTransaction'
    ),

    # 3. SystemSetting table & indexes
    (
        '''
        CREATE TABLE IF NOT EXISTS "SystemSetting" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "key" TEXT NOT NULL UNIQUE,
            "value" TEXT NOT NULL,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ''',
        'Create SystemSetting table'
    ),
    (
        'CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");',
        'Create unique index on SystemSetting(key)'
    ),

    # 4. FormationMarker table & indexes
    (
        '''
        CREATE TABLE IF NOT EXISTS "FormationMarker" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "wellId" TEXT NOT NULL REFERENCES "Well"("id") ON DELETE CASCADE,
            "formationName" TEXT NOT NULL,
            "topDepth" DOUBLE PRECISION NOT NULL,
            "bottomDepth" DOUBLE PRECISION,
            "source" TEXT NOT NULL DEFAULT 'INTERPRETER',
            "pickedBy" TEXT,
            "notes" TEXT,
            "ownerId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "FormationMarker_wellId_formationName_key" UNIQUE ("wellId", "formationName")
        );
        ''',
        'Create FormationMarker table'
    ),
    (
        'CREATE INDEX IF NOT EXISTS "FormationMarker_wellId_idx" ON "FormationMarker"("wellId");',
        'Create index on FormationMarker(wellId)'
    ),
]


def run_migrations(stop_on_error: bool = False) -> bool:
    """
    Execute all schema migration DDL statements.
    Each statement runs in its own individual transaction block so that
    a failure in one statement does NOT roll back previous successful statements.
    """
    logger.info("Starting database schema migration & compatibility check...")
    all_success = True
    executed_count = 0
    failed_count = 0

    for sql, description in DDL_STATEMENTS:
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            executed_count += 1
            logger.debug(f"Applied: {description}")
        except Exception as e:
            failed_count += 1
            all_success = False
            logger.warning(f"Migration step skipped or failed [{description}]: {e}")
            if stop_on_error:
                logger.error(f"Aborting migration due to critical failure in: {description}")
                return False

    logger.info(
        f"Schema migration completed: {executed_count} applied/verified, {failed_count} skipped/warnings."
    )
    return all_success


if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)

