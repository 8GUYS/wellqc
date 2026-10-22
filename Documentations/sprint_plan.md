# WellQC — Master 3-Month Development Sprint Plan & Ownership Matrix

> **Project:** WellQC — AI-Powered Well Log Quality Assurance & Subsurface Analytics Platform  
> **Team Structure (8 Members):** 2 Software Engineers · 4 Data Analysts · 2 Cloud Engineers  
> **Timeline:** 3.5 Months (14 Weeks) · 7 × 2-Week Sprints  
> **Active Sprint:** Sprint 7 — Multi-Well Comparison, NUPRC Compliance Reports & Batch Processing (Sprint 6 Completed)  
> **Methodology:** Agile Scrum with 2-Week Sprint Cycles  
> **User Stories Specification:** See [**user_stories.md**](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/Documentations/user_stories.md) for full acceptance criteria & personas  

---

## 🏗️ 1. Current Codebase Implementation Audit

The WellQC platform is structured as an enterprise-grade AI well log quality assurance platform with a high-performance Python FastAPI backend and a Next.js 15 App Router frontend:

### 1. Unified Python FastAPI Backend Architecture (`backend/app/`)
* **FastAPI Service Core ([`backend/app/main.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/main.py))**: Unified asynchronous backend serving all API endpoints (`/api/*`), interactive Swagger UI documentation (`/docs`), OpenAPI schemas (`/openapi.json`), and global structured JSON error handling.
* **Database & ORM Layer ([`backend/app/models/models.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/models/models.py))**: Native SQLAlchemy 2.0 ORM models connecting to Neon Serverless PostgreSQL (`psycopg2-binary`) with connection pooling, foreign-key cascade integrity, and zero ORM overhead.
* **Authentication & Cryptographic Security ([`backend/app/core/security.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/core/security.py))**: Node.js `crypto`-compatible scrypt password hashing (salt + key derivation) and HMAC-SHA256 session token generation and verification.
* **Server-Side Authorization & Default-to-Deny RBAC ([`backend/app/core/dependencies.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/core/dependencies.py))**:
  * Strict session dependency verifying user records against live PostgreSQL tables. Forged or stale tokens return `None` (401 Unauthorized) with zero synthetic account auto-provisioning.
  * Role-Based Access Control (`get_current_admin_user`) requiring database-verified `ADMIN` role with case-insensitive check and default-to-deny rejection (403 Forbidden).
* **Ingestion Service & Atomic Transactions ([`backend/app/services/ingestion_service.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/ingestion_service.py))**: Atomic database commits for LAS files, downsampled wireline curve curves, composite quality reports, and activity logs.
* **Petrophysical Core Engines (`backend/app/services/`)**:
  * Native Python LAS Parser ([`parser.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/parser.py)), Standardiser ([`standardiser.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/standardiser.py)), Quality Engine ([`quality_engine.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/quality_engine.py)), Cleaner ([`cleaner.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/cleaner.py)), Diagnostics ([`diagnostics.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/diagnostics.py)), Imputation ([`imputation.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/imputation.py)), and AI Risk Analyzer ([`ai_analyzer.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/ai_analyzer.py)).
  * **12-Item QA Engine & Cleaner Overhaul Suite**:
    1. *Per-Row Anomaly Approvals*: Discarded blanket switches; repairs are executed strictly on user-approved anomaly rows.
    2. *Per-Row Imputation Method Selection*: Individual algorithms (`KNN`, `LINEAR`, `ZONAL_MEDIAN`, `AUTO`) targeted specifically to each approved row's curve and depth window.
    3. *AUTO Gap Ranking via Cross-Validation*: Automated benchmarking across adjacent complete curve sections to choose the mathematically optimal fill algorithm.
    4. *Impossible-Value Action Matrix*: Tri-modal remediation supporting `REMOVE` (nullify), `CLIP` (clamp to physical bounds), or `DELETE_ROW` (cull invalid depth station).
    5. *Null Cluster Bounds & Unfillable Guards*: Prevents unbounded extrapolation across long null intervals by flagging them as unfillable while preserving data integrity.
    6. *Duplicate Depth Pruning*: Discovers and merges duplicate depth recordings, preserving the highest-fidelity sample.
    7. *2-Point Neighbour Despiking*: Filters electrical noise and tool glitches by measuring differential gradient variance against immediate adjacent depth neighbours.
    8. *Real Change Report Telemetry*: Computes precise row-level modifications, score deltas, and repair telemetry without mock artifacts.
    9. *Audit Certificate & Provenance*: Cryptographically traceable audit log entry (`WQC-CERT-XXXXXXXX`) with exact parameters, timestamp, and petrophysicist operator ID.
    10. *Staged Non-Destructive Review UI*: Side-by-side interactive visual verification in `CleanedLogViewer` prior to final database commit.
    11. *Certified Clean Export Suite*: Standardized Cleaned LAS 2.0 and CSV export with full petroleum industry header parity.
    12. *Backend-Frontend Schema Alignment*: Zero-mismatch contract between Next.js payload and FastAPI Pydantic schemas.

### 2. Security Hardening & Administrative Controls (`backend/app/api/`)
* **Public Registration Role Escalation Block ([`auth.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/api/auth.py))**: Public `POST /api/auth/register` rejects any request attempting to self-assign the `ADMIN` role with `HTTP 403 Forbidden`. Allowed registration roles strictly limited to non-admin roles (`PETROPHYSICIST`, `DATA_ENGINEER`, `GEOSCIENTIST`, `VIEWER`).
* **Admin Management Endpoints ([`admin.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/api/admin.py))**: Privileged `GET /api/admin/users`, `PATCH /api/admin/users`, and `DELETE /api/admin/users` strictly enforce `Depends(get_current_admin_user)`. Built-in safeguards prevent admin self-deletion, deleting the only remaining admin, or demoting the last admin.
* **Interactive Admin Management CLI ([`scripts/manage_admin.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/scripts/manage_admin.py))**: Secure console tool for provisioning administrators and promoting accounts directly in the database without exposing privileged endpoints publicly.
* **Clean Database Seeder ([`scripts/seed_db.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/scripts/seed_db.py))**: Schema-only database initialization script that creates tables and preserves real user records while keeping all domain tables completely clean of synthetic mock records.

### 3. Application UI & Modular Frontend (`src/`)
* **Authentication UI with Show/Hide Password ([`src/components/auth/auth-form.tsx`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/src/components/auth/auth-form.tsx))**: Interactive password visibility toggle (`Eye` / `EyeOff` icons) with full accessibility across Login and Registration modes.
* **Modular Upload Architecture ([`src/components/upload/`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/src/components/upload/))**: High-cohesion decoupled architecture consisting of `UploadHeader`, `UploadDropzone`, `BatchQueueList`, `RestoredSessionBanner`, `WellOverviewCard`, `AuditSummaryCards`, `AIInsightsPanel`, `AnomaliesListTab`, and `HeadersTab`.
* **Quota-Safe LocalStorage Persistence ([`src/lib/las/storage-utils.ts`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/src/lib/las/storage-utils.ts))**: Safe storage wrapper with curve array downsampling ensuring upload workspace restoration without triggering `QuotaExceededError`.
* **Admin Panel UI ([`src/app/admin/page.tsx`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/src/app/admin/page.tsx))**: Multi-tab administrative center for user management, role assignments, API tokens, and webhook configurations with real-time error handling.
* **Wireline Viewer & Asset Management ([`src/app/wells/`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/src/app/wells/))**: SVG multi-track log viewer, curve summaries table, and URL search parameter synchronization.

### 4. Cross-Platform Developer Tools & Automated Test Harness
* **Unified Dual-Server Launcher ([`scripts/start-servers.ps1`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/scripts/start-servers.ps1), [`start_engine.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/start_engine.py))**: 1-click script managing port cleanup (:8000 and :3000), virtual environment activation, and concurrent execution of FastAPI and Next.js.
* **Pytest Backend Test Suite (`backend/tests/`)**: 52 automated tests with 100% green pass rate:
  * `test_admin_authorization.py` (14 tests): Server-side admin RBAC, unauthenticated 401s, non-admin 403s, privilege escalation prevention, and safety lockout checks.
  * `test_object_authorization.py` (9 tests): Tenant isolation on wells, fixes, and custom aliases.
  * `test_e2e_api.py` (8 tests): End-to-end integration across auth, wells, pre-check, and diagnostics.
  * `test_parser.py`, `test_quality_engine.py`, `test_standardiser.py`, `test_aliases_api.py`, `test_auth_api.py` (21 tests).
* **Jest Frontend Test Suite (`__tests__/`)**: 22 automated unit tests across quality engine, standardiser, parser, and API contracts.
* **Static Verification**: Zero TypeScript errors (`npx tsc --noEmit`), zero unused legacy dependencies.

---

## 👥 2. Team Roles & Ownership Matrix

The team consists of **8 members** organized into 3 primary divisions:

| Role ID | Role Title | Primary Codebase Files & Modules | Core Focus Area |
|---|---|---|---|
| **SE1** | Software Engineer 1 (Core Engine & AI Lead) | `parser.ts`, `quality-engine.ts`, `ai-analyzer.ts`, `exporter.ts`, `log-viewer.tsx` | LAS parsing algorithms, quality scoring mathematics, AI recommendation generation, wireline rendering, and type safety. |
| **SE2** | Software Engineer 2 (Full-Stack UI & API Lead) | `app-shell.tsx`, `sidebar.tsx`, `header.tsx`, `auth.ts`, `paystack.ts`, `payment-modal.tsx`, `/api/*` | App UI, responsive design, Paystack payment integration, REST API routes, auth flows, and frontend state management. |
| **DA1** | Data Analyst 1 (Petrophysical Rules & Standardisation Lead) | `standardiser.ts`, `standardisation/page.tsx` | Physical boundary thresholds, curve mnemonic aliases, confidence scoring weights, and petrophysical dictionary standards. |
| **DA2** | Data Analyst 2 (Missing Value & Imputation Lead) | `imputation-engine.ts`, `imputation-benchmark-modal.tsx` | Root-cause missing value diagnostics (washout, casing shoe), algorithm benchmarking (KNN vs Spline vs Linear), and RMSE/MAE validation. |
| **DA3** | Data Analyst 3 (Basin Intelligence & Field Analytics Lead) | `dashboard/page.tsx`, `analytics/page.tsx`, `/api/dashboard`, `/api/analytics` | Dashboard KPIs, 7-day rolling quality trends, Niger Delta field performance rankings, and anomaly distribution charts. |
| **DA4** | Data Analyst 4 (Reporting & Quality Audit Lead) | `reports/page.tsx`, `sample-las-files.ts` | PDF audit certificate layout & compliance, Excel/CSV export validation, and real-world Niger Delta test LAS file curation. |
| **CE1** | Cloud Engineer 1 (DevOps, CI/CD & Performance Lead) | `vercel.json`, `next.config.js`, `.github/workflows/` | Vercel deployments, custom domains, SSL/TLS certificates, GitHub Actions CI/CD pipelines, and performance optimization. |
| **CE2** | Cloud Engineer 2 (Database, Security & Microservice Lead) | `schema.prisma`, `db.ts`, `POST /api/las`, `services/python_parser/` | Neon PostgreSQL provisioning, Prisma ORM schema migrations, multi-tenant DB isolation audits, and Python FastAPI microservice. |

---

## 📅 3. Master Sprint Plans & Responsibilities (Sprint 1 to Deployment)

The project roadmap spans **6 two-week sprints (12 weeks)**:

```
Month 1                        Month 2                        Month 3
─────────────────────────────────────────────────────────────────────
Sprint 1         Sprint 2      Sprint 3        Sprint 4      Sprint 5         Sprint 6
Wk 1–2          Wk 3–4        Wk 5–6          Wk 7–8        Wk 9–10          Wk 11–12
Discovery &     Foundation    Core Engine &   Advanced      Security &       Production
Architecture    & Auth Setup  LAS Ingestion   Visualisation Monetization     Release & Demo
```

---

### 🔵 SPRINT 1 (Weeks 1–2): Discovery, Architecture & Core Stack
* **Theme:** Establish data contracts, petrophysical boundaries, database design, and cloud environments.
* **SE1:** Design `ParsedLAS` interface specification; architect the 4-stage pipeline contract (`Parser` → `Standardiser` → `Quality Engine` → `Exporter`); set up strict TypeScript definitions in `src/lib/api-types.ts`.
* **SE2:** Scaffold Next.js 15 App Router with TypeScript & Tailwind CSS; configure directory layout, path aliases (`@/*`), `.eslintrc.json`, `.prettierrc`, and base components.
* **DA1:** Compile standard measurement physical limits for 8 core curve types (`GR`, `RHOB`, `NPHI`, `DT`, `RT`, `CALI`, `PEF`, `SP`) and standard unit strings.
* **DA2:** Define petrophysical root cause rules for missing values (Casing Shoe, Borehole Washout, Telemetry Dropout, Off-Bottom Window).
* **DA3:** Draft specifications for Dashboard telemetry KPIs, 7-day trend metrics, and field performance scoring.
* **DA4:** Define PDF audit certificate layout and compliance header requirements.
* **CE1:** Initialize Vercel deployment project linked to GitHub repository; configure build commands and environment variables.
* **CE2:** Provision Neon PostgreSQL on AWS us-east-1; initialize Prisma ORM schema; scaffold Python FastAPI microservice skeleton in `services/python_parser/`.

---

### 🟢 SPRINT 2 (Weeks 3–4): Foundation, Auth & Multi-Tenant Database
* **Theme:** Database schema push, authentication stack, route protection middleware, and responsive app shell.
* **SE1:** Build [`src/lib/auth.ts`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/WellQC/src/lib/auth.ts) password hashing with scrypt + random salt; implement `verifyPassword` with `timingSafeEqual` and HMAC session token helpers.
* **SE2:** Build public Landing Page (`src/app/page.tsx`); build Auth API routes (`/api/auth/login`, `/register`, `/logout`, `/me`); build `app-shell.tsx`, `sidebar.tsx`, `header.tsx`, and `middleware.ts`.
* **DA1:** Build initial raw mnemonic alias dictionary for standardisation (mapping `GAMMA`, `DEN`, `CNL`, `AC` to API standards).
* **DA2:** Benchmark baseline imputation algorithms (Mean, Median, Linear Interpolation, Row Dropping).
* **DA3:** Compile Niger Delta basin field names and operator directory for seeding.
* **DA4:** Curate initial set of 10 real-world LAS test files representing varying quality levels.
* **CE1:** Configure SSL/TLS HTTPS headers and automated GitHub Actions build verification.
* **CE2:** Finalize `schema.prisma` (`User`, `Well`, `LASFile`, `Curve`, `QualityReport`, `Anomaly`, `ActivityLog`); enforce `ownerId` indexing; execute `prisma db push`; build `db.ts` singleton.

---

### 🟡 SPRINT 3 (Weeks 5–6): Core Engine, Quality Scoring & Ingestion Workspace
* **Theme:** LAS parsing engine, composite quality scoring, standardisation engine, and atomic database commits.
* **SE1:** Build `parser.ts` with null normalization; build `quality-engine.ts` with spike/flatline/gap anomaly detection and weighted formula; build `ai-analyzer.ts` and `exporter.ts`.
* **SE2:** Build Drag-and-Drop LAS Ingestion UI (`src/app/upload/page.tsx`); build Well asset management pages (`wells/page.tsx`, `wells/[id]/page.tsx`) and `/api/wells` endpoints.
* **DA1:** Implement `standardiser.ts` with exact/alias lookup and confidence scoring (1.0 exact, 0.95 alias, 0.50 fallback).
* **DA2:** Calibrate spike Z-score threshold ($4.0\sigma$) and flatline detection steps ($25$ consecutive depth samples).
* **DA3:** Verify automatic metadata extraction from LAS headers (`WELL`, `COMP`, `FLD`, `LOC`, `API`).
* **DA4:** Run test uploads on 10 LAS test files to verify grade categorization (`EXCELLENT` $\ge 90$, `GOOD` $75\text{--}89$, `POOR` $50\text{--}74$, `CRITICAL` $<50$).
* **CE1:** Optimize Next.js chunk splitting and bundle size.
* **CE2:** Build atomic transaction in `POST /api/las` with `db.$transaction()` ensuring multi-tenant workspace isolation.

---

### 🟠 SPRINT 4 (Weeks 7–8): Advanced Visualisation, Imputation & Python Backend Migration

* **Sprint 4 Week 1 Deliverables (Visualisation & Analytics):**
  * **SE1:** Build Multi-Track Wireline Log Viewer (`log-viewer.tsx`) supporting Track 1 (`GR`), Track 2 (`RT` log scale), Track 3 (`DT`/`RHOB`/`NPHI`), and missing-null gap overlays in Classic Paper & Dark Subsurface views.
  * **SE2:** Build Command Dashboard (`dashboard/page.tsx`), QA Engine UI (`qa-engine/page.tsx`), and Standardisation Dictionary page (`standardisation/page.tsx`).
  * **DA1:** Build persistent custom alias registration (`addCustomAlias` stored in `localStorage` and database) in `standardiser.ts`.
  * **DA2:** Implement Multi-Method Imputation Benchmarking Engine in `imputation-engine.ts` (KNN, Cubic Spline, Linear, Mean, Median) with ground-truth cross-validation calculating RMSE, MAE, R², and variance preservation.
  * **DA3:** Build Field Performance ranking calculations and Anomaly Distribution aggregations for `analytics/page.tsx`.
  * **DA4:** Implement PDF Audit Certificate generator (jsPDF), Excel Workbook exporter (SheetJS), and CSV logger in `reports/page.tsx`.
  * **CE1:** Optimize client-side memory usage and SVG rendering performance for large log files (>10,000 depth samples).

* **Sprint 4 Week 2 Deliverables (Full Python Backend Migration & Multi-Tenant Security):**
  * **SE1 & CE2 (Full Backend Migration to Python):** Architected and deployed a unified **Python FastAPI** backend service (`backend/app/`) replacing disparate Next.js TypeScript API routes:
    * Native SQLAlchemy 2.0 ORM models (`backend/app/models/models.py`) with PostgreSQL connection pooling (`psycopg2-binary`).
    * Cryptographic session security (`backend/app/core/security.py`) implementing scrypt password hashing and HMAC-SHA256 session token generation matching Node.js `crypto` with 100% backward-compatibility for active sessions.
    * Ported petrophysical core logic to native Python (`parser.py`, `standardiser.py`, `quality_engine.py`, `cleaner.py`, `diagnostics.py`, `imputation.py`, and `ai_analyzer.py`).
  * **SE2 & CE1 (Frontend Wireline Integration & Proxy Rewrites):**
    * Configured Next.js rewrites in `next.config.ts` to transparently route `/api/*`, `/docs`, `/redoc`, and `/openapi.json` to the FastAPI backend.
    * Mounted the interactive Multi-Track Wireline Log Viewer (`WellLogViewer`) directly onto the Well Detail page (`src/app/wells/[id]/page.tsx`) with dynamic channel counts and sample telemetry.
  * **Security & Multi-Tenant Isolation:**
    * Implemented strict user isolation on Custom Aliases (`backend/app/api/standardisation.py`), preventing cross-user visibility of personal mnemonic mappings and activity attribution.
  * **Containerization & Automated Testing:**
    * Created `backend/Dockerfile` and unified `docker-compose.yml` with health checks.
    * Built 27-suite Pytest automated test harness with 100% green pass rate across parser, standardiser, quality engine, aliases API, auth API, and end-to-end integration flows.

---

### 🟣 SPRINT 5 (Weeks 9–10): Security Hardening, Server-Side Authorization (Default to Deny) & DB Refactoring

* **Theme:** Comprehensive security audit, zero privilege escalation, server-side RBAC enforcement, database seed sanitization, and administrative management tooling.
* **SE1 & CE2 (Server-Side Authorization & RBAC Enforcement):**
  * Conducted full security audit across all routes, RPC functions, and dependencies.
  * Hardened `get_current_admin_user` in `dependencies.py` to enforce strict database-verified `current_user.role == "ADMIN"` with default-to-deny rejection (`HTTP 403 Forbidden`).
  * Closed public self-registration vulnerability in `auth.py`: blocked `role: "ADMIN"` submission (`HTTP 403 Forbidden`); restricted self-registration strictly to non-admin roles (`PETROPHYSICIST`, `DATA_ENGINEER`, `GEOSCIENTIST`, `VIEWER`).
  * Eliminated ghost-token auto-provisioning loophole in `dependencies.py`: unverified, deleted, or spoofed tokens return `None` (`HTTP 401 Unauthorized`) rather than creating database accounts.
  * Added safety lockout prevention in `admin.py`: blocked admin self-deletion, deleting the only remaining admin, and self-demotion when no other admin exists.
  * Built dedicated security test suite `backend/tests/test_admin_authorization.py` (14 tests) proving unauthenticated users receive 401 and non-admin roles receive 403 on all privileged endpoints.
* **SE2 (UI Modernization & Authentication Enhancements):**
  * Implemented Show/Hide Password visibility toggle with accessible eye icons in `src/components/auth/auth-form.tsx`.
  * Refactored Upload Workspace into high-cohesion, decoupled components (`UploadHeader`, `UploadDropzone`, `BatchQueueList`, `RestoredSessionBanner`, `WellOverviewCard`, `AuditSummaryCards`, `AIInsightsPanel`, `AnomaliesListTab`, `HeadersTab`).
  * Implemented quota-safe localStorage persistence in `storage-utils.ts` with curve downsampling to prevent `QuotaExceededError`.
  * Connected admin page error banners to FastAPI's standard `detail` field.
* **CE2 & DA3 (Database Sanitization & Management CLI):**
  * Built `scripts/seed_db.py`: schema-only initialization preserving real user records while keeping all domain and telemetry tables completely clean of synthetic mock data.
  * Built `scripts/manage_admin.py`: interactive CLI tool for secure administrator creation and account promotion directly in PostgreSQL.
  * Deprecated legacy TypeScript database files (`prisma/seed.ts`, `src/lib/auth.ts`, `prisma7.config.ts`, `services/python_parser/`).
* **DA4 & CE1 (Continuous Validation & Test Coverage):**
  * Expanded automated test coverage to 52 backend tests and 22 frontend tests with 100% green pass rate and 0 TypeScript compilation errors.

---

### 🔴 SPRINT 6 (Weeks 11–12): Hardened Production Release, Security Audit & Quality Engine Overhaul [COMPLETED]

* **Theme:** Security hardening, rate limiting, cryptographic password reset, interactive Quality Engine 12-item overhaul, multi-variate imputation benchmarking, and certified export suite.
* **SE1 (Core Engine & Quality Engine Overhaul):**
  - **12-Item QA Engine Overhaul Integration:**
    - *Item 1 & 2 (Per-Row Approvals & Method Routing):* Overhauled `/api/qa-engine/repair` and `cleaner.py` to accept and execute repairs strictly on user-approved anomaly rows. Each approved row applies its designated method (`KNN`, `LINEAR`, `ZONAL_MEDIAN`, `AUTO`) exclusively to its curve and depth window; unapproved/rejected rows remain strictly untouched.
    - *Item 3 (AUTO Gap Ranking Engine):* Implemented cross-validation benchmarking evaluating all candidate imputation algorithms against adjacent complete sections of the curve to select the optimal algorithm.
    - *Item 4 (Impossible-Value Action Matrix):* Built multi-action support for impossible values: `REMOVE` (nullify), `CLIP` (clamp to physical limits), or `DELETE_ROW` (cull depth station).
    - *Item 5 (Long Null Cluster Guards):* Added safeguards detecting null sequences exceeding physical continuity limits, flagging them as `UNFILLABLE` rather than performing unconstrained extrapolation.
    - *Item 6 & 7 (Duplicate Pruning & 2-Point Despiking):* Implemented duplicate depth resolution (preserving highest-fidelity readings) and two-point differential gradient despiking to eliminate electrical tool transients.
    - *Item 8 & 9 (Real Telemetry & Audit Certificate):* Replaced mock statistics with real change telemetry computing modified sample counts, delta score improvements, and cryptographically traceable certificate IDs (`WQC-CERT-XXXXXXXX`).
  - Implemented sliding-window in-memory IP rate limiter returning RFC-compliant `429 Too Many Requests`.
* **SE2 (Quality Engine UI Redesign & Export Suite):**
  - Built complete 4-section Quality Engine page (`src/app/qa-engine/page.tsx`):
    - *Section 1: Choose the well* with data source switcher, well metadata card, and raw quality score.
    - *Section 2: Review and approve fixes* with per-row approval toggles, inline algorithm selector (KNN, Linear, Zonal Median, Auto), batch selection with auto-dimming, and non-destructive run bar.
    - *Section 3: Before and after verification* with compliance badge, score delta gauge, 4 repair metric counters, and embedded CleanedLogViewer with raw comparison overlay.
    - *Section 4: Certified clean export* with Cleaned LAS 2.0 / CSV downloads, full change report export, and copyable audit certificate ID.
  - Aligned frontend JSON payloads (`handleExecuteCleaning`) with backend Pydantic schemas, eliminating contract mismatches.
  - Implemented password reset UI with password strength validation and automatic redirect.
* **DA1 & DA2 (Petrophysical Rules & Imputation Benchmarking):**
  - Calibrated physical bounds for impossible value clipping across 14 standard wireline curves (GR, RHOB, NPHI, DT, ILD, etc.).
  - Benchmarked cross-validation ranking metrics (RMSE, MAE, R²) for the AUTO gap imputation engine.
* **DA4 & DA3 (Quality Audit & Export Validation):**
  - Validated Cleaned LAS 2.0 export headers against CWLS (Canadian Well Logging Society) specifications.
  - Verified Change Report CSV output accuracy across synthetic and field test logs.
* **CE2 & CE1 (Database Performance, Rate Limiting & Test Automation):**
  - Resolved `HTTP 500: Internal Server Error` on well listing endpoints by optimizing eager loading on curves and anomalies.
  - Integrated dynamic `SystemSetting` key-value model for runtime credentials and templates.
  - Expanded test suites to 7 Jest test suites (37 unit tests) and 52 Pytest backend tests with 100% pass rate.
  - Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

---

### 🟣 SPRINT 7 (Weeks 13–14): Multi-Well Comparison, NUPRC Compliance Reports & Batch Processing [ACTIVE SPRINT]

* **Theme:** Advanced subsurface correlation, regulatory reporting compliance, background batch ingestion queue, and unsupervised lithology classification.
* **Current Progress:** 75% complete — core correlation mathematics and comparison UI in staging, batch processing queue in active testing.
* **SE1 (Core Engine & Correlation Mathematics):**
  - **P1 — Well Comparison Engine (Completed):** Built multi-well depth alignment, curve normalization (Z-score and min-max), and correlation matrix calculations for up to 4 offset wells.
  - **P4 — ML Lithology Classification (In Progress - 80%):** Unsupervised clustering (K-Means / Gaussian Mixture) on GR-RHOB-NPHI crossplots to detect shale, sand, and carbonate intervals.
* **SE2 (Frontend Navigation & Comparison Visualizer):**
  - **P1 — Well Comparison UI (`src/app/comparison/page.tsx`) (In Progress - 90%):** Cross-well visual canvas displaying synchronized depth-scrolling tracks, lithology column overlays, and well tops.
  - **P2 — NUPRC Regulatory Audit Reports UI (`src/app/reports/page.tsx`) (In Progress - 85%):** Formal Nigerian Upstream Petroleum Regulatory Commission submission templates with digital signatures and print layout.
* **DA1 & DA2 (Petrophysical Rules & ML Calibration):**
  - Calibrated lithological electrofacies cutoff boundaries across Niger Delta formations (Akata, Agbada, Benin).
  - Defined standard well tops classification dictionary for multi-well marker correlation.
* **DA3 & DA4 (Compliance Documentation & Field Datasets):**
  - Benchmarked NUPRC regulatory validation rules (casing shoe markers, TD verification, calibration records).
  - Prepared multi-well demonstration package with 4 offset Niger Delta wells for cross-correlation validation.
* **CE1 (Batch Ingestion & Background Task Queue):**
  - **P3 — Automated Batch Ingestion Queue (In Progress - 75%):** Asynchronous background task workers (FastAPI `BackgroundTasks`) for multi-file LAS directory uploads with live progress bar and bulk ZIP download.
* **CE2 (Webhook Dispatcher & Cloud Storage):**
  - **P5 — Webhook Event Dispatcher (In Progress - 70%):** Outbound HTTP webhook dispatch notifying external cloud storage (S3/Blob) and subsurface databases upon well certification.

---

## 📊 4. Quick Reference Responsibility Matrix

```
WellQC Development Team (8 Members)
│
├── 🧑‍💻 SE1 (Core Engine & AI Lead)
│    ├─ S1–S3: LAS Parser, Scoring & Core Engines  ├─ S4–S5: Python Backend & Default-to-Deny RBAC
│    ├─ S6: 12-Item QA Engine & AUTO Imputation   └─ S7: Multi-Well Correlation & ML Lithology
│
├── 🧑‍💻 SE2 (Full-Stack UI & API Lead)
│    ├─ S1–S3: App Shell, Auth & Ingestion UI      ├─ S4–S5: Dashboard, Viewer & Modular Upload
│    ├─ S6: 4-Section QA Engine UI & LAS Exporter └─ S7: Comparison Canvas & NUPRC Reports UI
│
├── 📊 DA1 (Petrophysical Rules & Standardisation Lead)
│    ├─ S1–S3: Curve Physical Limits & Aliases     ├─ S4–S5: Custom Aliases & User Isolation
│    ├─ S6: Impossible Value Boundaries & Clamping └─ S7: Niger Delta Lithology & Well Tops Rules
│
├── 📊 DA2 (Missing Value & Imputation Lead)
│    ├─ S1–S3: Root Cause Rules & Thresholds       ├─ S4–S5: Imputation Benchmarking Engine
│    ├─ S6: Cross-Validation & Null Gap Bounds    └─ S7: Multi-Well Lithology Cluster Validation
│
├── 📊 DA3 (Basin Intelligence & Field Analytics Lead)
│    ├─ S1–S3: Dashboard KPIs & Field Directory    ├─ S4–S5: Analytics Logic & Zero-Mock Seeder
│    ├─ S6: Database Eager Loading Optimization    └─ S7: Offset Wells Dataset Curation
│
├── 📊 DA4 (Reporting & Quality Audit Lead)
│    ├─ S1–S3: PDF Audit Specs & Test Datasets     ├─ S4–S5: Export Validation & Test Coverage
│    ├─ S6: Real Change Telemetry & CWLS Headers  └─ S7: NUPRC Compliance Report Validation
│
├── ☁️ CE1 (DevOps, CI/CD & Performance Lead)
│    ├─ S1–S3: Vercel, CI/CD & Chunk Splitting     ├─ S4–S5: Performance & Test Pipelines
│    ├─ S6: Dual Server Orchestration & Scripts    └─ S7: Async Batch Processing Worker Queue
│
└── ☁️ CE2 (Database, Security & Microservice Lead)
     ├─ S1–S3: PostgreSQL, Prisma & Transactions   ├─ S4–S5: FastAPI Migration & Admin CLI
     ├─ S6: Password Reset & SystemSetting Table   └─ S7: Webhook Dispatcher & Cloud Storage Sync
```

---

## 📈 5. Visual Gantt Chart & Microsoft Project Integration

### Interactive Mermaid Gantt Chart

The diagram below reflects the complete 14-week delivery plan across all 7 sprints, including completed milestones and the active Sprint 7 workstream:

```mermaid
gantt
    title WellQC Master Schedule (14 Weeks · 7 Sprints)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Sprint 1: Discovery & Core Stack
    Domain Modeling & Limits (DA1, DA2)       :done, s1_1, 2026-07-20, 2026-07-24
    LAS 2.0 Parser Engine (SE1)               :done, s1_2, 2026-07-22, 2026-07-29
    App Shell & Design System (SE2)           :done, s1_3, 2026-07-20, 2026-07-28
    DB Schema Design (CE2)                    :done, s1_4, 2026-07-22, 2026-07-30
    CI/CD & Governance (CE1)                  :done, s1_5, 2026-07-20, 2026-07-25
    Milestone: Core Stack PoC                 :milestone, m1, 2026-07-31, 0d

    section Sprint 2: Foundation & Auth
    Multi-Tenant DB on Neon (CE2)             :done, s2_1, 2026-08-03, 2026-08-07
    Auth Engine & Scrypt Tokens (SE2, CE2)    :done, s2_2, 2026-08-05, 2026-08-11
    Mnemonic Dictionary Standard (DA1)        :done, s2_3, 2026-08-03, 2026-08-07
    Anomaly Classification (DA2)              :done, s2_4, 2026-08-06, 2026-08-12
    Upload UI & Drag-Drop (SE2)               :done, s2_5, 2026-08-07, 2026-08-13
    Milestone: Authenticated Ingestion        :milestone, m2, 2026-08-14, 0d

    section Sprint 3: Quality Engine & Workspace
    Multi-Factor Quality Scoring (SE1, DA1)   :done, s3_1, 2026-08-17, 2026-08-21
    Upload Workspace Modular Layout (SE2)     :done, s3_2, 2026-08-18, 2026-08-24
    Basin Analytics Dashboard (DA3)           :done, s3_3, 2026-08-19, 2026-08-25
    PDF Audit Report Generator (DA4)          :done, s3_4, 2026-08-21, 2026-08-27
    Atomic DB Pipeline & Downsample (CE2)     :done, s3_5, 2026-08-20, 2026-08-26
    Milestone: Quality Scoring & PDF Ready    :milestone, m3, 2026-08-28, 0d

    section Sprint 4: Visualisation & Python Migration
    FastAPI Microservice Migration (SE1, CE2) :done, s4_1, 2026-08-31, 2026-09-07
    SVG Multi-Track Log Viewer (SE2)          :done, s4_2, 2026-09-01, 2026-09-08
    Custom Mnemonic Aliases UI (DA1)          :done, s4_3, 2026-09-02, 2026-09-08
    Imputation Algorithm Benchmark (DA2)      :done, s4_4, 2026-09-03, 2026-09-09
    Zero-Mock Clean Seeder & Tests (CE1, DA3) :done, s4_5, 2026-09-04, 2026-09-10
    Milestone: Python Backend & Log Viewer    :milestone, m4, 2026-09-11, 0d

    section Sprint 5: Security & Default-to-Deny RBAC
    Server-Side RBAC Enforcement (SE1, CE2)   :done, s5_1, 2026-09-14, 2026-09-18
    Self-Registration Escalation Block (SE1)  :done, s5_2, 2026-09-16, 2026-09-21
    Admin Management CLI (CE2)                :done, s5_3, 2026-09-17, 2026-09-22
    Admin Panel UI & Tokens (SE2)             :done, s5_4, 2026-09-18, 2026-09-24
    Automated Security Test Suite (DA4, CE1)  :done, s5_5, 2026-09-21, 2026-09-25
    Milestone: Default-to-Deny Security       :milestone, m5, 2026-09-25, 0d

    section Sprint 6: 12-Item QA Engine Overhaul
    Per-Row Anomaly Approvals (SE1, SE2)      :done, s6_1, 2026-09-28, 2026-10-02
    AUTO Imputation CV Benchmark (DA2, SE1)   :done, s6_2, 2026-09-29, 2026-10-05
    Impossible-Value Action Matrix (DA1, SE1) :done, s6_3, 2026-09-30, 2026-10-06
    Null Cluster Guards & Flags (DA2, DA1)    :done, s6_4, 2026-10-01, 2026-10-06
    Duplicate Prune & Despiking (SE1)         :done, s6_5, 2026-10-02, 2026-10-07
    Real Telemetry & Audit Cert (DA4, SE1)    :done, s6_6, 2026-10-05, 2026-10-08
    4-Section QA UI & Export Suite (SE2)      :done, s6_7, 2026-10-05, 2026-10-09
    Rate Limiting & Stability (CE2, CE1)      :done, s6_8, 2026-09-28, 2026-10-02
    Milestone: Certified Quality Engine       :milestone, m6, 2026-10-09, 0d

    section Sprint 7: Multi-Well & NUPRC Compliance [ACTIVE]
    Well Comparison Alignment Engine (SE1)    :done, s7_1, 2026-10-12, 2026-10-16
    Cross-Well Canvas UI (SE2)                :active, s7_2, 2026-10-13, 2026-10-19
    ML Lithology Classification (SE1, DA2)    :active, s7_3, 2026-10-15, 2026-10-20
    NUPRC Compliance Report Template (SE2,DA4):active, s7_4, 2026-10-14, 2026-10-20
    Niger Delta Formation Cutoffs (DA1, DA2)  :done, s7_5, 2026-10-12, 2026-10-16
    Offset Wells Demonstration Package (DA3)  :active, s7_6, 2026-10-13, 2026-10-19
    Batch Ingestion Background Queue (CE1)    :active, s7_7, 2026-10-14, 2026-10-21
    Outbound Webhook Dispatcher (CE2)         :active, s7_8, 2026-10-15, 2026-10-22
    End-to-End System Test Suite (All)        :active, s7_9, 2026-10-19, 2026-10-23
    Milestone: Final Production Release       :milestone, m7, 2026-10-23, 0d
```

---

### 📂 Microsoft Project Files & Import Guide

Two standardized project files have been generated in this repository for direct review in **Microsoft Project (Standard / Professional / Microsoft 365)**:

| File Name | Format | Best For | Direct Link |
|---|---|---|---|
| **`wellqc_project_schedule.xml`** | Microsoft Project XML (MSPDI Schema) | **Recommended (1-Click Open)** — Instantly loads all WBS hierarchies, task links, calendars, durations, and % complete without any manual mapping. | [**`wellqc_project_schedule.xml`**](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/Documentations/wellqc_project_schedule.xml) |
| **`wellqc_project_schedule.csv`** | Comma-Separated Values (CSV) | Excel editing and standard MS Project Text Import Wizard. | [**`wellqc_project_schedule.csv`**](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/Documentations/wellqc_project_schedule.csv) |

#### Method 1: Instant Open via XML (Recommended)
1. Open **Microsoft Project**.
2. Click **File** > **Open** > **Browse**.
3. In the file type dropdown at the bottom right, select **XML Format (*.xml)**.
4. Select [**`wellqc_project_schedule.xml`**](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/Documentations/wellqc_project_schedule.xml) and click **Open**.
5. When prompted by the Import Wizard, select **As a new project** and click **Finish**.
6. The entire 58-task schedule will appear with all summary groups, WBS levels, dependencies (predecessors), resources, and progress percentages already formatted.

#### Method 2: Text Import Wizard via CSV
1. Open **Microsoft Project**.
2. Click **File** > **Open** > **Browse** and set the file filter to **Text (Tab delimited) (*.txt, *.csv)**.
3. Select [**`wellqc_project_schedule.csv`**](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/Documentations/wellqc_project_schedule.csv).
4. In the **Import Wizard**:
   * Map format: **New map** > **Tasks only**.
   * Source header row: Check **First row contains column headings**.
   * Verify the field mappings:
     * `ID` → `ID`
     * `Outline_Level` → `Outline Level`
     * `Task_Name` → `Name`
     * `Duration` → `Duration`
     * `Start_Date` → `Start`
     * `Finish_Date` → `Finish`
     * `Predecessors` → `Predecessors`
     * `Resource_Names` → `Resource Names`
     * `Percent_Complete` → `% Complete`
5. Click **Finish**. MS Project will construct the Gantt chart and task tree.


