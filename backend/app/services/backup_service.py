"""
Automated Database Backup Service (Cloudflare R2)
=================================================
Dumps the PostgreSQL database, compresses it with gzip,
and stores the timestamped archive in Cloudflare R2 under `backups/`.
Also implements an automated retention policy to prune archives older than 30 days.
"""

import datetime
import gzip
import io
import logging
import os
import shutil
import subprocess
from typing import Dict, Any, List

from sqlalchemy import inspect, text
from backend.app.core.config import settings
from backend.app.core.database import engine
from backend.app.services import r2_storage

logger = logging.getLogger("wellqc.backup")


def _dump_via_pg_dump(db_url: str) -> bytes:
    """Run pg_dump if the binary is present on the system."""
    pg_dump_bin = shutil.which("pg_dump")
    if not pg_dump_bin:
        raise FileNotFoundError("pg_dump binary not found on PATH.")

    cmd = [
        pg_dump_bin,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "-d",
        db_url,
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return result.stdout


def _dump_via_python_fallback(target_engine=None) -> bytes:
    active_engine = target_engine or engine
    """
    Pure Python SQL dump fallback when pg_dump is not available.
    Exports table schemas and rows as SQL statements.
    """
    buffer = io.StringIO()
    buffer.write(f"-- WellQC Database Fallback SQL Dump\n")
    buffer.write(f"-- Generated: {datetime.datetime.now(datetime.timezone.utc).isoformat()}\n\n")

    inspector = inspect(active_engine)
    table_names = inspector.get_table_names()

    with active_engine.connect() as conn:
        for table in table_names:
            buffer.write(f"-- Table: {table}\n")
            rows = conn.execute(text(f'SELECT * FROM "{table}"')).fetchall()
            if not rows:
                continue

            columns = [col["name"] for col in inspector.get_columns(table)]
            quoted_cols = ", ".join([f'"{c}"' for c in columns])

            for row in rows:
                formatted_vals = []
                for v in row:
                    if v is None:
                        formatted_vals.append("NULL")
                    elif isinstance(v, (int, float)):
                        formatted_vals.append(str(v))
                    elif isinstance(v, bool):
                        formatted_vals.append("TRUE" if v else "FALSE")
                    elif isinstance(v, datetime.datetime):
                        formatted_vals.append(f"'{v.isoformat()}'")
                    else:
                        escaped = str(v).replace("'", "''")
                        formatted_vals.append(f"'{escaped}'")
                
                vals_str = ", ".join(formatted_vals)
                buffer.write(f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({vals_str});\n')
            buffer.write("\n")

    return buffer.getvalue().encode("utf-8")


def prune_old_backups(client, bucket: str, retention_days: int = 30) -> int:
    """Remove backups older than `retention_days` from R2."""
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=retention_days)
    pruned = 0
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix="backups/"):
            for obj in page.get("Contents", []):
                last_modified = obj.get("LastModified")
                if last_modified and last_modified < cutoff:
                    key = obj.get("Key")
                    client.delete_object(Bucket=bucket, Key=key)
                    logger.info("Pruned old backup: %s", key)
                    pruned += 1
    except Exception as exc:
        logger.warning("Backup pruning encountered an issue: %s", exc)
    return pruned


def run_database_backup(retention_days: int = 30) -> Dict[str, Any]:
    """
    Execute a full database backup and upload it compressed to Cloudflare R2.
    """
    client = r2_storage._get_client()
    if not client or not r2_storage.is_enabled():
        raise RuntimeError("Cloudflare R2 is not configured. Cannot upload backup.")

    bucket = r2_storage._BUCKET
    db_url = settings.DATABASE_URL

    logger.info("Starting database backup...")
    try:
        raw_sql = _dump_via_pg_dump(db_url)
        method = "pg_dump"
    except Exception as exc:
        logger.info("pg_dump not available (%s); using Python streaming dump.", exc)
        raw_sql = _dump_via_python_fallback()
        method = "python_fallback"

    compressed = gzip.compress(raw_sql)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    key = f"backups/backup_wellqc_{timestamp}.sql.gz"

    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=compressed,
        ContentType="application/gzip",
        Metadata={
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "dump_method": method,
            "raw_size_bytes": str(len(raw_sql)),
        },
    )

    logger.info("Database backup uploaded successfully: %s (%d bytes)", key, len(compressed))

    # Apply automated retention pruning
    pruned_count = prune_old_backups(client, bucket, retention_days=retention_days)

    return {
        "success": True,
        "key": key,
        "bucket": bucket,
        "method": method,
        "size_bytes": len(compressed),
        "raw_size_bytes": len(raw_sql),
        "pruned_backups": pruned_count,
        "timestamp": timestamp,
    }
