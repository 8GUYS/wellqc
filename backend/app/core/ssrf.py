"""
SSRF (Server-Side Request Forgery) Protection Module
===================================================
Validates outbound URLs to prevent Server-Side Request Forgery (SSRF) attacks.
Disallows connections to:
- Loopback addresses (127.0.0.1, ::1, localhost)
- Private RFC-1918 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Link-local and cloud metadata endpoints (169.254.169.254, fe80::/10)
- Multicast, broadcast, and unspecified addresses (0.0.0.0)
"""

import ipaddress
import socket
from urllib.parse import urlparse
from fastapi import HTTPException, status

ALLOWED_SCHEMES = {"http", "https"}
DISALLOWED_HOSTS = {"localhost", "metadata.google.internal"}


class SSRFValidationError(ValueError):
    """Raised when a URL fails SSRF safety checks."""
    pass


def is_safe_ip(ip_str: str) -> bool:
    """Return True if the IP is public and safe for outbound requests."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    if (
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return False

    return True


def validate_safe_url(url: str, allow_private: bool = False) -> str:
    """
    Validate that a given URL is safe from SSRF vulnerabilities.
    
    Returns the validated URL string or raises SSRFValidationError / HTTPException.
    """
    if not url or not isinstance(url, str):
        raise SSRFValidationError("URL cannot be empty.")

    clean_url = url.strip()
    parsed = urlparse(clean_url)

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise SSRFValidationError(
            f"Invalid URL scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted."
        )

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("URL must include a valid host.")

    hostname_lower = hostname.lower()
    if hostname_lower in DISALLOWED_HOSTS or hostname_lower.endswith((".local", ".internal")):
        if not allow_private:
            raise SSRFValidationError(f"Access to '{hostname}' is restricted (internal host).")

    # Resolve hostname to IP addresses
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise SSRFValidationError(f"Could not resolve host '{hostname}'.")

    if not addr_info:
        raise SSRFValidationError(f"No IP addresses resolved for host '{hostname}'.")

    # Verify all resolved IPs are safe
    for info in addr_info:
        ip_addr = info[4][0]
        if not allow_private and not is_safe_ip(ip_addr):
            raise SSRFValidationError(
                f"URL resolves to a restricted or private address ({ip_addr})."
            )

    return clean_url


def enforce_safe_url(url: str, allow_private: bool = False) -> str:
    """
    FastAPI helper that raises an HTTPException(400) if SSRF validation fails.
    """
    try:
        return validate_safe_url(url, allow_private=allow_private)
    except SSRFValidationError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SSRF Security Violation: {str(err)}",
        )
