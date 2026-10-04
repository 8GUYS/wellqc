import os
import sys

# Ensure root directory and .venv site-packages are on sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
VENV_PACKAGES = os.path.join(PROJECT_ROOT, ".venv", "Lib", "site-packages")

if VENV_PACKAGES not in sys.path:
    sys.path.insert(0, VENV_PACKAGES)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import uvicorn

if __name__ == "__main__":
    print(f"Starting WellQC+ Engine on http://127.0.0.1:8000 (PID: {os.getpid()})")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=False)
