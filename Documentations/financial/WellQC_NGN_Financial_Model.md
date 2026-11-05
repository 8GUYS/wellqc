# WellQC+ — Full Nigerian Naira Financial Model
### All costs & revenues in ₦ · Exchange rate: ₦1,400 = $1 · Pro price: ₦75,000/month

---

## Baseline Parameters

| Parameter | Value |
|---|---|
| Exchange rate | **₦1,400 = $1** |
| Pro Monthly price | **₦75,000 / month** |
| Pro Annual price | **₦750,000 / year** (2 months free) |
| Free-to-paid conversion | **5%** of MAU |
| Avg files per user per month | **30** |
| Avg file size | **1.25 MB** |
| Paystack local NGN fee | **1.5% + ₦100 per charge** (capped ₦2,000) |
| Paystack international USD fee | **3.9% + ₦100 per charge** |
| AI cost (free case) | ₦0 per file |
| AI cost (paid case) | ₦14 per file ($0.01 × ₦1,400) |

---

## Paystack Net Revenue per Subscription

| Transaction type | Gross | Paystack fee | **Net to WellQC** |
|---|---|---|---|
| Local NGN card (Verve / Mastercard / Visa) | ₦75,000 | 1.5% × ₦75,000 + ₦100 = **₦1,225** | **₦73,775** |
| International USD card (at ₦75,000 equiv.) | ₦75,000 | 3.9% × ₦75,000 + ₦100 = **₦3,025** | **₦71,975** |
| Annual plan (local NGN) | ₦750,000 | 1.5% × ₦750,000 = ₦11,250 + ₦100 = **₦11,350** (cap ₦2,000 → **₦2,100**) | **₦747,900** |

> [!NOTE]
> Paystack **caps** local NGN fees at ₦2,000 per transaction. The annual plan (₦750,000) hits the cap: fee = ₦2,000 + ₦100 = **₦2,100**, net = **₦747,900** — making annual billing significantly more efficient for the business. Assume 70 % monthly / 30 % annual split in projections below.

### Blended net revenue per paying user per month
- Monthly billing: ₦73,775 net
- Annual billing: ₦747,900 / 12 = ₦62,325 net/month
- **Blended (70/30): 0.70 × ₦73,775 + 0.30 × ₦62,325 = ₦51,643 + ₦18,698 = ₦70,340 net/month**

---

## Revenue Table by Scale

| MAU | Paying users (5%) | Gross MRR | Paystack fees | **Net MRR** | **Net ARR** |
|---|---|---|---|---|---|
| 1 | 0.05 → ~0 | ₦0 | ₦0 | ₦0 | ₦0 |
| 10 | 0.5 → ~1 | ₦75,000 | ₦1,225 | **₦73,775** | **₦885,300** |
| 100 | 5 | ₦375,000 | ₦6,125 | **₦368,875** | **₦4,426,500** |
| 1,000 | 50 | ₦3,750,000 | ₦61,250 | **₦3,688,750** | **₦44,265,000** |
| 10,000 | 500 | ₦37,500,000 | ₦612,500 | **₦36,887,500** | **₦442,650,000** |
| 100,000 | 5,000 | ₦375,000,000 | ₦6,125,000 | **₦368,875,000** | **₦4,426,500,000** |
| 1,000,000 | 50,000 | ₦3,750,000,000 | ₦61,250,000 | **₦3,688,750,000** | **₦44,265,000,000** |
| 10,000,000 | 500,000 | ₦37,500,000,000 | ₦612,500,000 | **₦36,887,500,000** | **₦442,650,000,000** |

> All revenue figures use the **blended monthly net** of ₦70,340/paying user. Gross MRR and Paystack fees shown separately for clarity.

---

## Full P&L by Scale — in Nigerian Naira

---

### 📍 1 MAU

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| Render Hobby compute | ₦9,800 | ₦9,800 |
| Vercel (free tier) | ₦0 | ₦0 |
| Neon + R2 storage | ₦0 | ₦0 |
| EmailJS (free) | ₦0 | ₦0 |
| Custom domain (amortised) | ₦1,680 | ₦1,680 |
| Monitoring | ₦0 | ₦0 |
| AI calls (30 files × ₦14) | ₦0 | ₦420 |
| Paystack processing | ₦0 | ₦0 |
| Support staff | ₦0 | ₦0 |
| Engineering (founder-led) | ₦0 | ₦0 |
| Legal / tax / accounting | ₦0 | ₦0 |
| **Total monthly cost** | **₦11,480** | **₦11,900** |
| **Net MRR** | ₦0 | ₦0 |
| **Monthly P&L** | **–₦11,480** | **–₦11,900** |
| **Annual P&L** | **–₦137,760** | **–₦142,800** |

