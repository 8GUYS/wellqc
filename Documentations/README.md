# WellQC 🛢️

> **Enterprise-Grade AI-Powered Well Log Quality Assurance Platform**

WellQC+ is a full-stack cloud platform that automatically validates, cleans, standardises, and analyses **LAS (Log ASCII Standard)** well log files before consumption by petrophysicists and geoscientists. Styled after industry software from SLB, Palantir Foundry, and Microsoft Fabric, it provides complete automated QA/QC workflows, interactive log track rendering, AI anomaly detection, standardisation management, enterprise reporting, and a Paystack-powered Nigerian and global payment portal.

---

## ✨ Features

### 🗂️ LAS Parsing & Standardisation
- Native **TypeScript LAS 2.0/3.0 parser** — extracts `~V`, `~W`, `~C`, `~P`, `~A` header sections, depth arrays, null values, units, and curve data matrices
- **Automated Mnemonic Standardisation** — maps raw logging mnemonics (e.g., `GAMMA`, `DEN`, `CNL`, `ILD`, `AC`, `HCAL`) to standard API mnemonics (`GR`, `RHOB`, `NPHI`, `RT`, `DT`, `CALI`, `PEF`, `SP`, `MSFL`, `LLS`) with confidence scoring (1.0 exact, 0.95 alias, 0.50 fallback)
- **Persistent Custom Alias Registration** — user-defined aliases stored in `localStorage`
- Optional **Python FastAPI microservice** for high-throughput `lasio` + `scikit-learn` batch processing

### 🧠 AI Quality Engine
- Computes **Completeness Score**, **Consistency Score**, and **Overall Quality Score (0–100)** using the weighted formula:
  > `Overall = (0.50 × Curve Health) + (0.30 × Completeness) + (0.20 × Consistency)`
- Assigns quality grades: `EXCELLENT` (≥90), `GOOD` (75–89), `POOR` (50–74), `CRITICAL` (<50)
- Detects anomalies including:
  - Missing values & null ratio spikes
  - Non-monotonic depth sequences & depth gaps (>5× median step)
  - Physical boundary violations (e.g. RHOB < 1.0 or > 3.2 g/cc, NPHI < -0.05)
  - Extreme Z-score spikes (> 4.0σ)
  - Flatline sensors (> 25 consecutive identical steps)
  - Null cluster blocks (`NULL_CLUSTER`)
- **AI Summary Engine** — generates natural-language risk classifications and interval-level remediation recommendations

### 🔬 Missing Value Diagnostics & Imputation Benchmarking
- **Petrophysical Root-Cause Diagnostics** classifying origin of missing data into:
  - Casing Shoe Boundary (shallow depth null transitions)
  - Borehole Washout (high CALI readings > 15.5 in correlating with absent density/neutron)
  - Telemetry Dropout (large contiguous missing blocks across all channels)
  - Off-Bottom Window (missing readings at start/stop depths)
- **Multi-Method Imputation Benchmark Engine** cross-validating 5 strategies with ground-truth masking:
  - **KNN (K-Nearest Neighbours)** — achieves highest R² (>0.92) for GR/RHOB curves
  - Cubic Spline, Linear Interpolation, Mean Fill, Median Fill, Row Dropping
  - Ground-truth masking cross-validation computing RMSE, MAE, R², Variance Preservation %, and Execution Speed

### 📊 Interactive Petrophysical Log Viewer
- Multi-track log curve viewer rendering:
  - **Track 1**: Gamma Ray (GR) & SP
  - **Track 2**: Deep Resistivity (RT, log scale)
  - **Track 3**: Density (RHOB) vs Porosity (NPHI) crossover with missing gap overlay
  - **Anomaly Ribbon**: Depth-indexed flags with interactive tooltips
- Dual view modes: **Classic Paper Log View** and **Dark Subsurface View**

### 💳 Paystack Payment & Subscription Portal
- Full **Paystack-powered subscription gateway** supporting:
  - 🇳🇬 **Nigerian Naira (₦ NGN)** via Cards (Verve, Mastercard, Visa), Direct Bank Transfer, USSD & Mobile Money
  - 🌍 **US Dollars ($ USD)** for international users
