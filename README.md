# WellQC 🛢️

> **Enterprise-Grade AI-Powered Well Log Quality Assurance Platform**

WellQC is a full-stack cloud platform that automatically validates, cleans, standardises, and analyses **LAS (Log ASCII Standard)** well log files before consumption by petrophysicists and geoscientists. Styled after industry software from SLB, Palantir Foundry, and Microsoft Fabric, it provides complete automated QA/QC workflows, interactive log track rendering, AI anomaly detection, standardisation management, enterprise reporting, and a Paystack-powered Nigerian and global payment portal.

---

## ✨ Features

### 🗂️ LAS Parsing & Standardisation
- Native **TypeScript LAS 2.0/3.0 parser** — extracts `~V`, `~W`, `~C`, `~P`, `~A` header sections, depth arrays, null values, units, and curve data matrices
- **Automated Mnemonic Standardisation** — maps raw logging mnemonics (e.g., `GAMMA`, `DEN`, `CNL`, `ILD`, `AC`, `HCAL`) to standard API mnemonics (`GR`, `RHOB`, `NPHI`, `RT`, `DT`, `CALI`, `PEF`, `SP`, `MSFL`, `LLS`) with confidence scoring (1.0 exact, 0.95 alias, 0.50 fallback)
- **Persistent Custom Alias Registration** — user-defined aliases stored in `localStorage`
- **FastAPI backend (Python)** handling LAS parsing, quality scoring, standardisation and imputation

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

### 📊 Interactive Petrophysical Log Viewer & Dynamic Track Selector
- **Dynamic Multi-Curve Track Viewer** — dynamically renders any and all available curve channels from the uploaded LAS dataset (GR, RT, RHOB, NPHI, DT, CALI, SP, PEF, and custom logging mnemonics).
- **Interactive Track Toolbar & Dropdown Selector**:
  - Multi-select dropdown button displaying active and total track counts.
  - Search filter input to instantly locate curves in complex multi-channel logging suites.
  - Quick presets: **Standard 3 (GR, RT, DT)**, **Select All**, and **Clear All**.
  - One-click **"Only"** isolation button on each curve item to instantly focus on an individual log track.
- **Inline Track Controls**: Per-track header `<select>` dropdown to seamlessly hot-swap curves in place, plus a close button (`✕`) to dismiss individual tracks.
- **Log Scales & Visualizations**:
  - Dynamic linear and logarithmic scale handling (e.g. logarithmic for resistivity channels).
  - Density vs Porosity (RHOB/NPHI) crossover with missing gap overlays.
  - **Anomaly Ribbon**: Depth-indexed flags with interactive tooltips correlating anomalies to wireline depths.
- **Dual View Modes**: **Classic Paper Log View** and **Dark Subsurface View**.

### 🚀 Streamlined Data Upload Flow & Database Auto-Persistence
- **Direct Post-Auth Focus**: User login, registration, and email verification immediately route directly to the Data Upload workstation (`/upload`).
- **Zero-Click Database Auto-Save**: Files dropped or selected into the ingestion dropzone are automatically parsed, validated, and saved to the multi-tenant database without requiring manual button clicks.
- **Universal Tour Guide Header Trigger**: Replaced static status pills with a permanent top header Tour Guide button that launches an interactive guided onboarding tour from any page.
- **Dynamic Audit Certificates & Cleaned LAS Exports**: The Audit Reports suite (`/reports`) binds live previews, cryptographic seals, and certified LAS 2.0 downloads directly to whichever file is selected in the batch queue or database table.
- **Responsive Workspace Palette**: Integrated a compact theme switcher icon in the sidebar footer profile card with responsive, viewport-aware popover positioning.

### 🧭 Interactive Dashboard Onboarding Tour
- **Step-by-Step Guided Walkthrough**: Interactive, multi-step product tour guiding new petrophysicists and engineers through the core features of the Command Centre:
  - Welcome & platform architecture introduction
  - Real-time fleet KPI telemetry cards (8 live indicators)
  - 7-Day composite quality score rolling trends
  - Cross-basin field performance breakdown
  - Recent LAS well ingestion activity stream
  - Quick action launchpad (LAS Upload, Standardisation, Reports)
