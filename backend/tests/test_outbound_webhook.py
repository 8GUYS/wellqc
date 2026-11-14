"""
CE2-34 — Tests for the outbound webhook dispatcher.

Tests:
1. HMAC-SHA256 signature is correct and verifiable
2. Successful delivery on 200 response
3. Retry logic: succeeds on 3rd attempt after two failures
4. Exhausted retries (all 3 fail) logs error without raising
5. fire_event: no-op when no active webhooks match the event
6. fire_event: filters by event name correctly
"""
import asyncio
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

from backend.app.services.outbound_webhook import (
    _sign_payload,
    _dispatch_to_subscriber,
    fire_event,
)


# ─── Unit: signing ────────────────────────────────────────────────────────────

def test_sign_payload_format():
    sig = _sign_payload("mysecret", b"hello")
    assert sig.startswith("sha256=")
    assert len(sig) == len("sha256=") + 64  # 32-byte hex = 64 chars


def test_sign_payload_correctness():
    secret = "test-secret"
    body = b'{"event":"well.created"}'
    expected_hex = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert _sign_payload(secret, body) == f"sha256={expected_hex}"


def test_sign_payload_different_secrets_differ():
    body = b"payload"
    assert _sign_payload("secret1", body) != _sign_payload("secret2", body)


# ─── Unit: delivery ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_succeeds_on_first_attempt():
    mock_response = MagicMock()
    mock_response.status_code = 200

    with patch(
        "backend.app.services.outbound_webhook._deliver_once",
        new_callable=AsyncMock,
        return_value=200,
    ):
        # Should not raise
        await _dispatch_to_subscriber(
            "wh-1", "https://example.com/hook", "secret", "well.created", {"wellId": "x"}
        )


@pytest.mark.asyncio
async def test_dispatch_retries_on_non_2xx_then_succeeds():
    call_count = 0

    async def flaky_deliver(url, headers, body):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return 500
        return 200

    with patch("backend.app.services.outbound_webhook._deliver_once", side_effect=flaky_deliver):
        with patch("asyncio.sleep", new_callable=AsyncMock):
            await _dispatch_to_subscriber(
                "wh-2", "https://example.com/hook", "secret", "las.committed", {}
            )
    assert call_count == 3


@pytest.mark.asyncio
async def test_dispatch_exhausts_retries_without_raising():
    async def always_fails(url, headers, body):
        return 503

    with patch("backend.app.services.outbound_webhook._deliver_once", side_effect=always_fails):
        with patch("asyncio.sleep", new_callable=AsyncMock):
            # Must not raise even after all retries exhausted
            await _dispatch_to_subscriber(
                "wh-3", "https://example.com/hook", "secret", "las.batch_complete", {}
            )


@pytest.mark.asyncio
async def test_dispatch_retries_on_connection_error():
    call_count = 0

    async def raises_then_succeeds(url, headers, body):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise ConnectionError("timeout")
        return 200

    with patch(
        "backend.app.services.outbound_webhook._deliver_once",
        side_effect=raises_then_succeeds,
    ):
        with patch("asyncio.sleep", new_callable=AsyncMock):
            await _dispatch_to_subscriber(
                "wh-4", "https://example.com/hook", "secret", "well.created", {}
            )
    assert call_count == 2


# ─── Integration: fire_event ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fire_event_noop_when_no_webhooks():
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    # Should complete without calling _dispatch_to_subscriber
    with patch(
        "backend.app.services.outbound_webhook._dispatch_to_subscriber",
        new_callable=AsyncMock,
    ) as mock_dispatch:
        await fire_event("well.created", {"wellId": "x"}, db)
        mock_dispatch.assert_not_called()


@pytest.mark.asyncio
async def test_fire_event_delivers_to_matching_subscribers():
    wh1 = MagicMock()
    wh1.id = "wh-a"
    wh1.url = "https://subscriber-a.io/hook"
    wh1.secret = "sec-a"
    wh1.events = "well.created,las.committed"

    wh2 = MagicMock()
    wh2.id = "wh-b"
    wh2.url = "https://subscriber-b.io/hook"
    wh2.secret = "sec-b"
    wh2.events = "las.committed"  # does NOT match well.created

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [wh1, wh2]

    with patch(
        "backend.app.services.outbound_webhook._dispatch_to_subscriber",
        new_callable=AsyncMock,
    ) as mock_dispatch:
        await fire_event("well.created", {"wellId": "x"}, db)
        # Only wh1 matches "well.created"
        assert mock_dispatch.call_count == 1
        args = mock_dispatch.call_args[0]
        assert args[0] == "wh-a"


@pytest.mark.asyncio
async def test_fire_event_wildcard_subscriber_gets_all_events():
    wh = MagicMock()
    wh.id = "wh-c"
    wh.url = "https://sink.io/hook"
    wh.secret = "sec-c"
    wh.events = "*"

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [wh]

    with patch(
        "backend.app.services.outbound_webhook._dispatch_to_subscriber",
        new_callable=AsyncMock,
    ) as mock_dispatch:
        await fire_event("las.batch_complete", {"jobId": "j1", "total": 3}, db)
        assert mock_dispatch.call_count == 1
