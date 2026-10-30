"""
Script to generate:
1. Documentations/wellqc_project_schedule.csv (Master MS Project / Excel CSV)
2. Documentations/wellqc_project_schedule.xml (Master MS Project XML MSPDI format)
Reflecting verified Sprint 1-7 implementations (100% completed), current project progress,
and upcoming Sprint 8-9 tasks through Nov 2026.
"""

import csv
import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

TASKS = [
    # Sprint 1: Discovery, Architecture & Core Stack
    {"id": 2, "level": 2, "name": "Sprint 1: Discovery, Architecture & Core Stack", "dur": "10d", "start": "2026-07-20", "finish": "2026-07-31", "pred": "", "res": "", "pct": "100%"},
    {"id": 3, "level": 3, "name": "Petrophysical Domain Modeling & Curve Physical Limits", "dur": "5d", "start": "2026-07-20", "finish": "2026-07-24", "pred": "", "res": "DA1, DA2", "pct": "100%"},
    {"id": 4, "level": 3, "name": "LAS 2.0 Parser Engine & Line Splitter Validation", "dur": "6d", "start": "2026-07-22", "finish": "2026-07-29", "pred": "3", "res": "SE1", "pct": "100%"},
    {"id": 5, "level": 3, "name": "Next.js 15 App Shell, Navigation & Design System", "dur": "7d", "start": "2026-07-20", "finish": "2026-07-28", "pred": "", "res": "SE2", "pct": "100%"},
    {"id": 6, "level": 3, "name": "Database Schema Design & Prisma Setup", "dur": "7d", "start": "2026-07-22", "finish": "2026-07-30", "pred": "3", "res": "CE2", "pct": "100%"},
    {"id": 7, "level": 3, "name": "CI/CD Pipeline Setup & Repository Governance", "dur": "5d", "start": "2026-07-20", "finish": "2026-07-25", "pred": "", "res": "CE1", "pct": "100%"},
    {"id": 8, "level": 3, "name": "Milestone: Core Architecture & Ingestion Proof-of-Concept", "dur": "0d", "start": "2026-07-31", "finish": "2026-07-31", "pred": "4,5,6,7", "res": "SE1, SE2, CE1, CE2", "pct": "100%"},

    # Sprint 2: Foundation, Auth & Multi-Tenant Database
    {"id": 9, "level": 2, "name": "Sprint 2: Foundation, Auth & Multi-Tenant Database", "dur": "10d", "start": "2026-08-03", "finish": "2026-08-14", "pred": "8", "res": "", "pct": "100%"},
    {"id": 10, "level": 3, "name": "Multi-Tenant PostgreSQL Architecture on Neon", "dur": "5d", "start": "2026-08-03", "finish": "2026-08-07", "pred": "8", "res": "CE2", "pct": "100%"},
    {"id": 11, "level": 3, "name": "Authentication Engine, Session Tokens & Scrypt Hashing", "dur": "5d", "start": "2026-08-05", "finish": "2026-08-11", "pred": "10", "res": "SE2, CE2", "pct": "100%"},
    {"id": 12, "level": 3, "name": "Mnemonic Dictionary & 14 Standard Curve Classifications", "dur": "5d", "start": "2026-08-03", "finish": "2026-08-07", "pred": "8", "res": "DA1", "pct": "100%"},
    {"id": 13, "level": 3, "name": "Wireline Curve Anomaly Classification & Root Cause Engine", "dur": "5d", "start": "2026-08-06", "finish": "2026-08-12", "pred": "12", "res": "DA2", "pct": "100%"},
    {"id": 14, "level": 3, "name": "File Upload UI with Drag-and-Drop & Pre-Validation", "dur": "5d", "start": "2026-08-07", "finish": "2026-08-13", "pred": "11", "res": "SE2", "pct": "100%"},
    {"id": 15, "level": 3, "name": "Vercel Preview Deployments & DB Migration Automation", "dur": "10d", "start": "2026-08-03", "finish": "2026-08-14", "pred": "8", "res": "CE1", "pct": "100%"},
    {"id": 16, "level": 3, "name": "Milestone: Authenticated Ingestion & Mnemonic Baseline", "dur": "0d", "start": "2026-08-14", "finish": "2026-08-14", "pred": "10,11,13,14,15", "res": "SE2, CE2, DA1", "pct": "100%"},

    # Sprint 3: Core Engine, Quality Scoring & Ingestion Workspace
    {"id": 17, "level": 2, "name": "Sprint 3: Core Engine, Quality Scoring & Ingestion Workspace", "dur": "10d", "start": "2026-08-17", "finish": "2026-08-28", "pred": "16", "res": "", "pct": "100%"},
    {"id": 18, "level": 3, "name": "Multi-Factor Quality Scoring Algorithm (Completeness/Integrity/Noise)", "dur": "5d", "start": "2026-08-17", "finish": "2026-08-21", "pred": "16", "res": "SE1, DA1", "pct": "100%"},
    {"id": 19, "level": 3, "name": "Upload Workspace Redesign & Modular Tabbed Layout", "dur": "5d", "start": "2026-08-18", "finish": "2026-08-24", "pred": "16", "res": "SE2", "pct": "100%"},
    {"id": 20, "level": 3, "name": "Subsurface Basin Analytics & KPI Dashboard Aggregations", "dur": "5d", "start": "2026-08-19", "finish": "2026-08-25", "pred": "18", "res": "DA3", "pct": "100%"},
    {"id": 21, "level": 3, "name": "Automated PDF Audit Report Generator", "dur": "5d", "start": "2026-08-21", "finish": "2026-08-27", "pred": "18", "res": "DA4", "pct": "100%"},
    {"id": 22, "level": 3, "name": "Atomic Transaction Ingestion Pipeline & Downsampling", "dur": "5d", "start": "2026-08-20", "finish": "2026-08-26", "pred": "18", "res": "CE2", "pct": "100%"},
    {"id": 23, "level": 3, "name": "Milestone: Complete Quality Scoring & PDF Audit Capability", "dur": "0d", "start": "2026-08-28", "finish": "2026-08-28", "pred": "18,19,20,21,22", "res": "SE1, SE2, DA1, DA4", "pct": "100%"},

    # Sprint 4: Advanced Visualisation, Imputation & Python Migration
    {"id": 24, "level": 2, "name": "Sprint 4: Advanced Visualisation, Imputation & Python Migration", "dur": "10d", "start": "2026-08-31", "finish": "2026-09-11", "pred": "23", "res": "", "pct": "100%"},
    {"id": 25, "level": 3, "name": "FastAPI Microservice Migration & Native NumPy/Pandas Stack", "dur": "6d", "start": "2026-08-31", "finish": "2026-09-07", "pred": "23", "res": "SE1, CE2", "pct": "100%"},
    {"id": 26, "level": 3, "name": "SVG Multi-Track Wireline Log Viewer with Depth Sync", "dur": "6d", "start": "2026-09-01", "finish": "2026-09-08", "pred": "23", "res": "SE2", "pct": "100%"},
    {"id": 27, "level": 3, "name": "Custom Mnemonic Aliases & Tenant Rule Management", "dur": "5d", "start": "2026-09-02", "finish": "2026-09-08", "pred": "25", "res": "DA1", "pct": "100%"},
    {"id": 28, "level": 3, "name": "Imputation Algorithm Benchmark (KNN, Spline, Random Forest, Gradient Boosting, Linear)", "dur": "5d", "start": "2026-09-03", "finish": "2026-09-09", "pred": "25", "res": "DA2", "pct": "100%"},
    {"id": 29, "level": 3, "name": "Zero-Mock Clean Seeder & Performance Load Testing", "dur": "5d", "start": "2026-09-04", "finish": "2026-09-10", "pred": "25", "res": "CE1, DA3", "pct": "100%"},
    {"id": 30, "level": 3, "name": "Milestone: Unified Python Backend & Interactive Log Viewer", "dur": "0d", "start": "2026-09-11", "finish": "2026-09-11", "pred": "25,26,27,28,29", "res": "SE1, SE2, CE2", "pct": "100%"},

    # Sprint 5: Security Hardening, Default-to-Deny RBAC & Admin Tools
    {"id": 31, "level": 2, "name": "Sprint 5: Security Hardening, Default-to-Deny RBAC & Admin Tools", "dur": "10d", "start": "2026-09-14", "finish": "2026-09-25", "pred": "30", "res": "", "pct": "100%"},
    {"id": 32, "level": 3, "name": "Server-Side RBAC Enforcement & Ghost Token Elimination", "dur": "5d", "start": "2026-09-14", "finish": "2026-09-18", "pred": "30", "res": "SE1, CE2", "pct": "100%"},
    {"id": 33, "level": 3, "name": "Self-Registration Role Escalation Block (403 on ADMIN role)", "dur": "4d", "start": "2026-09-16", "finish": "2026-09-21", "pred": "32", "res": "SE1", "pct": "100%"},
    {"id": 34, "level": 3, "name": "Interactive Admin Management CLI (`manage_admin.py`)", "dur": "4d", "start": "2026-09-17", "finish": "2026-09-22", "pred": "32", "res": "CE2", "pct": "100%"},
    {"id": 35, "level": 3, "name": "Admin Panel UI with Tabbed User Management & Tokens", "dur": "5d", "start": "2026-09-18", "finish": "2026-09-24", "pred": "33", "res": "SE2", "pct": "100%"},
    {"id": 36, "level": 3, "name": "Automated Security Test Suite (19 Tests in `test_admin_auth.py`)", "dur": "5d", "start": "2026-09-21", "finish": "2026-09-25", "pred": "33", "res": "DA4, CE1", "pct": "100%"},
    {"id": 37, "level": 3, "name": "Milestone: Default-to-Deny Security & Administrative Center", "dur": "0d", "start": "2026-09-25", "finish": "2026-09-25", "pred": "32,33,34,35,36", "res": "SE1, SE2, CE2", "pct": "100%"},

    # Sprint 6: Production Hardening & Quality Engine 12-Item Overhaul
    {"id": 38, "level": 2, "name": "Sprint 6: Production Hardening & Quality Engine 12-Item Overhaul", "dur": "10d", "start": "2026-09-28", "finish": "2026-10-09", "pred": "37", "res": "", "pct": "100%"},
    {"id": 39, "level": 3, "name": "Item 1-2: Per-Row Anomaly Approvals & Specific Method Routing", "dur": "5d", "start": "2026-09-28", "finish": "2026-10-02", "pred": "37", "res": "SE1, SE2", "pct": "100%"},
    {"id": 40, "level": 3, "name": "Item 3: AUTO Imputation Gap Ranking via Cross-Validation", "dur": "5d", "start": "2026-09-29", "finish": "2026-10-05", "pred": "39", "res": "DA2, SE1", "pct": "100%"},
    {"id": 41, "level": 3, "name": "Item 4: Impossible Values Action Suite (Remove / Clip / Delete Row)", "dur": "5d", "start": "2026-09-30", "finish": "2026-10-06", "pred": "39", "res": "DA1, SE1", "pct": "100%"},
    {"id": 42, "level": 3, "name": "Item 5: Long Null Cluster Guards & Unfillable Flag Boundaries", "dur": "4d", "start": "2026-10-01", "finish": "2026-10-06", "pred": "40", "res": "DA2, DA1", "pct": "100%"},
    {"id": 43, "level": 3, "name": "Item 6-7: Duplicate Depth Prune & 2-Point Neighbour Despiking", "dur": "4d", "start": "2026-10-02", "finish": "2026-10-07", "pred": "41", "res": "SE1", "pct": "100%"},
    {"id": 44, "level": 3, "name": "Item 8-9: Real Change Report Telemetry & Audit Certificate ID", "dur": "4d", "start": "2026-10-05", "finish": "2026-10-08", "pred": "42,43", "res": "DA4, SE1", "pct": "100%"},
    {"id": 45, "level": 3, "name": "Item 10-12: Staged Non-Destructive QA UI & Cleaned Export Suite", "dur": "5d", "start": "2026-10-05", "finish": "2026-10-09", "pred": "39", "res": "SE2", "pct": "100%"},
    {"id": 46, "level": 3, "name": "Sliding-Window IP Rate Limiter & Security Stabilization", "dur": "5d", "start": "2026-09-28", "finish": "2026-10-02", "pred": "37", "res": "CE2, CE1", "pct": "100%"},
    {"id": 47, "level": 3, "name": "Milestone: Certified Quality Engine Overhaul & Audit Pipeline", "dur": "0d", "start": "2026-10-09", "finish": "2026-10-09", "pred": "39,40,41,42,43,44,45,46", "res": "SE1, SE2, DA1, DA2, DA4", "pct": "100%"},

    # Sprint 7: Multi-Well Comparison, Dynamic Workstation & UX Enhancements [COMPLETED]
    {"id": 48, "level": 2, "name": "Sprint 7: Multi-Well Comparison, Dynamic Workstation & UX Enhancements", "dur": "14d", "start": "2026-10-12", "finish": "2026-10-29", "pred": "47", "res": "", "pct": "100%"},
    {"id": 49, "level": 3, "name": "Multi-Well Depth Alignment & Stratigraphic Correlation Engine (SE1)", "dur": "5d", "start": "2026-10-12", "finish": "2026-10-16", "pred": "47", "res": "SE1", "pct": "100%"},
    {"id": 50, "level": 3, "name": "Cross-Well Workstation UI & Interactive SVG Overlaid Track (SE2)", "dur": "5d", "start": "2026-10-13", "finish": "2026-10-19", "pred": "49", "res": "SE2", "pct": "100%"},
    {"id": 51, "level": 3, "name": "Stratigraphic Continuity Grading & Depth Shift Mathematics (SE1, DA2)", "dur": "4d", "start": "2026-10-15", "finish": "2026-10-20", "pred": "49", "res": "SE1, DA2", "pct": "100%"},
    {"id": 52, "level": 3, "name": "NUPRC Compliance Report Template & Digital Signatures (SE2, DA4)", "dur": "5d", "start": "2026-10-14", "finish": "2026-10-20", "pred": "47", "res": "SE2, DA4", "pct": "100%"},
    {"id": 53, "level": 3, "name": "Niger Delta Formation Cutoffs & Hybrid Markers DB Schema (DA1, CE2)", "dur": "5d", "start": "2026-10-12", "finish": "2026-10-16", "pred": "47", "res": "DA1, CE2", "pct": "100%"},
    {"id": 54, "level": 3, "name": "Petrophysical Anomaly Benchmark Validation & Test Log Curation (DA3, DA4)", "dur": "5d", "start": "2026-10-13", "finish": "2026-10-19", "pred": "53", "res": "DA3, DA4", "pct": "100%"},
    {"id": 55, "level": 3, "name": "Multi-File Batch Queue & Progress Ingestion UI (CE1, SE2)", "dur": "6d", "start": "2026-10-14", "finish": "2026-10-21", "pred": "47", "res": "CE1, SE2", "pct": "100%"},
    {"id": 56, "level": 3, "name": "Enterprise Webhook Management Engine & Admin Integration (CE2)", "dur": "6d", "start": "2026-10-15", "finish": "2026-10-22", "pred": "47", "res": "CE2", "pct": "100%"},
    {"id": 57, "level": 3, "name": "Dynamic Multi-Curve Wireline Log Viewer & Channel Selector (SE1, SE2)", "dur": "5d", "start": "2026-10-20", "finish": "2026-10-26", "pred": "50", "res": "SE1, SE2", "pct": "100%"},
    {"id": 58, "level": 3, "name": "Interactive Dashboard Onboarding Tour Guide & Spotlight Walkthrough (SE2)", "dur": "4d", "start": "2026-10-22", "finish": "2026-10-27", "pred": "50", "res": "SE2", "pct": "100%"},
    {"id": 59, "level": 3, "name": "Subsurface Basin Analytics Engine & Real-Time Visualization API (DA3, SE2)", "dur": "4d", "start": "2026-10-23", "finish": "2026-10-28", "pred": "54", "res": "DA3, SE2", "pct": "100%"},
    {"id": 60, "level": 3, "name": "End-to-End System Test Suite (93 Pytest + 38 Jest Passing) (All)", "dur": "5d", "start": "2026-10-24", "finish": "2026-10-29", "pred": "57,58,59", "res": "SE1, SE2, CE1, CE2, DA1, DA2, DA3, DA4", "pct": "100%"},
    {"id": 61, "level": 3, "name": "Milestone: Multi-Well Platform, Dynamic Workstation & Core Feature Complete", "dur": "0d", "start": "2026-10-29", "finish": "2026-10-29", "pred": "60", "res": "SE1, SE2, CE1, CE2, DA1, DA2, DA3, DA4", "pct": "100%"},

    # Sprint 8: Production Deployment, NUPRC Operator Pilot & Cloud Scale [UPCOMING]
    {"id": 62, "level": 2, "name": "Sprint 8: Production Deployment, NUPRC Operator Pilot & Cloud Scale", "dur": "10d", "start": "2026-11-02", "finish": "2026-11-13", "pred": "61", "res": "", "pct": "0%"},
    {"id": 63, "level": 3, "name": "Multi-Region Cloud Deployment & Kubernetes Orchestration (CE1)", "dur": "5d", "start": "2026-11-02", "finish": "2026-11-06", "pred": "61", "res": "CE1", "pct": "0%"},
    {"id": 64, "level": 3, "name": "Live NUPRC Operator Pilot Program & Formal Submission Validation (DA4, SE2)", "dur": "6d", "start": "2026-11-03", "finish": "2026-11-10", "pred": "61", "res": "DA4, SE2", "pct": "0%"},
    {"id": 65, "level": 3, "name": "Real-Time Wellsite Telemetry Streaming Ingestion (WITSML / OPC-UA) (SE1, CE2)", "dur": "6d", "start": "2026-11-04", "finish": "2026-11-11", "pred": "63", "res": "SE1, CE2", "pct": "0%"},
    {"id": 66, "level": 3, "name": "Unsupervised ML Lithology Clustering on GR-RHOB-NPHI (SE1, DA2)", "dur": "5d", "start": "2026-11-04", "finish": "2026-11-09", "pred": "61", "res": "SE1, DA2", "pct": "0%"},
    {"id": 67, "level": 3, "name": "Advanced Reservoir Rock Physics Module (Sw, Permeability, Net-to-Gross) (DA1, DA2)", "dur": "5d", "start": "2026-11-05", "finish": "2026-11-11", "pred": "61", "res": "DA1, DA2", "pct": "0%"},
    {"id": 68, "level": 3, "name": "Asynchronous Background Ingestion Task Workers & Cloud Queue (CE1, CE2)", "dur": "5d", "start": "2026-11-05", "finish": "2026-11-11", "pred": "63", "res": "CE1, CE2", "pct": "0%"},
    {"id": 69, "level": 3, "name": "Outbound Webhook Cloud Storage Automated Sync Dispatcher (CE2)", "dur": "5d", "start": "2026-11-06", "finish": "2026-11-12", "pred": "63", "res": "CE2", "pct": "0%"},
    {"id": 70, "level": 3, "name": "Curated In-App Demonstration Well Package for Operator Pilot (DA3)", "dur": "4d", "start": "2026-11-06", "finish": "2026-11-11", "pred": "64", "res": "DA3", "pct": "0%"},
    {"id": 71, "level": 3, "name": "Enterprise SSO Integration (SAML 2.0 / Azure AD / Okta) & Audit Logs (CE2, SE2)", "dur": "5d", "start": "2026-11-09", "finish": "2026-11-13", "pred": "63", "res": "CE2, SE2", "pct": "0%"},
    {"id": 72, "level": 3, "name": "Milestone: Production Release & NUPRC Pilot Sign-off (All)", "dur": "0d", "start": "2026-11-13", "finish": "2026-11-13", "pred": "63,64,65,66,67,68,69,70,71", "res": "SE1, SE2, CE1, CE2, DA1, DA2, DA3, DA4", "pct": "0%"},

    # Sprint 9: Enterprise Scale, Real-Time Analytics & Hypercare Operational Handoff [UPCOMING]
    {"id": 73, "level": 2, "name": "Sprint 9: Enterprise Scale, Real-Time Analytics & Hypercare Operational Handoff", "dur": "10d", "start": "2026-11-16", "finish": "2026-11-27", "pred": "72", "res": "", "pct": "0%"},
    {"id": 74, "level": 3, "name": "High-Availability Multi-AZ Database Clustering & Disaster Recovery (CE2)", "dur": "5d", "start": "2026-11-16", "finish": "2026-11-20", "pred": "72", "res": "CE2", "pct": "0%"},
    {"id": 75, "level": 3, "name": "Automated Periodic AI Model Drift Detection & Petrophysical Re-calibration (SE1, DA2)", "dur": "5d", "start": "2026-11-17", "finish": "2026-11-23", "pred": "72", "res": "SE1, DA2", "pct": "0%"},
    {"id": 76, "level": 3, "name": "24/7 SLI/SLO Telemetry Observability, Prometheus Metrics & Alerting (CE1)", "dur": "5d", "start": "2026-11-18", "finish": "2026-11-24", "pred": "74", "res": "CE1", "pct": "0%"},
    {"id": 77, "level": 3, "name": "Enterprise User Training Portal, API Knowledge Base & Interactive Video Guides (DA3, DA4, SE2)", "dur": "6d", "start": "2026-11-19", "finish": "2026-11-26", "pred": "72", "res": "DA3, DA4, SE2", "pct": "0%"},
    {"id": 78, "level": 3, "name": "Client Acceptance Review & Regulatory Compliance Handoff (DA4, CE2)", "dur": "5d", "start": "2026-11-23", "finish": "2026-11-27", "pred": "76,77", "res": "DA4, CE2", "pct": "0%"},
    {"id": 79, "level": 3, "name": "Milestone: Enterprise General Availability (GA) & Steady-State SLAs (All)", "dur": "0d", "start": "2026-11-27", "finish": "2026-11-27", "pred": "74,75,76,77,78", "res": "SE1, SE2, CE1, CE2, DA1, DA2, DA3, DA4", "pct": "0%"}
]

