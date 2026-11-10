import asyncio
import base64
import json
import sys
import os
import subprocess
import time
import urllib.request
import websockets
from pathlib import Path

sys.path.insert(0, os.path.abspath("."))

from backend.app.core.database import SessionLocal
from backend.app.models.models import User
from backend.app.core.security import create_session_token

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]

def get_browser_exe():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise RuntimeError("Neither Chrome nor Edge executable was found.")

def get_auth_token():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "chidiekwebelam@gmail.com").first()
        if not user:
            user = db.query(User).first()
        token = create_session_token({
            "id": user.id,
            "email": user.email,
            "name": user.name or "Ebube Williams",
            "role": user.role,
            "tier": "PRO",
            "ndaAcceptedAt": user.ndaAcceptedAt.isoformat() if user.ndaAcceptedAt else "2026-11-08T00:00:00",
        })
        return token
    finally:
        db.close()

async def cdp_command(ws, method, params=None, msg_id=[1]):
    mid = msg_id[0]
    msg_id[0] += 1
    payload = {"id": mid, "method": method, "params": params or {}}
    await ws.send(json.dumps(payload))
    while True:
        resp = await ws.recv()
        data = json.loads(resp)
        if data.get("id") == mid:
            return data

async def capture_page(ws, url, out_path, theme="dark", wait_seconds=3.0):
    print(f"Navigating to {url} (theme: {theme})...")
    # Enable Page and Runtime
    await cdp_command(ws, "Page.enable")
    await cdp_command(ws, "Runtime.enable")
    
    # Set viewport
    await cdp_command(ws, "Emulation.setDeviceMetricsOverride", {
        "width": 1440,
        "height": 900,
        "deviceScaleFactor": 1,
        "mobile": False
    })

    # Navigate
    await cdp_command(ws, "Page.navigate", {"url": url})
    await asyncio.sleep(wait_seconds)

    # Set theme in DOM and localStorage
    eval_script = f"""
    (() => {{
        try {{
            const themeId = '{theme}';
            localStorage.setItem('wellqc_theme', themeId);
            document.documentElement.setAttribute('data-theme', themeId);
            if (themeId === 'light') {{
                document.documentElement.classList.remove('dark');
            }} else {{
                document.documentElement.classList.add('dark');
            }}
        }} catch(e) {{}}
    }})()
    """
    await cdp_command(ws, "Runtime.evaluate", {"expression": eval_script})
    await asyncio.sleep(2.0)

    # Capture screenshot
    res = await cdp_command(ws, "Page.captureScreenshot", {
        "format": "png",
        "clip": {
            "x": 0,
            "y": 0,
            "width": 1440,
            "height": 900,
            "scale": 1
        }
    })
    
    img_b64 = res.get("result", {}).get("data", "")
    if img_b64:
        img_bytes = base64.b64decode(img_b64)
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print(f"Saved: {out_path} ({len(img_bytes)} bytes)")
    else:
        print(f"Failed to capture {url}: {res}")

async def main():
    import tempfile
    import shutil
    browser_exe = get_browser_exe()
    token = get_auth_token()
    print(f"Browser: {browser_exe}")
    print(f"Auth token generated for cookie injection.")

    # 1. Start local servers
    print("Starting local backend on port 8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "start_engine.py"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    print("Starting local Next.js on port 3000...")
    frontend_proc = subprocess.Popen(
        ["cmd.exe", "/c", "npx next dev --port 3000"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    # Wait for Next.js to become ready
    print("Waiting for http://localhost:3000 to be ready...")
    ready = False
    for i in range(40):
        try:
            with urllib.request.urlopen("http://localhost:3000", timeout=1.5) as r:
                if r.status in (200, 304, 307, 308):
                    ready = True
                    break
        except Exception:
            time.sleep(1)
            print(f"Waiting for server ({i+1}/40)...")

    if not ready:
        backend_proc.terminate()
        frontend_proc.terminate()
        raise RuntimeError("Frontend server failed to start within 40 seconds.")

    print("Servers are ready! Launching headless browser...")

    user_data_dir = tempfile.mkdtemp(prefix="chrome_snap_")

    chrome_cmd = [
        browser_exe,
        "--headless=new",
        "--remote-debugging-port=9222",
        f"--user-data-dir={user_data_dir}",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--window-size=1440,900",
        "about:blank",
    ]

    proc = subprocess.Popen(chrome_cmd)
    time.sleep(2)

    try:
        # Get websocket debugger URL for the page target (not the browser target)
        time.sleep(1)
        list_url = "http://localhost:9222/json/list"
        req = urllib.request.urlopen(list_url)
        targets = json.loads(req.read().decode())
        page_targets = [t for t in targets if t.get("type") == "page"]
        if not page_targets:
            new_req = urllib.request.urlopen("http://localhost:9222/json/new")
            page_target = json.loads(new_req.read().decode())
        else:
            page_target = page_targets[0]
            
        ws_url = page_target["webSocketDebuggerUrl"]
        print(f"Connecting to Page CDP: {ws_url}")

        async with websockets.connect(ws_url, max_size=25_000_000) as ws:
            # Enable Network
            await cdp_command(ws, "Network.enable")
            
            # Set wellqc_session cookie
            await cdp_command(ws, "Network.setCookie", {
                "name": "wellqc_session",
                "value": token,
                "domain": "localhost",
                "path": "/",
                "httpOnly": True,
                "secure": False
            })

            brand_dir = Path("public/brand")
            brand_dir.mkdir(parents=True, exist_ok=True)

            BASE_URL = "http://localhost:3000"

            # 1. Log Ingestion & Wireline Track Plotter (/upload)
            await capture_page(ws, f"{BASE_URL}/upload", brand_dir / "las-upload.png", theme="dark", wait_seconds=7.0)

            # 2. Interactive QA Engine & Petrophysical Repair (/qa-engine)
            await capture_page(ws, f"{BASE_URL}/qa-engine", brand_dir / "qa-engine.png", theme="dark", wait_seconds=7.0)

            # 3. Mnemonic Standardisation Dictionary (/standardisation)
            await capture_page(ws, f"{BASE_URL}/standardisation", brand_dir / "las-parser.png", theme="dark", wait_seconds=6.0)

            # 4. Multi-Well Stratigraphic Correlation (/comparison)
            await capture_page(ws, f"{BASE_URL}/comparison", brand_dir / "well-comparison.png", theme="dark", wait_seconds=7.0)

            # 5. NUPRC Compliance & Audit Reports (/reports)
            await capture_page(ws, f"{BASE_URL}/reports", brand_dir / "audit-reports.png", theme="dark", wait_seconds=6.0)

            # 6. Petrophysical Pricing & Paystack Gateway (/pricing)
            await capture_page(ws, f"{BASE_URL}/pricing", brand_dir / "pricing-plans.png", theme="dark", wait_seconds=6.0)

    finally:
        print("Terminating browser and local server processes...")
        proc.terminate()
        backend_proc.terminate()
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], capture_output=True)
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(backend_proc.pid)], capture_output=True)
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        except Exception:
            pass
        try:
            shutil.rmtree(user_data_dir, ignore_errors=True)
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(main())
