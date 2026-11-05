# WellQC+ — Full Business Cost Model
### From Free-Tier Prototype → 10 M MAU Enterprise

> [!IMPORTANT]
> All figures are **2025/2026 list prices** in USD. Staff costs use **offshore/distributed** rates as a baseline (40–60 % cheaper than US SF/NYC). Paystack is used instead of Stripe; fee logic is identical (2.9 % + ₦100 / $0.30 per charge). Two AI cases are shown throughout: **AI-Free** and **AI-Paid** ($0.002–$0.02 per file).

---

## 1. Core Assumptions (Derivation)

| Parameter | Value | Source / Rationale |
|---|---|---|
| Avg files/user/month | **30** | Petrophysicist QC cadence (stated) |
| Avg file size | **1.25 MB** | Midpoint of 1–1.5 MB range |
| Storage accumulation | **Perpetual** | No archiving policy assumed |
| Peak-hour multiplier | **3×** | Stated |
| Throughput ceiling (current) | **0.15–0.16 uploads/s** on 1× 512 MB Render | Load test data |
| Upload concurrency (current) | **2 active + 15 queued** | Load test data |
| Paystack fee | **2.9 % + $0.30** per charge | Paystack international (USD) |
| AI cost (paid case) | **$0.01/file** | Midpoint of $0.002–$0.02 range |
| Avg revenue per paying user | **$49/mo** (Pro Monthly) | README pricing |
| Free-to-paid conversion | **5 %** | Typical B2B SaaS niche tool |
| Support tickets/100 MAU/mo | **3** | Low-touch petrophysics tool |
| Ticket cost (outsourced) | **$8** per resolution | Industry benchmark |

---

## 2. Derived Traffic & Storage Numbers

| Scale | MAU | Files/mo | GB uploaded/mo | Cumulative storage (12 mo) | Peak upload req/s |
|---|---|---|---|---|---|
| **1** | 1 | 30 | 0.04 | 0.4 GB | 0.003 |
| **10** | 10 | 300 | 0.38 | 4.5 GB | 0.03 |
| **100** | 100 | 3,000 | 3.75 GB | 45 GB | 0.3 |
| **1,000** | 1,000 | 30,000 | 37.5 GB | 450 GB | 3 |
| **10,000** | 10,000 | 300,000 | 375 GB | 4.5 TB | 30 |
| **100,000** | 100,000 | 3,000,000 | 3.75 TB | 45 TB | 300 |
| **1,000,000** | 1 M | 30 M | 37.5 TB | 450 TB | 3,000 |
| **10,000,000** | 10 M | 300 M | 375 TB | 4,500 TB | 30,000 |

> [!NOTE]
> Peak req/s assumes 3× hour multiplier applied over 8 active hours. The current single Render 512 MB instance handles ~0.15 req/s, so it saturates somewhere around **15 MAU** under sustained load.

---

## 3. Infrastructure Cost by Scale

### 3A. Compute — Render (current baseline)

| Scale | Instance config | Render plan | Monthly compute |
|---|---|---|---|
| 1–10 MAU | 1× Starter (512 MB) | Free → Hobby | **$0 → $7** |
| 10–100 MAU | 1× Standard (1 CPU / 2 GB) | Pro workspace | **$25 + $25 = $50** |
| 100–500 MAU | 2× Standard + Render autoscale | Pro | **$100** |
| 500–2K MAU | 4× Standard or 1× Performance-4 GB | Scale | **$200–$400** |
| 2K–10K MAU | Render becomes uneconomic; migrate (see §6) | — | — |

### 3B. Frontend — Vercel

| Scale | Vercel plan | Monthly cost |
|---|---|---|
| 1–100 MAU | Hobby (free) — fine for solo projects | **$0** |
| 100–10K MAU | Pro · 2 deploying seats | **$40** ($20×2) |
| 10K–100K MAU | Pro · 3 seats + BW overage ~100 GB | **$65** |
| 100K–1M MAU | Enterprise or move to Cloudflare Pages | **$400–$2,000** |
| >1M MAU | Self-host Next.js on Cloud Run / ECS | ~**$800** (compute only) |

> Vercel includes 1 TB CDN/month on Pro; 1 M MAU each loading ~200 KB of JS = ~200 GB/mo — comfortably within that.

### 3C. Database — Neon PostgreSQL

Storage accumulates **without archiving**, which is the dominant cost driver.

