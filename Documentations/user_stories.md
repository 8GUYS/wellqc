# WellQC+ — Enterprise User Stories & Acceptance Criteria

> **Document Version:** 1.0.0  
> **Target Audience:** Product Managers, Petrophysicists, Data Analysts, Software & Cloud Engineers, QA Teams  
> **Agile Framework:** Scrum with 2-Week Sprint Cadence  
> **Status:** Active / Approved  

---

## 🧭 1. Executive Summary & Agile Framework

WellQC+ is an enterprise cloud and AI-powered well log quality assurance, standardisation, and subsurface analytics platform. This document defines the formal **User Stories**, **User Personas**, and **Acceptance Criteria (Gherkin syntax)** that govern product development across all 6 two-week sprint cycles.

### 📐 Definition of Ready (DoR)
A story is considered ready for sprint planning when:
1. User story format is strictly adhered to: *"As a [persona], I want [capability], so that [business value]"*.
2. Acceptance criteria are documented in unambiguous *Given... When... Then...* format.
3. Dependencies (schema, microservice endpoints, UI components) are explicitly identified.
4. Business value and MoSCoW priority are assigned.
5. Story has been estimated in story points by the multidisciplinary team.

### ✅ Definition of Done (DoD)
A story is accepted as done when:
1. All functional acceptance criteria pass automated or manual verification.
2. Code conforms to PEP 8 (Python backend) and ESLint/Prettier (Next.js/TypeScript frontend).
3. Automated unit/integration tests pass with >85% code coverage.
4. OpenAPI/Swagger documentation (`/docs`) is updated and interactive.
5. Code is peer-reviewed, merged to the main trunk, and verified in staging/Docker.

---

## 👥 2. Target User Personas

| Persona ID | Persona Name | Professional Role | Primary Objectives & Pain Points |
|---|---|---|---|
| **PER-1** | **Dr. Amara Obi** | Lead Petrophysicist (E&P Asset Team) | Needs clean, trustworthy LAS curves (`GR`, `RHOB`, `NPHI`, `DT`, `RT`) for reservoir petrophysical calculations without wasting days manually fixing cycle-skips and null clusters. |
| **PER-2** | **Tunde Bakare** | Subsurface Data Engineer | Oversees data lakehouse ingestion. Needs automated mnemonic standardisation across multiple logging vendors (SLB, Baker Hughes, Halliburton) and automated schema integrity. |
| **PER-3** | **Folake Adeleke** | Subsurface Exploration Manager | Needs executive QA certificates, field-level risk indicators, and quality score tracking to make drilling and workover decisions with confidence. |
| **PER-4** | **Chinedu Eze** | Enterprise Systems & Security Admin | Manages multi-tenant RBAC, audit trails, secure session encryption, API tokens, and compliance with corporate NDA policies. |
| **PER-5** | **Kelechi Nnamdi** | Junior Geologist / Academic Trainee | Uses the platform on the Free Starter tier to learn wireline interpretation, run 2 free quality checks, and preview Paystack subscription upgrades. |

---

## 📚 3. Core Feature Epics & Detailed User Stories

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            WellQC+ Epic Hierarchy                            │
├───────────────────────┬──────────────────────────────┬───────────────────────┤
│ Epic 1: LAS Ingestion │ Epic 2: Standardisation      │ Epic 3: AI QA Engine  │
├───────────────────────┼──────────────────────────────┼───────────────────────┤
│ Epic 4: Imputation    │ Epic 5: Wireline Log Viewer  │ Epic 6: Data Cleaning │
├───────────────────────┼──────────────────────────────┼───────────────────────┤
│ Epic 7: Audit Reports │ Epic 8: Paystack Payments    │ Epic 9: RBAC & Assets │
├───────────────────────┴──────────────────────────────┴───────────────────────┤
│ Epic 10: OpenAPI / Swagger Developer Experience & Platform REST APIs         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 🗂️ Epic 1: LAS File Ingestion, Validation & Parsing

