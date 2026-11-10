# WellQC — Enterprise User Stories & Acceptance Criteria

> **Document Version:** 1.0.0  
> **Target Audience:** Product Managers, Petrophysicists, Data Analysts, Software & Cloud Engineers, QA Teams  
> **Agile Framework:** Scrum with 2-Week Sprint Cadence  
> **Status:** Active / Approved  

---

## 🧭 1. Executive Summary & Agile Framework

WellQC is an enterprise cloud and AI-powered well log quality assurance, standardisation, and subsurface analytics platform. This document defines the formal **User Stories**, **User Personas**, and **Acceptance Criteria (Gherkin syntax)** that govern product development across all 6 two-week sprint cycles.

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
| **PER-5** | **Kelechi Nnamdi** | Junior Geologist / Academic Trainee | Uses the platform on the Free Starter tier to learn wireline interpretation, run 3 free quality checks, and preview Paystack subscription upgrades. |

---

## 📚 3. Core Feature Epics & Detailed User Stories

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            WellQC Epic Hierarchy                            │
├───────────────────────┬──────────────────────────────┬───────────────────────┤
│ Epic 1: LAS Ingestion │ Epic 2: Standardisation      │ Epic 3: AI QA Engine  │
├───────────────────────┼──────────────────────────────┼───────────────────────┤
│ Epic 4: Imputation    │ Epic 5: Wireline Log Viewer  │ Epic 6: Data Cleaning │
├───────────────────────┼──────────────────────────────┼───────────────────────┤
│ Epic 7: Audit Reports │ Epic 8: Paystack Payments    │ Epic 9: RBAC & Assets │
├───────────────────────┴──────────────────────────────┴───────────────────────┤
│ Epic 10: OpenAPI / Swagger Developer Experience & Platform REST APIs         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Epic 11: Mobile Ergonomics & PWA Telemetry                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Epic 12: Multi-Well Comparison & Stratigraphic Correlation Workstation       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Epic 13: Interactive Dashboard Onboarding & Workflow Guidance                │
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

#### US-ING-03: Quota-Safe LocalStorage Session Persistence with Curve Downsampling
- **As a** Petrophysicist or Geologist (PER-1),
- **I want** my active LAS upload workspace to safely persist across page refreshes and browser tab navigation,
- **So that** I do not lose in-flight curve inventories or quality analysis results when switching views.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE2 / CE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Persisting large LAS file session in localStorage
    Given a parsed LAS file with >10,000 depth samples and curve data
    When the upload workspace serializes the session state to localStorage
    Then the system applies safe curve downsampling to prevent QuotaExceededError
    And when the page is reloaded, the workspace is restored with full curve inventories and anomalies
    And a notification confirms the session was successfully restored from storage
  ```

#### US-ING-04: Efficient IndexedDB Raw LAS Storage with Connection Lifecycle Management
- **As a** Petrophysicist (PER-1) or Subsurface Data Engineer (PER-2),
- **I want** the browser to store the active un-downsampled raw LAS text in IndexedDB without connection leaks or redundant multi-megabyte rewrites on UI state changes,
- **So that** memory footprint remains low and full-resolution cleaning runs reliably even on multi-thousand sample wells.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE1 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Storing un-downsampled raw LAS text efficiently
    Given an uploaded LAS file with complete raw text (~3.5 MB)
    When the raw text is received and parsed in the upload workspace
    Then the raw LAS text is persisted to IndexedDB ("wellqc_full_las") strictly on file/content change
    And every IndexedDB operation closes its database connection in a finally block to prevent connection accumulation
    And ordinary workspace state changes (anomalies, tabs, queue) do not re-write full text to IndexedDB
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

#### US-QCE-04: Accurate Sample Count Header Display for Database Wells
- **As a** Lead Petrophysicist (PER-1) or Geoscientist (PER-5),
- **I want** the Quality Engine header to display the true total point count (`pointCount`) for saved database wells rather than the downsampled visualization count,
- **So that** I immediately recognize the real depth resolution and size of the well log being examined.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 5 · SE1 / DA1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Loading a database well in the Quality Engine
    Given a saved well asset with 20,018 total depth samples in the database
    When I open the well in the Quality Engine workstation
    Then the workstation constructs the in-memory log using `detail.well.pointCount`
    And the header displays "Samples: 20,018" with thousand separators
    And falls back to received points length only if pointCount is missing or zero
  ```

