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

OK_CODES = (200, 201)
BUSY_CODE = 503  # the upload gate's "Server busy" reply (expected when over the limit)


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
    ap.add_argument(
        "--expect-ok",
        type=int,
        default=15,
        help="How many uploads the server should accept (the gate's MAX_IN_LINE). "
             "Uploads beyond this are expected to get 503 busy.",
    )
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
        with httpx.Client(base_url=BASE, cookies=cookies, timeout=300) as c:
            barrier.wait()  # release all uploads at the same moment
            t0 = time.perf_counter()
            try:
                r = c.post("/api/las", json={
                    "content": text,
                    "fileName": f"loadtest-{stamp}-{i:02d}.las",
                })
                results[i] = (r.status_code, time.perf_counter() - t0,
                              "" if r.status_code in OK_CODES else r.text[:120])
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

    ok = sum(1 for s, _, _ in results if s in OK_CODES)
    busy = sum(1 for s, _, _ in results if s == BUSY_CODE)

    print(f"\nUploads: {args.count}   OK: {ok}   Busy (503): {busy}   Status counts: {statuses}")

    # Timing uses successful uploads only, so busy replies and timeouts don't skew it.
    ok_times = sorted(t for s, t, _ in results if s in OK_CODES)
    if ok_times:
        p95 = ok_times[int(0.95 * (len(ok_times) - 1))]
        print(f"Seconds (successful uploads only)  min {ok_times[0]:.1f}  "
              f"median {statistics.median(ok_times):.1f}  p95 {p95:.1f}  "
              f"max {ok_times[-1]:.1f}  total run {wall:.1f}")
    else:
        print(f"Seconds: no successful uploads to time  total run {wall:.1f}")

    # Show the first unexpected failure (anything that is not OK and not a busy reply).
    for s, _, msg in results:
        if s not in OK_CODES and s != BUSY_CODE:
            print(f"  unexpected failure sample: {s} {msg}")
            break

    # Pass rule: exactly --expect-ok uploads succeed, the rest get 503 busy, nothing else.
    expected_ok = min(args.count, args.expect_ok)
    expected_busy = args.count - expected_ok
    passed = ok == expected_ok and busy == expected_busy
    expectation = f"{expected_ok} OK" + (f" + {expected_busy} busy" if expected_busy else "")
    if passed:
        print(f"RESULT: PASS (as expected: {expectation})")
    else:
        print(f"RESULT: FAIL (expected {expectation}, got {ok} OK + {busy} busy)")


if __name__ == "__main__":
    main()