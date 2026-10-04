# WellQC+ — Master 3-Month Development Sprint Plan & Ownership Matrix

> **Project:** WellQC+ — AI-Powered Well Log Quality Assurance & Subsurface Analytics Platform  
> **Team Structure (8 Members):** 2 Software Engineers · 4 Data Analysts · 2 Cloud Engineers  
> **Timeline:** 3 Months (12 Weeks) · 6 × 2-Week Sprints  
> **Active Sprint:** Sprint 6 — Hardened Production Release, Security Audit & Platform Integration  
> **Methodology:** Agile Scrum with 2-Week Sprint Cycles  
> **User Stories Specification:** See [**user_stories.md**](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/Documentations/user_stories.md) for full acceptance criteria & personas  

---

## 🏗️ 1. Current Codebase Implementation Audit

The WellQC+ platform is structured as an enterprise-grade AI well log quality assurance platform with a high-performance Python FastAPI backend and a Next.js 15 App Router frontend:

### 1. Unified Python FastAPI Backend Architecture (`backend/app/`)
* **FastAPI Service Core ([`backend/app/main.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/main.py))**: Unified asynchronous backend serving all API endpoints (`/api/*`), interactive Swagger UI documentation (`/docs`), OpenAPI schemas (`/openapi.json`), and global structured JSON error handling.
* **Database & ORM Layer ([`backend/app/models/models.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/models/models.py))**: Native SQLAlchemy 2.0 ORM models connecting to Neon Serverless PostgreSQL (`psycopg2-binary`) with connection pooling, foreign-key cascade integrity, and zero ORM overhead.
* **Authentication & Cryptographic Security ([`backend/app/core/security.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/core/security.py))**: Node.js `crypto`-compatible scrypt password hashing (salt + key derivation) and HMAC-SHA256 session token generation and verification.
* **Server-Side Authorization & Default-to-Deny RBAC ([`backend/app/core/dependencies.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/core/dependencies.py))**:
  * Strict session dependency verifying user records against live PostgreSQL tables. Forged or stale tokens return `None` (401 Unauthorized) with zero synthetic account auto-provisioning.
  * Role-Based Access Control (`get_current_admin_user`) requiring database-verified `ADMIN` role with case-insensitive check and default-to-deny rejection (403 Forbidden).
* **Ingestion Service & Atomic Transactions ([`backend/app/services/ingestion_service.py`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/NDI-G5/wellqc/backend/app/services/ingestion_service.py))**: Atomic database commits for LAS files, downsampled wireline curve curves, composite quality reports, and activity logs.
* **Petrophysical Core Engines (`backend/app/services/`)**:
  * Native Python LAS Parser (`parser.py`), Standardiser (`standardiser.py`), Quality Engine (`quality_engine.py`), Cleaner (`cleaner.py`), Diagnostics (`diagnostics.py`), Imputation (`imputation.py`), and AI Risk Analyzer (`ai_analyzer.py`).

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
* **SE1:** Build [`src/lib/auth.ts`](file:///c:/Users/Ekwebelam%20C%20Williams/Desktop/WellQC+/src/lib/auth.ts) password hashing with scrypt + random salt; implement `verifyPassword` with `timingSafeEqual` and HMAC session token helpers.
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

### 🔴 SPRINT 6 (Weeks 11–12): Hardened Production Release, Cross-Platform Launchers & Demo Sign-Off

* **Theme:** Dual-server orchestration, cross-platform developer tooling, performance verification, and final production sign-off.
* **SE1 & CE1:** Created `scripts/start-servers.ps1` and `start_engine.py` for single-command orchestration of FastAPI (:8000) and Next.js (:3000) with automatic port cleanup and health monitoring.
* **SE2:** Final responsive layout verification, dark mode aesthetics audit, and interactive Swagger UI (`/docs`) with Bearer token authorization modal.
* **CE2:** Production Docker containerization verification with `docker-compose.yml`, health probes, and SSL/TLS proxy alignment.
* **Full Team:** End-to-end regression audit, verification of 11 anomaly detection categories, and zero-technical-debt sign-off.

---

## 📊 4. Quick Reference Responsibility Matrix

```
WellQC+ Development Team (8 Members)
│
├── 🧑‍💻 SE1 (Core Engine & AI Lead)
│    ├─ S1: Architecture & Data Pipeline Contract  ├─ S2: Scrypt & HMAC Auth Engine
│    ├─ S3: LAS Parser & Quality Engine Scoring   ├─ S4: Multi-Track Viewer & Exporter
│    ├─ S5: Server RBAC Default-to-Deny & Audits  └─ S6: Cross-Platform Launcher & Sign-Off
│
├── 🧑‍💻 SE2 (Full-Stack UI & API Lead)
│    ├─ S1: Next.js Setup & Directory Scaffold    ├─ S2: Landing Page, Auth Pages & Shell
│    ├─ S3: Upload UI & Well CRUD Pages           ├─ S4: Dashboard, QA Engine & Benchmark UI
│    ├─ S5: Show/Hide Password & Modular Upload   └─ S6: Swagger UI Auth & UI Polish
│
├── 📊 DA1 (Petrophysical Rules & Standardisation Lead)
│    ├─ S1: 8 Core Curve Physical Limit Bounds    ├─ S2: Raw Mnemonic Alias Dictionary
│    ├─ S3: Standardiser Confidence Weighting     ├─ S4: Persistent Custom Alias Feature
│    ├─ S5: Custom Alias User Isolation Logic     └─ S6: Petrophysical Dictionary Sign-Off
│
├── 📊 DA2 (Missing Value & Imputation Lead)
│    ├─ S1: Root Cause Diagnostics Definition     ├─ S2: Baseline Imputation Benchmarks
│    ├─ S3: Spike & Flatline Threshold Tuning     ├─ S4: Multi-Method KNN Benchmark Engine
│    ├─ S5: Imputation Quality Verification       └─ S6: Imputation Presentation & Slides
│
├── 📊 DA3 (Basin Intelligence & Field Analytics Lead)
│    ├─ S1: Dashboard KPI & Telemetry Specs       ├─ S2: Niger Delta Basin Field Directory
│    ├─ S3: Header Metadata Auto-Extraction       ├─ S4: Analytics & Field Ranking Logic
│    ├─ S5: Clean DB Seeder & Zero-Mock Baseline  └─ S6: Field Performance Demo Dataset
│
├── 📊 DA4 (Reporting & Quality Audit Lead)
│    ├─ S1: PDF Audit Certificate Layout Specs    ├─ S2: 10 Niger Delta Test LAS Dataset
│    ├─ S3: Quality Grade Range Verification      ├─ S4: PDF / Excel / CSV Exporters
│    ├─ S5: Pytest 52-Suite Verification          └─ S6: Final Demonstration & Sign-Off
│
├── ☁️ CE1 (DevOps, CI/CD & Performance Lead)
│    ├─ S1: Vercel Project & Environment Setup    ├─ S2: SSL HTTPS & GitHub Actions CI/CD
│    ├─ S3: Next.js Chunk Splitting Optimization  ├─ S4: SVG Rendering Performance Tuning
│    ├─ S5: Automated Jest & Pytest Pipelines     └─ S6: Production Release & Custom Domain
│
└── ☁️ CE2 (Database, Security & Microservice Lead)
     ├─ S1: Neon PostgreSQL DB Provisioning       ├─ S2: Full Prisma Schema & Owner Indexes
     ├─ S3: Atomic Multi-Tenant DB Transaction    ├─ S4: Python FastAPI Imputation Service
     ├─ S5: Admin CLI & Privilege Escalation Fix  └─ S6: Production DB Migration & Deploy
```