#### US-QCE-05: Direct Quality Engine Repair Navigation for Saved Well Assets
- **As a** Petrophysicist inspecting a saved well log by ID (`/wells/[id]`) or from the Well Assets catalog (`/wells`),
- **I want** a dedicated "Fix in QA Engine" action button,
- **So that** I can seamlessly jump into the Quality Engine workstation with that specific database well pre-loaded and focused for anomaly remediation.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 6 · SE1 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Launching QA Engine from Well Detail page
    Given I am inspecting well "TUJA 1" on `/wells/<id>`
    When I click the "Fix in QA Engine" button in the header or petrophysical summary
    Then I am navigated to `/qa-engine?wellId=<id>`
    And the Quality Engine automatically selects the DATABASE_WELL source
    And loads all curve points and anomaly flags for "TUJA 1" ready for review and repair
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

#### US-VIW-03: Dynamic Multi-Curve Channel Selection & Custom Track Workstation
- **As a** Petrophysicist (PER-1) or Subsurface Data Engineer (PER-2),
- **I want to** select, filter, and render any curve channel available in the parsed LAS file via a toolbar dropdown selector, with quick presets, search filtering, and one-click track isolation,
- **So that** I am not restricted to fixed standard curves and can inspect any petrophysical, acoustic, or caliper logs in arbitrary combinations.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE1 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Selecting custom curves via toolbar dropdown
    Given a parsed LAS file with multiple logging channels (e.g. GR, RT, RHOB, NPHI, DT, CALI, SP, PEF)
    When I click the "Tracks" dropdown selector on the wireline toolbar
    Then I see checkboxes for all available curve channels with active/total count badges
    And I can search curves using the mnemonic filter input
    And clicking "Standard 3" activates GR, RT, and DT presets
    And clicking "Only" next to a curve isolates that single track immediately
    And each rendered track header provides an inline curve switcher and dismiss button
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

#### US-PAY-01: Freemium Usage Gate (3 Free Checks)
- **As a** Free Tier User (PER-5),
- **I want to** run 3 complete well log quality checks for free,
- **So that** I can evaluate the tool's power before purchasing a paid plan.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Gating free user on fourth check
    Given a user on the FREE tier with 3/3 checks used
    When the user attempts to upload a 4th LAS file for full evaluation
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

#### US-PAY-03: Context-Preserving Payment Verification Return Flow
- **As an** Upgrading Petrophysicist (PER-1, PER-5),
- **I want** my active well context (`targetWellId`) preserved through the Paystack checkout and verification journey,
- **So that** after completing payment I am immediately greeted with a personalized CTA to repair that exact well without re-searching the database.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE2 / UX1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Retaining well context through settlement
    Given I click a locked Pro repair action on Well "Akpo-04ST"
    When the Paystack Upgrade Modal opens and initializes checkout
    Then the callback URL carries `?wellId=<id>`
    And after settlement on `/payment/verify`, the card displays "Ready for Calibration: Akpo-04ST"
    And the primary CTA button reads 'Proceed to Repair "Akpo-04ST" →'
    And clicking it opens `/qa-engine?wellId=<id>` with that well's curves pre-loaded
  ```

#### US-PAY-04: Upfront Visual License Badging & Comprehensive Export / PDF Download Restriction
- **As an** Enterprise Product Manager (PER-3),
- **I want** Free tier users to see clear visual `PRO` badges and lock indicators on all advanced capabilities, and be strictly restricted from all file exports and PDF certificate downloads,
- **So that** commercial proprietary assets (NUPRC PDF certificates, cleaned LAS/CSV logs, correlation matrices, and spreadsheet CSVs) are protected and users are prompted to upgrade.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE2 / UX1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Restricting PDF downloads and all data exports for Free tier users
    Given a user authenticated on the Free tier
    When they navigate to `/reports`, `/comparison`, or inspect data tables
    Then Card 1 displays "Export PDF Certificate (PRO)" with a lock icon
    And Card 2 displays "PRO LICENSE REQUIRED" with a lock icon
    And the Cleaned LAS and PDF table columns show "PRO" badges
    And clicking "Print / Save PDF", "JSON", "Download Cleaned LAS", "Export Selected", "CSV Matrix", or "CSV" intercepts the download
    And opens the Paystack Upgrade Modal with targeted well context
  ```

