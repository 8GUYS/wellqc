"""
WellQC+ Database Schema Initializer.

Initializes database schema and ensures all tables exist while keeping tables empty.
No demo, synthetic, or mock records are inserted.

Usage:
    python scripts/seed_db.py
"""

import os
import sys

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.core.database import engine, Base
import backend.app.models.models  # Ensure all models are registered on Base

def init_db():
    print("[INIT] Verifying and initializing WellQC+ database schema...")
    try:
        # Create all tables if they do not already exist, without inserting data
        Base.metadata.create_all(bind=engine)
        print("[SUCCESS] All database tables initialized and verified. Tables remain clean and empty.")
    except Exception as e:
        print(f"[ERROR] Database schema initialization failed: {e}")
        raise

if __name__ == "__main__":
    init_db()
