"""
CE2-34 — Patch las.py to fire outbound webhook events.

Hooks:
  - las.committed  → after each successful file_done in _run_batch
  - las.batch_complete → after the whole batch finishes in _run_batch
"""
import pathlib

las_path = pathlib.Path("backend/app/api/las.py")
text = las_path.read_text(encoding="utf-8")

# 1. Add import (after existing job_store import)
old_import = "from backend.app.services import job_store"
new_import = (
    "from backend.app.services import job_store\n"
    "from backend.app.services.outbound_webhook import fire_event as _fire_event"
)
assert old_import in text, "job_store import not found in las.py"
text = text.replace(old_import, new_import, 1)

# 2. Hook las.committed after the file_done push_event block
old_file_done = '''\
        # ── 4. Notify: done ───────────────────────────────────────────────
        await job_store.push_event(job_id, {
            "type":        "file_done",
            "index":       file_index,
            "total":       total,
            "fileName":    file_name,
            "wellId":      result.get("id"),
            "wellName":    result.get("wellName"),
            "overallScore": result.get("overallScore"),
            "qualityGrade": result.get("qualityGrade"),
        })'''

new_file_done = '''\
        # ── 4. Notify: done ───────────────────────────────────────────────
        await job_store.push_event(job_id, {
            "type":        "file_done",
            "index":       file_index,
            "total":       total,
            "fileName":    file_name,
            "wellId":      result.get("id"),
            "wellName":    result.get("wellName"),
            "overallScore": result.get("overallScore"),
            "qualityGrade": result.get("qualityGrade"),
        })

        # CE2-34: fire las.committed outbound webhook (non-blocking)
        asyncio.ensure_future(_fire_event(
            "las.committed",
            {
                "jobId":        job_id,
                "fileName":     file_name,
                "wellId":       result.get("id"),
                "wellName":     result.get("wellName"),
                "overallScore": result.get("overallScore"),
                "qualityGrade": result.get("qualityGrade"),
            },
            db,
        ))'''

assert old_file_done in text, "file_done anchor not found in las.py"
text = text.replace(old_file_done, new_file_done, 1)

# 3. Hook las.batch_complete after close_job
old_batch_complete = '''\
    # ── 5. All files processed — close the stream ─────────────────────────
    await job_store.push_event(job_id, {
        "type":  "batch_complete",
        "total": total,
    })
    await job_store.close_job(job_id)'''

new_batch_complete = '''\
    # ── 5. All files processed — close the stream ─────────────────────────
    await job_store.push_event(job_id, {
        "type":  "batch_complete",
        "total": total,
    })
    await job_store.close_job(job_id)

    # CE2-34: fire las.batch_complete outbound webhook (non-blocking)
    asyncio.ensure_future(_fire_event(
        "las.batch_complete",
        {"jobId": job_id, "total": total},
        db,
    ))'''

assert old_batch_complete in text, "batch_complete anchor not found in las.py"
text = text.replace(old_batch_complete, new_batch_complete, 1)

las_path.write_text(text, encoding="utf-8")
print("las.py patched successfully.")
