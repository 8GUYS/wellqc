"""
CE2-34 — Outbound Webhook Storage Sync Dispatcher.

Dispatches signed HTTP POST payloads to external subscriber endpoints when
internal WellQC events fire (e.g. well.certified, las.committed).

Design:
- Uses the existing Webhook model (url, secret, events, active, userId).
- Signs each delivery with HMAC-SHA256 over the JSON body, identical to
  the inbound Paystack signature pattern so subscribers verify consistently.
- Retries up to 3 times with exponential back-off (1s → 2s → 4s).
- Runs entirely in an asyncio background task — never blocks the HTTP response.
- No new infrastructure: pure asyncio + httpx.

Signature header: X-WellQC-Signature: sha256=<hex>
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("uvicorn.error")

_MAX_RETRIES = 3
_RETRY_BASE_SECONDS = 1.0
_DELIVERY_TIMEOUT_SECONDS = 10


def _sign_payload(secret: str, body: bytes) -> str:
    """Return sha256=<hex> HMAC signature over *body* using *secret*."""
    mac = hmac.new(secret.encode("utf-8"), body, hashlib.sha256)
    return f"sha256={mac.hexdigest()}"


async def _deliver_once(url: str, headers: dict, body: bytes) -> int:
    """POST *body* to *url* with *headers*. Returns HTTP status code."""
    async with httpx.AsyncClient(timeout=_DELIVERY_TIMEOUT_SECONDS) as client:
        response = await client.post(url, content=body, headers=headers)
        return response.status_code


async def _dispatch_to_subscriber(
    webhook_id: str,
    url: str,
    secret: str,
    event: str,
    payload: dict[str, Any],
) -> None:
    """
    Deliver a signed webhook to a single subscriber URL.
    Retries up to _MAX_RETRIES times on non-2xx or connection errors.
    """
    body = json.dumps(
        {"event": event, "timestamp": datetime.now(timezone.utc).isoformat(), "data": payload},
        default=str,
    ).encode("utf-8")

    signature = _sign_payload(secret, body)
    headers = {
        "Content-Type": "application/json",
        "X-WellQC-Signature": signature,
        "X-WellQC-Event": event,
        "User-Agent": "WellQC-Webhook/1.0",
    }

    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            status = await _deliver_once(url, headers, body)
            if 200 <= status < 300:
                logger.info(
                    "Webhook %s delivered to %s (attempt %d, status %d)",
                    webhook_id, url, attempt, status,
                )
                return
            logger.warning(
                "Webhook %s non-2xx from %s (attempt %d, status %d)",
                webhook_id, url, attempt, status,
            )
        except Exception as exc:
            logger.warning(
                "Webhook %s delivery error on attempt %d to %s: %s",
                webhook_id, attempt, url, exc,
            )

        if attempt < _MAX_RETRIES:
            await asyncio.sleep(_RETRY_BASE_SECONDS * (2 ** (attempt - 1)))

    logger.error(
        "Webhook %s exhausted %d retries for event '%s' to %s",
        webhook_id, _MAX_RETRIES, event, url,
    )


async def fire_event(event: str, payload: dict[str, Any], db) -> None:
    """
    Look up all active Webhook subscribers for *event* and dispatch in parallel.

    Call this from any API endpoint after a state-changing operation:

        from backend.app.services.outbound_webhook import fire_event
        asyncio.ensure_future(fire_event("well.certified", {"wellId": well.id, ...}, db))

    *db* is a SQLAlchemy Session.  Webhook rows are read synchronously (fast
    primary-key scan) before the async dispatch fan-out starts.

    Supported event names (extend as needed):
        well.certified      — a well's status was promoted to CERTIFIED
        well.created        — a new well record was created
        las.committed       — a LAS file was successfully committed and QA'd
        las.batch_complete  — an SSE batch job completed
    """
    from backend.app.models.models import Webhook

    try:
        # Read matching webhooks synchronously (we're inside an async context
        # but SQLAlchemy sync session is fine for a quick indexed query).
        webhooks = (
            db.query(Webhook)
            .filter(Webhook.active == True)  # noqa: E712
            .all()
        )
    except Exception as exc:
        logger.error("fire_event: DB query failed for event '%s': %s", event, exc)
        return

    # Filter to those subscribed to this event
    targets = [
        w for w in webhooks
        if event in (w.events or "").split(",")
        or "*" in (w.events or "").split(",")
    ]

    if not targets:
        return

    # Fan-out — all deliveries run concurrently
    tasks = [
        _dispatch_to_subscriber(w.id, w.url, w.secret, event, payload)
        for w in targets
    ]
    await asyncio.gather(*tasks, return_exceptions=True)