#### US-PAY-05: User Billing History & Plan Management Portal
- **As a** Subsurface Asset Manager (PER-3),
- **I want** a dedicated Billing portal (`/pricing`) displaying my past transaction receipts, references, dates, and active plan status,
- **So that** accounting and audit reconciliations can be completed without contacting support.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 5 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Viewing transaction history
    Given an authenticated user on the `/pricing` page
    When the page loads
    Then the Billing History table displays all past Paystack references, dates, currency amounts, and settlement statuses
  ```

---

### 🔐 Epic 9: Multi-Tenant Asset Management & RBAC Security

#### US-AST-01: Centralized Well Assets Registry & Administrative Deletion Governance
- **As a** Subsurface Asset Manager or Systems Administrator (PER-3, PER-4),
- **I want** a dedicated Well Assets Registry (`/wells`) with real-time search, quality grade filtering, and administrative delete controls restricted to `ADMIN` users,
- **So that** fleet boreholes are safely curated without permitting regular users to delete files, game freemium quotas, or compromise regulatory audit trails.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE1 / UX1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Administrative deletion of well assets
    Given an authenticated user with role "ADMIN" on the `/wells` registry page
    When they select multiple wells and confirm deletion
    Then the selected wells and downstream curves/reports are deleted in an atomic transaction
    And an ActivityLog entry is permanently recorded

  Scenario: Non-admin deletion prevention
    Given an authenticated user with role "USER"
    When they view the `/wells` registry or `/upload` files catalog
    Then delete buttons and bulk selection checkboxes are hidden from the UI
    And any direct DELETE /api/wells/{id} or /api/wells/bulk-delete requests return 403 Forbidden
  ```

#### US-AST-02: Closed-Loop QA Engine Database Persistence
- **As a** Lead Petrophysicist (PER-1),
- **I want** an "Upload Cleaned Log to Database" action in Section 4 of the Quality Engine,
- **So that** my repaired and calibrated borehole curves are directly persisted back into the Well Assets database without requiring manual download and re-upload.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE1 / DA4
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Uploading calibrated log to database
    Given I have reviewed and applied anomaly repairs in `/qa-engine`
    When I click "Upload Cleaned Log to Database"
    Then the calibrated CWLS LAS 2.0 text is sent via POST /api/las
    And saved into PostgreSQL with `_CLEANED` suffix and updated quality grade
    And a celebratory success banner provides 1-click links to `/wells` and `/wells/[id]`
  ```

#### US-SEC-01: Role-Based Access Control (RBAC)
- **As a** Systems Administrator (PER-4),
- **I want** a clean binary authorization model separating security roles (`ADMIN` vs. `USER`) from domain professional titles (e.g., Petrophysicist, Geoscientist, Data Engineer in the user's `department`),
- **So that** administrative custody is strictly protected while subsurface professionals work cross-functionally without friction.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 2 · SE2 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Non-admin attempting administrative action
    Given a user authenticated with role "USER"
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

#### US-SEC-03: Server-Side Privileged Route Authorization & Default-to-Deny
- **As an** Enterprise Systems & Security Admin (PER-4),
- **I want** every privileged route, API endpoint, and administrative feature to enforce strict server-side authorization using the authenticated user's trusted database role,
- **So that** normal users cannot call administrative functions directly and self-registration cannot be exploited to gain elevated privileges.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE1 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Non-admin calling administrative endpoints directly
    Given a user authenticated with role "PETROPHYSICIST", "VIEWER", "DATA_ENGINEER", or "GEOSCIENTIST"
    When they send direct HTTP requests to GET, PATCH, or DELETE /api/admin/users
    Then the server returns 403 Forbidden ("Administrative privileges required")
    And unauthenticated callers receive 401 Unauthorized
    And public registration submitting role "ADMIN" is rejected with 403 Forbidden

  Scenario: Token spoofing for non-existent users
    Given a signed session token containing role "ADMIN" for an ID not present in the database
    When the request is evaluated by get_current_user
    Then the server returns 401 Unauthorized and does not auto-provision database records
  ```