#### US-ING-01: Multi-Version LAS Parsing
- **As a** Petrophysicist (PER-1),
- **I want to** drag and drop LAS 2.0 and LAS 3.0 files into the upload workspace,
- **So that** the system instantly extracts curve data, depth steps, and header metadata without manual formatting.
- **Priority:** Must Have (MoSCoW)
- **Sprint / Owner:** Sprint 1 · SE1 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Successfully parsing standard LAS 2.0 file
    Given I upload a valid LAS file "kestrel_federal_1h.las" with ~V, ~W, ~C, and ~A sections
    When the system processes the file
    Then it extracts well name, API number, start depth, stop depth, step, and null value (-999.25)
    And it loads the curves array with depth values and numerical points
    And the raw file is held in memory without altering original disk records
  ```

#### US-ING-02: Corrupt LAS File Diagnostics
- **As a** Subsurface Data Engineer (PER-2),
- **I want** the parser to flag malformed sections, non-numeric ASCII blocks, and truncated files,
- **So that** corrupted data does not enter the downstream petrophysical processing pipeline.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 3 · SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Uploading a file with corrupt ASCII data lines
    Given a LAS file containing letters in numerical curve tracks
    When the parser parses the ~A data block
    Then it captures parsing warnings indicating the exact line number
    And it safely skips or converts invalid tokens to null representation (-999.25)
    And displays a warning notification to the user
  ```

---

### 🏷️ Epic 2: Curve Mnemonic Standardisation & Dictionary Management

#### US-STD-01: Automated Vendor Mnemonic Mapping
- **As a** Subsurface Data Engineer (PER-2),
- **I want** raw service company mnemonics (e.g., `DEN`, `CNL`, `ILD`, `AC`, `HCAL`) to map automatically to standard API names (`RHOB`, `NPHI`, `RT`, `DT`, `CALI`),
- **So that** all well assets adhere to a unified company dictionary regardless of the logging contractor.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 3 · DA1 / SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Automatic mapping of Schlumberger and Halliburton mnemonics
    Given an uploaded LAS file with curve mnemonics ["GAMMA", "DEN", "ILD"]
    When the standardisation engine analyzes the curve list
    Then "GAMMA" is mapped to "GR" with confidence 0.95
    And "DEN" is mapped to "RHOB" with confidence 0.95
    And "ILD" is mapped to "RT" with confidence 0.95
    And unmapped curves receive standard designation "UNKNOWN" with confidence 0.0
  ```

#### US-STD-02: Persistent Custom Alias Registration
- **As a** Petrophysicist (PER-1),
- **I want to** define and save custom mnemonic aliases (e.g., `CILD` -> `RT`),
- **So that** local basin nomenclature is remembered and auto-applied to all future file uploads.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 3 · DA1 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Registering and applying custom alias
    Given I navigate to the Standardisation Dictionary page (/standardisation)
    When I add a custom alias "RDEP" mapped to standard curve "RT"
    Then the alias is saved in the database under my organization
    And subsequent uploads containing "RDEP" automatically resolve to "RT"
  ```

---

### 🧠 Epic 3: AI Quality Scoring, Anomaly Detection & Risk Assessment