---

### 📍 10 MAU

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| Render Hobby | ₦9,800 | ₦9,800 |
| Vercel (free) | ₦0 | ₦0 |
| Neon Launch + R2 | ₦2,800 | ₦2,800 |
| EmailJS (free) | ₦0 | ₦0 |
| Domain | ₦1,680 | ₦1,680 |
| AI calls (300 files × ₦14) | ₦0 | ₦4,200 |
| Paystack (1 charge) | ₦1,225 | ₦1,225 |
| Support | ₦0 | ₦0 |
| Engineering (founder) | ₦0 | ₦0 |
| **Total monthly cost** | **₦15,505** | **₦19,705** |
| **Net MRR** | **₦73,775** | **₦73,775** |
| **Monthly P&L** | **+₦58,270** | **+₦54,070** |
| **Annual P&L** | **+₦699,240** | **+₦648,840** |
| **Gross margin** | 95% | 87% |

---

### 📍 100 MAU · 5 paying users

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| Render Standard 1× + Pro workspace | ₦70,000 | ₦70,000 |
| Vercel Pro (2 seats) | ₦56,000 | ₦56,000 |
| Neon Launch + R2 (45 GB) | ₦28,000 | ₦28,000 |
| EmailJS Basic | ₦14,000 | ₦14,000 |
| Domain | ₦1,680 | ₦1,680 |
| Monitoring (free tiers) | ₦0 | ₦0 |
| AI calls (3,000 × ₦14) | ₦0 | ₦42,000 |
| Paystack (5 charges) | ₦6,125 | ₦6,125 |
| Support (3 tickets × ₦11,200) | ₦33,600 | ₦33,600 |
| Engineering (5 hr/mo contractor @ ₦70,000/hr) | ₦350,000 | ₦350,000 |
| Legal / tax / accounting | ₦140,000 | ₦140,000 |
| **Total monthly cost** | **₦699,405** | **₦741,405** |
| **Net MRR (5 × ₦73,775)** | **₦368,875** | **₦368,875** |
| **Monthly P&L** | **–₦330,530** | **–₦372,530** |
| **Annual P&L** | **–₦3,966,360** | **–₦4,470,360** |
| **Gross margin (infra+support only)** | 60% | 49% |
| **EBITDA margin** | –90% | –101% |

> Break-even at 100 MAU requires **10 paying users** (AI-Free) or **11 paying users** (AI-Paid) — i.e., a 10–11% conversion rate vs. the 5% baseline. Engineering cost dominates.

---

### 📍 1,000 MAU · 50 paying users

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| Render Standard 2× | ₦280,000 | ₦280,000 |
| Vercel Pro (2 seats) | ₦56,000 | ₦56,000 |
| Neon Scale + R2 (450 GB) | ₦117,600 | ₦117,600 |
| EmailJS Pro | ₦28,000 | ₦28,000 |
| Domain | ₦1,680 | ₦1,680 |
| Monitoring | ₦14,000 | ₦14,000 |
| AI calls (30,000 × ₦14) | ₦0 | ₦420,000 |
| Paystack (50 charges) | ₦61,250 | ₦61,250 |
| Support (30 tickets @ ₦11,200) | ₦336,000 | ₦336,000 |
| Engineering (part-time eng, 40 hr/mo @ ₦70,000/hr) | ₦2,800,000 | ₦2,800,000 |
| Security / compliance | ₦140,000 | ₦140,000 |
| Legal / tax / accounting | ₦280,000 | ₦280,000 |
| **Total monthly cost** | **₦4,114,530** | **₦4,534,530** |
| **Net MRR (50 × ₦73,775)** | **₦3,688,750** | **₦3,688,750** |
| **Monthly P&L** | **–₦425,780** | **–₦845,780** |
| **Annual P&L** | **–₦5,109,360** | **–₦10,149,360** |
| **Gross margin** | 87% | 77% |
| **EBITDA margin** | –12% | –23% |

> 🎯 **Break-even** at 1K MAU = **56 paying users** (AI-Free) or **62 paying users** (AI-Paid). This is a **5.6–6.2% conversion rate** — achievable with basic email nurture campaigns to registered free users.

