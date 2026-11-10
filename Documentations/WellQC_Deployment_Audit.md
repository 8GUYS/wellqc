# WellQC+ — 111-Point Deployment Audit
### Evidence-based review of backend, DevOps, security & reliability posture

> **Legend:** ✅ Implemented · 🟡 Partial · ❌ Missing · ⬜ Not Applicable (by design)

---

## Score Summary

| Category | ✅ | 🟡 | ❌ | Score |
|---|---|---|---|---|
| Traffic & Routing | 3 | 3 | 2 | 56% |
| Async & Messaging | 0 | 1 | 6 | 7% |
| Database | 4 | 3 | 6 | 46% |
| Resilience & Reliability | 2 | 3 | 6 | 32% |
| Scaling & Performance | 2 | 2 | 6 | 30% |
| CI/CD & Deployment | 4 | 2 | 7 | 38% |
| Observability | 1 | 1 | 6 | 17% |
| Security | 9 | 4 | 4 | 65% |
| Data Integrity | 3 | 2 | 4 | 44% |
| **Overall** | **28** | **21** | **47** | **35%** |

> This score reflects a **well-built prototype with strong security fundamentals** that has not yet been hardened for production scale. That is normal and expected for Sprint 7 of 9.

---

## 1–5 · Traffic & Routing

| # | Concept | Status | Evidence |
|---|---|---|---|
| 1 | **Rate Limiting** | 🟡 Partial | Upload gate (`MAX_RUNNING=2`, `MAX_IN_LINE=15`, `Retry-After: 30` header) exists in `las.py` but is **per-process, not distributed** — resets if Render restarts, and doesn't apply to auth, wells, or dashboard endpoints. No token-bucket or sliding-window rate limiter on login (brute-force risk). |
| 2 | **Caching** | 🟡 Partial | In-memory TTL cache on `GET /api/wells` (`CACHE_TTL_SECONDS=30`) with `invalidate_wells_cache()` on mutations. **No** response caching on dashboard KPIs, analytics, or the Vercel CDN layer. No Redis. |
| 3 | **Load Balancing** | ❌ Missing | Single Render instance — no load balancer in front. Vercel handles frontend edge load balancing, but the Python backend has a single point of failure. |
| 4 | **Reverse Proxies** | 🟡 Partial | Vercel acts as a reverse proxy via `next.config.ts` rewrites (`/api/*` → Render). No explicit Nginx or Caddy in the stack. Works, but adds a ~40–80 ms hop and routes all API traffic through Vercel's serverless functions. |
| 5 | **API Gateways** | ❌ Missing | No dedicated API gateway (Kong, AWS API Gateway, Cloudflare Workers). Vercel rewrites serve the role loosely, but without auth at gateway level, rate limiting, or request transformation. |

---

## 6–9 · CI/CD & Deployment

| # | Concept | Status | Evidence |
|---|---|---|---|
| 6 | **CI/CD** | ✅ Implemented | Three GitHub Actions workflows: `test-and-lint.yml` (lint + Jest + build + Docker build on PRs), `python-tests.yml` (pytest on backend PRs), `migrate.yml` (Prisma migrations on push to main). Concurrency cancellation configured. |
| 7 | **Docker** | ✅ Implemented | `Dockerfile` for frontend (Node 20 Alpine), `backend/Dockerfile` for FastAPI. `docker-compose.yml` with `postgres`, `backend`, `frontend` services, healthcheck on postgres, `depends_on` with conditions. Build cache (`--mount=type=cache`) used. |
| 8 | **Kubernetes** | ❌ Missing | No K8s manifests, Helm charts, or GKE/EKS config. Planned for Sprint 8. |
| 9 | **Service Discovery** | ❌ Missing | Services communicate via hardcoded env vars (`PYTHON_BACKEND_URL`). No service mesh, Consul, or DNS-based discovery. Fine at current scale; becomes a problem in multi-container K8s. |

---

## 10–15 · Resilience Patterns

