"""
CLI runner for WellQC Database Backup to Cloudflare R2
=====================================================
Usage:
    python scripts/backup_db.py [--retention-days 30]
"""

import argparse
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.backup_service import run_database_backup


def main():
    parser = argparse.ArgumentParser(description="WellQC Nightly Database Backup to Cloudflare R2")
    parser.add_argument(
        "--retention-days",
        type=int,
        default=30,
        help="Number of days to retain backups in R2 before pruning (default: 30)",
    )
    args = parser.parse_args()

    print("[WellQC Backup] Initiating automated database backup...")
    try:
        res = run_database_backup(retention_days=args.retention_days)
        print(f"[WellQC Backup] SUCCESS!")
        print(f"  Destination: r2://{res['bucket']}/{res['key']}")
        print(f"  Method:      {res['method']}")
        print(f"  Size:        {res['size_bytes']:,} bytes (compressed from {res['raw_size_bytes']:,} bytes)")
        print(f"  Old pruned:  {res['pruned_backups']} archives")
        sys.exit(0)
    except Exception as exc:
        print(f"[WellQC Backup] FAILED: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
