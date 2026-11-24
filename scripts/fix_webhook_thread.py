"""
Fix CE2-34: asyncio.ensure_future() fails in sync threadpool endpoint (wells.py).

create_well is a sync FastAPI route => runs in AnyIO worker thread => no event loop.
Fix: use threading.Thread + asyncio.run() to fire webhook in a fresh event loop.
"""
import pathlib

wells_path = pathlib.Path("backend/app/api/wells.py")
text = wells_path.read_text(encoding="utf-8")

# 1. Replace 'import asyncio as _asyncio' with threading import
old_import = "import asyncio as _asyncio\nfrom backend.app.services.outbound_webhook import fire_event as _fire_event"
new_import = "import threading as _threading\nimport asyncio as _asyncio\nfrom backend.app.services.outbound_webhook import fire_event as _fire_event"
assert old_import in text, "asyncio import not found"
text = text.replace(old_import, new_import, 1)

# 2. Replace asyncio.ensure_future() call with threading.Thread + asyncio.run()
old_fire = '''\
    # CE2-34: fire well.created outbound webhook (non-blocking)
    _asyncio.ensure_future(_fire_event(
        "well.created",
        {
            "wellId": well.id,
            "apiNo": well.apiNo,
            "name": well.name,
            "operatorName": well.operatorName,
            "qualityGrade": well.qualityGrade,
        },
        db,
    ))'''

new_fire = '''\
    # CE2-34: fire well.created outbound webhook (non-blocking).
    # create_well runs in a sync threadpool (no event loop) so we spin a
    # daemon thread with its own asyncio.run() rather than ensure_future().
    _webhook_payload = {
        "wellId": well.id,
        "apiNo": well.apiNo,
        "name": well.name,
        "operatorName": well.operatorName,
        "qualityGrade": well.qualityGrade,
    }
    _threading.Thread(
        target=lambda: _asyncio.run(_fire_event("well.created", _webhook_payload, db)),
        daemon=True,
    ).start()'''

assert old_fire in text, "ensure_future block not found"
text = text.replace(old_fire, new_fire, 1)

wells_path.write_text(text, encoding="utf-8")
print("wells.py fixed.")