def generate_csv():
    csv_path = "Documentations/wellqc_project_schedule.csv"
    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["ID", "Outline_Level", "Task_Name", "Duration", "Start_Date", "Finish_Date", "Predecessors", "Resource_Names", "Percent_Complete"])
        # Overall Project Task
        writer.writerow([1, 1, "WellQC Platform Development", "90d", "2026-07-20", "2026-11-27", "", "", "78%"])
        for t in TASKS:
            writer.writerow([t["id"], t["level"], t["name"], t["dur"], t["start"], t["finish"], t["pred"], t["res"], t["pct"]])
    print(f"Generated {csv_path} with {len(TASKS) + 1} tasks.")

def generate_xml():
    xml_path = "Documentations/wellqc_project_schedule.xml"
    project = ET.Element("Project", xmlns="http://schemas.microsoft.com/project")
    ET.SubElement(project, "Name").text = "WellQC Platform Development Plan"
    ET.SubElement(project, "Title").text = "WellQC Subsurface Log QA Schedule"
    ET.SubElement(project, "Company").text = "NDI-G5 WellQC Team"
    ET.SubElement(project, "StartDate").text = "2026-07-20T08:00:00"
    ET.SubElement(project, "FinishDate").text = "2026-11-27T17:00:00"
    ET.SubElement(project, "ScheduleFromStart").text = "1"

    calendars = ET.SubElement(project, "Calendars")
    cal = ET.SubElement(calendars, "Calendar")
    ET.SubElement(cal, "UID").text = "1"
    ET.SubElement(cal, "Name").text = "Standard"
    ET.SubElement(cal, "IsBaseCalendar").text = "1"

    tasks_el = ET.SubElement(project, "Tasks")

    # Overall project summary task
    t_root = ET.SubElement(tasks_el, "Task")
    ET.SubElement(t_root, "UID").text = "1"
    ET.SubElement(t_root, "ID").text = "1"
    ET.SubElement(t_root, "Name").text = "WellQC Platform Development"
    ET.SubElement(t_root, "OutlineLevel").text = "1"
    ET.SubElement(t_root, "Start").text = "2026-07-20T08:00:00"
    ET.SubElement(t_root, "Finish").text = "2026-11-27T17:00:00"
    ET.SubElement(t_root, "Duration").text = "PT720H0M0S"
    ET.SubElement(t_root, "PercentComplete").text = "78"
    ET.SubElement(t_root, "Summary").text = "1"

    for t in TASKS:
        t_el = ET.SubElement(tasks_el, "Task")
        ET.SubElement(t_el, "UID").text = str(t["id"])
        ET.SubElement(t_el, "ID").text = str(t["id"])
        ET.SubElement(t_el, "Name").text = t["name"]
        ET.SubElement(t_el, "OutlineLevel").text = str(t["level"])
        ET.SubElement(t_el, "Start").text = f"{t['start']}T08:00:00"
        ET.SubElement(t_el, "Finish").text = f"{t['finish']}T17:00:00"
        dur_days = int(t["dur"].replace("d", ""))
        ET.SubElement(t_el, "Duration").text = f"PT{dur_days * 8}H0M0S"
        ET.SubElement(t_el, "PercentComplete").text = t["pct"].replace("%", "")
        ET.SubElement(t_el, "Summary").text = "1" if t["level"] == 2 else "0"
        ET.SubElement(t_el, "Milestone").text = "1" if dur_days == 0 else "0"
        if t["pred"]:
            for p in t["pred"].split(","):
                pl = ET.SubElement(t_el, "PredecessorLink")
                ET.SubElement(pl, "PredecessorUID").text = p.strip()
                ET.SubElement(pl, "Type").text = "1" # Finish-to-Start

    xml_str = ET.tostring(project, encoding="utf-8")
    dom = minidom.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent="  ")

    with open(xml_path, mode="w", encoding="utf-8") as f:
        f.write(pretty_xml)
    print(f"Generated {xml_path} with {len(TASKS) + 1} tasks.")

if __name__ == "__main__":
    generate_csv()
    generate_xml()