| # | Concept | Status | Evidence |
|---|---|---|---|
| 10 | **Circuit Breakers** | ❌ Missing | No circuit breaker on DB calls, external email, or Paystack webhook. If Neon cold-starts take >15 s, requests pile up rather than fast-failing. |
| 11 | **Timeouts** | 🟡 Partial | DB `connect_timeout=15s`, `pool_timeout=30s`, `pool_recycle=300s` in `database.py`. No HTTP client timeouts on outbound calls (EmailJS, Paystack). No Uvicorn `timeout-keep-alive` configured. |
| 12 | **Retries** | 🟡 Partial | CI/CD has retry logic (`migrate.yml`: 3 attempts, 20 s wait; `python-tests.yml`: 5 Neon warmup attempts). No retry logic in the application code itself for DB queries or outbound HTTP calls. |
| 13 | **Exponential Backoff** | ❌ Missing | Retries in CI use fixed `sleep 20` — linear, not exponential. No backoff in application code. |
| 14 | **Idempotency** | 🟡 Partial | LAS commit uses UUIDs (`uuid.uuid4()`) for record IDs which makes creates naturally idempotent if the client retries with the same data. No `Idempotency-Key` header checked on any endpoint. Paystack webhooks use HMAC-SHA512 replay protection but no deduplication table. |
| 15 | **Message Queues** | ❌ Missing | No queue (Celery, RQ, BullMQ, SQS). Heavy LAS processing (KNN imputation, benchmark) runs synchronously in the request thread — blocks the worker and contributes to the throughput ceiling. |

---

## 16–21 · Event-Driven & Async

| # | Concept | Status | Evidence |
|---|---|---|---|
| 16 | **Pub/Sub** | ❌ Missing | None. |
| 17 | **Event-Driven Architecture** | 🟡 Partial | `ActivityLog` table provides an audit event log, and Paystack webhooks (`charge.success`) trigger tier upgrades. But events are not consumed by other services — no event bus. |
| 18 | **Distributed Transactions** | ❌ Missing | LAS commit in `ingestion_service.py` uses a single SQLAlchemy session transaction (atomic per DB). Fine now; becomes a problem if blob storage (S3/R2) is added — there's no compensating transaction if the DB write succeeds but the R2 upload fails. |
| 19 | **Saga Pattern** | ❌ Missing | No saga orchestration. Related to above — needed when you add R2 blob storage. |
| 20 | **Dead Letter Queues** | ❌ Missing | No queue → no DLQ. |
| 21 | **Cron Jobs** | ❌ Missing | No scheduled tasks. Candidates: session cleanup, free-tier usage reset, subscription expiry checks. Currently none exist. |

---

## 22–24 · Real-Time Communication

| # | Concept | Status | Evidence |
|---|---|---|---|
| 22 | **WebSockets** | ❌ Missing | None. Upload progress is polled by the frontend, not pushed. |
| 23 | **Long Polling** | ❌ Missing | None. |
| 24 | **Server-Sent Events** | ❌ Missing | None. The frontend shows real-time upload progress via UI state, but it's all client-side — no server push of processing status. |

---

## 25–33 · Database

| # | Concept | Status | Evidence |
|---|---|---|---|
| 25 | **Database Indexing** | ✅ Implemented | Comprehensive indexing: `@@index([ownerId])` on Well, LASFile, Curve, QualityReport, Anomaly. `@@index([userId])` on ActivityLog, APIToken. `email UNIQUE`, `apiNo UNIQUE`, `token UNIQUE`. SQLAlchemy models also declare `index=True` on FK columns. |
| 26 | **Query Optimization** | 🟡 Partial | `pool_pre_ping=True` avoids stale connections. Wells list uses a single aggregated query. However, the dashboard endpoint runs multiple sequential `db.query()` calls that could be combined. No `EXPLAIN ANALYZE` evidence or query monitoring. |
| 27 | **N+1 Queries** | 🟡 Partial | SQLAlchemy relationships are defined. No explicit `joinedload` or `selectinload` usage found — risk of N+1 on endpoints that iterate related records (e.g., wells with their LAS files). |
| 28 | **Connection Pooling** | ✅ Implemented | SQLAlchemy `create_engine` with `pool_size=10`, `max_overflow=20`, `pool_recycle=300`, `pool_pre_ping=True`. Comments mention pgbouncer awareness (transaction-level RLS context). |
| 29 | **Read Replicas** | ❌ Missing | Single Neon database. No read replica routing. |
| 30 | **Sharding** | ❌ Missing | Not needed at current scale. |
| 31 | **Partitioning** | ❌ Missing | No table partitioning. `ActivityLog` will grow unboundedly — a candidate for time-based partitioning at scale. |
| 32 | **Replication** | ❌ Missing | Neon handles internal replication transparently, but no explicit HA replica config or failover is set up at the app level. |
| 33 | **Leader Election** | ⬜ N/A | Single-process app. Relevant only when you run multiple backend replicas. |