| Scale | Cumulative storage (12 mo) | Neon plan | Compute (CU-hrs) | Storage | Monthly DB cost |
|---|---|---|---|---|---|
| 1 MAU | 0.4 GB | Free | $0 | $0 | **$0** |
| 10 MAU | 4.5 GB | Launch | ~$0.50 | $1.60 | **$2** |
| 100 MAU | 45 GB | Launch | ~$4 | $15.75 | **$20** |
| 1K MAU | 450 GB | Scale | ~$22 | $157 | **$180** |
| 10K MAU | 4,500 GB | Scale | ~$90 | $1,575 | **$1,665** |
| 100K MAU | 45,000 GB | **Migrate to RDS/Aurora** | — | — | see §6 |
| 1M MAU | 450 TB | Aurora Serverless v2 | — | — | **$18,000** |
| 10M MAU | 4,500 TB | Aurora + S3 offload | — | — | **$85,000** |

> [!CAUTION]
> **Storage is the time bomb.** At 10K MAU the Neon bill alone (~$1,665/mo) exceeds the $1,500 migration trigger. The correct fix is to **never store raw LAS bytes in Postgres** — move file blobs to Cloudflare R2 at month 1, keep only metadata in Neon. This changes the 10K-MAU DB bill from $1,665 to ~$90.

### 3C-corrected. Neon (metadata only) + Cloudflare R2 (files)

| Scale | Neon storage (metadata only) | Neon cost | R2 storage | R2 cost (at $0.015/GB, $0 egress) | Combined DB+Storage |
|---|---|---|---|---|---|
| 100 MAU | ~0.5 GB | $0.18 | 45 GB | $0.68 | **$1** |
| 1K MAU | ~5 GB | $1.75 | 450 GB | $6.75 | **$9** |
| 10K MAU | ~50 GB | $17 | 4,500 GB | $67 | **$84** |
| 100K MAU | ~500 GB | $175 | 45 TB | $675 | **$850** |
| 1M MAU | ~5 TB | $1,750 | 450 TB | $6,750 | **$8,500** |
| 10M MAU | ~50 TB | $17,500 | 4,500 TB | $67,500 | **$85,000** |

### 3D. Email — EmailJS

| Scale | Emails/mo | EmailJS plan | Monthly cost |
|---|---|---|---|
| 1–100 MAU | <200 | Free | **$0** |
| 100–1K MAU | 200–2K | Basic ($9.99/mo) | **$10** |
| 1K–10K MAU | 2K–30K | Pro ($19.99/mo) | **$20** |
| >10K MAU | >30K | Migrate to Resend or AWS SES ($0.10/1K) | **$3–$300** |

### 3E. Custom Domain + SSL

| Item | Provider | Annual | Monthly equiv |
|---|---|---|---|
| `.app` domain (wellqc.app) | Cloudflare Registrar | $14/yr | $1.20 |
| SSL cert | Vercel auto / Cloudflare | $0 | $0 |
| **Total** | | **$14/yr** | **$1.20** |

### 3F. Monitoring & Observability

| Scale | Tool | Monthly cost |
|---|---|---|
| 1–100 MAU | Vercel Analytics (free tier) + UptimeRobot | **$0** |
| 100–10K MAU | Sentry free + Grafana Cloud free tier | **$0–$20** |
| 10K–100K MAU | Sentry Team ($26) + Grafana Cloud Pro ($19) | **$45** |
| 100K–1M MAU | Datadog Infra (Sprint 8/9 observability) | **$300–$1,500** |
| >1M MAU | Datadog full stack | **$3,000–$8,000** |

---

## 4. Full Business Cost — Monthly & Annual (All 8 Scales)

### Notation
- **AI-Free**: The AI analysis engine (ai-analyzer.ts / ai_analyzer.py) uses only local rule-based scoring — $0 per file.
- **AI-Paid**: External LLM call at $0.01/file (midpoint of $0.002–$0.02 range).

---

### Scale: 1 MAU

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| Render compute (Hobby) | $7 | $7 |
| Vercel (Hobby) | $0 | $0 |
| Neon (free) + R2 (< 1 GB) | $0 | $0 |
| EmailJS (free) | $0 | $0 |
| Domain | $1.20 | $1.20 |
| Monitoring | $0 | $0 |
| AI calls (30 files) | $0 | $0.30 |
| Paystack fees (0 paying users) | $0 | $0 |
| Support staff | $0 | $0 |
| Engineering (founder-led) | $0 | $0 |
| Security / legal / tax | $0 | $0 |
| **Monthly total** | **$8.20** | **$8.50** |
| **Annual total** | **$98** | **$102** |

