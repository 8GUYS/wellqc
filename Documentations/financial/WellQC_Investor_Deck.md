# WellQC+ — Investor Deck
### AI-Powered LAS Well Log QC SaaS | Seed Round

---

> [!IMPORTANT]
> **Raising:** ₦20,000,000 Seed Round
> **Exchange Rate:** ₦1,400 = \$1 · **Pro Price:** ₦75,000/month · **Stack:** Next.js · FastAPI · Neon PostgreSQL · Paystack

---

## 1. Executive Summary

WellQC+ is a **Nigeria-native, NGN-billed SaaS platform** that automates LAS (Log ASCII Standard) well log quality control for petrophysicists, geoscientists, and data engineers across Africa's oil & gas sector.

The global petrophysics software market is worth **\$3.2 billion** and growing. Yet no platform exists that serves Nigerian operators with local currency billing, offline capability, and a production-ready AI QC engine — until now.

We are pre-profitability but **fully functional in production**, with 131 passing automated tests, Paystack billing live, and a freemium funnel already converting. We are raising **₦20M** to execute Sprints 8 & 9, scale to 10,000 MAU, and sign enterprise contracts with oil majors.

---

## 2. The Problem

> [!NOTE]
> The average petrophysicist manually reviews **30 LAS files per month**. This process is error-prone, time-consuming, and costly — and bad QC can cost oil companies millions in poor drilling decisions.

| Pain Point | Current Reality |
|---|---|
| Manual LAS QC | Hours per file; no standardised workflow |
| FX friction | Competing tools are USD-billed — a blocker for Nigerian teams |
| Offline inaccessibility | Rig sites have poor or zero internet connectivity |
| No African-native platform | Every alternative is built for Western markets |

Nigeria is **Africa's largest oil producer**. The Niger Delta basin has thousands of active wells generating continuous LAS data. The infrastructure to QC that data reliably doesn't exist locally. **We are building it.**

---

## 3. The Solution

**WellQC+** is a full-stack SaaS platform that automates LAS well log QC with AI — billed in Naira, integrated with Paystack, and optimised for the Nigerian operator.

### Key Differentiators

- 🇳🇬 **NGN-native billing via Paystack** — zero FX friction for Nigerian users
- 📶 **Offline PWA** — works on rig sites with poor/no connectivity
- 🤖 **AI-powered QC engine** — flags anomalies, missing curves, depth errors instantly
- ✅ **Production-ready** — 131 passing tests (93 Python + 38 Jest), CI/CD live
- 🔒 **Freemium gate** — 2 free checks, then ₦75,000/month; natural upsell funnel

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (Vercel) |
| Backend | FastAPI (Render → Cloud Run) |
| Database | Neon PostgreSQL |
| Payments | Paystack |
| Storage | Cloudflare R2 (migration in progress) |

---

## 4. Market Opportunity

| Market | Size |
|---|---|
| Global Petrophysics / Geoscience Software | **\$3.2B** (growing) |
| Nigerian oil & gas tech addressable market | Large and underserved |
| Active wells in Niger Delta basin | Thousands, generating continuous LAS data |
| Primary buyers | IOCs, NOCs, independent E&P companies |

> [!TIP]
> **Why Nigeria First?** Nigeria is Africa's #1 oil producer. Nigerian petrophysicists face every problem WellQC+ solves — and no competitor addresses them with local currency, local integration, and offline support. We win Nigeria, then expand to Ghana, Angola, Kenya, and the broader African basin.

---

## 5. Why Now

1. **Digital transformation mandates** at Nigerian NOCs (NNPC, Seplat, Oando) are accelerating software adoption
2. **Paystack ecosystem maturity** now makes NGN SaaS billing seamless — the infrastructure moment has arrived
3. **AI commoditisation** means we can build QC intelligence that was previously enterprise-only, at fraction of cost
4. **Remote/hybrid geoscience workflows** post-pandemic have normalised cloud-based technical tools
5. **No funded competitor** operates in this exact niche — the window is open now

---

## 6. Business Model

### Pricing

| Tier | Price | Details |
|---|---|---|
| Free | ₦0 | 2 LAS QC checks — freemium hook |
| Pro Monthly | **₦75,000/month** | Unlimited checks, all features |
| Pro Annual | **₦750,000/year** | 2 months free (~17% discount) |
| Enterprise | Custom | Multi-seat, SLA, on-prem options (Sprint 8+) |

