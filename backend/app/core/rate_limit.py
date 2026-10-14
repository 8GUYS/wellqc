import time
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status

logger = logging.getLogger("wellqc.rate_limit")


class SlidingWindowRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Tracks client request timestamps per IP/key within a sliding window.
    Automatically purges expired timestamps to prevent memory leakage.
    """

    def __init__(self):
        # key -> list of timestamp floats
        self._records: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_old_keys(self, now: float, max_age: float = 3600.0):
        """Periodically purge keys that haven't been touched in over an hour."""
        if now - self._last_cleanup < 300.0:
            return
        self._last_cleanup = now
        expired_keys = [
            k for k, timestamps in self._records.items()
            if not timestamps or (now - timestamps[-1]) > max_age
        ]
        for k in expired_keys:
            self._records.pop(k, None)

    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        """
        Check if request under `key` is allowed within `window_seconds`.
        Returns (is_allowed, retry_after_seconds).
        """
        now = time.time()
        self._cleanup_old_keys(now)

        window_start = now - window_seconds
        timestamps = self._records.get(key, [])
        # Keep only timestamps within current sliding window
        valid_timestamps = [t for t in timestamps if t > window_start]

        if len(valid_timestamps) >= max_requests:
            # Exceeded limit: calculate retry-after
            oldest_in_window = valid_timestamps[0]
            retry_after = max(1, int(window_seconds - (now - oldest_in_window)))
            self._records[key] = valid_timestamps
            return False, retry_after

        # Record this request
        valid_timestamps.append(now)
        self._records[key] = valid_timestamps
        return True, 0

    def reset(self):
        """Clear all rate limit records (useful for test resets)."""
        self._records.clear()


# Global in-memory limiter instance
limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP respecting X-Forwarded-For if behind a proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in chain is client IP
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class RateLimitDependency:
    """
    FastAPI dependency factory for applying rate limits to route handlers.

    Usage:
        @router.post("/login", dependencies=[Depends(RateLimitDependency(max_requests=5, window_seconds=60))])
    """

    def __init__(self, max_requests: int, window_seconds: int, action: str = "generic"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.action = action

    def __call__(self, request: Request):
        ip = get_client_ip(request)
        key = f"{self.action}:{ip}"

        allowed, retry_after = limiter.is_allowed(
            key=key,
            max_requests=self.max_requests,
            window_seconds=self.window_seconds,
        )

        if not allowed:
            logger.warning(
                f"Rate limit exceeded for action '{self.action}' by IP {ip}. "
                f"Retry after {retry_after}s."
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests for {self.action}. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
