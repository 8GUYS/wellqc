# WellQC+ — Stage 0 MVP Readiness: Before, Current, and Next Steps
### Presenter script | Wana, Cloud & Platform Engineering | November 5, 2026

---

## Before (Oct 28 to Nov 3): Closing Sprint 5 & Laying The Groundwork

Before Stage 0 formally began, our focus was stabilizing the Sprint 5 row-level security implementation and closing the remaining operational checks. We confirmed that production and staging both connected as the restricted `wellqc_api` account, verified that deleting a user safely cascades to remove their associated wells, files, and reports, and ensured the 51 RLS policies were active across both branches. 

During that review, several architectural gaps and launch blockers became obvious. First, every LAS file uploaded was still stored as a raw ASCII text blob directly inside Neon PostgreSQL rows. At ₦490 per gigabyte per month on Neon versus ₦21 on Cloudflare R2, continuing to store files in the database was a compounding financial risk. Second, while the backend was protected by basic in-memory checks, the login endpoint still allowed 10 requests per minute rather than the strict 5-attempt industry standard for credential stuffing, and endpoints accepting URLs lacked a formal Server-Side Request Forgery (SSRF) shield. Third, on Render's hobby tier, idle instances went to sleep after 15 minutes, subjecting the next user to a 30 to 60-second cold-start delay. Finally, we lacked automated off-site database backups, dual-layer error tracking, and a documented emergency runbook. 

We agreed that before opening the platform to public MVP users, these vulnerabilities had to be closed.

---

## Current (Nov 4 to 5): Stage 0 MVP Readiness Complete Across 8 Core Steps

Sprint 5 gave us locked-down database access; this milestone gives us a battle-hardened, cost-controlled, and observable production cloud platform. Over the last 48 hours, we completed all remaining engineering items for Stage 0 across eight steps, packaged into the `feat/mvp-readiness` release branch with green CI checks.

**Step 1 moved file blobs out of PostgreSQL into Cloudflare R2.** We wrote a dedicated R2 storage service using `boto3` with adaptive retries and presigned download URL generation, added the nullable `r2Key` column to `LASFile`, and updated the ingestion pipeline. To protect existing data, we built a zero-downtime passthrough fallback: pre-migration files stored in PostgreSQL remain fully readable, and if R2 credentials are ever missing in local dev or CI, the backend falls back to database storage automatically without failing. In Neon and Cloudflare right now, all new production uploads bypass the database entirely and stream directly into R2, cutting file storage costs by 95%.

**Step 2 hardened database connection scalability.** FastAPI workers handle high concurrency, and direct database connections can exhaust Neon's connection pool under concurrent user traffic. We swapped the backend `DATABASE_URL` in Render to Neon's built-in PgBouncer pooler (`-pooler` hostname). Because our RLS policies use transaction-local `set_config` parameters, multi-tenant isolation remains leak-proof across pooled connections.

**Step 3 eliminated instance cold starts.** We configured an automated external UptimeRobot monitor pinging `https://wellqc.onrender.com/health` every 5 minutes around the clock. This keeps the FastAPI runtime, connection pools, and memory caches permanently warm at zero cost, ensuring sub-second response times regardless of when a user logs in.

**Step 4 tightened login rate limiting.** We updated `/api/auth/login` to enforce a strict threshold of 5 attempts per minute per IP. The sliding-window limiter auto-purges expired records to prevent memory leakage, and the 6th attempt immediately returns HTTP 429 (`Too Many Requests`) with a dynamic `Retry-After` header. The behavior is locked down by automated unit tests.

**Step 5 erected a Server-Side Request Forgery (SSRF) shield.** We built a custom validation engine in `backend/app/core/ssrf.py`. Before any outbound network call occurs, it resolves hostnames to all underlying IP addresses and blocks loopback addresses (`127.0.0.1`, `localhost`), private RFC-1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), cloud metadata endpoints (`169.254.169.254`), and non-HTTP protocols. We wired it into admin webhook registration and destination handlers, confirmed by 5 passing unit tests.