### Revenue Flow (per Pro monthly subscriber)

```
Gross:  ₦75,000
Paystack fee (1.5% + ₦100):  –₦1,225
Net to WellQC+:  ₦73,775
```

**Conversion assumption:** 5% of MAU convert to paid (conservative; freemium SaaS benchmark is 2–5%)

---

## 7. Unit Economics

> [!IMPORTANT]
> These are exceptional metrics for an early-stage SaaS — LTV:CAC of up to **35:1** with a **1–2 month payback period**.

| Metric | Value |
|---|---|
| Monthly Net Revenue per User | ₦73,775 |
| Average Paying Tenure | 24 months |
| **LTV (Lifetime Value)** | **₦1,770,600** |
| CAC (content/community-led) | ₦50,000 – ₦150,000 |
| **LTV:CAC Ratio** | **12:1 to 35:1** |
| CAC Payback Period | **1–2 months** |
| Gross Margin at 10K MAU | **91%** |
| Target Net Revenue Retention | **110%+** |

---

## 8. Financial Projections

### P&L Scaling Model (AI-Free Base Case)

| MAU | Paying Users | Gross MRR | Net MRR | Monthly Cost | Monthly EBITDA | ARR | Margin |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | ₦0 | ₦0 | ₦11,480 | –₦11,480 | –₦137,760 | — |
| 10 | 1 | ₦75,000 | ₦73,775 | ₦15,505 | **+₦58,270** | ₦885,300 | 79% |
| 100 | 5 | ₦375,000 | ₦368,875 | ₦699,405 | –₦330,530 | –₦3.97M | –90% |
| 1,000 | 50 | ₦3,750,000 | ₦3,688,750 | ₦4,114,530 | –₦425,780 | –₦5.1M | –12% |
| **10,000** | **500** | **₦37.5M** | **₦36.89M** | **₦13.07M** | **+₦23.81M** | **₦285.8M** | **+65%** |
| 100,000 | 5,000 | ₦375M | ₦368.9M | ₦61.2M | +₦307.7M | ₦3.69B | +83% |
| 1,000,000 | 50,000 | ₦3.75B | ₦3.69B | ₦293M | +₦3.40B | ₦40.75B | +92% |
| 10,000,000 | 500,000 | ₦37.5B | ₦36.89B | ₦2.04B | +₦34.84B | ₦418.1B | +94% |

> [!NOTE]
> The valley between 100 and 1,000 MAU is the **"growth trough"** — a known SaaS pattern where infra costs scale before revenue catches up. This seed round funds us cleanly through it.

---

### Year 1 Ramp

- **Start:** ~50 MAU
- **Growth:** 30% month-over-month
- **End of Year 1:** ~900 MAU
- **Total Year 1 Deficit:** –₦3,889,175 (~\$2,785)
- **Minimum Runway Required:** ₦4–6M

### Year 2 Quarterly Trajectory

| Quarter | MAU | Monthly Cash Flow |
|---|---|---|
| Q1 | 1,500 | **+₦733,125** |
| Q2 | 3,000 | **+₦3,566,250** |
| Q3 | 6,000 | **+₦11,632,500** |
| Q4 | 10,000 | **+₦23,814,720** |
| **Full Year 2 Net** | — | **~+₦119,000,000** |

**Year 2 is cash-flow positive from Q1.** The business is self-sustaining before we hit 10K MAU.

---

## 9. Break-Even Analysis

| MAU | Paying Users Needed | Required Conversion Rate |
|---|---|---|
| 100 | 10 | 10.0% |
| 1,000 | 56 | 5.6% |
| **10,000** | **177** | **1.8%** |

> [!TIP]
> At 10,000 MAU, we only need **1.8% conversion** to break even — well below our 5% baseline assumption. This is a structurally sound model with significant downside protection.

---

## 10. Cost Optimisation Roadmap

| Milestone | Action | Monthly Saving | Payback |
|---|---|---|---|
| Day 1 | Move file blobs → Cloudflare R2 | ₦200,000+ at scale | Immediate |
| 2K MAU | Render → Google Cloud Run | ₦350,000/mo | 5 months |
| 50K MAU | Neon → Aurora Serverless v2 | ₦1,680,000/mo | 1.7 months |