#### US-QCE-01: Composite Quality Scoring (0–100)
- **As a** Exploration Manager (PER-3),
- **I want** each uploaded well to receive a transparent Quality Score (0–100) and Grade,
- **So that** I can rapidly distinguish high-confidence well data from risky, incomplete logs.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 3 · SE1 / DA1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Computing composite quality score
    Given a well with evaluated curve health, completeness, and consistency
    When the Quality Engine evaluates the logs
    Then the score is calculated using: Overall = (0.50 × CurveHealth) + (0.30 × Completeness) + (0.20 × Consistency)
    And assigns quality grades:
      | Score Range | Quality Grade |
      | >= 90       | EXCELLENT     |
      | 75 - 89     | GOOD          |
      | 50 - 74     | POOR          |
      | < 50        | CRITICAL      |
  ```

#### US-QCE-02: Detection of the 11 Core Petrophysical Anomalies
- **As a** Petrophysicist (PER-1),
- **I want** the system to detect and pinpoint all 11 industry anomaly types with depth intervals,
- **So that** I know exactly where sensors malfunctioned or borehole conditions degraded.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 4 · SE1 / DA1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Detecting sensor flatlines and DT cycle skips
    Given a sonic curve DT containing 30 consecutive identical values
    And a bulk density curve RHOB reading 0.8 g/cc (< physical boundary 1.0 g/cc)
    When the anomaly detector runs
    Then it generates an anomaly record for "FLATLINE" on DT with depth range
    And it generates an "IMPOSSIBLE_VALUE" anomaly for RHOB
    And it specifies recommended petrophysical corrections
  ```

#### US-QCE-03: AI Natural-Language Risk Summary
- **As a** Petrophysicist (PER-1) or Exploration Manager (PER-3),
- **I want** an AI-generated textual summary highlighting formation risks and data defects,
- **So that** I can quickly include executive summaries in reservoir review slide decks.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 3 · SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Generating AI summary
    Given a quality report with 4 detected anomalies
    When the report is generated
    Then the `aiSummary` field provides a narrative explanation of curve issues
    And provides bulleted recommendations for petrophysical remediation
  ```

---

### 🔬 Epic 4: Petrophysical Diagnostics & Intelligent Imputation

#### US-IMP-01: Root-Cause Classification of Missing Data
- **As a** Petrophysicist (PER-1),
- **I want** missing curve intervals categorized by geological/mechanical cause (Washout, Casing Shoe, Telemetry Dropout, Off-Bottom),
- **So that** I do not mistakenly impute data across physical boundaries like casing shoes.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 4 · DA2 / SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Classifying borehole washout
    Given missing RHOB/NPHI readings occurring where CALI > 15.5 inches
    When the diagnostic engine runs
    Then the missing gap is tagged as "Borehole Washout"
    And the recommended correction notes that density pad lost borehole contact
  ```

#### US-IMP-02: Imputation Algorithm Benchmarking
- **As a** Data Analyst (PER-2),
- **I want to** benchmark 5 imputation strategies (KNN, Spline, Linear, Mean, Median) using cross-validation,
- **So that** I can select the algorithm with the highest R² score and lowest RMSE before filling gaps.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 4 · DA2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Running ground-truth cross-validation
    Given a curve with complete data intervals
    When I trigger the Imputation Benchmark Modal
    Then it masks 15% of known ground-truth points
    And evaluates KNN, Spline, Linear, Mean, and Median models
    And outputs a comparative table of RMSE, MAE, R², and Variance Preservation %
  ```

---

### 📊 Epic 5: Interactive Multi-Track Wireline Log Viewer

#### US-VIW-01: Standard Petrophysical 3-Track Presentation
- **As a** Petrophysicist (PER-1),
- **I want to** view logs in an interactive 3-track presentation (Track 1: GR/SP, Track 2: RT log scale, Track 3: RHOB/NPHI crossover),
- **So that** I can visually inspect lithology, fluid contacts, and reservoir pay zones.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 4 · SE1 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Visualizing multi-track wireline layout
    Given a well with valid GR, RT, RHOB, and NPHI curves
    When I open the log viewer
    Then Track 1 displays Gamma Ray (0 to 150 GAPI)
    And Track 2 displays Deep Resistivity on logarithmic scale (0.2 to 2000 ohm-m)
    And Track 3 displays Density-Neutron crossover with yellow sand shading
    And scrolling pan and zoom synchronizes depth across all tracks
  ```

