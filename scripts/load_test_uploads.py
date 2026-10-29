"""Staging-only concurrency test: N simultaneous LAS uploads."""
import argparse
import os
import statistics
import sys
import threading
import time

import httpx

STAGING_HOST = "wellqc-api.onrender.com"
BASE = f"https://{STAGING_HOST}"


def warm_up(timeout_s=120):
    """The free instance sleeps; wake it so uploads measure real speed."""
    end = time.time() + timeout_s
    while time.time() < end:
        try:
            if httpx.get(f"{BASE}/api/health", timeout=30).status_code == 200:
                return True
        except httpx.HTTPError:
            pass
        time.sleep(3)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--file", default=r"C:\Users\Wanaemi Watson\Downloads\TUJA 01.txt")
    args = ap.parse_args()

    email, password = os.getenv("WQC_EMAIL"), os.getenv("WQC_PASSWORD")
    if not email or not password:
        sys.exit("Set WQC_EMAIL and WQC_PASSWORD first.")

    with open(args.file, encoding="utf-8", errors="replace") as f:
        text = f.read()

    print(f"Target: {BASE} (staging only)")
    print("Warming up..." if warm_up() else "WARNING: health check never returned 200")

    login = httpx.post(f"{BASE}/api/auth/login",
                       json={"email": email, "password": password}, timeout=60)
    if login.status_code != 200:
        sys.exit(f"Login failed: {login.status_code} {login.text[:150]}")
    cookies = dict(login.cookies)
    if not cookies:
        print("WARNING: login set no cookie; uploads may be unauthenticated")

    stamp = int(time.time())
    barrier = threading.Barrier(args.count)
    results = [None] * args.count

    def worker(i):
        with httpx.Client(base_url=BASE, cookies=cookies, timeout=180) as c:
            barrier.wait()  # release all uploads at the same moment
            t0 = time.perf_counter()
            try:
                r = c.post("/api/las", json={
                    "content": text,
                    "fileName": f"loadtest-{stamp}-{i:02d}.las",
                })
                results[i] = (r.status_code, time.perf_counter() - t0,
                              "" if r.status_code in (200, 201) else r.text[:120])
            except Exception as e:  # noqa: BLE001
                results[i] = ("ERR", time.perf_counter() - t0, type(e).__name__)

    start = time.perf_counter()
    threads = [threading.Thread(target=worker, args=(i,)) for i in range(args.count)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall = time.perf_counter() - start

    statuses = {}
    for s, _, _ in results:
        statuses[s] = statuses.get(s, 0) + 1
    times = sorted(t for _, t, _ in results)
    ok = sum(1 for s, _, _ in results if s in (200, 201))

    print(f"\nUploads: {args.count}   OK: {ok}   Status counts: {statuses}")
    print(f"Seconds  min {times[0]:.1f}  median {statistics.median(times):.1f}  "
          f"p95 {times[int(0.95 * (len(times) - 1))]:.1f}  max {times[-1]:.1f}  total {wall:.1f}")
    for s, _, msg in results:
        if msg:
            print(f"  failure sample: {s} {msg}")
            break
    print("RESULT:", "PASS" if ok == args.count else "FAIL")


if __name__ == "__main__":
    main()