---

### 📍 10,000 MAU · 500 paying users ← **Profitability unlocks here**

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| Google Cloud Run (4 vCPU / 8 GB) | ₦490,000 | ₦490,000 |
| Vercel Pro (3 seats) | ₦84,000 | ₦84,000 |
| Neon + R2 (4.5 TB) | ₦117,600 | ₦117,600 |
| Resend email (30K/mo) | ₦28,000 | ₦28,000 |
| Domain | ₦1,680 | ₦1,680 |
| Monitoring (Sentry + Grafana) | ₦63,000 | ₦63,000 |
| AI calls (300,000 × ₦14) | ₦0 | ₦4,200,000 |
| Paystack (500 charges) | ₦612,500 | ₦612,500 |
| Support (300 tickets, AI-deflected) | ₦2,016,000 | ₦2,016,000 |
| Engineering (1.5 FTE offshore @ ₦5,600,000/mo ea.) | ₦8,400,000 | ₦8,400,000 |
| Security & compliance | ₦700,000 | ₦700,000 |
| Legal / tax / accounting | ₦560,000 | ₦560,000 |
| **Total monthly cost** | **₦13,072,780** | **₦17,272,780** |
| **Net MRR (500 × ₦73,775)** | **₦36,887,500** | **₦36,887,500** |
| **Gross MRR** | ₦37,500,000 | ₦37,500,000 |
| **Monthly P&L** | **+₦23,814,720** | **+₦19,614,720** |
| **Annual P&L** | **+₦285,776,640** | **+₦235,376,640** |
| **Gross margin** | 96% | 85% |
| **EBITDA margin** | **+65%** | **+53%** |

> ✅ **Strongly profitable. Engineering now ~64% of total costs.** The key lever is keeping engineering offshore and lean.

---

### 📍 100,000 MAU · 5,000 paying users

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| Cloud Run multi-region + GKE Autopilot | ₦4,900,000 | ₦4,900,000 |
| Vercel Enterprise / Cloudflare Pages | ₦1,400,000 | ₦1,400,000 |
| Aurora Serverless v2 + R2 (45 TB) | ₦3,500,000 | ₦3,500,000 |
| AWS SES (500K emails) | ₦77,000 | ₦77,000 |
| Domain | ₦1,680 | ₦1,680 |
| Datadog APM (Sprint 9) | ₦1,120,000 | ₦1,120,000 |
| AI calls (3M × ₦14) | ₦0 | ₦42,000,000 |
| Paystack (5,000 charges) | ₦6,125,000 | ₦6,125,000 |
| Support (1,500 tickets + 2 support FTE) | ₦11,200,000 | ₦11,200,000 |
| Engineering (4 FTE offshore @ ₦7,000,000/mo ea.) | ₦28,000,000 | ₦28,000,000 |
| Security / SOC 2 Type II | ₦2,100,000 | ₦2,100,000 |
| Legal / tax / CFO (fractional) | ₦2,800,000 | ₦2,800,000 |
| **Total monthly cost** | **₦61,223,680** | **₦103,223,680** |
| **Net MRR (5,000 × ₦73,775)** | **₦368,875,000** | **₦368,875,000** |
| **Monthly P&L** | **+₦307,651,320** | **+₦265,651,320** |
| **Annual P&L** | **+₦3,691,815,840** | **+₦3,187,815,840** |
| **Gross margin** | 98% | 87% |
| **EBITDA margin** | **+83%** | **+72%** |

> AI-Paid cost (₦42M/mo) now rivals the entire engineering bill. Negotiating a flat LLM contract becomes critical here.

---

