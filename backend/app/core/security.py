import base64
import hashlib
import html
import hmac
import json
import os
import re
import secrets
import time
from typing import Any, Dict, List, Optional
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

def normalize_role(role: Optional[str]) -> str:
    """
    Normalizes a role string to either 'ADMIN' or 'USER'.
    Provides backward-compatible fallback mapping any legacy
    PETROPHYSICIST, DATA_ENGINEER, GEOSCIENTIST, VIEWER, etc. to 'USER'.
    """
    if not role:
        return "USER"
    r = role.strip().upper()
    return "ADMIN" if r == "ADMIN" else "USER"

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


# ===========================================================================
# SQL Injection (SQLi) Defense & Form Protection Utilities
# ===========================================================================

# Comprehensive SQL Injection (SQLi) attack signatures
SQL_INJECTION_PATTERNS = [
    # Tautology / Boolean-based SQLi: ' OR '1'='1, " OR 1=1, ' OR true, " OR 'a'='a'
    re.compile(r"(['\"]\s*(OR|AND)\s+['\"]?(\d+|true|'[^']*'|\"[^\"]*\")(\s*=\s*['\"]?(\d+|true|'[^']*'|\"[^\"]*\"))?)", re.IGNORECASE),
    re.compile(r"(\b(OR|AND)\b\s+['\"]?(\d+|true|'[^']*'|\"[^\"]*\")\s*=\s*['\"]?(\d+|true|'[^']*'|\"[^\"]*\"))", re.IGNORECASE),
    # Union-based SQLi: UNION SELECT, UNION ALL SELECT
    re.compile(r"(\bUNION\s+(ALL\s+)?SELECT\b)", re.IGNORECASE),
    # Stacked commands / DDL / DML injection: ; DROP TABLE, ; TRUNCATE, ; DELETE FROM, ; ALTER TABLE
    re.compile(r"(;\s*(DROP|ALTER|TRUNCATE|DELETE\s+FROM|INSERT\s+INTO|UPDATE|CREATE)\s+)", re.IGNORECASE),
    # Time-based blind SQLi: pg_sleep, sleep(), waitfor delay, benchmark()
    re.compile(r"(\b(pg_sleep\s*\(|sleep\s*\(|waitfor\s+delay|benchmark\s*\())", re.IGNORECASE),
    # SQL comment injection at end of string with quotes or keywords: ' --, " --, /* ... */
    re.compile(r"(['\"][^'\"]*(--|\/\*))", re.IGNORECASE),
    # System execution / privilege escalation SQLi: xp_cmdshell, exec(), sp_executesql
    re.compile(r"(\b(xp_cmdshell|exec\s*\(|sp_executesql)\b)", re.IGNORECASE),
    # Information schema harvesting: FROM information_schema
    re.compile(r"(\bFROM\s+information_schema\b)", re.IGNORECASE),
]

# Unsafe HTML / script patterns for form inputs (XSS prevention)
HTML_TAG_PATTERN = re.compile(r"<[^>]*>", re.IGNORECASE)
DANGEROUS_SCRIPT_PATTERN = re.compile(
    r"(<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|javascript:|data:text\/html|on\w+\s*=)",
    re.IGNORECASE,
)


def detect_sql_injection(data: Any, path: str = "root") -> Optional[str]:
    """
    Recursively scans incoming request data (strings, dicts, lists) for SQL injection signatures.
    Returns a description of the detected threat if found, or None if the payload is clean.
    """
    if data is None:
        return None

    if isinstance(data, str):
        # Null bytes can exploit C-string terminators or bypass filters
        if "\x00" in data:
            return f"Null byte injection detected at '{path}'"

        # Check against SQL injection regex signatures
        for pattern in SQL_INJECTION_PATTERNS:
            match = pattern.search(data)
            if match:
                return f"SQL injection signature matched at '{path}': {match.group(0)}"
        return None

    if isinstance(data, dict):
        for k, v in data.items():
            # Check key itself
            if isinstance(k, str):
                key_threat = detect_sql_injection(k, f"{path}.key[{k}]")
                if key_threat:
                    return key_threat
            # Check value
            val_threat = detect_sql_injection(v, f"{path}.{k}")
            if val_threat:
                return val_threat
        return None

    if isinstance(data, list):
        for idx, item in enumerate(data):
            threat = detect_sql_injection(item, f"{path}[{idx}]")
            if threat:
                return threat
        return None

    return None


def sanitize_text(val: Optional[str], max_length: int = 255) -> str:
    """
    Sanitizes user input from form fields:
    - Strips leading and trailing whitespace
    - Removes null bytes
    - Strips dangerous script tags and inline handlers
    - Escapes HTML entities to prevent Stored XSS
    - Enforces maximum length constraint
    """
    if not val:
        return ""
    # Remove null bytes
    clean = val.replace("\x00", "").strip()
    # Remove dangerous script tags / event handlers
    clean = DANGEROUS_SCRIPT_PATTERN.sub("", clean)
    # Escape HTML to prevent Stored XSS
    clean = html.escape(clean, quote=True)
    # Truncate to maximum length
    return clean[:max_length]


def validate_safe_identifier(val: str, field_name: str = "Identifier", max_len: int = 100) -> str:
    """
    Validates that a string is a safe identifier (e.g. well name, API number, alias, mnemonic).
    Allows letters, digits, spaces, hyphens, underscores, dots, and slashes.
    Disallows quotes, semicolons, comments, angle brackets, and control characters.
    """
    if not val:
        return ""
    clean = val.replace("\x00", "").strip()
    if len(clean) > max_len:
        raise ValueError(f"{field_name} must not exceed {max_len} characters.")

    # Reject dangerous SQL / HTML characters
    unsafe_chars = ["'", '"', ";", "--", "/*", "*/", "<", ">", "\\"]
    for char in unsafe_chars:
        if char in clean:
            raise ValueError(f"{field_name} contains prohibited character or sequence '{char}'.")
    return clean



