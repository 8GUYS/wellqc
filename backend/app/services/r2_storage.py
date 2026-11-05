"""
Cloudflare R2 Blob Storage Service
===================================
Handles upload, download, and deletion of raw LAS file content in
Cloudflare R2 (S3-compatible object storage).

R2 is 23× cheaper than storing raw text in Neon PostgreSQL, and
serves downloads with zero egress fees.

Environment variables required (set in Render dashboard):
    R2_ACCOUNT_ID       - Cloudflare account ID
    R2_ACCESS_KEY_ID    - R2 API token Access Key ID
    R2_SECRET_ACCESS_KEY - R2 API token Secret Access Key
    R2_BUCKET_NAME      - Bucket name (e.g. wellqc-las-files)

If any R2 env var is missing the service operates in PASSTHROUGH mode:
content is returned/stored as-is so the app keeps working without R2
configured (useful in local dev and CI).
"""

import logging
import os
from typing import Optional

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# Configuration — read once at import time
# ---------------------------------------------------------------------------
_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
_BUCKET = os.getenv("R2_BUCKET_NAME", "wellqc-las-files")

_R2_ENABLED = all([_ACCOUNT_ID, _ACCESS_KEY_ID, _SECRET_ACCESS_KEY])

_client = None


def _get_client():
    """Lazily initialise the boto3 S3 client pointed at Cloudflare R2."""
    global _client
    if _client is not None:
        return _client
    if not _R2_ENABLED:
        return None
    try:
        import boto3  # type: ignore
        from botocore.config import Config  # type: ignore

        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=_ACCESS_KEY_ID,
            aws_secret_access_key=_SECRET_ACCESS_KEY,
            config=Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "adaptive"},
                connect_timeout=10,
                read_timeout=30,
            ),
            region_name="auto",
        )
        logger.info("R2 storage client initialised (bucket: %s)", _BUCKET)
        return _client
    except Exception as exc:
        logger.warning("R2 client init failed — passthrough mode active: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def is_enabled() -> bool:
    """Return True if R2 credentials are configured."""
    return _R2_ENABLED and _get_client() is not None


def upload_las(owner_id: str, las_file_id: str, content: str) -> Optional[str]:
    """
    Upload raw LAS text to R2 and return the object key.

    Key format:  las/{owner_id}/{las_file_id}.las

    Returns the key string on success, or None if R2 is not enabled /
    upload failed (caller should fall back to storing content in DB).
    """
    client = _get_client()
    if not client:
        return None

    key = f"las/{owner_id}/{las_file_id}.las"
    try:
        client.put_object(
            Bucket=_BUCKET,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="text/plain",
            Metadata={"owner_id": owner_id, "las_file_id": las_file_id},
        )
        logger.info("R2 upload OK: %s", key)
        return key
    except Exception as exc:
        logger.error("R2 upload failed for key %s: %s", key, exc)
        return None


def download_las(r2_key: str) -> Optional[str]:
    """
    Fetch raw LAS text from R2 by its object key.

    Returns the decoded string on success, or None if not found / R2 down.
    """
    client = _get_client()
    if not client:
        return None
    try:
        response = client.get_object(Bucket=_BUCKET, Key=r2_key)
        return response["Body"].read().decode("utf-8")
    except Exception as exc:
        logger.error("R2 download failed for key %s: %s", r2_key, exc)
        return None


def delete_las(r2_key: str) -> bool:
    """
    Delete an object from R2 by key. Returns True on success.
    Safe to call even if the key does not exist.
    """
    client = _get_client()
    if not client:
        return False
    try:
        client.delete_object(Bucket=_BUCKET, Key=r2_key)
        logger.info("R2 delete OK: %s", r2_key)
        return True
    except Exception as exc:
        logger.error("R2 delete failed for key %s: %s", r2_key, exc)
        return False


def generate_presigned_download_url(r2_key: str, expires_in: int = 3600) -> Optional[str]:
    """
    Generate a time-limited presigned URL for direct browser download of a
    LAS file from R2 (bypasses the backend entirely — zero egress cost).

    expires_in: URL validity in seconds (default 1 hour).
    Returns URL string or None if R2 not configured.
    """
    client = _get_client()
    if not client:
        return None
    try:
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET, "Key": r2_key},
            ExpiresIn=expires_in,
        )
        return url
    except Exception as exc:
        logger.error("R2 presigned URL failed for key %s: %s", r2_key, exc)
        return None