#### US-SEC-04: Administrative Account Management CLI & Accidental Lockout Protection
- **As an** Enterprise Systems Administrator (PER-4),
- **I want** an interactive command-line tool to create and promote administrator accounts, with built-in safeguards preventing lockout of the last admin,
- **So that** elevated privileges can be managed safely without exposing public elevation endpoints.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · CE2 / SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Managing admin accounts via console CLI
    Given a system operator running python scripts/manage_admin.py
    When they select option to create or promote an admin account
    Then the script securely hashes the password and assigns role "ADMIN" in PostgreSQL
    And when an admin attempts to delete their own account or delete the only remaining admin in /api/admin/users
    Then the request is rejected with 400 Bad Request to prevent lockout
  ```

#### US-SEC-05: Quality Engine Cross-Tenant Saved Well Ownership Enforcement
- **As an** Enterprise Systems & Security Admin (PER-4),
- **I want** all Quality Engine execution endpoints (`/repair` and `/rank-gaps`) to enforce server-side ownership checks before resolving saved well data,
- **So that** unauthorized users cannot access, repair, or generate audit activity against well assets owned by another tenant.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · CE2 / SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Non-owner attempts to repair another tenant's saved well
    Given User Beta is signed in with standard PETROPHYSICIST role
    And User Alpha owns saved well "well-alpha-123"
    When User Beta sends POST /api/qa-engine/repair or POST /api/qa-engine/rank-gaps referencing "well-alpha-123"
    Then the server immediately stops with 403 Forbidden before reading raw text or curves
    And no activity log or cleaned data is returned to User Beta
    And when User Alpha or an Admin sends the same request, it succeeds with 200 OK
  ```

#### US-SEC-06: Administrator User Account Management & 1-Click Email Verification
- **As an** Enterprise Systems Administrator (PER-4),
- **I want** to manage user accounts, reset passwords, and trigger 1-click email verifications in `/admin`,
- **So that** I can assist onboarded geoscientists encountering email delivery friction or credentials issues.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 5 · SE1 / CE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: 1-click email verification by Administrator
    Given an administrator inspecting a user account with isEmailVerified == False
    When the administrator clicks "Verify Email" in the user inspector modal
    Then POST /api/admin/users/{user_id}/verify-email sets isEmailVerified = True
    And stamps emailVerifiedAt with the current UTC timestamp
    And the user status badge immediately updates to "VERIFIED"
  ```

#### US-AUT-01: Interactive Password Visibility Toggle on Authentication Form
- **As a** Platform User (PER-1, PER-2, PER-5),
- **I want** a toggle button inside password fields to reveal or hide typed characters,
- **So that** I can verify complex passwords before submitting without compromising accessibility or security.
- **Priority:** Should Have
- **Sprint / Owner:** Sprint 5 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Toggling password visibility
    Given I am on the Login or Registration form
    When I click the Eye icon inside the password field
    Then the input type changes from "password" to "text" and the icon changes to EyeOff
    And when clicked again, the input type reverts back to "password"
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

### 📱 Epic 11: Mobile Ergonomics & Progressive Web App (PWA) Telemetry

#### US-MOB-01: Responsive Hero Showcase & Dynamic Layout Stabilization
- **As a** Geoscientist or Petrophysicist accessing WellQC on a mobile device or tablet (PER-1, PER-2),
- **I want** the hero showcase slider to remain structurally stabilized without jumping or overflowing,
- **So that** I can seamlessly review workstation themes, swipe through slide previews, and tap controls without visual disruption.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 6 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Viewing hero slideshow on mobile viewports (< 640px)
    Given I navigate to the landing page on a mobile device
    When the hero section renders
    Then the variable-length mock browser URL bar is hidden on mobile to prevent layout shifts
    And the top display bezel maintains clean, stable macOS window controls and slide counter
    And the slide switcher provides smooth horizontal touch-scrolling with no-scrollbar styling
    And touch-swipe gestures (swipe left / swipe right) advance the slides
    And compact dot indicators display the active slide progression
  ```