Costs compress as we scale — the margin curve improves dramatically with planned infrastructure migrations.

---

## 11. Growth Strategy

### Phase 1 — Nigeria Market Penetration (Year 1)
- Content-led growth: LAS QC tutorials, LinkedIn, petrophysics communities
- Partner with University of Ibadan, University of Benin geology/petroleum departments
- Free tier as top-of-funnel; convert via usage limits
- Direct outreach to petrophysicists at Seplat, Oando, NNPC, Shell Nigeria

### Phase 2 — Enterprise Unlocked (Year 2, Sprint 8 & 9)
- Multi-region deployment + Kubernetes (GKE)
- High-availability database + full observability (Datadog)
- 99.9% SLA capability → qualify for enterprise contracts at oil majors
- Estimated enterprise contract value: ₦5M–₦20M/year per account
- Additional monthly infra investment: ₦2.8M–₦5.6M (funded by seed)

### Phase 3 — African Expansion (Year 3+)
- Ghana, Angola, Kenya, Mozambique, Tanzania
- Partner with African Petroleum Producers' Organization (APPO) affiliates
- Multi-currency billing (GHS, AOA, KES)

---

## 12. Competitive Landscape

| Platform | NGN Billing | Offline PWA | AI QC | Africa-native | LAS-specific |
|---|:---:|:---:|:---:|:---:|:---:|
| **WellQC+** | ✅ | ✅ | ✅ | ✅ | ✅ |
| Petrel (SLB) | ❌ | ❌ | Partial | ❌ | ❌ |
| Kingdom (IHS) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Generic QC scripts | ❌ | ❌ | ❌ | ❌ | Partial |

> [!IMPORTANT]
> **WellQC+ is the only LAS QC platform in the world with NGN billing + Paystack integration.** This is not a feature gap we fill — it is a structural moat competitors cannot cross without rebuilding their entire billing infrastructure.

---

## 13. Team

*[To be completed by founders — suggested inclusions below]*

| Role | Background |
|---|---|
| Founder / CTO | Full-stack engineering, FastAPI, Next.js, petroleum data systems |
| Co-founder / Domain Lead | Petrophysics / geoscience expertise, industry relationships |
| Advisors | Oil & gas sector, Nigerian fintech/SaaS ecosystem |

> The founding team combines deep petroleum domain knowledge with production engineering capability — evidenced by 131 passing tests and a live, billing-enabled product.

---

## 14. Use of Funds

**Raising: ₦20,000,000**

| Allocation | Amount | Purpose |
|---|---|---|
| 🔧 Engineering (Sprint 8 & 9) | ₦8,000,000 | Multi-region, GKE, HA database, Datadog observability |
| 📣 Sales & Marketing | ₦5,000,000 | Content, outreach, conference presence, partnerships |
| ⚖️ Legal / Compliance / SOC 2 | ₦3,000,000 | Corporate structure, data compliance, enterprise readiness |
| 🛡️ Runway Buffer (6 months) | ₦4,000,000 | Operating cushion through Year 1 growth trough |
| **Total** | **₦20,000,000** | |

```
₦20M seed bridges the Year 1 deficit (₦3.89M),
funds enterprise-unlocking infrastructure (Sprint 8 & 9),
and positions WellQC+ for a cash-flow-positive Year 2
generating ~₦119M net.
```

---

## 15. The Ask

> [!IMPORTANT]
> **We are raising ₦20,000,000 at seed stage.**
> We are open to: pre-seed angels, energy sector strategics, African tech funds, and convertible notes.
> **Target close:** Q1 next quarter.

### Why Invest Now?

1. ✅ **Product is live** — not a pitch deck; a working, tested, billing-enabled SaaS
2. 📈 **Economics are exceptional** — 91% gross margin, LTV:CAC of 35:1, 1-month CAC payback
3. 🏆 **Monopoly position** — only NGN-billed, Paystack-native LAS QC platform in existence
4. 🚪 **Enterprise gate is next** — one Sprint away from 99.9% SLA and oil major contracts
5. 💰 **Year 2 is profitable** — ₦119M net at 10K MAU, purely from organic 5% conversion

---

*WellQC+ · Confidential Investor Materials · [Year]*
*Contact: [founder@wellqcplus.com] · [LinkedIn / Website]*