### 📍 1,000,000 MAU · 50,000 paying users

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| AWS ECS Fargate multi-region + ALB | ₦25,200,000 | ₦25,200,000 |
| Cloudflare CDN (self-hosted Next.js) | ₦1,120,000 | ₦1,120,000 |
| Aurora PostgreSQL Multi-AZ + R2 (450 TB) | ₦11,900,000 | ₦11,900,000 |
| AWS SES (3M emails) | ₦420,000 | ₦420,000 |
| Domain | ₦1,680 | ₦1,680 |
| Datadog full stack | ₦5,600,000 | ₦5,600,000 |
| AI calls (30M × ₦14) | ₦0 | ₦420,000,000 |
| Paystack (50,000 charges) | ₦61,250,000 | ₦61,250,000 |
| Support (8 FTE + AI deflection) | ₦35,000,000 | ₦35,000,000 |
| Engineering (12 FTE blended @ ₦11,200,000/mo ea.) | ₦134,400,000 | ₦134,400,000 |
| Security / SOC 2 + ISO 27001 | ₦7,000,000 | ₦7,000,000 |
| Legal / tax / Finance / CFO | ₦11,200,000 | ₦11,200,000 |
| **Total monthly cost** | **₦293,091,680** | **₦713,091,680** |
| **Net MRR (50,000 × ₦73,775)** | **₦3,688,750,000** | **₦3,688,750,000** |
| **Monthly P&L** | **+₦3,395,658,320** | **+₦2,975,658,320** |
| **Annual P&L** | **+₦40,747,899,840** | **+₦35,707,899,840** |
| **Gross margin** | 99% | 88% |
| **EBITDA margin** | **+92%** | **+81%** |

> [!WARNING]
> AI-Paid at 1M MAU costs **₦420M/month** — more than all engineering + support combined. At this point, **self-hosting an open-source LLM on GPU clusters costs ~₦84M/month** (equivalent to ~$60K/mo on A100 clusters), saving **₦336M/month**. The self-host break-even is at roughly **15M files/month**.

---

### 📍 10,000,000 MAU · 500,000 paying users

| Cost Line | ₦/month (AI-Free) | ₦/month (AI-Paid) |
|---|---|---|
| AWS ECS / EKS multi-region (Sprint 8 K8s) | ₦168,000,000 | ₦168,000,000 |
| Cloudflare CDN global | ₦7,000,000 | ₦7,000,000 |
| Aurora Global DB + R2 (4.5 PB) | ₦119,000,000 | ₦119,000,000 |
| AWS SES (30M emails) | ₦4,200,000 | ₦4,200,000 |
| Domain portfolio | ₦70,000 | ₦70,000 |
| Datadog enterprise | ₦28,000,000 | ₦28,000,000 |
| AI calls (300M × ₦14) — or self-host | ₦0 | ₦840,000,000† |
| Paystack (500K charges) | ₦612,500,000 | ₦612,500,000 |
| Support (40 FTE + AI) | ₦168,000,000 | ₦168,000,000 |
| Engineering (60 FTE blended @ ₦14,000,000/mo ea.) | ₦840,000,000 | ₦840,000,000 |
| Security (CISO, pen tests, compliance) | ₦42,000,000 | ₦42,000,000 |
| Legal / tax / finance leadership | ₦56,000,000 | ₦56,000,000 |
| **Total monthly cost** | **₦2,044,770,000** | **₦2,884,770,000** |
| **Net MRR (500,000 × ₦73,775)** | **₦36,887,500,000** | **₦36,887,500,000** |
| **Monthly P&L** | **+₦34,842,730,000** | **+₦34,002,730,000** |
| **Annual P&L** | **+₦418,112,760,000** | **+₦408,032,760,000** |
| **Gross margin** | 99.4% | 97.7% |
| **EBITDA margin** | **+94%** | **+92%** |

†Self-host recommendation: GPU cluster for LLM at 10M MAU saves ~₦756M/month vs. API pricing.

---

## Master Summary — All Scales in ₦

| MAU | Monthly Cost (AI-Free) | Monthly Cost (AI-Paid) | Net MRR | **P&L (AI-Free)** | **P&L (AI-Paid)** | **ARR (AI-Free)** |
|---|---|---|---|---|---|---|
| 1 | ₦11,480 | ₦11,900 | ₦0 | –₦11,480 | –₦11,900 | –₦137,760 |
| 10 | ₦15,505 | ₦19,705 | ₦73,775 | **+₦58,270** | **+₦54,070** | **+₦699,240** |
| 100 | ₦699,405 | ₦741,405 | ₦368,875 | –₦330,530 | –₦372,530 | –₦3,966,360 |
| 1,000 | ₦4,114,530 | ₦4,534,530 | ₦3,688,750 | –₦425,780 | –₦845,780 | –₦5,109,360 |
| **10,000** | **₦13,072,780** | **₦17,272,780** | **₦36,887,500** | **+₦23,814,720 ✅** | **+₦19,614,720 ✅** | **+₦285,776,640** |
| 100,000 | ₦61,223,680 | ₦103,223,680 | ₦368,875,000 | +₦307,651,320 | +₦265,651,320 | +₦3.69B |
| 1,000,000 | ₦293,091,680 | ₦713,091,680 | ₦3,688,750,000 | +₦3.40B | +₦2.98B | +₦40.75B |
| 10,000,000 | ₦2,044,770,000 | ₦2,884,770,000 | ₦36,887,500,000 | +₦34.84B | +₦34.00B | +₦418.1B |

