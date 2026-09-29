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