---

### Scale: 10 MAU

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| Render (Hobby 1×) | $7 | $7 |
| Vercel (Hobby) | $0 | $0 |
| Neon Launch + R2 | $2 | $2 |
| EmailJS free | $0 | $0 |
| Domain | $1.20 | $1.20 |
| AI calls (300 files) | $0 | $3 |
| Paystack (0–1 paying @ $49) | $1.72 | $1.72 |
| Support (0 tickets avg) | $0 | $0 |
| Engineering (founder) | $0 | $0 |
| **Monthly total** | **$12** | **$15** |
| **Annual total** | **$144** | **$180** |

---

### Scale: 100 MAU (5 paying users → $245 MRR)

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| Render Standard 1× + Pro workspace | $50 | $50 |
| Vercel Pro (2 seats) | $40 | $40 |
| Neon Launch + R2 (45 GB) | $20 | $20 |
| EmailJS Basic | $10 | $10 |
| Domain + SSL | $1.20 | $1.20 |
| Monitoring (free tiers) | $0 | $0 |
| AI calls (3,000 files) | $0 | $30 |
| Paystack (5 charges × $49) | $8.42 | $8.42 |
| Support (3 tickets/mo) | $24 | $24 |
| Engineering (part-time contractor, 5 hr/mo @ $50/hr) | $250 | $250 |
| Legal / tax / accounting | $100 | $100 |
| **Monthly total** | **$503** | **$533** |
| **Annual total** | **$6,040** | **$6,400** |
| MRR | $245 | $245 |
| **Net monthly P&L** | **–$258** | **–$288** |

> [!NOTE]
> Break-even at 100 MAU requires ~11 paying users at $49/mo to cover the **AI-Free** cost stack, or 13 paying users for **AI-Paid** (at $0.01/file).

---

### Scale: 1,000 MAU (50 paying users → $2,450 MRR)

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| Render Standard 2× + Scale workspace | $200 | $200 |
| Vercel Pro (2 seats) | $40 | $40 |
| Neon Scale + R2 (450 GB) | $84 | $84 |
| EmailJS Pro | $20 | $20 |
| Domain + SSL | $1.20 | $1.20 |
| Monitoring (Sentry free + Grafana free) | $10 | $10 |
| AI calls (30,000 files) | $0 | $300 |
| Paystack (50 charges) | $82 | $82 |
| Support (30 tickets @ $8) | $240 | $240 |
| Engineering (1 part-time eng, 40 hr/mo @ $50) | $2,000 | $2,000 |
| Security & compliance (pen test amortized) | $100 | $100 |
| Legal / tax / accounting | $200 | $200 |
| **Monthly total** | **$2,977** | **$3,277** |
| **Annual total** | **$35,720** | **$39,320** |
| MRR | $2,450 | $2,450 |
| **Net monthly P&L** | **–$527** | **–$827** |

> At 1K MAU the business is **close to break-even on infrastructure alone** but engineering + support push it negative. ~62 paying users ($3,038 MRR) covers **AI-Free** costs. **This is the critical sprint to close.**

---

### Scale: 10,000 MAU (500 paying users → $24,500 MRR)

> [!IMPORTANT]
> At this scale: migrate compute off Render → **Google Cloud Run**, keep Vercel for CDN/edge, move files to **R2** (already assumed), consider Aurora Serverless for DB.

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| Cloud Run (4 vCPU / 8 GB, ~720 hr/mo) | $350 | $350 |
| Vercel Pro (3 seats) | $60 | $60 |
| Neon Scale + R2 (4.5 TB) | $84 | $84 |
| Resend email (30K/mo) | $20 | $20 |
| Domain + SSL | $1.20 | $1.20 |
| Monitoring (Sentry Team + Grafana Pro) | $45 | $45 |
| AI calls (300,000 files) | $0 | $3,000 |
| Paystack (500 charges) | $786 | $786 |
| Support (300 tickets @ $8, partly AI-deflected) | $1,440 | $1,440 |
| Engineering (1.5 FTE offshore @ $4,000/mo each) | $6,000 | $6,000 |
| Security & compliance (SOC 2 prep amortized) | $500 | $500 |
| Legal / tax / accounting | $400 | $400 |
| **Monthly total** | **$9,686** | **$12,686** |
| **Annual total** | **$116,240** | **$152,240** |
| MRR | $24,500 | $24,500 |
| **Net monthly P&L** | **+$14,814** | **+$11,814** |