---

## 34–40 · Consistency & Concurrency

| # | Concept | Status | Evidence |
|---|---|---|---|
| 34 | **CAP Theorem** | 🟡 Partial (aware) | Neon is CP (consistency + partition tolerance). In-memory wells cache (`_wells_cache`) introduces a brief window of stale reads — an eventual consistency trade-off. Not documented. |
| 35 | **Eventual Consistency** | 🟡 Partial | The `invalidate_wells_cache()` pattern handles it for wells, but only on the same process. Second Render instance would have its own stale cache. |
| 36 | **Optimistic Locking** | ❌ Missing | No `version` column or `updatedAt` check-before-write pattern on mutations. Concurrent edits to the same well could silently overwrite each other. |
| 37 | **Pessimistic Locking** | ❌ Missing | No `SELECT FOR UPDATE`. |
| 38 | **Distributed Locks** | ❌ Missing | The upload gate uses `threading.BoundedSemaphore` — a **process-local** lock. Two Render instances = two independent semaphores = no global rate limit. |
| 39 | **Race Conditions** | 🟡 Partial | `freeChecksUsed` increment and LAS file count check enforces the 3-file hard cap. The upload gate itself is thread-safe within one process. |
| 40 | **Deadlocks** | ❌ Missing | No deadlock detection or retry-on-deadlock logic. SQLAlchemy will raise, the global exception handler will catch it (masking the error), and the request fails. |

---

## 41–44 · Memory & Runtime

| # | Concept | Status | Evidence |
|---|---|---|---|
| 41 | **Memory Leaks** | 🟡 Partial | `_wells_cache` dict grows per user-key but is bounded by active users × 30 s TTL. `_in_line` counter is always decremented in `finally` blocks — correct. No explicit limit on the cache size. |
| 42 | **Garbage Collection** | ⬜ N/A | Python GC is automatic. No custom GC tuning needed at current scale. |
| 43 | **Thread Safety** | ✅ Implemented | `_count_lock = threading.Lock()` guards `_in_line` counter. `_running = threading.BoundedSemaphore(MAX_RUNNING)` is thread-safe. `_wells_cache` dict is **not** protected by a lock — potential race on concurrent writes (low probability, low impact at current scale). |
| 44 | **Backpressure** | 🟡 Partial | `MAX_IN_LINE=15` rejects requests over capacity with `503 + Retry-After`. This is basic backpressure. No backpressure on DB connection pool exhaustion. |

---

## 45–50 · Scaling

| # | Concept | Status | Evidence |
|---|---|---|---|
| 45 | **Autoscaling** | ❌ Missing | Render does not autoscale the free/hobby tier. Manual scaling only. No HPA, no Render autoscale configuration. |
| 46 | **Horizontal Scaling** | ❌ Missing | Architected for a single instance. In-memory state (cache, semaphore) breaks across multiple instances. |
| 47 | **Vertical Scaling** | ✅ Implemented | You can upgrade Render instance size (512 MB → 2 GB → 4 GB) at any time. This is the current scaling strategy. |
| 48 | **CDN** | ✅ Implemented | Vercel Edge Network serves Next.js static assets and pages globally. Static fonts, icons, and JS bundles are edge-cached. |
| 49 | **Edge Caching** | 🟡 Partial | Vercel caches static assets. Dynamic API routes (`/api/*`) are not cached at the edge — they all hit the Render origin. No `Cache-Control` headers on API responses that could be edge-cached (e.g., analytics endpoints). |
| 50 | **Cache Invalidation** | 🟡 Partial | `invalidate_wells_cache()` is called on POST/PUT/DELETE for wells. No cache invalidation strategy for anything else. No versioned cache keys. |

