import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import time
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.models.models import User
from backend.app.core.security import create_session_token

client = TestClient(app)

def test_public():
    print("=== Testing Public Endpoints ===", flush=True)
    endpoints = [
        ("GET", "/health"),
        ("GET", "/api/health"),
        ("GET", "/"),
        ("GET", "/openapi.json"),
        ("GET", "/docs"),
    ]
    for method, path in endpoints:
        t0 = time.time()
        res = client.request(method, path)
        t1 = time.time()
        print(f"[{res.status_code}] {method:4} {path:25} ({t1-t0:.3f}s)", flush=True)

def test_authenticated():
    print("\n=== Testing Authenticated Endpoints ===", flush=True)
    db = SessionLocal()
    user = db.query(User).filter(User.role == "ADMIN").first()
    if not user:
        user = db.query(User).first()
    db.close()
    
    token = create_session_token({
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
    })
    headers = {"Authorization": f"Bearer {token}"}
    cookies = {"wellqc_session": token}

    auth_endpoints = [
        ("GET", "/api/auth/me"),
        ("GET", "/api/dashboard"),
        ("GET", "/api/analytics"),
        ("GET", "/api/activity"),
        ("GET", "/api/qa-engine"),
        ("GET", "/api/standardisation/curves"),
        ("GET", "/api/standardisation/aliases"),
        ("GET", "/api/user/profile"),
        ("GET", "/api/admin/users"),
        ("GET", "/api/admin/email-settings"),
        ("GET", "/api/admin/tokens"),
        ("GET", "/api/admin/webhooks"),
        ("GET", "/api/wells"),
    ]

    for method, path in auth_endpoints:
        t0 = time.time()
        try:
            res = client.request(method, path, headers=headers, cookies=cookies)
            t1 = time.time()
            print(f"[{res.status_code}] {method:4} {path:30} ({t1-t0:.3f}s)", flush=True)
            if res.status_code >= 400:
                print(f"  -> Error: {res.text[:200]}", flush=True)
        except Exception as e:
            t1 = time.time()
            print(f"[EXC]  {method:4} {path:30} ({t1-t0:.3f}s) -> {e}", flush=True)

if __name__ == "__main__":
    test_public()
    test_authenticated()