> 🎯 **The business first turns solidly profitable here — AI-Free at ~$15K/mo margin, AI-Paid at ~$12K/mo.**

---

### Scale: 100,000 MAU (5,000 paying users → $245,000 MRR)

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| Cloud Run multi-region (Sprint 8) + GKE Autopilot | $3,500 | $3,500 |
| Vercel Enterprise or Cloudflare Pages | $1,000 | $1,000 |
| Aurora Serverless v2 + R2 (45 TB) | $2,500 | $2,500 |
| AWS SES / Resend (500K/mo) | $55 | $55 |
| Domain + SSL | $1.20 | $1.20 |
| Datadog APM (Sprint 9 observability) | $800 | $800 |
| AI calls (3 M files) | $0 | $30,000 |
| Paystack (5,000 charges) | $7,720 | $7,720 |
| Support (1,500 tickets + 2 support FTE offshore) | $8,000 | $8,000 |
| Engineering (4 FTE offshore @ $5,000/mo) | $20,000 | $20,000 |
| Security / SOC 2 Type II audit | $1,500 | $1,500 |
| Legal / tax / accounting / CFO (fractional) | $2,000 | $2,000 |
| **Monthly total** | **$47,076** | **$77,076** |
| **Annual total** | **$564,912** | **$924,912** |
| MRR | $245,000 | $245,000 |
| **Net monthly P&L** | **+$197,924** | **+$167,924** |

---

### Scale: 1,000,000 MAU (50,000 paying users → $2.45 M MRR)

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| AWS ECS Fargate multi-region + ALB | $18,000 | $18,000 |
| Cloudflare CDN (self-hosted Next.js) | $800 | $800 |
| Aurora PostgreSQL Multi-AZ + R2 (450 TB) | $8,500 | $8,500 |
| AWS SES (3 M emails) | $300 | $300 |
| Domain + SSL | $1.20 | $1.20 |
| Datadog full stack | $4,000 | $4,000 |
| AI calls (30 M files) | $0 | $300,000 |
| Paystack (50,000 charges) | $72,050 | $72,050 |
| Support (10,000 tickets + 8 support FTE + AI deflection) | $25,000 | $25,000 |
| Engineering (12 FTE mixed onshore/offshore avg $8K/mo) | $96,000 | $96,000 |
| Security / SOC 2 + ISO 27001 | $5,000 | $5,000 |
| Legal / tax / accounting / Finance (CFO) | $8,000 | $8,000 |
| **Monthly total** | **$237,651** | **$537,651** |
| **Annual total** | **$2,851,812** | **$6,451,812** |
| MRR | $2,450,000 | $2,450,000 |
| **Net monthly P&L** | **+$2,212,349** | **+$1,912,349** |

> [!WARNING]
> At $300K/mo in AI call costs (AI-Paid, 1M MAU), the AI line is **the single largest cost item** — larger than all engineering staff combined. This is the point where negotiating a custom LLM contract or fine-tuning an open-source model on-prem becomes mandatory.

---

### Scale: 10,000,000 MAU (500,000 paying users → $24.5 M MRR)

| Cost Line | AI-Free | AI-Paid |
|---|---|---|
| AWS ECS / EKS multi-region (Sprint 8 K8s) | $120,000 | $120,000 |
| Cloudflare CDN global | $5,000 | $5,000 |
| Aurora Global Database + R2 (4.5 PB) | $85,000 | $85,000 |
| AWS SES (30 M emails) | $3,000 | $3,000 |
| Domain + multi-domain | $50 | $50 |
| Datadog enterprise | $20,000 | $20,000 |
| AI calls (300 M files) — negotiate or self-host | $0 | $600,000† |
| Paystack / Stripe (500K charges) | $726,500 | $726,500 |
| Support (50K tickets + 40 FTE + AI) | $120,000 | $120,000 |
| Engineering (60 FTE blended $10K/mo) | $600,000 | $600,000 |
| Security (CISO, pen tests, compliance) | $30,000 | $30,000 |
| Legal / tax / finance | $40,000 | $40,000 |
| **Monthly total** | **$1,749,550** | **$2,349,550** |
| **Annual total** | **$20,994,600** | **$28,194,600** |
| MRR | $24,500,000 | $24,500,000 |
| **Net monthly P&L** | **+$22,750,450** | **+$22,150,450** |

