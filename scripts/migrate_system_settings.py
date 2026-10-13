import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.core.database import engine
from sqlalchemy import text

def run_migration():
    print("[MIGRATION] Creating SystemSetting table if not exists...")
    with engine.connect() as conn:
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS "SystemSetting" (
                "id" VARCHAR PRIMARY KEY,
                "key" VARCHAR UNIQUE NOT NULL,
                "value" TEXT NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        '''))
        conn.commit()
    print("[SUCCESS] SystemSetting table created or verified successfully.")

if __name__ == "__main__":
    run_migration()