- **Freemium Tier Model**: 2 free LAS quality checks before upgrade prompt
- **Pro Monthly Plan**: ₦75,000/month ($49/month)
- **Pro Annual Plan**: ₦750,000/year ($490/year — 2 months free)
- Payment Modal using React `createPortal` with `z-[99999]` correctly floating above all page layers
- Public Pricing & Plans portal at `/pricing`
- Paystack webhook listener with HMAC-SHA512 signature validation
- Automatic PRO tier activation on verified payment

### 🏢 Enterprise Platform Modules
| Module | Description |
|---|---|
| **Command Dashboard** | 8 KPI telemetry cards, 7-day rolling quality trend, field performance breakdown, payment success banners |
| **Well Management** | Full CRUD asset management with coordinates, curve inventory & quality history |
| **LAS Upload Workspace** | Drag-and-drop uploader with real-time parsing, pre-check QA scoring, freemium gate & DB commit |
| **Curve Standardisation Dictionary** | Alias mapping dictionary & manual override controls with persistent custom aliases |
| **QA Rule Engine Inspector** | Threshold tuning, live batch evaluation & stakeholder alignment mode |
| **Basin Analytics** | Operator comparison charts, error frequency & anomaly distribution |
| **Well Comparison** | Side-by-side log curve comparison across wells |
| **Reports & Downloads** | PDF executive certificates, Excel workbooks, CSV audit logs & cleaned LAS exports |
| **Activity & Audit Trail** | Immutable action log for compliance |
| **Admin Panel** | RBAC role simulator, API tokens & webhook dispatch configuration |
| **Pricing & Plans** | Paystack-integrated subscription portal with NGN/USD toggle and billing cycle toggle |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org/) | ^15.0.3 | Full-stack React framework with App Router & Turbopack |
| [React](https://react.dev/) | ^19.0.0 | UI component library |
| [TypeScript](https://www.typescriptlang.org/) | ^5.6.3 | Type-safe development across the entire codebase |
| [Tailwind CSS](https://tailwindcss.com/) | ^3.4.15 | Utility-first CSS with enterprise dark theme |
| [Framer Motion](https://www.framer.com/motion/) | ^11.11.17 | Smooth animations & micro-interactions |
| [Lucide React](https://lucide.dev/) | ^0.460.0 | Consistent icon system |
| [Recharts](https://recharts.org/) | ^2.13.3 | Petrophysical chart and log track rendering |

### Forms & Validation
| Technology | Version | Purpose |
|---|---|---|
| [React Hook Form](https://react-hook-form.com/) | ^7.53.2 | Performant form state management |
| [Zod](https://zod.dev/) | ^3.23.8 | Schema validation & type inference |
| [@hookform/resolvers](https://github.com/react-hook-form/resolvers) | ^3.9.0 | Zod integration with React Hook Form |

### Database & ORM
| Technology | Version | Purpose |
|---|---|---|
| [Prisma ORM](https://www.prisma.io/) | ^5.22.0 | Type-safe database access & schema management |
| [Neon PostgreSQL](https://neon.tech/) | — | Serverless PostgreSQL on AWS us-east-1 with connection pooling |

### Payment & Monetization
| Technology | Purpose |
|---|---|
| [Paystack](https://paystack.com/) | Nigerian & international payment gateway (Cards, Bank Transfer, USSD, Mobile Money) |
| HMAC-SHA512 | Webhook signature validation for `charge.success` events |

### Authentication & Security
| Technology | Purpose |
|---|---|
| `crypto.scrypt` | Password hashing with 16-byte random salt |
| HMAC-SHA256 | Session token generation with 7-day expiry |
| `crypto.timingSafeEqual` | Constant-time password comparison to prevent timing attacks |
| Route Middleware | `middleware.ts` protects all app routes with multi-tenant `ownerId` isolation |

### Data Processing & Exports
| Technology | Version | Purpose |
|---|---|---|
| [PapaParse](https://www.papaparse.com/) | ^5.4.1 | CSV parsing & export |
| [jsPDF](https://github.com/parallax/jsPDF) | ^2.5.2 | PDF audit certificate generation |
| [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) | ^3.8.4 | Structured table rendering in PDFs |
| [XLSX](https://sheetjs.com/) | ^0.18.5 | Excel workbook export |
| [date-fns](https://date-fns.org/) | ^4.1.0 | Date formatting & manipulation |
| clsx + tailwind-merge | ^2.1.1 / ^2.5.4 | Conditional class utilities |

### Backend Microservice (Optional)
| Technology | Purpose |
|---|---|
| Python 3 | Runtime for advanced petrophysical analytics |
| FastAPI | High-performance REST API for LAS batch processing |
| lasio | Industry-standard Python LAS file reader |
| scikit-learn | `KNNImputer` for missing curve value estimation |
| pandas | Curve data manipulation & statistical analysis |
| numpy | Numerical computation for imputation benchmarking |

### Dev Tools
| Technology | Version | Purpose |
|---|---|---|
| PostCSS | ^8.4.49 | CSS transformation pipeline |
| Autoprefixer | ^10.4.20 | Cross-browser CSS compatibility |
| ts-node | ^10.9.2 | TypeScript execution for Prisma seed scripts |

---

## 📁 Project Structure

```
WellQC+/
├── .env                           # Environment variables (Paystack keys, DB URL, session secret)
├── middleware.ts                  # Route protection & freemium limit middleware
├── prisma/
│   ├── schema.prisma              # Database schema (12+ models incl. billing tier fields)
│   └── seed.ts                   # Sample data: Niger Delta demo wells
├── services/
│   └── python_parser/
│       └── main.py               # Optional FastAPI LAS microservice (KNNImputer)
└── src/
    ├── app/
    │   ├── page.tsx               # Public landing page with Paystack pricing section
    │   ├── pricing/               # Public pricing & plans portal (NGN/USD toggle)
    │   ├── dashboard/             # Command centre dashboard with payment success toast
    │   ├── wells/                 # Well management & detail view
    │   ├── upload/                # LAS drag-and-drop upload workspace (freemium gate)
    │   ├── standardisation/       # Mnemonic dictionary & override UI
    │   ├── qa-engine/             # QA rule inspector & threshold tuning (freemium gate)
    │   ├── analytics/             # Basin & operator analytics
    │   ├── comparison/            # Well-to-well comparison
    │   ├── reports/               # PDF/Excel/CSV/LAS export centre
    │   ├── activity/              # Immutable audit trail
    │   ├── admin/                 # RBAC, API tokens & webhooks
    │   └── api/
    │       ├── auth/              # Login, register, logout, session routes
    │       ├── las/               # LAS processing & freemium check endpoint
    │       ├── wells/             # Well CRUD with multi-tenant isolation
    │       ├── dashboard/         # Aggregated telemetry API
    │       ├── analytics/         # Basin analytics aggregations
    │       ├── paystack/
    │       │   ├── initialize/    # Start Paystack transaction
    │       │   ├── verify/        # Verify reference & activate PRO tier
    │       │   └── webhook/       # Paystack charge.success webhook (HMAC-SHA512)
    │       └── checkout/          # Payment intent router
    ├── components/
    │   ├── ui/                    # Header (with Upgrade button), sidebar, shared components
    │   ├── pricing/
    │   │   └── payment-modal.tsx  # React Portal payment modal (z-[99999])
    │   └── well-log/              # Interactive log track viewer & imputation benchmark modal
    └── lib/
        ├── auth.ts                # scrypt hashing & HMAC session token management
        ├── db.ts                  # Prisma Client singleton
        ├── paystack.ts            # Paystack SDK helpers, plan config & sandbox fallback
        └── las/
            ├── parser.ts          # LAS 2.0/3.0 TypeScript parser
            ├── standardiser.ts    # Mnemonic standardisation engine (with custom aliases)
            ├── quality-engine.ts  # QA scoring & anomaly detection
            ├── ai-analyzer.ts     # AI natural-language summary engine
            ├── imputation-engine.ts # Multi-method imputation benchmarking (KNN/Spline/Linear)
            └── exporter.ts        # LAS 2.0 / CSV / Excel / PDF export engine
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18
- **npm** or **pnpm**
- A **Neon PostgreSQL** database URL (or any PostgreSQL instance)
- A **Paystack** account for payment processing ([dashboard.paystack.com](https://dashboard.paystack.com))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment variables
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, PAYSTACK_SECRET_KEY, NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, etc.

# 3. Push the database schema
npx prisma db push

# 4. (Optional) Seed with sample well data
npx ts-node --project tsconfig.json prisma/seed.ts
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
SESSION_SECRET="your-random-secret"

# Paystack Payment Gateway
PAYSTACK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY="pk_test_..."
PAYSTACK_WEBHOOK_SECRET="your-paystack-webhook-secret"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> **Getting Paystack Keys**: Sign in to [dashboard.paystack.com](https://dashboard.paystack.com) → Settings → API Keys & Webhooks. Copy your Test Secret Key and Test Public Key for development, then swap to Live keys for production.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Optional: Python Microservice

```bash
cd services/python_parser
pip install fastapi uvicorn lasio pandas numpy scikit-learn
uvicorn main:app --reload --port 8000
```

---

## 📜 Database Schema

The Prisma schema defines **12 core entities** backed by **Neon PostgreSQL**:

```
User · Well · Field · Operator · LASFile · Curve
CurveStandardisation · QualityReport · Anomaly
ActivityLog · APIToken · Webhook
```

Key schema highlights:
- `User` includes billing fields: `tier` (`FREE` / `PRO`), `freeChecksUsed`, `paystackCustomerId`, `paystackSubscriptionId`
- All `Well` records are isolated by `ownerId` (`@@index([ownerId])`) enforcing strict multi-tenant data separation
- `QualityReport` stores `overallScore`, `completenessScore`, `consistencyScore`, `avgCurveHealth`, and `grade`
- `ActivityLog` provides an immutable compliance audit trail for all user and system actions

---

## 💳 Payment & Subscription Tiers

| Plan | Price (NGN) | Price (USD) | Features |
|---|---|---|---|
| **Starter Free** | ₦0 | $0 | 2 LAS quality checks, basic anomaly detection |
| **Pro Monthly** | ₦75,000 / mo | $49 / mo | Unlimited checks, KNN imputation, PDF certificates, all modules |
| **Pro Annual** | ₦750,000 / yr | $490 / yr | All Pro features, 2 months free (17% saving) |

Payment channels supported: **Verve, Mastercard, Visa**, **Bank Transfer**, **USSD**, **Mobile Money** (all via Paystack).

---

## 📊 Supported LAS Mnemonics

| Standard Mnemonic | Description | Typical Range |
|---|---|---|
| GR | Gamma Ray | 0–300 GAPI |
| RHOB | Bulk Density | 1.00–3.20 g/cc |
| NPHI | Neutron Porosity | -0.05–0.60 v/v |
| DT | Acoustic Transit Time | 40–200 μs/ft |
| RT | True Resistivity | 0.02–2000 OHMM |
| CALI | Caliper | 6–16 IN |
| PEF | Photoelectric Factor | 0.5–15.0 B/E |
| SP | Spontaneous Potential | -250–250 MV |
| ILD | Induction Log Deep | — |
| MSFL / LLS / LLD | Shallow / Medium / Deep Laterolog | — |

---

## 🔐 Security Model

- **Multi-Tenant Isolation**: Every API query enforces `where: { ownerId: user.id }`. Cross-tenant URL access returns `404 Not Found`.
- **Freemium Gate**: `FREE` tier users are blocked at `POST /api/las` after 2 checks, returning `402 Payment Required`.
- **httpOnly Session Cookies**: 7-day expiry, HTTPS-only in production.
- **Paystack Webhook HMAC**: All incoming Paystack webhooks are verified using `HMAC-SHA512` before any data mutation.

---

## 🏗️ Build for Production

```bash
npm run build
npm start
```

---

## 📄 License

This project is private and proprietary. All rights reserved © NDI-GROUP 5.
