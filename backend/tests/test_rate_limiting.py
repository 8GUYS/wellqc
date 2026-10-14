import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.rate_limit import limiter

client = TestClient(app)


def test_rate_limiter_blocks_excessive_requests():
    """Verify that hitting a rate-limited endpoint more than max_requests triggers HTTP 429."""
    limiter.reset()

    # Trigger forgot-password up to limit (10 times)
    for _ in range(10):
        res = client.post("/api/auth/forgot-password", json={"email": "ratelimit_tester@wellqc.com"})
        assert res.status_code == 200

    # 11th request must be blocked by rate limiter with 429 Too Many Requests
    blocked_res = client.post("/api/auth/forgot-password", json={"email": "ratelimit_tester@wellqc.com"})
    assert blocked_res.status_code == 429
    assert "Too many requests" in blocked_res.json()["detail"]
    assert "Retry-After" in blocked_res.headers

    # Reset limiter cleans up
    limiter.reset()
    clean_res = client.post("/api/auth/forgot-password", json={"email": "ratelimit_tester@wellqc.com"})
    assert clean_res.status_code == 200