#### US-PWA-01: False-Positive Resilient Offline Status Detection
- **As a** Field Petrophysicist using WellQC on mobile devices with variable cellular connections,
- **I want** the offline banner to trigger only when the network is genuinely unreachable,
- **So that** I am not greeted by false "Offline Mode Active" warnings caused by iOS WebKit `navigator.onLine` initialization quirks.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 6 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Initializing WellQC in iOS Safari / WebKit browsers
    Given a user loading WellQC over HTTPS on an iPhone or mobile browser
    When the PWA client hydrates
    Then `isOffline` defaults to false to prevent false-positive hydration warnings
    And if `navigator.onLine` reports false, a lightweight network probe confirms true offline status
    And the offline banner provides an explicit dismiss button (`X`)
    And returning online automatically clears the offline indicator
  ```

---

### 🔬 Epic 12: Multi-Well Comparison & Stratigraphic Correlation Workstation

#### US-CMP-01: Multi-Well Resampling & Depth Overlap Alignment
- **As a** Lead Petrophysicist or Asset Geoscientist (PER-1, PER-3),
- **I want** the comparison engine to compute common depth overlap and resample curve data to a uniform grid (0.5 ft step),
- **So that** wireline logs from different logging campaigns or vendors can be directly aligned and compared without sampling mismatches.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Comparing two offset wells with differing depth bounds and sampling rates
    Given Well A with depth range 5,000–10,500 ft (0.5 ft step) and Well B with 6,200–11,800 ft (0.25 ft step)
    When I submit a comparison request via `POST /api/wells/compare`
    Then the engine computes overlap span (6,200–10,500 ft) with total shared thickness of 4,300 ft
    And both wells are resampled onto an identical 0.5 ft uniform depth array
    And wells with zero depth overlap return `400 Bad Request` with an explanatory diagnostic message
  ```

#### US-CMP-02: Multi-Channel Pearson Correlation & Structural Lag Shift
- **As a** Subsurface Asset Petrophysicist (PER-1),
- **I want** automated channel-by-channel Pearson correlation coefficient ($r$), optimal structural lag shift ($\Delta z$), RMSD, and MAE across all shared wireline curves,
- **So that** I can quantify stratigraphic similarity, identify structural dip offsets, and detect faulting or facies changes between offset wells.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Computing cross-correlation and optimal depth shift
    Given resampled curve series for matching channels (e.g., GR, RHOB, NPHI, RT, DT)
    When correlation metrics are computed
    Then Pearson $r$, RMSD, and MAE are calculated for each common channel
    And optimal structural lag shift $\Delta z$ is determined via cross-correlation peak within ±150 ft
    And each curve receives a Stratigraphic Continuity Grade (`HIGH`, `MODERATE`, `LOW`, `DISCONTINUOUS`)
    And a composite match score (0–100%) and overall match grade (`EXCELLENT_MATCH`, `GOOD_MATCH`, `MODERATE_MATCH`, `POOR_MATCH`) are returned
  ```

#### US-CMP-03: Hybrid Formation Tops Alignment & Provenance Verification
- **As a** Petrophysicist or Regional Stratigrapher (PER-1, PER-2),
- **I want** regional formation markers (e.g., Benin, Agbada, Akata, or custom reservoir sand markers) stored in the database with verified interpreter provenance, accompanied by algorithmic baseline estimation fallbacks,
- **So that** our comparisons utilize verified geological ground truth whenever available while remaining completely functional on newly ingested wells without manual picks.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · DA1 & SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Inspecting and editing formation markers on compared wells
    Given two wells loaded into the comparison workstation
    When formation markers are retrieved
    Then verified picks stored in `FormationMarker` table are returned with badge `VERIFIED INTERPRETER PICK`
    And if no database picks exist, regional Niger Delta baseline markers are estimated from Gamma Ray trends and tagged `ALGORITHMIC ESTIMATION`
    And clicking "Edit Tops" opens an interactive modal allowing petrophysicists to edit top/bottom depths, update interpreter source (`VERIFIED`, `BIOSTRATIGRAPHY`, `CORE`, `SEISMIC`), or add custom sand markers
    And saving persists the verified markers to `POST /api/wells/{id}/markers` and updates the correlation canvas in real time
  ```