#### US-VIW-02: Anomaly Ribbon Overlay
- **As a** Petrophysicist (PER-1),
- **I want** color-coded anomaly markers plotted directly alongside curve depths,
- **So that** I can hover over an anomaly to see its type, severity, and suggested correction in context.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 4 · SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Hovering over anomaly ribbon marker
    Given an anomaly at depth 10,250 ft on curve RHOB
    When I hover over the anomaly marker on the track ribbon
    Then a tooltip displays: "IMPOSSIBLE_VALUE (Critical): RHOB reading 0.82 g/cc"
    And displays the suggested action: "Clip to lower physical boundary 1.00 g/cc"
  ```

---

### 🛠️ Epic 6: Automated Data Cleaning & Repair Engine

#### US-CLN-01: Non-Destructive Raw Data Preservation
- **As a** Subsurface Data Engineer (PER-2),
- **I want** the original raw LAS file to remain permanently untouched in the database,
- **So that** data provenance is maintained and all repairs are generated as versioned copies.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 4 · SE1 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Verifying data immutability
    Given a raw LAS file uploaded to the workspace
    When I apply multiple cleaning fixes (e.g. clipping, despiking, KNN imputation)
    Then the original raw LAS file records remain unmodified
    And a new cleaned dataset version is generated and associated with the well
  ```

#### US-CLN-02: Before vs After Quality Score Verification
- **As a** Petrophysicist (PER-1),
- **I want** a side-by-side comparison of Quality Score before and after applying repairs,
- **So that** I can quantify the exact data quality improvement achieved.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 4 · SE1 / DA1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Reviewing cleaning impact
    Given a raw well with Quality Score 62 (POOR)
    When I execute the recommended cleaning batch
    Then the screen presents a Before vs After scoreboard
    And displays the new Quality Score (e.g., 91 EXCELLENT)
    And provides buttons to export the Cleaned LAS and Cleaned CSV
  ```

---

### 📄 Epic 7: Audit Reporting, Executive Certificates & Exports

#### US-RPT-01: Executive PDF QA/QC Audit Certificate
- **As a** Exploration Manager (PER-3),
- **I want to** download a formal PDF Quality Assurance Certificate with audit badge,
- **So that** I can submit it to regulatory authorities and partner joint ventures (JVs).
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · DA4 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Generating PDF Audit Certificate
    Given an evaluated well asset
    When I click "Download QA Certificate (PDF)"
    Then a formatted PDF document is compiled containing:
      | Certificate Element |
      | Well Identification & Operator Metadata |
      | Overall Quality Score and Stamp Badge |
      | Curve Health Breakdown Table |
      | Anomaly Register & Remediation History |
      | Digital Timestamp and Compliance Checksum |
  ```

#### US-RPT-02: Cleaned LAS 2.0 Export
- **As a** Petrophysicist (PER-1),
- **I want to** download a cleaned, standardized LAS 2.0 file,
- **So that** I can import it directly into commercial interpretation packages (Petrel, Techlog, IP).
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE1 / DA4
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Exporting cleaned LAS file
    Given a cleaned well log dataset
    When I request LAS export
    Then it generates standard CWLS LAS 2.0 text
    And verifies that all duplicate depths are removed
    And confirms step depth is strictly monotonic
  ```

---

### 💳 Epic 8: Subscription Management & Paystack Payments

#### US-PAY-01: Freemium Usage Gate (2 Free Checks)
- **As a** Free Tier User (PER-5),
- **I want to** run 2 complete well log quality checks for free,
- **So that** I can evaluate the tool's power before purchasing a paid plan.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Gating free user on third check
    Given a user on the FREE tier with 2/2 checks used
    When the user attempts to upload a 3rd LAS file for full evaluation
    Then the upload is paused and the Paystack Upgrade Modal appears
    And displays options to upgrade to Pro Monthly (₦75,000 / $49) or Annual
  ```

