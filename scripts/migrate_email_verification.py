import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.core.database import engine
from sqlalchemy import text

def run_migration():
    print("[MIGRATION] Adding isEmailVerified and emailVerifiedAt to User table...")
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT FALSE;'))
        conn.execute(text('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP WITH TIME ZONE;'))
        conn.commit()
    print("[SUCCESS] Columns isEmailVerified and emailVerifiedAt added or verified successfully.")

if __name__ == "__main__":
    run_migration()
