import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.security import detect_sql_injection, sanitize_text, validate_safe_identifier

client = TestClient(app)

def test_detect_sql_injection_unit():
    """Unit test verify detect_sql_injection catches various malicious payloads."""
    # Tautology
    assert detect_sql_injection("' OR '1'='1") is not None
    assert detect_sql_injection("' OR 1=1 --") is not None
    assert detect_sql_injection('" OR true') is not None
    
    # Union based
    assert detect_sql_injection("1 UNION SELECT id, passwordHash FROM User --") is not None
    assert detect_sql_injection("UNION ALL SELECT null, null") is not None

    # Stacked queries
    assert detect_sql_injection("test; DROP TABLE Well; --") is not None
    assert detect_sql_injection("; TRUNCATE TABLE User") is not None

    # Time based / sleep
    assert detect_sql_injection("1'; pg_sleep(5); --") is not None
    assert detect_sql_injection("sleep(10)") is not None

    # System functions
    assert detect_sql_injection("xp_cmdshell('dir')") is not None

    # Null bytes
    assert detect_sql_injection("admin\x00user") is not None

    # Legitimate values should NOT be flagged
    assert detect_sql_injection("AKPO_NORTH_12") is None
    assert detect_sql_injection("NG-AKPO-012") is None
    assert detect_sql_injection("Chevron Nigeria Limited") is None
    assert detect_sql_injection("user@example.com") is None
    assert detect_sql_injection("Deep offshore Niger Delta basin") is None

def test_sanitize_text_strips_html_and_null_bytes():
    """Verify sanitize_text prevents Stored XSS and null byte injection."""
    dirty = "  <script>alert('xss')</script>John Doe\x00  "
    clean = sanitize_text(dirty, max_length=50)
    assert "<script>" not in clean
    assert "\x00" not in clean
    assert "John Doe" in clean

def test_validate_safe_identifier():
    """Verify validate_safe_identifier prevents dangerous SQL and shell characters."""
    assert validate_safe_identifier("AKPO-12_B") == "AKPO-12_B"
    with pytest.raises(ValueError):
        validate_safe_identifier("AKPO'; DROP TABLE Well; --")
    with pytest.raises(ValueError):
        validate_safe_identifier("<script>alert(1)</script>")

def test_middleware_blocks_sqli_in_query_params():
    """Verify HTTP requests with SQLi in query string are rejected with 400 Bad Request."""
    res = client.get("/api/dashboard?scope=' OR '1'='1")
    assert res.status_code == 400
    assert "potentially malicious SQL injection detected" in res.json()["detail"]

    res2 = client.get("/api/wells?search=1; DROP TABLE Well; --")
    assert res2.status_code == 400

def test_middleware_blocks_sqli_in_json_body():
    """Verify HTTP POST requests with SQLi in form JSON are rejected with 400 Bad Request."""
    malicious_payload = {
        "email": "' OR '1'='1",
        "password": "Password123!",
    }
    res = client.post("/api/auth/login", json=malicious_payload)
    assert res.status_code == 400
    assert "potentially malicious SQL injection detected" in res.json()["detail"]

    malicious_register = {
        "name": "Hacker'; DROP TABLE User; --",
        "email": "hacker@wellqc.com",
        "password": "ValidPassword123!",
        "acceptedNda": True,
    }
    res_reg = client.post("/api/auth/register", json=malicious_register)
    assert res_reg.status_code == 400

def test_security_headers_present_on_response():
    """Verify defense-in-depth security headers are attached to responses."""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-XSS-Protection") == "1; mode=block"