#### US-CMP-04: Interactive Multi-Well Workstation UI & Visual Overlays
- **As a** Subsurface Exploration Manager or Petrophysicist (PER-1, PER-3),
- **I want** a dedicated `/comparison` workstation with 4 interactive visual tabs (Correlation Matrix, SVG Resampled Overlaid Track with differential fill, Side-by-Side Dual Log Tracks, and Formation Markers Alignment),
- **So that** I can perform multi-well petrophysical correlation, review cross-well anomalies, and present structural findings to asset management.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Navigating and interacting with the Comparison Workstation
    Given I navigate to `/comparison` via the sidebar navigation link
    When I select Well A and Well B from the multi-well selector and click "Run Multi-Well Correlation"
    Then the Composite Correlation Match banner displays match percentage, grade badge, and overlap thickness
    And Tab 1 displays the channel correlation metrics matrix with Pearson $r$, lag shift, RMSD, and continuity badges
    And Tab 2 renders the synchronized SVG Overlaid Track with semi-transparent differential fill between curves
    And Tab 3 renders side-by-side wireline log tracks with synchronized depth scrolling
    And Tab 4 renders the Stratigraphic Markers Alignment comparison with thickness delta calculations and provenance badges
  ```

#### US-CMP-05: Multi-Well Comparison Gatekeeper & Free Tier License Restrictions
- **As a** Platform Operator or Commercial Strategist,
- **I want** the Multi-Well Petrophysical Comparison workstation (`/comparison`) gated behind a dedicated Pro license paywall,
- **So that** Free Tier users are restricted from computing multi-well stratigraphic alignments or exporting correlation matrices, while seeing an actionable upgrade CTA to WellQC Pro.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE2 / SE1
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Free Tier user navigates to /comparison
    Given a signed-in user on the "FREE" tier
    When they navigate to /comparison
    Then a paywall banner is displayed highlighting "Well Comparison Restricted" and "FREE TIER"
    And feature highlight cards showcase Pearson correlation analysis, structural lag shifts, and composite cross-track overlays
    And clicking "Upgrade to WellQC Pro" launches the Paystack checkout modal
    And in the sidebar navigation, "Well Comparison" displays a "PRO" badge
    And on the Well Dossier page (/wells/[id]), the "Compare Well" action button displays a lock icon and "PRO" pill, opening the upgrade modal upon click
  ```

---

### 🧭 Epic 13: Interactive Dashboard Onboarding & Workflow Guidance

#### US-DSB-01: Interactive Step-by-Step Dashboard Product Tour & Spotlight
- **As a** First-Time User or Exploring Petrophysicist (PER-1, PER-2),
- **I want** an interactive guided onboarding tour with a visual spotlight overlay and a non-intrusive welcome banner,
- **So that** I understand the platform architecture, KPI telemetry, quality trends, and quick-action navigation immediately upon logging in.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Running the onboarding tour on the Command Dashboard
    Given a user navigating to `/dashboard`
    When the user has not dismissed the welcome banner
    Then the "Welcome to WellQC Command Center" banner is displayed with a "Take 1-Min Tour" button
    And clicking "Take 1-Min Tour" or the permanent "Tour Guide" button in the global header launches the 6-step guided walkthrough
    And a darkened spotlight overlay focuses on the current target element with smooth auto-scrolling
    And an animated tooltip displays step descriptions, progress badge (e.g. "Step 2 of 6"), "Back", "Next", and "Exit Tour"
    And pressing the "Escape" key closes the tour and restores full interactivity
    And completing or exiting the tour persists dismissal to localStorage safely via React 19 useSyncExternalStore
  ```

#### US-NAV-01: Post-Auth Data Upload Routing & Streamlined Direct Flow
- **As an** Active Geoscientist or Petrophysicist (PER-1, PER-2),
- **I want** the application to automatically route me to the Data Upload workstation (`/upload`) immediately upon login, registration, or email verification,
- **So that** I can immediately drag and drop or audit well logs without having to manually navigate away from an initial overview dashboard.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Authenticated user routing
    Given an unauthenticated user logging in or creating an account
    When credentials pass validation and session tokens are set
    Then the system redirects the user directly to `/upload`
    And middleware enforces `/upload` as the default authenticated home view
  ```

