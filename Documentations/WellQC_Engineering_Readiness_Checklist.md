# WellQC+ — Master Engineering Readiness Checklist
### A permanent, scale-indexed tracker for every capability the platform needs to implement

> **How to use this document:**
> - Each stage represents a scale milestone. When you reach that MAU range, everything in that stage should be complete.
> - Tick boxes as you implement them. Items carry forward — once done, they stay done.
> - Re-read this document at the start of every sprint.
> - Items marked 🔁 require ongoing attention, not just one-time implementation.
> - Items marked ⚠️ are security or compliance critical — do not defer past their stage.

---

## Stage Index

| Stage | MAU Range | Description | Your Status |
|---|---|---|---|
| [Stage 0](#stage-0) | 0 – 100 | Prototype → Public Launch | 🟡 In Progress |
| [Stage 1](#stage-1) | 100 – 1,000 | Early Traction | ❌ Not Started |
| [Stage 2](#stage-2) | 1,000 – 10,000 | Product-Market Fit | ❌ Not Started |
| [Stage 3](#stage-3) | 10,000 – 100,000 | Growth | ❌ Not Started |
| [Stage 4](#stage-4) | 100,000 – 1,000,000 | Scale | ❌ Not Started |
| [Stage 5](#stage-5) | 1,000,000 – 10,000,000 | Hyper-Scale | ❌ Not Started |
| [Stage 6](#stage-6) | 10,000,000+ | Enterprise / Unicorn | ❌ Not Started |

---

<a name="stage-0"></a>
## Stage 0 — Prototype → Public Launch (0 – 100 MAU)
> **Goal:** Safe, stable, and deployable. Users can trust it with their data.

### 🔐 Security Basics
- [x] ⚠️ Password hashing with scrypt / bcrypt / argon2 (not MD5 or SHA-1)
- [x] ⚠️ HMAC-signed session tokens with expiry
- [x] ⚠️ httpOnly, Secure session cookies
- [x] ⚠️ CORS configured with explicit origin allowlist + regex for previews
- [x] ⚠️ SQL injection protection via ORM parameterisation
- [x] ⚠️ XSS protection headers (X-XSS-Protection, X-Content-Type-Options)
- [x] ⚠️ Clickjacking protection (X-Frame-Options: DENY)
- [x] ⚠️ HSTS header (Strict-Transport-Security with preload)
- [x] ⚠️ TLS on all endpoints (HTTPS enforced)
- [x] ⚠️ Multi-tenant data isolation — every query scoped by ownerId
- [x] ⚠️ Admin role default-deny (403 on non-admin access to admin endpoints)
- [x] ⚠️ Public registration cannot self-assign ADMIN role
- [x] ⚠️ Webhook signature validation (HMAC-SHA512 for Paystack)
- [x] ⚠️ Error messages mask internal DB/stack details in production
- [x] ⚠️ Secrets in environment variables, not committed to git
- [x] ⚠️ Production refuses to start with weak/default AUTH_SECRET
- [x] ⚠️ Rate limiting on login endpoint (max 5 attempts/min per IP)
- [x] ⚠️ SSRF protection on any endpoint that accepts a URL parameter

### 🏗️ Infrastructure
- [x] App deployed and publicly accessible
- [x] Frontend on CDN edge (Vercel)
- [x] Backend on managed compute (Render)
- [x] PostgreSQL database provisioned (Neon)
- [x] TLS certificates auto-provisioned
- [x] Custom domain purchased (do this if not done)
- [ ] Custom domain connected to Vercel (wellqc.app or similar)
- [ ] API pointed directly at backend subdomain (api.wellqc.app → Render) — removes Vercel rewrite hop

### 🗄️ Database
- [x] Database indexes on all foreign keys and frequently queried columns
- [x] ownerId indexed on every tenant-scoped table
- [x] Connection pooling configured (pool_size, max_overflow, pool_recycle, pool_pre_ping)
- [x] Database schema version-controlled via Prisma migrations
- [x] ⚠️ Automated nightly database backup (pg_dump to Cloudflare R2 or S3)
- [ ] Backup restore tested at least once manually

### 🧪 Testing & CI/CD
- [x] Unit tests (Jest for frontend, pytest for backend)
- [x] Tests run automatically on every pull request
- [x] Linting enforced in CI
- [x] Build verified in CI before merge
- [x] Database migrations run automatically on push to main
- [x] Docker image built and verified in CI
- [ ] All tests pass consistently (no flaky tests)
- [ ] Branch protection rule: PRs require passing CI before merge to main

### 📋 Basic Operations
- [x] Health check endpoint (`GET /health` returns 200 with status)
- [x] Uptime monitor configured (UptimeRobot or Better Uptime — free tier)
- [x] Error tracking configured (Sentry free tier)
- [ ] 🔁 Check error logs at least once a week
- [x] README documents how to run, deploy, and roll back
- [x] Runbook: what to do if the site goes down

### 🗂️ File Storage
- [x] ⚠️ LAS file content stored in Cloudflare R2 (not in PostgreSQL rows) — do this before 50 users to avoid storage cost explosion
- [x] Database stores only the R2 object key, not the file bytes

### 💳 Freemium / Feature Gate
- [x] Free tier hard cap: 3 LAS file uploads per account (enforced via `freeChecksUsed` counter and LAS ownership query)
- [x] Wireline Log Viewer accessible to all tiers (including Free tier users) across `/upload` and `/wells/[id]` dossier
- [x] Quality Anomalies detailed diagnostics gated behind PRO tier for Free users (locked paywall card with upgrade CTA)
- [x] Admin-only well asset deletion governance: standard users cannot delete well assets, eliminating quota evasion and protecting NUPRC compliance
- [x] File cleaning / auto-fix endpoint gated behind PRO tier
- [x] Certified report and export downloads (PDF/JSON/Cleaned LAS) gated behind PRO tier
- [x] Paywall UI: locked workstation components display Pro badges and trigger `<PaystackUpgradeModal />`
- [x] Upgrade flow tested end-to-end: free → Paystack checkout (NGN/USD with automatic sandbox fallback) → PRO tier unlocked

---

<a name="stage-1"></a>
## Stage 1 — Early Traction (100 – 1,000 MAU)
> **Goal:** Reliable for paying users. Fast enough that no one complains. Safe from the most common attacks.

### 🔐 Security
- [ ] ⚠️ Rate limiting on all auth endpoints (login, register, password reset) — per IP
- [ ] ⚠️ Rate limiting on file upload endpoint — per user (not just per process)
- [ ] ⚠️ Account lockout after N failed login attempts (or CAPTCHA)
- [ ] ⚠️ Email verification required before full account access
- [ ] ⚠️ Password reset tokens expire after 1 hour
- [ ] ⚠️ Session invalidated on password change
- [ ] API versioning added (`/api/v1/` prefix on all routes)
- [ ] Semantic versioning used for releases (git tags: v1.0.0, v1.1.0, etc.)
- [ ] Dependabot or Renovate enabled for automated dependency security updates

### 🏗️ Infrastructure
- [ ] Render upgraded from free/hobby to paid instance (avoid cold starts)
- [ ] At least 2 Render instances OR migration to Cloud Run begun
- [ ] Vercel upgraded to Pro plan
- [ ] Custom domain live with HTTPS
- [ ] DNS health check configured (Cloudflare or Route 53)
- [ ] `Retry-After` header returned on all 429 and 503 responses

### 🗄️ Database
- [ ] Neon upgraded to paid plan (Launch tier)
- [ ] `SELECT FOR UPDATE` or `UPDATE ... WHERE version = :v` on any resource updated concurrently (wells, freeChecksUsed counter)
- [ ] Atomic increment for `freeChecksUsed` (single UPDATE statement, no read-then-write)
- [ ] Slow query logging enabled (Neon dashboard or pg_stat_statements)
- [ ] At least one `EXPLAIN ANALYZE` review of your top 5 most-used queries

### 🔄 Resilience
- [ ] Outbound HTTP calls to EmailJS, Paystack have explicit timeouts (10 s max)
- [ ] Retry with fixed delay on outbound HTTP calls (max 3 attempts)
- [ ] DB connection failure returns a user-friendly error (not a 500 stack trace)
- [ ] Upload gate Retry-After header tested and confirmed working

### 📊 Observability
- [ ] Sentry configured and catching errors in production
- [ ] 🔁 Sentry error volume reviewed weekly
- [ ] Structured JSON logging in FastAPI (python-json-logger or structlog)
- [ ] Log every request with: method, path, status code, user_id, duration_ms
- [ ] Logs shipped to a log aggregator (Logtail or Papertrail — free tier)
- [ ] Uptime alerts configured (email or SMS when site is down)

### 🚀 Deployment
- [ ] Rollback procedure documented and tested (redeploy previous commit on Render)
- [ ] One-way DB migrations checked — never drop columns in a migration without a code deploy first
- [ ] Environment variables documented (`.env.example` up to date)
- [ ] Zero-downtime deploys confirmed (Render graceful restart)

### 📧 Communications
- [ ] Email provider upgraded from EmailJS to Resend or AWS SES (more reliable at volume)
- [ ] Transactional emails tested end-to-end: welcome, verify, password reset, payment receipt

---

<a name="stage-2"></a>
## Stage 2 — Product-Market Fit (1,000 – 10,000 MAU)
> **Goal:** Survive load. First enterprise clients. Begin compliance journey. The business is now worth protecting properly.

### 🔐 Security & Compliance
- [ ] ⚠️ Penetration test commissioned (annual, from a qualified vendor)
- [ ] ⚠️ SOC 2 Type I preparation begins (document policies, access controls, change management)
- [ ] ⚠️ Secrets moved to a secrets manager (AWS Secrets Manager or HashiCorp Vault) — no more plain `.env` files in production
- [ ] ⚠️ Principle of least privilege for all service accounts and IAM roles
- [ ] ⚠️ Database credentials rotated every 90 days
- [ ] ⚠️ All admin actions logged to an immutable audit trail
- [ ] OAuth 2.0 social login (Google / Microsoft) — reduces password liability
- [ ] JWT or session rotation: issue a new token on each request or every 15 minutes
- [ ] WAF in front of backend (Cloudflare WAF free tier or AWS WAF)
- [ ] DDoS protection enabled (Cloudflare proxy for the backend domain)
- [ ] CSRF double-submit cookie or SameSite=Strict cookie attribute enforced
- [ ] Content Security Policy (CSP) header configured on all pages
- [ ] Subresource Integrity (SRI) on any externally loaded scripts

### 🏗️ Infrastructure
- [ ] Compute migrated from Render → Google Cloud Run (autoscaling, pay-per-request, no cold starts on min-instances=1)
- [ ] Load balancer in front of backend (Cloud Run handles this natively)
- [ ] API subdomain live and direct (`api.wellqc.app` → Cloud Run — no Vercel rewrite)
- [ ] File uploads streamed directly to Cloudflare R2 from frontend (presigned URLs) — backend no longer touches file bytes
- [ ] CDN for API responses: cache Analytics and Dashboard KPI endpoints at edge (Cache-Control: public, max-age=60)
- [ ] HTTP/2 enabled on backend (Uvicorn `--http h2`)

### 🗄️ Database
- [ ] Read replica provisioned for analytics and dashboard queries (Neon supports branching for this)
- [ ] Dashboard and Analytics endpoints route reads to replica, writes to primary
- [ ] SQLAlchemy `selectinload` / `joinedload` audited on all list endpoints to eliminate N+1 queries
- [ ] `EXPLAIN ANALYZE` run on top 10 slowest queries (use pg_stat_statements)
- [ ] Table-level index review — add composite indexes where needed (e.g., `(ownerId, createdAt)` on ActivityLog)
- [ ] ActivityLog partitioned by month (time-based partitioning before it grows past 1 M rows)
- [ ] Connection pool sized to Cloud Run instance count × 10 (reconfigure pool_size)
- [ ] PgBouncer or RDS Proxy evaluated if connection count exceeds Neon limits

### 🔄 Resilience
- [ ] Retry with exponential backoff on all outbound HTTP calls (Paystack, email, any third-party)
- [ ] Circuit breaker on database calls: if DB is down, return 503 immediately instead of queuing up threads
- [ ] Circuit breaker on external services (Paystack, EmailJS)
- [ ] Graceful degradation: if analytics DB is slow, return cached KPIs instead of timing out
- [ ] `freeChecksUsed` race condition fixed: use `SELECT ... FOR UPDATE` or atomic SQL UPDATE
- [ ] Idempotency keys on all payment and subscription mutation endpoints
- [ ] Paystack webhook deduplication table: store processed event IDs, skip replays

### ⚡ Performance
- [ ] Heavy LAS processing (KNN imputation, benchmark) moved to background tasks (FastAPI BackgroundTasks → Celery + Redis or Cloud Tasks)
- [ ] Upload returns a job ID immediately; frontend polls `GET /api/las/status/{job_id}` for result
- [ ] P99 latency measured and baselined for top 5 endpoints
- [ ] Response compression (gzip) enabled on FastAPI (`GZipMiddleware`)
- [ ] Image and static asset optimisation confirmed on Vercel

### 📊 Observability
- [ ] Application Performance Monitoring (APM) installed — Sentry Performance or New Relic free tier
- [ ] Request trace ID generated per request and logged (use `uuid4()` as `X-Request-ID` header)
- [ ] `X-Request-ID` propagated from Next.js → FastAPI on every API call
- [ ] Metrics dashboard: requests/min, error rate, P50/P99 latency, active uploads, DB query time
- [ ] Business metrics tracked: daily uploads, new signups, conversion events, MRR
- [ ] 🔁 Weekly metrics review meeting (even if it's just you looking at a dashboard)
- [ ] Alerts configured for: error rate > 1%, P99 latency > 3 s, uptime < 99.5%
- [ ] SLO defined: 99.5% uptime, < 2 s P99 for uploads, < 500 ms P99 for reads
- [ ] SLI instrumented: measure the SLO metrics in real time
- [ ] Error budget calculated: 0.5% downtime = 3.6 hrs/month allowed

### 🚀 Deployment
- [ ] Blue-green deployment or canary releases configured on Cloud Run (traffic split: 5% new → 95% stable)
- [ ] Automated rollback on health check failure (Cloud Run supports this natively)
- [ ] Feature flags system installed (PostHog or LaunchDarkly free tier)
- [ ] All new features deployed behind a feature flag before full rollout
- [ ] Database migration rollback strategy documented (what to do if a migration breaks prod)

### 🔁 Operations
- [ ] On-call rotation documented (even if it's just you on your phone)
- [ ] PagerDuty or Spike.sh configured to wake someone up if the site goes down
- [ ] Postmortem template created (every incident > 1 hour gets a written postmortem)
- [ ] Runbook for top 5 most likely incidents: DB down, Render/Cloud Run crash, Paystack webhook failure, auth broken, storage full
- [ ] Disaster recovery tested: restore from backup to a staging environment

---

<a name="stage-3"></a>
## Stage 3 — Growth (10,000 – 100,000 MAU)
> **Goal:** Enterprise-ready. Multi-region. SLA commitments. The platform must not go down.

### 🔐 Security & Compliance
- [ ] ⚠️ SOC 2 Type II audit completed and certificate issued
- [ ] ⚠️ ISO 27001 preparation (if targeting oil majors — Shell, TotalEnergies, ExxonMobil require this)
- [ ] ⚠️ NDPR (Nigerian Data Protection Regulation) compliance documented
- [ ] ⚠️ Data residency options available for EU customers (GDPR)
- [ ] ⚠️ Full IAM audit: every service account has only the permissions it needs, no more
- [ ] ⚠️ Zero-trust network policy: services communicate only on explicitly allowed paths
- [ ] ⚠️ Vulnerability scanning in CI/CD pipeline (Trivy for Docker images, Snyk for dependencies)
- [ ] ⚠️ Bug bounty program launched (HackerOne or Bugcrowd basic tier)
- [ ] ⚠️ Annual penetration test (application + infrastructure)
- [ ] Security incident response plan documented and tested

### 🏗️ Infrastructure
- [ ] Kubernetes cluster provisioned (GKE Autopilot or EKS — Sprint 8 target)
- [ ] Helm charts written for all services
- [ ] Multi-region active-active or active-passive deployment (us-east-1 + eu-west-1 at minimum)
- [ ] Global load balancing with latency-based routing (Cloudflare or AWS Global Accelerator)
- [ ] Infrastructure as Code for all cloud resources (Terraform or Pulumi — no manual console changes)
- [ ] All Terraform state stored remotely (Terraform Cloud or S3 + DynamoDB lock)
- [ ] Staging environment that mirrors production exactly (same infra, different data)
- [ ] Service mesh considered (Istio or Linkerd) for inter-service mTLS

### 🗄️ Database
- [ ] Database migrated from Neon → Aurora Serverless v2 (PostgreSQL-compatible, autoscales, Multi-AZ)
- [ ] Aurora Multi-AZ enabled (automatic failover in < 30 s)
- [ ] Read replicas in each deployment region
- [ ] Connection pooling via RDS Proxy (manages thousands of connections, no pool exhaustion)
- [ ] Database sharding strategy documented (even if not yet implemented — plan ahead)
- [ ] Time-series data (quality scores, analytics) moved to a time-series store (TimescaleDB extension or InfluxDB)
- [ ] Data archiving policy: ActivityLog older than 2 years → cold storage (S3 Glacier)
- [ ] Database query cost monitoring enabled (pg_stat_statements in CloudWatch / Datadog)

### 🔄 Resilience
- [ ] Circuit breakers on all external service calls with fallback behaviour defined
- [ ] Chaos engineering drills scheduled quarterly (kill a pod, block a region, saturate DB connections)
- [ ] Bulkhead pattern: separate connection pools for read and write operations
- [ ] Rate limiting distributed across all instances (Redis-backed, not in-process)
- [ ] Rate limiting per customer tier (Free: 10 req/min, Pro: 100 req/min, Enterprise: custom)
- [ ] Backpressure propagated end-to-end: queue depth exposed as a metric, alerts fire before it fills
- [ ] Network partition handling documented: what does each service do if it can't reach the DB?
- [ ] Failover tested: manually kill the primary DB and confirm replica promotion in < 60 s

### ⚡ Performance
- [ ] Message queue for all async work (Celery + Redis or Google Cloud Tasks)
- [ ] Dead Letter Queue configured: failed jobs captured, alerting on DLQ depth > 0
- [ ] Caching layer: Redis for session data, rate limit counters, frequently read KPIs
- [ ] Cache invalidation strategy documented for every cached resource
- [ ] CDN edge caching for LAS file downloads (R2 + Cloudflare — zero egress cost)
- [ ] Lazy loading and pagination on all list endpoints (no unbounded `SELECT *`)
- [ ] Tail latency (P99.9) measured for the most critical endpoints
- [ ] Database query cache (pg_prewarm for hot tables on startup)
- [ ] `VACUUM ANALYZE` scheduled on large tables

### 📊 Observability
- [ ] Full observability stack: Datadog or Grafana + Prometheus + Loki + Tempo (logs + metrics + traces)
- [ ] Distributed tracing across Next.js → FastAPI → PostgreSQL → R2 (OpenTelemetry)
- [ ] Every service emits trace IDs, span IDs, and parent span IDs
- [ ] Real user monitoring (RUM): Datadog RUM or Sentry Replay
- [ ] Synthetic monitoring: headless browser test running every 5 minutes (simulate a real upload)
- [ ] SLO dashboards visible to the whole team
- [ ] Error budget burn rate alerts (alert when burning error budget 2× faster than expected)
- [ ] On-call rotation formalised with escalation policy (L1 → L2 → Engineering Lead)
- [ ] 🔁 Postmortem conducted within 48 hours of every P1 incident
- [ ] Incident severity levels defined (P1: site down, P2: degraded, P3: minor)

### 🚀 Deployment
- [ ] Rolling deployments with health check gating (never route traffic to an unhealthy pod)
- [ ] Liveness probe: `GET /health` — restarts pod if it fails 3 consecutive checks
- [ ] Readiness probe: `GET /health/ready` (checks DB connectivity) — removes pod from load balancer until ready
- [ ] Canary releases: all deploys start at 5% traffic, auto-promote if error rate stays < 0.1%
- [ ] Automated rollback: if P99 latency doubles after a deploy, roll back automatically
- [ ] Deployment freeze windows defined (no deploys on Friday afternoon, Nigerian public holidays)
- [ ] Change advisory board (CAB) process for high-risk changes

### 🔁 Async & Events
- [ ] Message queue in production (Celery + Redis, BullMQ, or Google Cloud Tasks)
- [ ] All file processing jobs async: parse, QA score, AI analysis, imputation — none in request thread
- [ ] Job status polling endpoint (`GET /api/jobs/{id}`) or Server-Sent Events for progress
- [ ] Dead Letter Queue with alerting on failure
- [ ] Cron jobs for scheduled work: session cleanup, subscription expiry check, usage report generation
- [ ] Event log: every significant business event emitted to a structured event store

---

<a name="stage-4"></a>
## Stage 4 — Scale (100,000 – 1,000,000 MAU)
> **Goal:** The platform runs itself. Engineering focuses on features, not firefighting.

### 🔐 Security
- [ ] ⚠️ CISO hired or fractional CISO engaged
- [ ] ⚠️ Security team separate from engineering team
- [ ] ⚠️ Automated compliance scanning in CI (AWS Config, Prisma Cloud)
- [ ] ⚠️ Customer data encryption at application layer (not just at DB layer)
- [ ] ⚠️ Customer-managed encryption keys (CMEK) option for enterprise clients
- [ ] ⚠️ Audit logs immutable and customer-accessible (required by oil major procurement)
- [ ] ⚠️ SAML/SSO integration for enterprise customers (Okta, Azure AD)
- [ ] ⚠️ Multi-factor authentication (MFA) mandatory for admin accounts, optional for users
- [ ] Token rotation: short-lived access tokens (15 min) + long-lived refresh tokens (7 days)
- [ ] All secrets rotated automatically (AWS Secrets Manager auto-rotation)

### 🏗️ Infrastructure
- [ ] Multi-cloud or multi-region active-active (US, EU, Africa regions)
- [ ] Kubernetes HPA (Horizontal Pod Autoscaler) configured for every service
- [ ] VPA (Vertical Pod Autoscaler) for right-sizing pod resource requests
- [ ] Cluster autoscaler: Kubernetes nodes scale in and out with pod demand
- [ ] Service mesh with mTLS between all internal services (Istio or Linkerd)
- [ ] Dedicated ingress controller (NGINX Ingress or Istio Gateway)
- [ ] Private VPC: backend services not directly internet-accessible
- [ ] NAT gateway for outbound traffic from private subnets
- [ ] Egress firewall: allow-list of outbound destinations

### 🗄️ Database
- [ ] Aurora Global Database (< 1 s cross-region replication)
- [ ] Read replicas in every active region
- [ ] Application-level read/write splitting: all GET routes → replica, all mutations → primary
- [ ] Database query planner reviewed annually with a DBA
- [ ] Table partitioning implemented on ActivityLog, QualityReport, and Anomaly tables
- [ ] Sharding strategy implemented if any single table exceeds 500 GB
- [ ] Data lake: raw LAS files and QC results replicated to S3 for analytics (Athena / BigQuery)

### ⚡ Performance
- [ ] gRPC for internal service-to-service calls (lower latency than REST)
- [ ] HTTP/3 (QUIC) enabled on public-facing endpoints
- [ ] Global caching tier: Redis cluster (ElastiCache or Upstash) in every region
- [ ] Cache hit rate > 80% for read-heavy endpoints
- [ ] P99 latency < 500 ms for all user-facing endpoints — SLO enforced
- [ ] Load test suite runs weekly against staging (k6 or Locust)
- [ ] Throughput tested to 10× current peak — the system must handle a sudden spike

### 📊 Observability
- [ ] Full OpenTelemetry implementation across every service
- [ ] Business observability: conversion funnel tracked in real time (signups → free use → paid)
- [ ] Cost per request tracked (infra cost / request count per endpoint)
- [ ] Capacity planning model: given current growth rate, when does each resource hit 80% utilisation?
- [ ] 🔁 Monthly capacity planning review with engineering lead
- [ ] Chaos engineering: GameDay drills quarterly (whole team participates in simulated incident)

### 🔄 Resilience
- [ ] Multi-region failover tested annually (simulate a full region going offline)
- [ ] RTO (Recovery Time Objective) < 5 minutes for P1 incidents
- [ ] RPO (Recovery Point Objective) < 1 minute (database replication lag < 60 s)
- [ ] Bulkheads between customer tiers: Enterprise customers on dedicated resources
- [ ] API quotas per customer tier enforced at gateway level (not application level)
- [ ] Eventual consistency documented for every endpoint that uses it

### 🚀 Deployment
- [ ] GitOps: all infrastructure changes via pull requests (ArgoCD or Flux)
- [ ] Environment promotion pipeline: dev → staging → canary → production
- [ ] Database migration dry-run in staging before every production migration
- [ ] Zero-downtime schema migrations enforced (additive changes only; never drop without deprecation period)

---

<a name="stage-5"></a>
## Stage 5 — Hyper-Scale (1,000,000 – 10,000,000 MAU)
> **Goal:** The platform is a critical piece of global oil & gas infrastructure. Every decision is about reliability at massive scale.

### 🔐 Security
- [ ] ⚠️ ISO 27001 certified
- [ ] ⚠️ GDPR Data Processing Agreements signed with all EU customers
- [ ] ⚠️ API security gateway with per-token rate limiting, threat detection, bot mitigation
- [ ] ⚠️ Zero-trust architecture: no implicit trust between any two services
- [ ] ⚠️ Automated threat intelligence feeds integrated (block known malicious IPs at edge)
- [ ] Red team exercises twice a year (external attackers hired to try to breach the system)

### 🏗️ Infrastructure
- [ ] Multi-cloud considered to avoid vendor lock-in (AWS primary, GCP failover)
- [ ] Edge computing: some processing moved to Cloudflare Workers / Lambda@Edge (e.g., auth, rate limiting)
- [ ] Dedicated hardware for largest enterprise clients (if contractually required)
- [ ] FinOps function: dedicated person or team managing cloud cost optimisation
- [ ] Reserved instances / committed use discounts negotiated with cloud providers (30–50% savings)

### 🗄️ Database
- [ ] CQRS (Command Query Responsibility Segregation): separate read and write models
- [ ] Event sourcing for audit-critical entities (LASFile, QualityReport)
- [ ] Data warehouse for analytics (BigQuery or Redshift) — OLAP separate from OLTP
- [ ] ML feature store for AI model training data
- [ ] Database cost per query tracked and optimised

### ⚡ Performance
- [ ] AI model self-hosted on GPU cluster (save $600K+/month vs. API calls at this scale)
- [ ] Predictive autoscaling: scale before the traffic arrives (based on time-of-day patterns)
- [ ] Global anycast network for < 50 ms latency from any country

### 📊 Observability
- [ ] Observability-as-a-platform: internal tooling team builds observability products for other engineers
- [ ] AI/ML anomaly detection on metrics (automated incident detection, not just static thresholds)
- [ ] Cost observability: every team can see the cloud cost of their service

---

<a name="stage-6"></a>
## Stage 6 — Enterprise / Unicorn (10,000,000+ MAU)
> **Goal:** The platform is infrastructure. It is expected to be as reliable as electricity.

### 🔐 Security
- [ ] ⚠️ Full-time internal security operations centre (SOC)
- [ ] ⚠️ 24/7 threat monitoring with automated response
- [ ] ⚠️ Compliance team for every region of operation (US, EU, Africa, Middle East)
- [ ] ⚠️ Supply chain security: audit every open-source dependency

### 🏗️ Infrastructure
- [ ] Five-nines availability target (99.999% = 5 min downtime/year)
- [ ] Active-active multi-region: requests served from the nearest region, no primary/backup
- [ ] Dedicated fibre or private connectivity between regions (not public internet)
- [ ] Hardware redundancy at every layer (dual network cards, RAID storage)

### 📊 Observability
- [ ] Sub-second incident detection
- [ ] Automated remediation for known failure modes (self-healing infrastructure)
- [ ] 🔁 Annual architecture review with external experts

### 🔄 Resilience
- [ ] Chaos engineering as continuous practice (automated chaos injected daily in staging)
- [ ] Annual DR exercise: full production failover to backup region, with real traffic
- [ ] Every runbook tested quarterly

---

## 🗓️ Ongoing Responsibilities (At Every Stage)

These are never "done" — they recur forever:

| Cadence | Task |
|---|---|
| **Daily** | Check error tracking dashboard (Sentry) for new issues |
| **Daily** | Check uptime monitor — confirm all services green |
| **Weekly** | Review slow query log — any new queries above 500 ms? |
| **Weekly** | Check dependency updates — any critical security patches? |
| **Weekly** | Review key business metrics: MAU, MRR, conversion rate, churn |
| **Monthly** | Rotate secrets and credentials that require manual rotation |
| **Monthly** | Review and prune unused user accounts and API tokens |
| **Monthly** | Test backup restore to staging environment |
| **Monthly** | Review cloud costs against budget — any anomalous spend? |
| **Quarterly** | Full security review of new features added in the quarter |
| **Quarterly** | Load test against 2× current peak traffic |
| **Quarterly** | Review and update all runbooks |
| **Quarterly** | Chaos engineering drill |
| **Annually** | Penetration test (external vendor) |
| **Annually** | Full disaster recovery test (restore from backup to new environment) |
| **Annually** | Review and renew all compliance certifications |
| **Annually** | Architecture review: is the current design still right for the next 3× of growth? |

---

## 📌 Quick Status Reference

Use this table to get a fast view of where you are. Update it at the start of each sprint.

| Stage | Total Items | Done | Partial | Missing | % Complete |
|---|---|---|---|---|---|
| Stage 0 (0–100 MAU) | 44 | 27 | 0 | 17 | 61% |
| Stage 1 (100–1K MAU) | 28 | 0 | 0 | 28 | 0% |
| Stage 2 (1K–10K MAU) | 52 | 0 | 0 | 52 | 0% |
| Stage 3 (10K–100K MAU) | 58 | 0 | 0 | 58 | 0% |
| Stage 4 (100K–1M MAU) | 40 | 0 | 0 | 40 | 0% |
| Stage 5 (1M–10M MAU) | 20 | 0 | 0 | 20 | 0% |
| Stage 6 (10M+ MAU) | 12 | 0 | 0 | 12 | 0% |

> Update the counts as you tick items off. The goal is never 100% — it's knowing exactly where you are.

---

*WellQC+ Master Engineering Checklist · First created November 2026 · Update this document at the start of every sprint*
*Version this document in git alongside your codebase.*