- **Visual Spotlight Overlay**: Dynamic element spotlighting with darkened backdrop focus, animated tooltip popovers, progress indicator badges, and smooth scroll tracking.
- **First-Time User Experience**:
  - Non-intrusive onboarding welcome banner with direct "Take Tour" launcher and dismiss state.
  - SSR/hydration-safe `localStorage` state tracking via React 19 `useSyncExternalStore`.
  - Permanent "Tour Guide" header trigger button for on-demand walkthrough re-runs anytime.
  - Full keyboard accessibility with `Escape` dismiss and keyboard navigation.

### 💳 Paystack Payment & Subscription Portal
- Full **Paystack-powered subscription gateway** supporting:
  - 🇳🇬 **Nigerian Naira (₦ NGN)** via Cards (Verve, Mastercard, Visa), Direct Bank Transfer, USSD & Mobile Money
  - 🌍 **US Dollars ($ USD)** for international users
- **Freemium Tier Model**: 2 free LAS quality checks before upgrade prompt
- **Pro Monthly Plan**: ₦75,000/month ($49/month)
- **Pro Annual Plan**: ₦750,000/year ($490/year — 2 months free)
- **Zero-Key Mock Sandbox Fallback**: Automatic mock checkout simulation during local testing and MVP demonstrations when live Paystack secret keys are not configured.
- **Context-Preserving Checkout Return Flow**: Preserves `targetWellId` throughout the payment journey; the verification card dynamically fetches well metadata and personalizes the return CTA (e.g. `Proceed to Repair "Well-Name" →`), routing directly into the QA Engine with that borehole focused.
- **User Transaction & Receipt History**: Real-time billing history table on `/pricing` displaying settlement dates, currency amounts, transaction references, and current plan status.
- **Pro Feature Gating & Comprehensive Export Protection**: Upfront visual `PRO` lock badges and inline upgrade triggers across the Upload table (`/upload`), Well Assets (`/wells`), Dossier (`/wells/[id]`), QA Engine (`/qa-engine`), Well Comparison (`/comparison`), and Log Data Tables. Free tier users are strictly gated from all file exports (Cleaned LAS, Cleaned CSV, Correlation matrices) and NUPRC PDF compliance certificate downloads.
- Payment Modal using React `createPortal` with `z-[99999]` correctly floating above all page layers.
- Public Pricing & Plans portal at `/pricing`.
- Paystack webhook listener with HMAC-SHA512 signature validation.
- Automatic PRO tier activation on verified payment.

### 🏢 Enterprise Platform Modules
| Module | Description |
|---|---|
| **Command Dashboard** | 8 KPI telemetry cards, 7-day rolling quality trend, field performance breakdown, interactive onboarding tour guide, payment success banners |
| **Well Assets Registry (`/wells`)** | Fleet-wide asset management with real-time search, quality grade filtering (EXCELLENT, GOOD, FAIR, POOR), single and bulk deletion with modal confirmation, and deep dossier links (`/wells/[id]`) with multi-curve visualization and cross-module shortcuts ("Standardise Curves", "Compare Well", "Fix in QA Engine") |
| **Well Dossier (`/wells/[id]`)** | Single-well command dossier featuring interactive multi-track log inspection, AI petrophysical health summary, anomaly lists, and direct launch actions |
| **LAS Upload Workspace (`/upload`)** | Drag-and-drop uploader with real-time parsing, pre-check QA scoring, instant analysis tabs (Curve Health, Wireline Viewer, Anomalies, Headers), and automated persistence with instant "Saved ✓" badges |
| **Closed-Loop QA Engine (`/qa-engine`)** | Anomaly remediation with single/multi-curve/auto repair algorithms, before/after curve comparisons, and 1-click **"Save Cleaned Log"** persisting calibrated curves directly into your central Well Assets as updated asset versions |
| **Curve Standardisation Dictionary (`/standardisation`)** | Alias mapping dictionary & manual override controls with persistent custom aliases and cross-well routing |
| **Stratigraphic Well Comparison (`/comparison`)** | Side-by-side log curve comparison across wells with URL-based Offset A/B pre-selection |
| **Audit Certificates & Reports (`/reports`)** | Dual-document export suite: NUPRC Form WQC-08-A certificates, SHA-256 cryptographic verification seals, and multi-well batch ZIP bundles. Cleaned LAS 2.0 exports are strictly gated behind Pro tier licenses |
| **Admin Operations Console (`/admin`)** | Enterprise user management, user detail inspector, password resets, 1-click backend email verification, system health statistics, activity logs, and custom mnemonic aliases |
| **Enterprise Licensing & Billing (`/pricing`)** | Paystack-integrated billing hub with NGN/USD toggle, monthly/annual billing cycle selector, transaction history receipts, and context-preserving return redirects |
| **Activity & Audit Trail (`/activity`)** | Immutable action log for compliance and data governance |

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