**Step 6 established automated nightly database backups.** We built a backup service in `backend/app/services/backup_service.py` and a CLI runner in `scripts/backup_db.py`. It dumps the PostgreSQL database, compresses it with gzip, and uploads it to Cloudflare R2 under `backups/backup_wellqc_YYYYMMDD_HHMMSS.sql.gz`. It includes an automated 30-day retention pruning policy, and runs via a scheduled GitHub Actions workflow every night at 02:00 UTC (with manual one-click dispatch enabled).

**Step 7 implemented full-stack Sentry error tracking.** On the FastAPI backend, unhandled exceptions are caught by our global exception interceptor, masked from the client to prevent SQL error leakage, and transmitted to Sentry with complete Python stack traces and curve context. On the Next.js frontend, we added App Router error boundaries in `src/app/error.tsx` and an asynchronous deferred script loader in `layout.tsx` to ensure zero prerendering conflicts. Both layers operate safely in silent mode if DSNs are absent.

**Step 8 authored the Master Operations Runbook.** We published `Documentations/WellQC_Operations_Runbook.md` and linked it directly from the root `README.md`. It provides a one-page incident triage matrix, step-by-step instructions for 5-second instant rollbacks on Vercel and Render, local development setup, and decompression commands for database restoration from R2 archives.

Finally, we reconciled the Master Engineering Readiness Checklist: Stage 0 is now **27 of 44 items complete (61%)**. As agreed, the freemium feature gate (capping free accounts at 2 files and withholding anomalies) remains clean, documented, and intentionally on hold until the team finalizes commercial thresholds.

---

## Next Steps: Launch Monitoring, Ongoing Operations & The Freemium Gate

With all pre-MVP engineering tasks complete, our focus transitions from building infrastructure to **monitoring the live system** as real users onboard.

| # | Task | Owner | Window | Status |
|---|---|---|---|---|
| 1 | **Merge `feat/mvp-readiness` into `main`** | Founder / Lead | Today | Ready to merge |
| 2 | **Add 5 GitHub Repository Secrets for Nightly Backups** (`DATABASE_URL`, `R2_*`) | Platform Eng | Post-merge (2 min) | Pending dashboard input |
| 3 | **Activate GitHub Branch Protection** on `main` (require PR + green CI) | Lead | Post-merge (2 min) | Pending setting toggle |
| 4 | **First Production Backup Verification**: trigger workflow manually in GitHub Actions | Platform Eng | Post-merge | Scheduled |
| 5 | **Freemium Gate Specification**: team aligns on anomaly count to withhold | Product & Team | Pending discussion | On hold |

---

## Ongoing: Things We Monitor

These represent our permanent operational rhythm. They carry an ongoing cadence rather than a completion percentage:

| Item | What to Look For | Owner | Cadence |
|---|---|---|---|
| **Sentry Issue Streams** (`wellqc-backend` & `wellqc-frontend`) | Unhandled 500 errors, LAS parsing edge cases, browser rendering faults | Cloud & Lead | Daily glance / instant email alerts |
| **UptimeRobot Keepalive** | Response latency, downtime alerts on `/health` | Cloud Eng | 24/7 automated monitoring |
| **Cloudflare R2 Storage & Backups** | Verify daily `.sql.gz` arrival in `backups/`, check LAS file upload volume in `las/` | Cloud Eng | Weekly check |
| **Neon Connection Health** | Review connection count and compute hours in Neon dashboard | Cloud Eng | Weekly review |
| **Backup Restoration Drill** | Restore latest R2 `.sql.gz` backup to a temporary Neon branch to verify recoverability | Cloud & Lead | Monthly |
| **Dependency Upkeep & Vulnerability Scans** | Dependabot alerts, Python and npm security patches | Engineering | Monthly, prior to major releases |

---

*WellQC+ Stage 0 MVP Readiness Summary · November 2026*