#### US-PAY-02: Paystack Multi-Channel Checkout
- **As a** Petrophysicist in Nigeria or abroad (PER-1, PER-5),
- **I want to** pay via Paystack using Naira or US Dollars with Cards, Bank Transfer, or USSD,
- **So that** subscription billing is smooth and locally accessible.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Completing payment and instant tier upgrade
    Given I select the Pro Monthly plan in the Paystack modal
    When I complete the payment authorization
    Then Paystack verifies the transaction reference via webhook/API
    And my account tier is instantly upgraded to "PRO"
    And my check limit becomes unlimited
  ```

---

### 🔐 Epic 9: Multi-Tenant Asset Management & RBAC Security

#### US-SEC-01: Role-Based Access Control (RBAC)
- **As a** Systems Administrator (PER-4),
- **I want** distinct permissions for ADMIN, PETROPHYSICIST, DATA_ENGINEER, GEOSCIENTIST, and VIEWER,
- **So that** sensitive field data and administrative actions are strictly safeguarded.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 2 · SE2 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Non-admin attempting administrative action
    Given a user authenticated with role "PETROPHYSICIST"
    When they attempt to update another user's role via POST /api/admin/users/{id}/role
    Then the server returns 403 Forbidden ("Administrative privileges required")
  ```

#### US-SEC-02: Asset Ownership & Multi-Tenant Isolation
- **As a** Petrophysicist (PER-1),
- **I want** my well assets and LAS files private to my account or organization,
- **So that** confidential exploration data is never visible to competitor tenants.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 2 · CE2 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Accessing well assets across tenants
    Given Petrophysicist A owns Well "Alpha-1"
    When Petrophysicist B attempts to access /api/wells/{id_of_alpha_1}
    Then the server returns 403 Forbidden with ownership restriction notice
    And Petrophysicist A and System Administrators can access it normally
  ```

---

### 🌐 Epic 10: OpenAPI / Swagger Developer Experience & Platform REST APIs

#### US-API-01: Interactive Swagger UI Authorization
- **As an** API Integrator or Developer,
- **I want** Swagger UI (`/docs`) to feature a prominent **Authorize** modal supporting Bearer authentication,
- **So that** I can easily test endpoints (like `GET /api/wells/{id}`) directly from the browser documentation.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 6 · SE2 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Authenticating inside Swagger UI (/docs)
    Given I navigate to http://127.0.0.1:8000/docs
    When I click the green "Authorize" button at the top
    And enter my Bearer session token
    Then all subsequent "Try it out" requests automatically include the `Authorization: Bearer <token>` header
    And protected endpoints return 200 OK responses instead of 401 Unauthorized
  ```

#### US-API-02: Flexible Well Retrieval by ID, API Number, or Name
- **As a** Petrophysicist or API Developer (PER-1),
- **I want** `GET /api/wells/{id}` to resolve wells whether I pass an internal UUID, the well's API/UWI number, or the well name,
- **So that** I do not have to look up the database UUID just to inspect a well's quality report and curve points.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 6 · SE1 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Retrieving well detail via API number
    Given a well with UUID "123e4567-e89b-12d3-a456-426614174000" and API number "42-999-00001"
    When I send `GET /api/wells/42-999-00001`
    Then the server returns 200 OK
    And the payload contains the complete well item, curvesMatrix, curveSummaries, and AI summary
  ```

#### US-API-03: Paystack Webhook Handler with Signature Verification
- **As a** Cloud Security Engineer (CE2),
- **I want** the `/api/paystack/webhook` endpoint to validate the HMAC-SHA512 header against our Paystack secret key,
- **So that** forged transaction notifications cannot fraudulently grant Pro subscriptions.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · CE2 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Receiving legitimate Paystack webhook event
    Given a webhook POST request signed with valid x-paystack-signature header
    When the event is processed
    Then the signature is verified via HMAC-SHA512
    And the user's tier is upgraded upon event "charge.success"
  ```

---

## 📊 4. Requirements Traceability Matrix (RTM)