### Progressive Web App (PWA) & Offline
| Technology | Purpose |
|---|---|
| Service Worker (`sw.js`) | Background asset caching, offline page fallback, and mutation bypass |
| Web App Manifest (`manifest.ts` / `manifest.json`) | Standalone display mode, launch icons (192px/512px), theme colors & app shortcuts |
| Cache Storage API | Static asset and CSS bundle preservation for zero-network rig usage |
| Install Prompt API (`beforeinstallprompt`) | Custom native install experience with local state management |

### Typography & Design System
| Technology | Purpose |
|---|---|
| Apple SF Pro Display | Locally bundled webfonts (Regular, Medium, Bold) with Apple letter spacing |
| Custom Theme Studio | Real-time gradient & surface design engine with persistent `localStorage` |
| CSS Custom Properties | Dynamic design tokens for multi-gradient and light/dark theme switching |

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

### Backend (FastAPI)
| Technology | Purpose |
|---|---|
| Python 3 | Runtime for the backend API and petrophysical analytics |
| FastAPI | REST API for authentication, uploads, wells, analytics and LAS processing |
| SQLAlchemy | Query layer over the Prisma-managed schema |
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
WellQC/
├── .env                           # Environment variables (Paystack keys, DB URL, session secret)
├── Documentations/                # Project documentation suite
│   ├── README.md                  # System overview and architecture guide
│   ├── user_stories.md            # Agile user stories & Gherkin acceptance criteria
│   ├── sprint_plan.md             # 3-Month master sprint plan & ownership matrix
│   └── database_erd.md            # Entity-relationship schema documentation
├── middleware.ts                  # Route protection, freemium gating & PWA asset bypass
├── public/                        # Static assets, PWA service worker & manifest
│   ├── brand/                     # SVG brand assets and logomarks
│   ├── fonts/                     # Apple SF Pro Display webfonts (Regular, Medium, Bold)
│   ├── manifest.json              # Static Web App Manifest fallback
│   ├── sw.js                      # Offline caching service worker
│   ├── icon-192.png               # High-res PWA icon (192x192)
│   └── icon-512.png               # High-res PWA icon (512x512)
├── prisma/
│   ├── schema.prisma              # Database schema (12+ models incl. billing tier fields)
│   └── seed.ts                   # Sample data: Niger Delta demo wells
├── backend/                       # FastAPI backend: auth, uploads, wells, analytics, quality engine
└── src/
    ├── app/
    │   ├── page.tsx               # Public landing page with dynamic hero slideshow & team showcase
    │   ├── manifest.ts            # Dynamic Next.js Web App Manifest route
    │   ├── offline/page.tsx       # Dedicated offline connection fallback screen
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
    │   ├── dashboard/
    │   │   └── dashboard-tour.tsx # Interactive product tour, spotlight overlay & welcome banner
    │   ├── pwa/
    │   │   └── pwa-client.tsx     # Service Worker registration, install banner & offline toasts
    │   ├── theme/
    │   │   ├── theme-provider.tsx # Multi-theme context (Light, Dark, Gradients, Custom)
    │   │   ├── theme-switcher.tsx # Grouped theme selector with studio customizer launcher
    │   │   └── theme-customizer-modal.tsx # Interactive real-time gradient & color designer
    │   ├── ui/                    # Header, sidebar, wellqc-logo, shared design components
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

| Standard Names | Description | Typical Range |
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

## 📖 Documentation & Schedule Suite