†At 300 M files/mo, negotiate a flat LLM API contract (~$600K) or self-host Gemma/Mistral on GPU clusters (~$200K). The self-host break-even vs. API is at roughly **50 M files/month**.

---

## 5. Summary Table — Monthly Cost & Net P&L

| MAU | Monthly Cost (AI-Free) | Monthly Cost (AI-Paid) | MRR | P&L (AI-Free) | P&L (AI-Paid) |
|---|---|---|---|---|---|
| 1 | $8 | $9 | $0 | –$8 | –$9 |
| 10 | $12 | $15 | $49 | +$37 | +$34 |
| 100 | $503 | $533 | $245 | –$258 | –$288 |
| 1,000 | $2,977 | $3,277 | $2,450 | –$527 | –$827 |
| 10,000 | $9,686 | $12,686 | $24,500 | **+$14,814** | **+$11,814** |
| 100,000 | $47,076 | $77,076 | $245,000 | **+$197,924** | **+$167,924** |
| 1,000,000 | $237,651 | $537,651 | $2,450,000 | **+$2,212,349** | **+$1,912,349** |
| 10,000,000 | $1,749,550 | $2,349,550 | $24,500,000 | **+$22,750,450** | **+$22,150,450** |

> Annual figures = monthly × 12 (approximate; ignores growth ramp within year).

---

## 6. Migration Decision Framework

### 6A. Raw LAS / Curve Blob Storage: Neon → Cloudflare R2

| Metric | Trigger |
|---|---|
| **When** | **Day 1** (before launch). Never store 1+ MB LAS blobs in Postgres rows. |
| **Bill trigger** | Neon free tier (0.5 GB) runs out at ~400 files uploaded. |
| **Migration cost** | 8–12 engineering hours: add R2 SDK, update ingestion_service.py to write to R2 and store only the R2 key in Neon, write a one-time backfill script for existing blobs. |
| **Payback** | Instant — saves ~$150/mo at 100 MAU vs. storing in Neon. |
| **Destination** | **Cloudflare R2** ($0.015/GB storage, $0 egress). Prefer over S3 because LAS files are frequently downloaded by users, and S3 egress at $0.09/GB becomes a significant line at 10K+ MAU. |

### 6B. API Routing: Vercel Rewrite → Direct Subdomain (api.wellqc.app)

| Metric | Trigger |
|---|---|
| **When** | 1,000–5,000 MAU, or when Vercel bills >$100/mo in function invocations. |
| **Current state** | `next.config.ts` rewrites `/api/python/*` to Render backend. Adds ~40–80 ms latency and routes all traffic through Vercel Edge. |
| **Migration cost** | 4–6 hours: configure `api.wellqc.app` CNAME to Render/Cloud Run, update CORS origins in `main.py`, update `NEXT_PUBLIC_API_URL` in Vercel env. |
| **Payback** | Latency improvement (40–80 ms recovered) + avoids Vercel function execution charges. At 1K MAU this saves ~$20–$50/mo; payback < 1 week. |

### 6C. Compute: Render → Google Cloud Run

| Metric | Trigger |
|---|---|
| **When** | Render bill exceeds **$300/mo** OR throughput demand exceeds 3 req/s sustained (≈2,000 MAU). |
| **Why Cloud Run first** | Scales to zero during off-hours (petroleum industry = mostly 9–5 weekday traffic), so you pay only for active compute. |
| **Migration cost** | 20–30 engineering hours: containerize backend (Dockerfile already exists ✅), write Cloud Run deployment YAML, set up Cloud Build CI, configure Cloud Armor for WAF, update env vars. Existing `docker-compose.yml` accelerates this. |
| **Monthly saving vs. Render** | At 10K MAU: Cloud Run ~$350/mo vs. Render ~$600/mo = **$250/mo saving**. |
| **Payback** | At 10K MAU: 25 hrs × $50/hr = $1,250 migration cost ÷ $250/mo = **5-month payback**. ✅ Within the 6-month rule. |
| **When to move to ECS/EKS** | >100K MAU or when multi-region (Sprint 8) requires Kubernetes orchestration. EKS adds ~$150/mo control plane but unlocks true horizontal pod autoscaling and blue-green deploys. |

### 6D. Database: Neon → RDS / Aurora

