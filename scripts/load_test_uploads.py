"""Staging-only load test for LAS uploads.

Two modes:
  * Single file per user (default, --batch-files 1): N simultaneous uploads.
  * Batch queue (--batch-files M, M > 1): N simulated users start together and
    each uploads M files ONE AFTER ANOTHER, like the browser upload queue
    (src/app/upload/page.tsx). Every file is an ordinary POST /api/las, so it
    goes through the upload gate.
"""
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
    ap.add_argument("--count", type=int, default=20,
                    help="Simultaneous users (in single mode, simultaneous uploads).")
    ap.add_argument(
        "--expect-ok",
        type=int,
        default=15,
        help="The gate's MAX_IN_LINE. With more simultaneous users than this, "
             "some uploads are expected to get 503 busy.",
    )
    ap.add_argument(
        "--batch-files",
        type=int,
        default=1,
        help="Files each user uploads one after another (1 = old single-upload mode).",
    )
    ap.add_argument("--file", default=r"C:\Users\Wanaemi Watson\Downloads\TUJA 01.txt")
    args = ap.parse_args()

    if args.count < 1 or args.batch_files < 1:
        sys.exit("--count and --batch-files must be at least 1.")

    email, password = os.getenv("WQC_EMAIL"), os.getenv("WQC_PASSWORD")
    if not email or not password:
        sys.exit("Set WQC_EMAIL and WQC_PASSWORD first.")

    with open(args.file, encoding="utf-8", errors="replace") as f:
        text = f.read()

    print(f"Target: {BASE} (staging only)")
    print(f"Users: {args.count}   Files per user (one after another): {args.batch_files}   "
          f"Total uploads: {args.count * args.batch_files}")
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
    results = []          # (status, seconds, message, user, file_index)
    results_lock = threading.Lock()
    user_totals = {}      # user -> seconds to finish their whole batch

    def worker(user):
        with httpx.Client(base_url=BASE, cookies=cookies, timeout=300) as c:
            barrier.wait()  # release all users at the same moment
            user_start = time.perf_counter()
            for j in range(args.batch_files):
                t0 = time.perf_counter()
                try:
                    r = c.post("/api/las", json={
                        "content": text,
                        "fileName": f"loadtest-{stamp}-u{user:02d}-f{j:02d}.las",
                    })
                    row = (r.status_code, time.perf_counter() - t0,
                           "" if r.status_code in OK_CODES else r.text[:120], user, j)
                except Exception as e:  # noqa: BLE001
                    row = ("ERR", time.perf_counter() - t0, type(e).__name__, user, j)
                with results_lock:
                    results.append(row)
            user_totals[user] = time.perf_counter() - user_start

    start = time.perf_counter()
    threads = [threading.Thread(target=worker, args=(u,)) for u in range(args.count)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    wall = time.perf_counter() - start

    total = args.count * args.batch_files
    statuses = {}
    for s, _, _, _, _ in results:
        statuses[s] = statuses.get(s, 0) + 1

    ok = sum(1 for r in results if r[0] in OK_CODES)
    busy = sum(1 for r in results if r[0] == BUSY_CODE)

    print(f"\nUploads: {total}   OK: {ok}   Busy (503): {busy}   Status counts: {statuses}")

    # Timing uses successful uploads only, so busy replies and timeouts don't skew it.
    ok_times = sorted(r[1] for r in results if r[0] in OK_CODES)
    if ok_times:
        p95 = ok_times[int(0.95 * (len(ok_times) - 1))]
        print(f"Seconds per upload (successful only)  min {ok_times[0]:.1f}  "
              f"median {statistics.median(ok_times):.1f}  p95 {p95:.1f}  "
              f"max {ok_times[-1]:.1f}  total run {wall:.1f}")
    else:
        print(f"Seconds: no successful uploads to time  total run {wall:.1f}")

    if args.batch_files > 1:
        # Time each user waited to finish their whole queue, and how many finished cleanly.
        per_user_ok = {}
        for s, _, _, u, _ in results:
            if s in OK_CODES:
                per_user_ok[u] = per_user_ok.get(u, 0) + 1
        complete = sum(1 for u in range(args.count) if per_user_ok.get(u, 0) == args.batch_files)
        totals = sorted(user_totals.values())
        print(f"Users who finished their whole batch: {complete} of {args.count}")
        if totals:
            print(f"Seconds for a user to finish the batch  min {totals[0]:.1f}  "
                  f"median {statistics.median(totals):.1f}  max {totals[-1]:.1f}")

    # Show the first unexpected failure (anything that is not OK and not a busy reply).
    for s, _, msg, _, _ in results:
        if s not in OK_CODES and s != BUSY_CODE:
            print(f"  unexpected failure sample: {s} {msg}")
            break

    unexpected = total - ok - busy
    if args.batch_files == 1:
        # Original rule: exactly --expect-ok succeed, the rest get 503, nothing else.
        expected_ok = min(args.count, args.expect_ok)
        expected_busy = args.count - expected_ok
        passed = ok == expected_ok and busy == expected_busy
        expectation = f"{expected_ok} OK" + (f" + {expected_busy} busy" if expected_busy else "")
    elif args.count <= args.expect_ok:
        # Each user has one upload in flight at a time, so the line never exceeds the
        # number of users: nothing should be refused.
        passed = ok == total and busy == 0
        expectation = f"all {total} OK, no busy replies"
    else:
        # More users than the line allows: some 503s are expected, but nothing else.
        passed = unexpected == 0 and ok > 0
        expectation = f"only OK or busy replies (no 502, 429 or timeouts), some 503s allowed"
    if passed:
        print(f"RESULT: PASS (as expected: {expectation})")
    else:
        print(f"RESULT: FAIL (expected {expectation}; got {ok} OK, {busy} busy, {unexpected} other)")


if __name__ == "__main__":
    main()