#### US-ING-05: Zero-Click Instant Database Auto-Persistence on File Ingestion
- **As a** Subsurface Data Engineer (PER-2),
- **I want** uploaded LAS files to automatically save to the database upon drag-and-drop or file selection,
- **So that** I do not have to manually click "Upload to Database" or "Upload all to database" buttons for every file.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · SE1 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Dragging and dropping well files into the upload workspace
    Given a user on the `/upload` workstation
    When one or more LAS files are dropped into the dropzone or selected
    Then each file is immediately validated and committed to the backend database asynchronously
    And status updates to "Saved to Database ✓" without requiring manual button clicks
  ```

#### US-RPT-03: Real-Time Dynamic Audit Certificate Preview & Export for Selected Well Files
- **As a** Petrophysicist or Quality Auditor (PER-1, PER-4),
- **I want** the Certificate Preview modal and PDF print generator to display authentic data for whichever well file I select in the reports table,
- **So that** I can audit individual well assets with accurate UWI identifiers, depth bounds, and real anomaly records without placeholder dummy data.
- **Priority:** Must Have
- **Sprint / Owner:** Sprint 7 · DA4 / SE2
- **Acceptance Criteria:**
  ```gherkin
  Scenario: Selecting and previewing a well certificate in Audit Reports
    Given a user on `/reports` with multiple uploaded or database wells
    When the user clicks a row or checks a well asset in the table
    Then the top card updates to display the selected asset name, quality grade, and score
    And clicking "Preview Certificate" opens the certificate populated with that exact well's real metadata, depth range, and flagged anomalies
    And clicking "Download Cleaned LAS" downloads the certified CWLS LAS 2.0 file for that specific well
  ```

---

## 📊 4. Requirements Traceability Matrix (RTM)

| Story ID | Epic Title | MoSCoW | Sprint Target | Lead Owner | Primary Code Modules |
|---|---|---|---|---|---|
| **US-ING-01** | Multi-Version LAS Parsing | Must Have | Sprint 1 | SE1 | `backend/app/services/parser.py`, `src/lib/las/parser.ts` |
| **US-ING-02** | Corrupt LAS File Diagnostics | Must Have | Sprint 3 | SE1 | `backend/app/api/las.py`, `src/lib/las/parser.ts` |
| **US-ING-03** | Quota-Safe LocalStorage Persistence | Must Have | Sprint 5 | SE2 | `src/lib/las/storage-utils.ts`, `src/app/upload/` |
| **US-ING-04** | IndexedDB Lifecycle & Targeted Workspace Sync | Must Have | Sprint 6 | SE2 | `src/lib/las/full-text-store.ts`, `src/app/upload/page.tsx` |
| **US-STD-01** | Vendor Mnemonic Mapping | Must Have | Sprint 3 | DA1 | `backend/app/api/standardisation.py`, `standardiser.py` |
| **US-STD-02** | Persistent Custom Aliases | Should Have | Sprint 3 | DA1 | `backend/app/api/standardisation.py`, `/standardisation` |
| **US-QCE-01** | Composite Quality Scoring | Must Have | Sprint 3 | SE1 | `backend/app/services/quality_engine.py` |
| **US-QCE-02** | 11 Anomaly Category Audits | Must Have | Sprint 4 | DA1 | `backend/app/services/quality_engine.py`, `cleaner.py` |
| **US-QCE-03** | AI Natural Language Summary | Should Have | Sprint 3 | SE1 | `backend/app/api/wells.py`, `ai_analyzer.py` |
| **US-QCE-04** | Ground-Truth Sample Count Display | Must Have | Sprint 6 | SE1 | `src/app/qa-engine/page.tsx`, `backend/app/api/wells.py` |
| **US-QCE-05** | Direct Quality Engine Repair Navigation | Must Have | Sprint 6 | SE1 | `src/app/wells/[id]/page.tsx`, `src/app/qa-engine/page.tsx` |
| **US-IMP-01** | Root-Cause Classifications | Should Have | Sprint 4 | DA2 | `src/lib/las/imputation-engine.ts`, `backend/app/api/las.py` |
| **US-IMP-02** | Imputation Benchmarking | Should Have | Sprint 4 | DA2 | `imputation-benchmark-modal.tsx`, `imputation.py` |
| **US-VIW-01** | 3-Track Wireline Presentation | Must Have | Sprint 4 | SE1 | `src/components/well-log/log-viewer.tsx` |
| **US-VIW-02** | Interactive Anomaly Ribbon | Should Have | Sprint 4 | SE1 | `src/components/well-log/log-viewer.tsx` |
| **US-VIW-03** | Dynamic Multi-Curve Channel Selection | Must Have | Sprint 7 | SE1 / SE2 | `src/components/well-log/log-viewer.tsx` |
| **US-CLN-01** | Non-Destructive Raw Data | Must Have | Sprint 4 | CE2 | `src/lib/las/cleaner.ts`, `backend/app/api/las.py` |
| **US-CLN-02** | Before vs After Scorecard | Must Have | Sprint 4 | SE1 | `src/app/qa-engine/page.tsx`, `cleaner.py` |
| **US-RPT-01** | Executive PDF QA Certificate | Must Have | Sprint 5 | DA4 | `src/app/reports/page.tsx`, `src/lib/las/exporter.ts` |
| **US-RPT-02** | Cleaned LAS 2.0 Export | Must Have | Sprint 5 | SE1 | `src/lib/las/exporter.ts`, `backend/app/api/las.py` |
| **US-PAY-01** | Freemium Usage Gate (3 Checks) | Must Have | Sprint 5 | SE2 | `src/app/upload/page.tsx`, `backend/app/api/las.py` |
| **US-PAY-02** | Paystack Multi-Channel Checkout | Must Have | Sprint 5 | SE2 | `src/lib/paystack.ts`, `payment-modal.tsx`, `/pricing` |
| **US-SEC-01** | Role-Based Access Control (RBAC) | Must Have | Sprint 2 | SE2 | `backend/app/core/dependencies.py`, `/api/admin` |
| **US-SEC-02** | Multi-Tenant Data Isolation | Must Have | Sprint 2 | CE2 | `backend/app/api/wells.py`, `schema.prisma` |
| **US-SEC-03** | Server RBAC Default-to-Deny | Must Have | Sprint 5 | SE1 | `backend/app/core/dependencies.py`, `test_admin_auth.py` |
| **US-SEC-04** | Admin Management CLI & Lockout Protection | Must Have | Sprint 5 | CE2 | `scripts/manage_admin.py`, `backend/app/api/admin.py` |
| **US-SEC-05** | Quality Engine Cross-Tenant Authorization | Must Have | Sprint 6 | SE1 | `backend/app/api/qa_engine.py`, `test_object_authorization.py` |
| **US-AUT-01** | Password Visibility Toggle | Should Have | Sprint 5 | SE2 | `src/components/auth/auth-form.tsx` |
| **US-API-01** | Interactive Swagger Authorize | Must Have | Sprint 6 | SE2 | `backend/app/core/dependencies.py`, `backend/app/main.py` |
| **US-API-02** | Flexible Well Retrieval (ID/API) | Must Have | Sprint 6 | SE1 | `backend/app/api/wells.py` |
| **US-API-03** | Webhook HMAC-SHA512 Verification | Must Have | Sprint 5 | CE2 | `backend/app/api/auth.py` |
| **US-MOB-01** | Responsive Hero Showcase & Layout Stabilization | Must Have | Sprint 6 | SE2 | `src/components/landing/hero-section.tsx`, `globals.css` |
| **US-PWA-01** | False-Positive Resilient Offline Status Detection | Must Have | Sprint 6 | SE2 | `src/components/pwa/pwa-client.tsx` |
| **US-CMP-01** | Multi-Well Resampling & Depth Overlap Alignment | Must Have | Sprint 7 | SE1 | `backend/app/services/comparison.py`, `backend/app/api/wells.py` |
| **US-CMP-02** | Multi-Channel Pearson Correlation & Structural Lag Shift | Must Have | Sprint 7 | SE1 | `backend/app/services/comparison.py`, `src/app/comparison/` |
| **US-CMP-03** | Hybrid Formation Tops Alignment & Provenance Verification | Must Have | Sprint 7 | DA1 & SE1 | `backend/app/models/models.py`, `backend/app/api/wells.py`, `comparison/page.tsx` |
| **US-CMP-04** | Interactive Multi-Well Workstation UI & Visual Overlays | Must Have | Sprint 7 | SE2 | `src/app/comparison/page.tsx`, `src/components/ui/sidebar.tsx` |
| **US-CMP-05** | Multi-Well Comparison Gatekeeper & Free Tier Paywall | Must Have | Sprint 7 | SE2 / SE1 | `src/app/comparison/page.tsx`, `src/components/ui/sidebar.tsx`, `src/app/wells/[id]/page.tsx` |
| **US-DSB-01** | Interactive Dashboard Onboarding Tour Guide | Must Have | Sprint 7 | SE2 | `src/components/dashboard/dashboard-tour.tsx`, `src/components/ui/header.tsx` |
| **US-NAV-01** | Post-Auth Direct Data Upload Routing | Must Have | Sprint 7 | SE2 | `middleware.ts`, `src/components/auth/auth-form.tsx` |
| **US-ING-05** | Zero-Click Instant Database Auto-Persistence | Must Have | Sprint 7 | SE1 / SE2 | `src/app/upload/page.tsx`, `src/components/upload/` |
| **US-RPT-03** | Dynamic Selected File Audit Certificate & Cleaned Export | Must Have | Sprint 7 | DA4 / SE2 | `src/app/reports/page.tsx`, `audit-certificate-modal.tsx` |

---

*Document approved by WellQC Core Engineering & Petrophysical Analytics Working Group.*
