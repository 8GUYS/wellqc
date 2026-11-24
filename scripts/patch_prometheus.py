"""Patch main.py to wire in Prometheus /metrics endpoint."""
import pathlib

main_path = pathlib.Path("backend/app/main.py")
text = main_path.read_text(encoding="utf-8")

# 1. Add import after existing imports block
old_import = "from backend.app.api import ("
new_import = (
    "from prometheus_fastapi_instrumentator import Instrumentator\n"
    "from backend.app.api import ("
)
assert old_import in text, "Import anchor not found"
text = text.replace(old_import, new_import, 1)

# 2. Wire up Instrumentator after all routers are registered
old_anchor = 'app.include_router(payments.router)       # /api/payments: Paystack checkout, webhook, plans catalog'
new_anchor = (
    'app.include_router(payments.router)       # /api/payments: Paystack checkout, webhook, plans catalog\n'
    '\n'
    '# ---------------------------------------------------------------------------\n'
    '# Prometheus Metrics Instrumentation (CE1-34)\n'
    '# Exposes /metrics in Prometheus text format.\n'
    '# Scrape URL for Grafana Cloud: https://<render-host>/metrics\n'
    '# Access is intentionally public (read-only counters/histograms, no PII).\n'
    '# To restrict to internal scraper only, add IP-allowlist middleware here.\n'
    '# ---------------------------------------------------------------------------\n'
    'Instrumentator(\n'
    '    should_group_status_codes=True,\n'
    '    should_ignore_untemplated=True,\n'
    '    should_respect_env_var=False,\n'
    '    excluded_handlers=[\n'
    '        "/health",\n'
    '        "/api/health",\n'
    '        "/metrics",\n'
    '        "/",\n'
    '        "/docs",\n'
    '        "/openapi.json",\n'
    '    ],\n'
    ').instrument(app).expose(app, include_in_schema=False, tags=["system"])'
)
assert old_anchor in text, "Router anchor not found"
text = text.replace(old_anchor, new_anchor, 1)

main_path.write_text(text, encoding="utf-8")
print("main.py patched successfully.")
