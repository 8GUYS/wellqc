"""
job_store.py — In-memory async job registry for SSE ingestion workers.

Each batch upload creates one Job keyed by a UUID job_id.
The job holds an asyncio.Queue of SSE event dicts that the
/api/las/job/{job_id}/stream endpoint drains in real-time.

Design decisions:
- Pure asyncio, zero extra infrastructure (no Redis/Celery).
- One store per FastAPI worker process — fits Render's single-process free tier.
- Jobs are GC'd after JOB_TTL_SECONDS to prevent memory leaks on long-lived servers.
- Queue is bounded (maxsize=256) so a stalled consumer cannot exhaust memory.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

# ── Constants ────────────────────────────────────────────────────────────────
JOB_TTL_SECONDS = 600          # 10 minutes — job evicted after this
QUEUE_MAXSIZE   = 256          # max SSE events buffered per job
SENTINEL        = object()     # signals stream end to consumer

# ── Data model ───────────────────────────────────────────────────────────────

@dataclass
class Job:
    job_id:     str
    total:      int                        # total files in this batch
    created_at: float = field(default_factory=time.monotonic)
    queue:      asyncio.Queue = field(init=False)

    def __post_init__(self) -> None:
        self.queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)

    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > JOB_TTL_SECONDS


# ── Registry (module-level singleton) ────────────────────────────────────────

_jobs: Dict[str, Job] = {}
_lock: asyncio.Lock   = asyncio.Lock()


async def create_job(total: int) -> str:
    """Create a new job for `total` files. Returns the job_id."""
    _evict_expired()
    job_id = str(uuid.uuid4())
    async with _lock:
        _jobs[job_id] = Job(job_id=job_id, total=total)
    return job_id


def get_job(job_id: str) -> Optional[Job]:
    """Return the Job or None if unknown / expired."""
    return _jobs.get(job_id)


async def push_event(job_id: str, event: Dict[str, Any]) -> None:
    """Put one SSE event dict onto the job's queue (non-blocking best-effort)."""
    job = _jobs.get(job_id)
    if job is None:
        return
    try:
        job.queue.put_nowait(event)
    except asyncio.QueueFull:
        # Drop oldest, then push new — prevents deadlock if consumer is slow
        try:
            job.queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            job.queue.put_nowait(event)
        except asyncio.QueueFull:
            pass


async def close_job(job_id: str) -> None:
    """Signal stream end then remove the job from the registry."""
    job = _jobs.get(job_id)
    if job:
        try:
            job.queue.put_nowait(SENTINEL)
        except asyncio.QueueFull:
            pass
        # Give consumer a moment to drain before eviction
        await asyncio.sleep(0.1)
        _jobs.pop(job_id, None)


def _evict_expired() -> None:
    """Remove jobs older than JOB_TTL_SECONDS (called on each job creation)."""
    expired = [jid for jid, j in _jobs.items() if j.is_expired()]
    for jid in expired:
        _jobs.pop(jid, None)