---

## Key Financial Metrics Dashboard

### Gross Margin by Scale (AI-Free)

| MAU | Infrastructure COGS | Support COGS | Gross Profit | **Gross Margin %** |
|---|---|---|---|---|
| 100 | ₦169,680 | ₦33,600 | ₦165,595 | **44.9%** |
| 1,000 | ₦501,280 | ₦336,000 | ₦2,851,470 | **77.3%** |
| 10,000 | ₦1,294,780 | ₦2,016,000 | ₦33,576,720 | **91.0%** |
| 100,000 | ₦11,000,680 | ₦11,200,000 | ₦346,674,320 | **93.9%** |
| 1,000,000 | ₦44,491,680 | ₦35,000,000 | ₦3,609,258,320 | **97.8%** |

> COGS = infrastructure + Paystack fees + direct support. Engineering + legal + security = OpEx below the gross line.

---

### EBITDA Margin Summary

| MAU | AI-Free EBITDA | AI-Paid EBITDA |
|---|---|---|
| 100 | –90% | –101% |
| 1,000 | –12% | –23% |
| 10,000 | **+65%** | **+53%** |
| 100,000 | **+83%** | **+72%** |
| 1,000,000 | **+92%** | **+81%** |
| 10,000,000 | **+94%** | **+92%** |

---

### Break-Even Paying Users Required

| MAU | Monthly cost (AI-Free) | Paying users needed | Implied conversion % | Feasible? |
|---|---|---|---|---|
| 100 | ₦699,405 | **10 users** | 10% | 🟡 Stretch goal |
| 1,000 | ₦4,114,530 | **56 users** | 5.6% | ✅ Slightly above baseline |
| 10,000 | ₦13,072,780 | **177 users** | 1.8% | ✅ Very achievable |
| 100,000 | ₦61,223,680 | **830 users** | 0.8% | ✅ Trivial |

> Break-even paying users = Total monthly cost ÷ ₦73,775 net per user.

---

### Revenue per Employee (at 10K MAU — the scale at which you hire)

| Metric | Value |
|---|---|
| Net MRR | ₦36,887,500 |
| Total engineering FTE | 1.5 |
| Revenue per engineer per month | **₦24,591,667** |
| Fully loaded eng cost per month (offshore) | ₦5,600,000 |
| **Revenue-to-eng-cost ratio** | **4.4×** |

> Anything above 3× is healthy for a SaaS product at this stage.

---

## Year 1 Growth Scenario (Realistic Ramp)

Assumes you launch with ~50 MAU and grow 30% month-on-month, reaching ~1,000 MAU by month 12.

| Month | MAU | Paying | Gross MRR | Net MRR | Monthly Cost | **Net Cash Flow** |
|---|---|---|---|---|---|---|
| 1 | 50 | 3 | ₦225,000 | ₦221,775 | ₦500,000 | –₦278,225 |
| 2 | 65 | 3 | ₦225,000 | ₦221,775 | ₦520,000 | –₦298,225 |
| 3 | 85 | 4 | ₦300,000 | ₦295,100 | ₦560,000 | –₦264,900 |
| 4 | 110 | 6 | ₦450,000 | ₦442,650 | ₦700,000 | –₦257,350 |
| 5 | 143 | 7 | ₦525,000 | ₦516,425 | ₦750,000 | –₦233,575 |
| 6 | 186 | 9 | ₦675,000 | ₦663,975 | ₦850,000 | –₦186,025 |
| 7 | 242 | 12 | ₦900,000 | ₦885,300 | ₦1,100,000 | –₦214,700 |
| 8 | 315 | 16 | ₦1,200,000 | ₦1,180,400 | ₦1,400,000 | –₦219,600 |
| 9 | 409 | 20 | ₦1,500,000 | ₦1,475,500 | ₦1,800,000 | –₦324,500 |
| 10 | 532 | 27 | ₦2,025,000 | ₦1,991,925 | ₦2,400,000 | –₦408,075 |
| 11 | 692 | 35 | ₦2,625,000 | ₦2,582,125 | ₦3,200,000 | –₦617,875 |
| 12 | 900 | 45 | ₦3,375,000 | ₦3,319,875 | ₦3,900,000 | –₦580,125 |
| **Total Year 1** | | | **₦14,025,000** | **₦13,790,825** | **₦17,680,000** | **–₦3,889,175** |