| Metric | Trigger |
|---|---|
| **When** | Monthly DB bill (Neon) exceeds **$500/mo** OR need HA with automatic failover (Sprint 9). |
| **Approximate MAU at trigger** | ~5,000–10,000 MAU (if blobs remain in Neon) or ~**50,000 MAU** (if blobs already on R2 — recommended). |
| **Destination** | **Aurora Serverless v2** (PostgreSQL-compatible). Scales from 0.5 ACUs (idle) to 64 ACUs (peak). ~$0.12/ACU-hr. |
| **Why not RDS Single-AZ** | Aurora Serverless v2 auto-scales capacity without downtime; RDS requires manual resize with a maintenance window. |
| **Migration cost** | 30–50 engineering hours: export Neon DB, import to Aurora, update `DATABASE_URL`, test Prisma migrations, configure connection pooling (PgBouncer on ECS or RDS Proxy). |
| **Monthly saving** | At 50K MAU: Aurora Serverless v2 ~$800/mo vs. Neon Scale ~$2,000/mo (if storing metadata only; larger if not) = **$1,200/mo saving**. |
| **Payback** | 40 hrs × $50 = $2,000 ÷ $1,200/mo = **1.7-month payback**. ✅ |

---

## 7. Sprint 8 & 9 Infrastructure Items — Cost Impact

| Sprint item | What it costs | When to activate |
|---|---|---|
| **Multi-region (Sprint 8)** | Cloud Run or EKS in 2 regions (us-east-1 + eu-west-1): +$500–$2,000/mo. Neon multi-region replica: +$200/mo. | 50K+ MAU or enterprise customer requiring data residency. |
| **Kubernetes / GKE Autopilot (Sprint 8)** | GKE Autopilot: ~$0.10/vCPU-hr, pay only for pod resources. At 10K MAU: ~$400/mo. Offsets Render savings. | >25K MAU or when you need rolling deploys, canary releases, and HPA. |
| **High-Availability DB (Sprint 9)** | Aurora Multi-AZ: +$300/mo over single-AZ. Or Neon "always-on" Scale plan: +$100/mo. | When SLA commitments to enterprise customers require 99.9 %+ uptime. |
| **Full observability stack (Sprint 9)** | Datadog APM + Logs + Infra: $300–$1,500/mo depending on host count. | >10K MAU or when debugging production incidents takes >2 hrs per incident. |

---

## 8. Infrastructure Cost per User — Flatten Point

```
Cost/MAU (AI-Free infrastructure only, excl. staff):

MAU        $/MAU/mo
1          $8.20
10         $1.20
100        $1.21
1,000      $0.78
10,000     $0.44  ← flattens here
100,000    $0.37
1,000,000  $0.24
10,000,000 $0.17
```

The curve **flattens at ~10,000 MAU** where the fixed costs (Vercel Pro, engineering baseline, monitoring) are spread over enough users. Below that point, fixed staff & tooling dominate. Above it, marginal infrastructure per user converges toward **$0.15–$0.25/user/month**.

---

## 9. Break-Even Price per User

Assumes a **5 % free-to-paid conversion** and **$49/mo Pro price**.

| MAU | Total monthly cost (AI-Free) | Paying users | Revenue needed for B/E | Required ARPU | Break-even? |
|---|---|---|---|---|---|
| 100 | $503 | 5 | $503 | $100.60/paying user | ❌ Need 2× price or 2× conversion |
| 1,000 | $2,977 | 50 | $2,977 | $59.54/paying user | 🟡 Borderline — just above $49 |
| 10,000 | $9,686 | 500 | $9,686 | $19.37/paying user | ✅ Well profitable at $49 |
| 100,000 | $47,076 | 5,000 | $47,076 | $9.42/paying user | ✅ Strongly profitable |

> The **1,000 MAU mark is the critical threshold**. If the free-to-paid conversion can reach 6.5 % (rather than 5 %), 1K MAU breaks even at the current $49/mo price.

---

## 10. Sensitivity Analysis — Which Assumptions Move the Answer Most

Ranked by impact on monthly cost (at 10,000 MAU scale):