| Story ID | Epic Title | MoSCoW | Sprint Target | Lead Owner | Primary Code Modules |
|---|---|---|---|---|---|
| **US-ING-01** | Multi-Version LAS Parsing | Must Have | Sprint 1 | SE1 | `backend/app/core/las_parser.py`, `src/lib/las/parser.ts` |
| **US-ING-02** | Corrupt LAS File Diagnostics | Must Have | Sprint 3 | SE1 | `backend/app/api/las.py`, `src/lib/las/parser.ts` |
| **US-STD-01** | Vendor Mnemonic Mapping | Must Have | Sprint 3 | DA1 | `backend/app/api/standardisation.py`, `src/lib/las/standardiser.ts` |
| **US-STD-02** | Persistent Custom Aliases | Should Have | Sprint 3 | DA1 | `backend/app/api/standardisation.py`, `/standardisation` |
| **US-QCE-01** | Composite Quality Scoring | Must Have | Sprint 3 | SE1 | `backend/app/core/quality_engine.py`, `quality-engine.ts` |
| **US-QCE-02** | 11 Anomaly Category Audits | Must Have | Sprint 4 | DA1 | `backend/app/core/quality_engine.py`, `cleaner.ts` |
| **US-QCE-03** | AI Natural Language Summary | Should Have | Sprint 3 | SE1 | `backend/app/api/wells.py`, `ai-analyzer.ts` |
| **US-IMP-01** | Root-Cause Classifications | Should Have | Sprint 4 | DA2 | `src/lib/las/imputation-engine.ts`, `backend/app/api/las.py` |
| **US-IMP-02** | Imputation Benchmarking | Should Have | Sprint 4 | DA2 | `imputation-benchmark-modal.tsx`, `imputation-engine.ts` |
| **US-VIW-01** | 3-Track Wireline Presentation | Must Have | Sprint 4 | SE1 | `src/components/well-log/log-viewer.tsx` |
| **US-VIW-02** | Interactive Anomaly Ribbon | Should Have | Sprint 4 | SE1 | `src/components/well-log/log-viewer.tsx` |
| **US-CLN-01** | Non-Destructive Raw Data | Must Have | Sprint 4 | CE2 | `src/lib/las/cleaner.ts`, `backend/app/api/las.py` |
| **US-CLN-02** | Before vs After Scorecard | Must Have | Sprint 4 | SE1 | `src/app/qa-engine/page.tsx`, `cleaner.ts` |
| **US-RPT-01** | Executive PDF QA Certificate | Must Have | Sprint 5 | DA4 | `src/app/reports/page.tsx`, `src/lib/las/exporter.ts` |
| **US-RPT-02** | Cleaned LAS 2.0 Export | Must Have | Sprint 5 | SE1 | `src/lib/las/exporter.ts`, `backend/app/api/las.py` |
| **US-PAY-01** | Freemium Usage Gate (2 Checks) | Must Have | Sprint 5 | SE2 | `src/app/upload/page.tsx`, `backend/app/api/las.py` |
| **US-PAY-02** | Paystack Multi-Channel Checkout | Must Have | Sprint 5 | SE2 | `src/lib/paystack.ts`, `payment-modal.tsx`, `/pricing` |
| **US-SEC-01** | Role-Based Access Control (RBAC) | Must Have | Sprint 2 | SE2 | `backend/app/core/dependencies.py`, `/api/admin` |
| **US-SEC-02** | Multi-Tenant Data Isolation | Must Have | Sprint 2 | CE2 | `backend/app/api/wells.py`, `schema.prisma` |
| **US-API-01** | Interactive Swagger Authorize | Must Have | Sprint 6 | SE2 | `backend/app/core/dependencies.py`, `backend/app/main.py` |
| **US-API-02** | Flexible Well Retrieval (ID/API) | Must Have | Sprint 6 | SE1 | `backend/app/api/wells.py` |
| **US-API-03** | Webhook HMAC-SHA512 Verification | Must Have | Sprint 5 | CE2 | `src/app/api/paystack/webhook/route.ts` |

---

*Document approved by WellQC+ Core Engineering & Petrophysical Analytics Working Group.*