> [!IMPORTANT]
> **Total Year 1 cash deficit: ~₦3.9M (~$2,785)** — this is the **minimum runway capital** needed to reach 1,000 MAU at a 30% monthly growth rate. Extremely lean. This is achievable from founder savings, a small grant, or one or two early enterprise clients paying annually.

---

### Year 2 Projection (1,000 → 10,000 MAU)

| Quarter | MAU | Net MRR | Monthly Cost | Monthly Cash Flow |
|---|---|---|---|---|
| Q1 (Yr 2) | 1,500 | ₦5,533,125 | ₦4,800,000 | +₦733,125 |
| Q2 (Yr 2) | 3,000 | ₦11,066,250 | ₦7,500,000 | +₦3,566,250 |
| Q3 (Yr 2) | 6,000 | ₦22,132,500 | ₦10,500,000 | +₦11,632,500 |
| Q4 (Yr 2) | 10,000 | ₦36,887,500 | ₦13,072,780 | **+₦23,814,720** |
| **Full Year 2** | | **~₦227M total** | **~₦108M total** | **+₦119M** |

> **Year 2 is when the business becomes self-funding and can invest in Sprint 8 & 9** (multi-region, Kubernetes, HA DB, observability) — total Sprint 8/9 capex estimated at ₦8–20M one-time engineering + ₦2–4M/mo ongoing infra uplift.

---

## Annual Revenue (ARR) Milestones in Naira

| Milestone | MAU needed | ARR | Equiv. $USD |
|---|---|---|---|
| **₦1M ARR** ("first million") | ~190 MAU | ₦1,000,000 | $714 |
| **₦10M ARR** | ~1,100 MAU | ₦10,000,000 | $7,143 |
| **₦100M ARR** | ~3,700 MAU | ₦100,000,000 | $71,429 |
| **₦1B ARR** | ~37,000 MAU | ₦1,000,000,000 | $714,286 |
| **₦10B ARR** | ~370,000 MAU | ₦10,000,000,000 | $7.14M |
| **₦100B ARR** | ~3.7M MAU | ₦100,000,000,000 | $71.4M |
| **₦1T ARR** | ~37M MAU | ₦1,000,000,000,000 | $714M |

---

## Sensitivity: What Changes the P&L Most (at 10,000 MAU)

| Variable | Baseline | Stress case | Monthly P&L impact |
|---|---|---|---|
| **AI call cost (₦/file)** | ₦0 | ₦28 ($0.02) | –₦8,400,000 |
| **Files per user** | 30 | 100 (power-user shift) | –₦13,720,000 (infra+AI) |
| **Engineering FTE rate** | ₦5.6M/mo | ₦16.8M/mo (US hire) | –₦16,800,000 |
| **Free-to-paid conversion** | 5% | 2% | –₦22,132,500 MRR |
| **Paystack fee type** | Local 1.5% | Intl 3.9% | –₦1,350,000 |
| **Storage per file** | 1.25 MB | 5 MB (deepwater) | –₦315,000 |

> [!TIP]
> The single highest-leverage action before you hire anyone: **run a conversion rate experiment**. Moving from 5% → 8% free-to-paid at 10K MAU adds **₦11,066,250 MRR** — more than any infrastructure optimisation at that scale.

---

## Quick Reference: ₦ ↔ $ Conversion Table

| USD amount | ₦ equivalent (@ ₦1,400/$) |
|---|---|
| $1 | ₦1,400 |
| $7 (Render Hobby) | ₦9,800 |
| $20 (Vercel seat) | ₦28,000 |
| $25 (Render Standard) | ₦35,000 |
| $49 (Pro Monthly USD) | ₦68,600 |
| ₦75,000 (Pro Monthly NGN) | $53.57 |
| $0.01 (AI per file) | ₦14 |
| $1,000 | ₦1,400,000 |
| $10,000 | ₦14,000,000 |
| $100,000 | ₦140,000,000 |
| $1,000,000 | ₦1,400,000,000 |

---

*WellQC+ · NDI-GROUP 5 · November 2026 · Exchange rate: ₦1,400 = $1 (verify before budget approval)*
