import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any, Dict, Optional
from backend.app.core.config import settings

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def _b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    # Match Node crypto.scrypt(password, salt_str, 64)
    # In Node, string salt is treated as utf-8 bytes
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        maxmem=0,
        dklen=64,
    )
    return f"{salt}:{derived.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split(":")
        if len(parts) != 2:
            return False
        salt, expected_hex = parts
        derived = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt.encode("utf-8"),
            n=16384,
            r=8,
            p=1,
            maxmem=0,
            dklen=64,
        )
        return hmac.compare_digest(derived.hex(), expected_hex)
    except Exception:
        return False

def create_session_token(user_data: Dict[str, Any]) -> str:
    payload_dict = {
        **user_data,
        "exp": int((time.time() + settings.SESSION_MAX_AGE_SECONDS) * 1000),  # ms timestamp
    }
    # Match Node JSON.stringify()
    payload_json = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload_json)
    
    signature_bytes = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64url_encode(signature_bytes)
    
    return f"{payload_b64}.{signature_b64}"

def read_session_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token or "." not in token:
        return None
    
    parts = token.split(".")
    if len(parts) != 2:
        return None
    
    payload_b64, signature_b64 = parts
    expected_bytes = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected_signature_b64 = _b64url_encode(expected_bytes)
    
    if not hmac.compare_digest(expected_signature_b64, signature_b64):
        return None
    
    try:
        raw_payload = _b64url_decode(payload_b64).decode("utf-8")
        parsed = json.loads(raw_payload)
        exp = parsed.get("exp")
        now_ms = int(time.time() * 1000)
        if not exp or exp < now_ms:
            return None
        return parsed
    except Exception:
        return None


def create_email_verification_token(
    user_id: str,
    email: str,
    expires_in_seconds: Optional[int] = None,
) -> str:
    """
    Generate a cryptographically signed HMAC-SHA256 email verification token.
    Token payload encapsulates user UUID, email address, purpose tag, and Unix expiry.
    """
    if expires_in_seconds is None:
        expires_in_seconds = settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_SECONDS

    payload_dict = {
        "sub": user_id,
        "email": email.strip().lower(),
        "type": "email_verification",
        "exp": int((time.time() + expires_in_seconds) * 1000),  # ms timestamp
    }
    payload_json = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload_json)

    signature_bytes = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64url_encode(signature_bytes)

    return f"{payload_b64}.{signature_b64}"


def read_email_verification_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Validate and decode an email verification token.
    Verifies cryptographic signature, type tag, and expiration timestamp.
    Returns decoded payload if valid and non-expired; otherwise None.
    """
    if not token or "." not in token:
        return None

    parts = token.split(".")
    if len(parts) != 2:
        return None

    payload_b64, signature_b64 = parts
    expected_bytes = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected_signature_b64 = _b64url_encode(expected_bytes)

    if not hmac.compare_digest(expected_signature_b64, signature_b64):
        return None

    try:
        raw_payload = _b64url_decode(payload_b64).decode("utf-8")
        parsed = json.loads(raw_payload)

        # Verify token purpose tag
        if parsed.get("type") != "email_verification":
            return None

        # Verify expiration
        exp = parsed.get("exp")
        now_ms = int(time.time() * 1000)
        if not exp or exp < now_ms:
            return None

        return parsed
    except Exception:
        return None


def create_password_reset_token(
    user_id: str,
    email: str,
    expires_in_seconds: int = 3600,
) -> str:
    """
    Generate a cryptographically signed HMAC-SHA256 password reset token.
    Token payload encapsulates user UUID, email address, password_reset purpose tag, and Unix expiry.
    """
    payload_dict = {
        "sub": user_id,
        "email": email.strip().lower(),
        "type": "password_reset",
        "exp": int((time.time() + expires_in_seconds) * 1000),  # ms timestamp
    }
    payload_json = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")
    payload_b64 = _b64url_encode(payload_json)

    signature_bytes = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _b64url_encode(signature_bytes)

    return f"{payload_b64}.{signature_b64}"


def read_password_reset_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Validate and decode a password reset token.
    Verifies cryptographic signature, type tag ('password_reset'), and expiration timestamp.
    Returns decoded payload if valid and non-expired; otherwise None.
    """
    if not token or "." not in token:
        return None

    parts = token.split(".")
    if len(parts) != 2:
        return None

    payload_b64, signature_b64 = parts
    expected_bytes = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    expected_signature_b64 = _b64url_encode(expected_bytes)

    if not hmac.compare_digest(expected_signature_b64, signature_b64):
        return None

    try:
        raw_payload = _b64url_decode(payload_b64).decode("utf-8")
        parsed = json.loads(raw_payload)

        # Verify token purpose tag
        if parsed.get("type") != "password_reset":
            return None

        # Verify expiration
        exp = parsed.get("exp")
        now_ms = int(time.time() * 1000)
        if not exp or exp < now_ms:
            return None

        return parsed
    except Exception:
        return None