| Rank | Assumption | Baseline | High case | Monthly cost delta |
|---|---|---|---|---|
| 1 | **AI call cost per file** | $0.01 | $0.02 | +$3,000 (+31%) |
| 2 | **Files per user per month** | 30 | 100 (power users dominate) | +$7,350 infra + AI |
| 3 | **Storage per file** | 1.25 MB | 5 MB (deepwater wells) | +$225 storage/mo |
| 4 | **Staff cost (engineering)** | $4,000/FTE/mo | $12,000/FTE/mo (US hire) | +$12,000 (+124%) |
| 5 | **Free-to-paid conversion** | 5% | 2% | –$12,250 MRR (revenue side) |
| 6 | **Storage accumulation** | Perpetual | Tiered archive after 12 mo | –$45 at 10K MAU (minor until >1M) |

### Conclusions from sensitivity
1. **AI cost is the dominant variable below 100K MAU** — use the free rule-based path unless you have clear WTP data from users for AI insights.
2. **Staff cost is the dominant variable above 10K MAU** — offshore/distributed teams are mandatory until Series A.
3. **Files per user swamps everything** if your power-user cohort (bulk loaders at 200–1,000 files/mo) grows faster than light users.
4. **Storage accumulation is a slow burn** that becomes catastrophic above 100K MAU without a blob-offload + archiving policy.

---

## 11. One-Page Decision Checklist

```
TODAY (0–100 MAU)
  ✅ Move file blobs to Cloudflare R2 immediately
  ✅ Custom domain (wellqc.app) — $14/yr
  ✅ Render Hobby ($7/mo) or Standard ($25/mo) — your call
  ✅ Vercel Hobby (free)
  ✅ Keep AI analysis rule-based (free)
  ✅ EmailJS free tier

AT 500 MAU (~$1,200 MRR)
  ✅ Upgrade Vercel → Pro ($40/mo)
  ✅ Point api.wellqc.app directly to Render (remove rewrite)
  ✅ Add Sentry free for error tracking

AT 2,000 MAU (~$4,900 MRR)
  ✅ Migrate Render → Google Cloud Run
  ✅ Upgrade Neon → Launch paid plan
  ✅ Add Grafana Cloud free tier for metrics

AT 10,000 MAU (~$24,500 MRR, profitable)
  ✅ Evaluate AI-Paid: at $3,000/mo cost, needs ~65 incremental paying users to justify
  ✅ Begin SOC 2 Type I preparation (customer requirement for oil majors)
  ✅ GKE Autopilot or Cloud Run multi-container for Sprint 8

AT 50,000 MAU (~$122,500 MRR)
  ✅ Migrate Neon → Aurora Serverless v2
  ✅ Vercel → Enterprise or Cloudflare Pages
  ✅ Datadog APM for Sprint 9 observability
  ✅ Multi-region deploy for data residency (EU, Africa)

AT 100,000+ MAU
  ✅ EKS / GKE Standard for Kubernetes Sprint 8
  ✅ Negotiate LLM API contract if AI-Paid
  ✅ US-based legal, CFO, CISO
  ✅ ISO 27001 / API Sec certification for oil major contracts
```

---

## 12. Appendix — Price Reference Sheet (2025/2026)

| Service | Unit | Price |
|---|---|---|
| Render Hobby | /mo | $7 |
| Render Standard (1 CPU / 2 GB) | /mo | $25 |
| Render Performance (2 CPU / 4 GB) | /mo | $85 |
| Vercel Pro seat | /seat/mo | $20 |
| Neon Launch compute | /CU-hr | $0.106 |
| Neon Scale compute | /CU-hr | $0.222 |
| Neon storage | /GB-mo | $0.35 |
| Cloudflare R2 storage | /GB-mo | $0.015 |
| Cloudflare R2 egress | /GB | $0.00 |
| AWS S3 storage (us-east-1) | /GB-mo | $0.023 |
| AWS S3 egress | /GB | $0.09 |
| Aurora Serverless v2 | /ACU-hr | $0.12 |
| Cloud Run (1 vCPU) | /vCPU-hr | $0.048 |
| Fargate (1 vCPU) | /vCPU-hr | $0.040 |
| Fargate ALB | /mo flat | $22 |
| Datadog Infra Pro | /host/mo | $23 |
| Paystack fee | per charge | 2.9% + $0.30 |
| EmailJS Pro | /mo | $20 |
| AWS SES | /1K emails | $0.10 |
| Sentry Team | /mo | $26 |
| Grafana Cloud Pro | /mo | $19 |
| `.app` domain | /yr | $14 |

---

*Prepared for WellQC+ · NDI-GROUP 5 · November 2026*
*All prices subject to vendor changes. Verify current pricing before budget approval.*