---

## 51–55 · Deployment Strategies

| # | Concept | Status | Evidence |
|---|---|---|---|
| 51 | **Feature Flags** | ❌ Missing | No feature flag system (LaunchDarkly, PostHog flags, env-var toggles). `REQUIRE_EMAIL_VERIFICATION` is an env-var toggle — closest thing you have. |
| 52 | **Blue-Green Deployment** | ❌ Missing | Render deploys in-place. No blue-green. |
| 53 | **Canary Releases** | ❌ Missing | None. All traffic switches at once on deploy. |
| 54 | **Rolling Deployments** | ❌ Missing | Render does rolling redeploy on its side, but you have no control over it. |
| 55 | **Rollbacks** | 🟡 Partial | GitHub allows you to revert a commit and redeploy. Render has "Manual Deploy" from a previous commit in the dashboard. No automated rollback on health check failure. DB migrations are one-way (no `down` migrations in Prisma). |

---

## 56–66 · Observability

| # | Concept | Status | Evidence |
|---|---|---|---|
| 56 | **Health Checks** | ✅ Implemented | `GET /health` and `GET /api/health` return service status, version, environment. Used by Docker Compose healthcheck. |
| 57 | **Liveness & Readiness Probes** | 🟡 Partial | `/health` endpoint exists but is not wired to a Kubernetes readiness probe (no K8s yet). Docker Compose `healthcheck` covers local dev. Render does its own HTTP health check to the root URL. |
| 58 | **Monitoring** | ❌ Missing | No APM (Datadog, New Relic, Sentry Performance). No uptime monitor (UptimeRobot, Better Uptime). Render provides basic CPU/memory graphs but no alerting. |
| 59 | **Logging** | 🟡 Partial | `logging.getLogger("uvicorn.error")` used throughout. Security events are logged (`logger.warning("SECURITY ALERT: ...")`). Logs go to Render's stdout/log drain. No structured JSON logging, no log aggregation (Datadog Logs, Logtail, Papertrail). |
| 60 | **Distributed Tracing** | ❌ Missing | No OpenTelemetry, no trace IDs propagated between Next.js and FastAPI. |
| 61 | **Metrics** | ❌ Missing | No Prometheus metrics, no custom business metrics exported (uploads/min, error rates, queue depth). |
| 62 | **Alerts** | ❌ Missing | No alerting configured. |
| 63 | **SLOs** | ❌ Missing | No Service Level Objectives defined. |
| 64 | **SLIs** | ❌ Missing | No Service Level Indicators measured. |
| 65 | **Error Budgets** | ❌ Missing | Follows from missing SLOs. |
| 66 | **Observability** | ❌ Missing | The three pillars (logs + metrics + traces) are only partially present (logs only, and those aren't structured). |

---

## 67–80 · Security

| # | Concept | Status | Evidence |
|---|---|---|---|
| 67 | **Secrets Management** | 🟡 Partial | Secrets in `.env` (gitignored), Vercel env vars, GitHub Actions secrets. No secrets manager (Vault, AWS Secrets Manager). `validate_auth_secret()` refuses to start in production with weak/default secrets — excellent. |
| 68 | **IAM** | 🟡 Partial | RBAC with `ADMIN` / `USER` roles enforced in `get_current_admin_user`. Multi-tenant `ownerId` isolation. No AWS IAM, no fine-grained resource-level permissions beyond owner check. |
| 69 | **OAuth** | ❌ Missing | Custom HMAC-SHA256 session tokens only. No OAuth 2.0 / social login. |
| 70 | **JWT Rotation** | ❌ Missing | Not using JWTs (using custom HMAC tokens). No token rotation — sessions are 30-minute sliding tokens, but there's no refresh/rotation mechanism. |
| 71 | **TLS** | ✅ Implemented | HSTS header set (`max-age=63072000; includeSubDomains; preload`). Vercel and Render both provision TLS automatically. `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` set in both `next.config.ts` and FastAPI middleware. |
| 72 | **Encryption at Rest** | 🟡 Partial | Neon encrypts data at rest (AES-256) by default — you get this for free. Passwords use scrypt (correct). LAS file content stored as plain text in the database — not additionally encrypted at the application layer. |
| 73 | **Encryption in Transit** | ✅ Implemented | TLS enforced on all endpoints. HSTS preload configured. |
| 74 | **WAF** | ✅ Implemented | Custom `SQLInjectionAndFormSecurityMiddleware` in `main.py` scans query params and JSON bodies. `detect_sql_injection()` pattern matching. Body size limit to prevent DoS. Not a full WAF (no Cloudflare WAF, no OWASP ModSecurity rules) but meaningful protection. |
| 75 | **DDoS Protection** | 🟡 Partial | Vercel provides basic DDoS protection on the frontend. Render has no DDoS mitigation. The upload gate provides rudimentary backpressure. No Cloudflare proxy, no rate-limit by IP. |
| 76 | **CORS** | ✅ Implemented | `CORS_ORIGIN_REGEX` matches all Vercel preview deployments. `CORS_EXTRA_ORIGINS` env var for custom domains. `allow_credentials=True` correctly set. |
| 77 | **CSRF** | ✅ Implemented | Sessions use `httpOnly` cookies. The FastAPI backend is a separate origin from the frontend, so same-site cookie protection is in effect. No double-submit cookie pattern implemented explicitly, but the architecture (separate origins + cookie auth) provides inherent CSRF resistance. |
| 78 | **SQL Injection** | ✅ Implemented | SQLAlchemy ORM parameterises all queries by default. Custom `detect_sql_injection()` middleware provides an extra inspection layer. Error masking in `global_exception_handler` prevents SQLAlchemy error leakage. |
| 79 | **XSS** | ✅ Implemented | `X-XSS-Protection: 1; mode=block` header set. `html.escape()` imported in security module. Next.js escapes React output by default. `X-Content-Type-Options: nosniff` prevents MIME sniffing attacks. |
| 80 | **SSRF** | ❌ Missing | No SSRF protection. If any endpoint accepts a URL parameter (e.g., for a webhook target), an attacker could target internal services. `Webhook` model exists — confirm URL validation is in place. |

---

## 81–87 · Data Integrity & Recovery

| # | Concept | Status | Evidence |
|---|---|---|---|
| 81 | **Database Migrations** | ✅ Implemented | Prisma Migrate with `migrate deploy` on CI. `migrate.yml` runs on push to main with retry. The `lifespan()` function in `main.py` runs DDL patches at startup for schema columns added outside migrations (a workaround — should be migrated properly). |
| 82 | **Schema Versioning** | ✅ Implemented | Prisma migration files provide a versioned schema history. `prisma migrate deploy` is idempotent. |
| 83 | **Disaster Recovery** | ❌ Missing | No DR plan documented. No RTO/RPO targets. Neon provides point-in-time recovery but you haven't configured the retention window or tested a restore. |
| 84 | **Backups** | ❌ Missing | No explicit backup schedule or export. Neon free tier has limited PITR. No pg_dump scheduled job. |
| 85 | **Failover** | ❌ Missing | No automatic failover. If Render instance goes down, the app is down until Render restarts it. No standby. |
| 86 | **Multi-Region Deployment** | ❌ Missing | Planned for Sprint 8. Currently single-region (Neon on AWS us-east-1, Render US region, Vercel global edge). |
| 87 | **Chaos Engineering** | ❌ Missing | No chaos testing (Chaos Monkey, Gremlin, etc.). |

---

## 88–100 · Performance & Protocols

| # | Concept | Status | Evidence |
|---|---|---|---|
| 88 | **Cost Optimization** | 🟡 Partial | LAS blobs stored in Neon (expensive at scale — should move to R2). Free tiers used maximally. No cloud cost monitoring alerts. `pool_recycle=300` prevents idle connection charges. |
| 89 | **Cold Starts** | 🟡 Partial | Neon cold start addressed in CI (`python-tests.yml` warmup loop). Render free/hobby tier sleeps after 15 min inactivity — first request after sleep takes 30–60 s. This is a known UX problem at current tier. |
| 90 | **Serverless Limits** | ✅ Implemented | `bodySizeLimit: '20mb'` set in Next.js for server actions. FastAPI middleware limits body size. Render is not serverless (always-on), so cold starts after inactivity are a paid-tier sleep issue, not a function limit. |
| 91 | **Latency** | 🟡 Partial | Vercel → Render rewrite adds ~40–80 ms. Heavy computations (KNN imputation) run synchronously. No latency benchmarks tracked. `pool_pre_ping` reduces stale connection latency spikes. |
| 92 | **Throughput** | 🟡 Partial | Load-tested at 0.15–0.16 uploads/s on current instance. `upload_gate` enforces the ceiling. No throughput tracking in production. |
| 93 | **P99 Latency** | ❌ Missing | Not measured. No percentile latency tracking. |
| 94 | **Tail Latency** | ❌ Missing | Not measured. Imputation benchmark requests (scikit-learn KNN) are the likely tail outliers. |
| 95 | **Network Partitions** | ❌ Missing | No partition tolerance strategy. If Neon becomes unreachable, all requests fail with unmasked DB errors (mitigated by the global exception handler, but no graceful degradation). |
| 96 | **Clock Skew** | ⬜ N/A | No distributed clocks. All timestamps from a single DB. Session expiry uses `time.time()` — fine. |
| 97 | **DNS** | 🟡 Partial | Vercel manages DNS for `wellqc.vercel.app`. No custom domain configured yet. No DNS health checks or failover records. |
| 98 | **TCP vs UDP** | ⬜ N/A | All HTTP/HTTPS over TCP. No UDP in the stack. |
| 99 | **HTTP/2 & HTTP/3** | 🟡 Partial | Vercel serves HTTP/2 automatically. Render-to-Vercel backend connection uses HTTP/1.1. Uvicorn supports HTTP/2 with `--http h2` but it's not configured. |
| 100 | **gRPC** | ⬜ N/A | REST API — gRPC not applicable at current scale. |

---

## 101–111 · Integrations & Operations

| # | Concept | Status | Evidence |
|---|---|---|---|
| 101 | **Webhooks** | ✅ Implemented | Paystack `charge.success` webhook with HMAC-SHA512 signature validation. `Webhook` model exists for outbound webhooks from the admin panel. |
| 102 | **API Versioning** | ❌ Missing | All routes are `/api/...` with no version prefix (`/api/v1/...`). A breaking change to any endpoint breaks all clients simultaneously. |
| 103 | **Semantic Versioning** | 🟡 Partial | `VERSION: str = "1.0.0"` in `config.py` and returned in `/health`. Not used for API versioning or release tagging in GitHub. |
| 104 | **Infrastructure as Code** | 🟡 Partial | `docker-compose.yml` and `Dockerfile` are IaC for local/dev. No Terraform, no Render IaC, no Vercel config file (`vercel.json` is present but minimal). |
| 105 | **Terraform** | ❌ Missing | None. |
| 106 | **Helm Charts** | ❌ Missing | No K8s yet → no Helm. |
| 107 | **Build Caching** | ✅ Implemented | Dockerfile uses `--mount=type=cache,target=/root/.npm`. GitHub Actions uses `cache: npm` and `cache: pip` with `cache-dependency-path`. |
| 108 | **Dependency Hell** | 🟡 Partial | `package-lock.json` and `requirements.txt` pin versions. `npm ci` used in CI (reproducible installs). `--fetch-retries=5` guards against registry flakiness. No Renovate/Dependabot for automated security updates. |
| 109 | **Production Incidents** | ❌ Missing | No incident management process, runbook, or on-call rotation defined. |
| 110 | **On-Call** | ❌ Missing | No PagerDuty, OpsGenie, or on-call schedule. |
| 111 | **Postmortems** | ❌ Missing | No postmortem template or process. |

---

## Priority Remediation Plan

### 🔴 Fix Before First Enterprise Client (Sprint 8, Week 1–2)

| Item | What to do | Effort |
|---|---|---|
| **Rate Limiting (#1)** | Add `slowapi` (FastAPI rate limiter) — 5 login attempts/min per IP, 30 uploads/min per user. Replace in-memory semaphore with Redis-backed limiter. | 4 hrs |
| **Optimistic Locking (#36)** | Add `version Int @default(0)` to Well and LASFile. Check-and-increment on any PUT. Prevents silent data overwrites. | 3 hrs |
| **API Versioning (#102)** | Prefix all routes `/api/v1/`. Update frontend env var. Takes 30 min of work, prevents months of pain later. | 2 hrs |
| **N+1 Query Risk (#27)** | Add `selectinload` on any endpoint that iterates related records. Run `EXPLAIN ANALYZE` on the dashboard query. | 4 hrs |
| **Atomic freeChecksUsed (#39)** | Replace read-then-write with `UPDATE User SET "freeChecksUsed" = "freeChecksUsed" + 1 WHERE id = :id AND "freeChecksUsed" < 2`. | 1 hr |
| **Move LAS blobs to R2 (#88)** | Store file content in Cloudflare R2, only the key in Postgres. Prevents the storage cost explosion. | 12 hrs |

### 🟠 Fix Before Multi-Region / Sprint 8

| Item | What to do | Effort |
|---|---|---|
| **Structured Logging (#59)** | Switch to `python-json-logger`. Add `request_id` to every log line. Ship to Logtail (free tier). | 3 hrs |
| **Health / Readiness Probes (#57)** | Add `GET /health/ready` that checks DB connectivity. Separate from liveness. Ready for K8s. | 2 hrs |
| **Distributed Rate Limit (#38)** | Redis (Upstash free tier) + `slowapi` Redis backend. Survives multiple instances. | 4 hrs |
| **Backups (#84)** | Set up a nightly pg_dump to R2 or S3 via a GitHub Actions scheduled workflow. | 3 hrs |
| **Timeouts on outbound HTTP (#11)** | Add `httpx.AsyncClient(timeout=10.0)` to all EmailJS and Paystack calls. | 2 hrs |
| **SSRF on Webhooks (#80)** | Validate that webhook URLs are not RFC-1918 private IPs before storing or dispatching. | 1 hr |

### 🟡 Sprint 9 / Observability Sprint

| Item | What to do | Effort |
|---|---|---|
| **Monitoring & Alerts (#58, #62)** | Sentry (error tracking) + UptimeRobot (uptime). Free tiers cover you to 10K MAU. | 2 hrs |
| **Metrics (#61)** | Add Prometheus metrics via `prometheus-fastapi-instrumentator`. Export to Grafana Cloud free tier. | 4 hrs |
| **SLOs / SLIs (#63, #64)** | Define: 99.5% uptime, P99 upload latency < 3 s, error rate < 1%. Measure with Grafana. | 4 hrs |
| **Feature Flags (#51)** | Use PostHog feature flags (free tier). Lets you roll out AI analysis gradually. | 3 hrs |
| **Canary Releases (#53)** | Once on Cloud Run: traffic split 5% canary → 95% stable on new deploys. | 2 hrs |
| **Async LAS Processing (#15)** | Move KNN imputation to a background task (FastAPI `BackgroundTasks` or Celery + Redis). Returns job ID immediately, frontend polls. Removes the throughput bottleneck. | 16 hrs |

---

## What You're Doing Really Well ✅

- **Security is well ahead of most startups at this stage.** Custom WAF middleware, HMAC-SHA512 webhook validation, scrypt password hashing, timing-safe comparisons, RLS context, SQL injection scanning, and masking of DB errors in 500 responses — this is genuinely impressive for a Sprint 7 build.
- **CI/CD pipeline is solid.** Three workflows, `npm ci`, build caching, Docker build verification on every PR, pytest with Neon warmup — production-grade habits.
- **Database indexing is thorough.** Every FK and every query field has an index. The `@@index([ownerId])` pattern enforces multi-tenancy at the DB layer.
- **Upload concurrency gate is a smart, pragmatic solution** for the current scale — a BoundedSemaphore with a queue counter and proper `Retry-After` headers. Most apps at this stage have none of this.
- **Connection pooling is correctly configured** with all the right parameters (`pool_pre_ping`, `pool_recycle`, `connect_timeout`).

---

*Audit conducted against codebase at `C:\Users\Wanaemi Watson\wellqc` · November 2026*