| Document | Format / Type | Purpose |
|---|---|---|
| [**System Overview & Architecture**](Documentations/README.md) | Markdown | Platform features, technology stack, setup guide, and physical curve limits. |
| [**Agile User Stories & Acceptance Criteria**](Documentations/user_stories.md) | Markdown | 22 formal user stories across 13 epics with Gherkin acceptance criteria, personas, and MoSCoW priorities. |
| [**Master Sprint Plan & Ownership Matrix**](Documentations/sprint_plan.md) | Markdown | Master 18-week development roadmap, 9-sprint breakdowns, responsibility matrix, and interactive Mermaid Gantt charts. |
| [**Visual Kanban Board & Trello Guide**](Documentations/trello_kanban_board.md) | Markdown | Interactive visual Kanban board with 1-click import guides and free-tier split batches. |
| [**Trello CSV Board Import**](Documentations/wellqc_trello_import.csv) | CSV | Standard Trello CSV import file (66 cards with descriptions, members, labels, and due dates). |
| [**Trello Native JSON Board**](Documentations/wellqc_trello_board.json) | JSON | Complete native Trello board JSON export (9 sprint lists, colored labels, and cards). |
| [**Microsoft Project Schedule (MPP)**](Documentations/wellqc_project_schedule.mpp) | MPP (Binary) | Native Microsoft Project binary file with pre-configured Gantt timeline, views, and dependencies. |
| [**Microsoft Project Schedule (XML)**](Documentations/wellqc_project_schedule.xml) | XML (MSPDI) | 1-Click native Microsoft Project XML file with complete 76-task WBS hierarchy and predecessor links. |
| [**Microsoft Project Schedule (CSV)**](Documentations/wellqc_project_schedule.csv) | CSV | Standard WBS CSV schedule for Microsoft Project or Excel Gantt import. |
| [**Database Entity-Relationship Schema**](Documentations/database_erd.md) | Markdown | Relational schema diagrams, Prisma & SQLAlchemy models, and index specifications. |

---|---|---|
| [**System Overview & Architecture**](Documentations/README.md) | Markdown | Platform features, technology stack, setup guide, and physical curve limits. |
| [**Agile User Stories & Acceptance Criteria**](Documentations/user_stories.md) | Markdown | 22 formal user stories across 11 epics with Gherkin acceptance criteria, personas, and MoSCoW priorities. |
| [**Master Sprint Plan & Ownership Matrix**](Documentations/sprint_plan.md) | Markdown | Master 14-week development roadmap, 7-sprint breakdowns, responsibility matrix, and Gantt charts. |
| [**Visual Kanban Board & Trello Guide**](Documentations/trello_kanban_board.md) | Markdown | Interactive visual Kanban board with 1-click import guides for Trello. |
| [**Trello CSV Board Import**](Documentations/wellqc_trello_import.csv) | CSV | Standard Trello CSV import file (50 cards with descriptions, members, labels, and due dates). |
| [**Trello Native JSON Board**](Documentations/wellqc_trello_board.json) | JSON | Complete native Trello board JSON export (7 sprint lists, colored labels, and cards). |
| [**Microsoft Project Schedule (CSV)**](Documentations/wellqc_project_schedule.csv) | CSV | Standard WBS CSV schedule for Microsoft Project or Excel Gantt import. |
| [**Microsoft Project Schedule (XML)**](Documentations/wellqc_project_schedule.xml) | XML (MSPDI) | 1-Click native Microsoft Project XML file with complete task dependencies and predecessor links. |
| [**Database Entity-Relationship Schema**](Documentations/database_erd.md) | Markdown | Relational schema diagrams, Prisma & SQLAlchemy models, and index specifications. |

---

## 🔐 Security Model

- **Multi-Tenant Isolation**: Every API query enforces `where: { ownerId: user.id }`. Cross-tenant URL access returns `404 Not Found`.
- **Freemium Gate**: `FREE` tier users are blocked at `POST /api/las` after 2 checks, returning `402 Payment Required`.
- **httpOnly Session Cookies**: 7-day expiry, HTTPS-only in production.
- **Paystack Webhook HMAC**: All incoming Paystack webhooks are verified using `HMAC-SHA512` before any data mutation.

---

## 🏗️ Build & Deploy for Production

```bash
# Build frontend
npm run build
npm start

# Run backend
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

---

## 🚨 Operations & Runbook

For production incident response, database restoration from R2 archives, and zero-downtime rollback procedures on Render & Vercel, refer to:
👉 [**WellQC Master Operations Runbook**](Documentations/WellQC_Operations_Runbook.md)

---

## 📄 License

This project is private and proprietary. All rights reserved © NDI-GROUP 5.
