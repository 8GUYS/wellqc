import pytest
from backend.app.core.ssrf import validate_safe_url, is_safe_ip, SSRFValidationError


def test_ssrf_blocks_private_ips():
    """Verify that RFC-1918 and link-local private IPs are rejected."""
    bad_urls = [
        "http://127.0.0.1:8000/internal",
        "http://127.0.0.2:80/status",
        "http://10.0.0.1/admin",
        "http://192.168.1.1/router",
        "http://172.16.0.10/api",
        "http://169.254.169.254/latest/meta-data/",  # AWS / Render metadata
        "http://0.0.0.0:8000",
    ]
    for url in bad_urls:
        with pytest.raises(SSRFValidationError):
            validate_safe_url(url)


def test_ssrf_blocks_localhost_and_internal_domains():
    """Verify that localhost and local hostnames are rejected."""
    bad_urls = [
        "http://localhost:3000",
        "http://localhost/secret",
        "http://server.local/api",
        "http://cluster.internal/status",
    ]
    for url in bad_urls:
        with pytest.raises(SSRFValidationError):
            validate_safe_url(url)


def test_ssrf_blocks_disallowed_schemes():
    """Verify that non-HTTP/HTTPS schemes are rejected."""
    bad_urls = [
        "file:///etc/passwd",
        "ftp://files.example.com/data",
        "gopher://gopher.example.com",
        "data:text/plain;base64,SGVsbG8=",
    ]
    for url in bad_urls:
        with pytest.raises(SSRFValidationError):
            validate_safe_url(url)


def test_ssrf_allows_valid_public_urls():
    """Verify that legitimate public domains are accepted."""
    good_urls = [
        "https://example.com/webhook",
        "https://api.github.com/events",
        "https://www.google.com",
    ]
    for url in good_urls:
        res = validate_safe_url(url)
        assert res == url
