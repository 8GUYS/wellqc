"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  Activity,
  Layers,
  Wrench,
  ShieldCheck,
  Database,
  CreditCard,
  GitCompare,
  Play,
  RotateCcw,
  Check,
  ChevronDown,
} from "lucide-react";

export interface TourStep {
  id: string;
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  highlights?: string[];
  actionLink?: {
    href: string;
    label: string;
  };
  tips?: string;
  preferredPlacement?: "bottom" | "top" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to WellQC Studio",
    badge: "Getting Started",
    icon: <Sparkles className="w-5 h-5 text-cyan-400" />,
    description:
      "WellQC Studio is an enterprise petrophysical quality assurance and compliance platform. Standardise vendor mnemonics, detect sensor anomalies, apply non-destructive repairs, correlate offset wells, and generate NUPRC-compliant digital certificates.",
    highlights: [
      "API RP 66 Mnemonic Standardisation",
      "Physics-based Anomaly & Sensor Fault Detection",
      "Non-Destructive Spline & KNN Null Imputation",
      "Form WQC-08-A NUPRC Compliance Digital Certificates",
    ],
    tips: "Explore the interactive simulator below or use Left (←) and Right (→) arrow keys to navigate. On mobile, swipe left or right.",
    preferredPlacement: "center",
  },
  {
    id: "data-management",
    title: "1. Data Management & LAS Ingestion",
    badge: "Module 1: Ingestion",
    icon: <UploadCloud className="w-5 h-5 text-cyan-400" />,
    description:
      "Drag-and-drop raw LAS 2.0 or 3.0 well files into your workstation. The parser automatically validates section syntax (~VERSION, ~WELL, ~CURVE, ~ASCII), verifies depth increments, and immediately saves verified assets into your secure local database.",
    highlights: [
      "Frictionless Drag & Drop or File Browser Ingestion",
      "Real-time Syntax, Header & Null Value Verification",
      "Database Wells Registry with Direct QA Repair Shortcuts",
    ],
    actionLink: {
      href: "/upload",
      label: "Open Ingestion Workstation",
    },
    tips: "Test the simulated LAS parser below to see instant syntax validation in action.",
    preferredPlacement: "center",
  },
  {
    id: "well-assets",
    title: "2. Subsurface Well Assets Registry",
    badge: "Module 2: Asset Governance",
    icon: <Database className="w-5 h-5 text-cyan-400" />,
    description:
      "Centralised repository for your entire portfolio of subsurface well logs. Inspect individual well dossiers with deep curve telemetry, filter by field, operator, or quality score, and compare multi-well stratigraphy across your basin.",
    highlights: [
      "Central Multi-Tenant PostgreSQL Asset Repository",
      "Instant Quality Grading (Excellent, Good, Poor, Critical)",
      "Comprehensive Well Dossiers with AI Summaries & Specs",
      "Direct Shortcuts to Standardisation, QA Engine & Comparison",
    ],
    actionLink: {
      href: "/wells",
      label: "Explore Well Assets Registry",
    },
    tips: "Every cleaned well log can be uploaded directly from the Quality Engine to appear permanently in this registry.",
    preferredPlacement: "center",
  },
  {
    id: "wireline-viewer",
    title: "3. Calibrated Wireline Log Viewer & Telemetry",
    badge: "Module 3: Visualisation",
    icon: <Activity className="w-5 h-5 text-cyan-400" />,
    description:
      "Inspect high-resolution multi-track wireline curves in calibrated Classic Paper Log view. Interactive depth crosshairs display instantaneous depth, curve readings, and engineering units in real time.",
    highlights: [
      "Calibrated Log Plot, Data Table & Split View Layouts",
      "Interactive Depth Crosshairs with Instantaneous Readings",
      "Selective Multi-Track Display with One-Click Curve Selection",
    ],
    tips: "Drag the interactive depth slider below to inspect instantaneous wireline telemetry.",
    preferredPlacement: "center",
  },
  {
    id: "mnemonic-standardisation",
    title: "4. Mnemonic Standardisation Engine",
    badge: "Module 4: Normalisation",
    icon: <Layers className="w-5 h-5 text-cyan-400" />,
    description:
      "Harmonise disparate oilfield service vendor curve mnemonics (e.g., Schlumberger, Baker Hughes, Halliburton) to API RP 66 standard classes. Detect unrecognised aliases and map them with 1-click confidence into canonical petrophysical curves.",
    highlights: [
      "Automated Mapping to API RP 66 Industry Standard",
      "Vendor Alias Normalisation (e.g. GR_EDTC → GR, ILD → RES)",
      "Bulk Normalisation for Harmonised Basin Analytics",
    ],
    actionLink: {
      href: "/standardisation",
      label: "Open Standardisation Engine",
    },
    tips: "Standardising curve names ensures your automated petrophysical scripts and ML models run reliably across all wells.",
    preferredPlacement: "center",
  },
  {
    id: "qa-engine",
    title: "5. Quality Engine & Non-Destructive Repair",
    badge: "Module 5: Remediation",
    icon: <Wrench className="w-5 h-5 text-cyan-400" />,
    description:
      "Remediate data quality faults through an interactive 4-step workflow: Review flagged anomalies, select recommended fixes via the toggleable Suggested Fixes menu (Despiking, Outlier Clipping, Spline/KNN Null Imputation), preview before/after curves, and upload clean logs directly to the database.",
    highlights: [
      "Step 1: Automated Physical Bounds & Spike Diagnostics",
      "Step 2: Toggleable Suggested Fixes Dropdown Menu",
      "Step 3: Interactive Before vs After Diff Preview",
      "Step 4: 1-Click Upload Cleaned Log to Database & LAS/CSV Export",
    ],
    actionLink: {
      href: "/qa-engine",
      label: "Launch Quality Engine",
    },
    tips: "Click 'Run Repair Simulation' below to see despiking and null gap reconstruction in real-time.",
    preferredPlacement: "center",
  },
  {
    id: "well-comparison",
    title: "6. Multi-Well Correlation & Lag Shift",
    badge: "Module 6: Cross-Well",
    icon: <GitCompare className="w-5 h-5 text-cyan-400" />,
    description:
      "Cross-correlate target and offset wells across shared formation intervals. Compute Pearson correlation coefficients ($r$), search for optimal structural lag depth shifts ($\Delta z$), and inspect differential overlaid log tracks.",
    highlights: [
      "Pairwise Pearson Cross-Correlation Matrix",
      "Automated Structural Dip Lag Shifts (±50m Search Window)",
      "Composite Differential Overlays & Dual-Track Inspection",
    ],
    actionLink: {
      href: "/comparison",
      label: "Open Comparison Workstation",
    },
    tips: "Use the lag depth slider below to align offset logs and maximize stratigraphic correlation.",
    preferredPlacement: "center",
  },
  {
    id: "compliance-reports",
    title: "7. NUPRC Compliance & Digital Certificates",
    badge: "Module 7: Governance",
    icon: <ShieldCheck className="w-5 h-5 text-cyan-400" />,
    description:
      "Generate official Form WQC-08-A digital certificates conforming to Nigerian Upstream Petroleum Regulatory Commission (NUPRC) and Petroleum Industry Act (PIA 2021) guidelines. Every certificate incorporates cryptographic SHA-256 signatures for tamper-proof submission.",
    highlights: [
      "Official Form WQC-08-A Regulatory Certificate Format",
      "Cryptographic SHA-256 Hash Verification Stamp",
      "Comprehensive Pass/Fail Audit Logs & One-Click PDF Export",
    ],
    actionLink: {
      href: "/reports",
      label: "View Compliance Reports",
    },
    tips: "Certificates can be shared directly with regulators and verified against the unique digital validation signature.",
    preferredPlacement: "center",
  },
  {
    id: "billing-plans",
    title: "8. Enterprise Licensing & Billing",
    badge: "Module 8: Plans & Pricing",
    icon: <CreditCard className="w-5 h-5 text-cyan-400" />,
    description:
      "Transparent licensing tailored for independent geoscientists, consultancies, and operators. Review your active subscription tier (Free, Pro, Enterprise), unlock uncapped ML anomaly repairs, and audit historical Paystack transactions.",
    highlights: [
      "Instant Paystack Settlement in NGN (₦) and USD ($)",
      "Uncapped Machine Learning Imputation & Interpretation-Ready Exports",
      "Complete Billing History & Transaction Reference Audit Trail",
    ],
    actionLink: {
      href: "/pricing",
      label: "View Billing & Plans",
    },
    tips: "Toggle between Free Starter and WellQC Pro below to review plan capabilities.",
    preferredPlacement: "center",
  },
  {
    id: "completed",
    title: "You're Ready to Use WellQC Studio!",
    badge: "Tour Complete",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    description:
      "You now know your way around WellQC Studio. You can relaunch this guide anytime by clicking the 'Tour Guide' button in the top navigation bar. Jump directly into any workspace below:",
    highlights: [
      "Data Ingestion Workstation: /upload",
      "Well Assets Registry: /wells",
      "Mnemonic Normalisation: /standardisation",
      "Quality Engine Remediation: /qa-engine",
      "Multi-Well Comparison: /comparison",
      "Compliance Certificates: /reports",
    ],
    preferredPlacement: "center",
  },
];

const TOUR_STORAGE_KEY = "wellqc_studio_tour_completed_v3";

function subscribeToTourStorage(callback: () => void) {
  if (typeof window === "undefined") return () => { };
  window.addEventListener("storage", callback);
  window.addEventListener("wellqc_tour_updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("wellqc_tour_updated", callback);
  };
}

function getTourStorageSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return Boolean(localStorage.getItem(TOUR_STORAGE_KEY));
  } catch {
    return false;
  }
}

function getTourStorageServerSnapshot(): boolean {
  return true;
}

export function useIsTourCompleted(): boolean {
  return useSyncExternalStore(
    subscribeToTourStorage,
    getTourStorageSnapshot,
    getTourStorageServerSnapshot
  );
}

export interface DashboardTourProps {
  isOpen: boolean;
  onClose: () => void;
  onStart?: () => void;
}

export function DashboardTour({ isOpen, onClose }: DashboardTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Touch gesture state for mobile swiping
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Reset to first step whenever reopened
  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      Promise.resolve().then(() => {
        if (!ignore) setCurrentStepIndex(0);
      });
    }
    return () => { ignore = true; };
  }, [isOpen]);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      window.dispatchEvent(new Event("wellqc_tour_updated"));
    } catch { }
    onClose();
  }, [onClose]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      window.dispatchEvent(new Event("wellqc_tour_updated"));
    } catch { }
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [isLastStep, handleComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isFirstStep]);

  // Touch gesture listeners for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold: 45px
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss();
      } else if (e.key === "ArrowRight") {
        if (!isLastStep) {
          e.preventDefault();
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          e.preventDefault();
          handleComplete();
        }
      } else if (e.key === "ArrowLeft") {
        if (!isFirstStep) {
          e.preventDefault();
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFirstStep, isLastStep, handleDismiss, handleComplete]);

  if (!isOpen) return null;

  const progressPercentage = Math.round(((currentStepIndex + 1) / TOUR_STEPS.length) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto font-sans select-none pointer-events-auto flex items-center justify-center p-3 sm:p-4"
    >
      {/* Dark backdrop with blur */}
      <div
        onClick={handleDismiss}
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Floating Tour Guide Dialog Card */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl z-[60] overflow-hidden text-slate-100 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 my-auto flex flex-col"
      >
        {/* Animated Linear Progress Bar */}
        <div className="h-1.5 w-full bg-slate-800/80 overflow-hidden shrink-0">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Top Header Strip (Sticky) */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-cyan-950/50 via-slate-900 to-slate-900 border-b border-slate-800/90 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
              {currentStep.icon || <Compass className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-400 truncate">
                  {currentStep.badge || "WellQC Studio"}
                </span>
                <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-mono">
                  {progressPercentage}%
                </span>
              </div>
              {/* Step Jump Dropdown for Fast Access */}
              <div className="relative inline-flex items-center mt-0.5">
                <select
                  value={currentStepIndex}
                  onChange={(e) => setCurrentStepIndex(Number(e.target.value))}
                  className="bg-transparent text-xs font-mono text-slate-300 font-bold pr-5 cursor-pointer appearance-none focus:outline-none hover:text-white"
                  title="Jump to step"
                >
                  {TOUR_STEPS.map((s, idx) => (
                    <option key={s.id} value={idx} className="bg-slate-900 text-slate-200">
                      Step {idx + 1} of {TOUR_STEPS.length}: {s.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-cyan-400 absolute right-0 pointer-events-none" />
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Exit Tour (Esc)"
            aria-label="Exit Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body (Scrollable with Momentum Touch) */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-1.5">
              {currentStep.description}
            </p>
          </div>

          {/* DYNAMIC INTERACTIVE SIMULATOR PER STEP */}
          <InteractiveTourSimulator
            stepId={currentStep.id}
            onCompleteAction={handleComplete}
          />

          {/* Key Feature Highlights */}
          {currentStep.highlights && currentStep.highlights.length > 0 && (
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Key Capabilities:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {currentStep.highlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-2 text-[11px] font-mono text-slate-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="truncate">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Workspace Action Link */}
          {currentStep.actionLink && (
            <div className="pt-0.5">
              <Link
                href={currentStep.actionLink.href}
                onClick={handleComplete}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-bold transition-all group"
              >
                <span>{currentStep.actionLink.label}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}

          {/* Helpful Tips */}
          {currentStep.tips && (
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 font-mono flex items-start space-x-2">
              <span className="font-bold shrink-0">💡 Tip:</span>
              <span className="leading-snug">{currentStep.tips}</span>
            </div>
          )}

          {/* Swipe indicator hint for touch screens */}
          <div className="sm:hidden text-center text-[10px] text-slate-500 font-mono pt-1">
            ⇄ Swipe left or right to switch modules
          </div>
        </div>

        {/* Navigation Controls Footer (Sticky) */}
        <div className="p-3.5 sm:p-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-between shrink-0">
          {/* Keyboard Hotkeys Legend (Desktop Only) */}
          <div className="hidden sm:flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">Esc</kbd>
              <span>Exit</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">←</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">→</kbd>
              <span>Navigate</span>
            </span>
          </div>

          {/* Progress Indicator: Segmented Dots on Desktop, Compact on Mobile */}
          <div className="flex items-center space-x-1">
            <span className="sm:hidden text-[10px] font-mono text-slate-400 font-bold">
              {currentStepIndex + 1}/{TOUR_STEPS.length}
            </span>
            <div className="hidden sm:flex items-center space-x-1.5">
              {TOUR_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-2 rounded-full transition-all ${idx === currentStepIndex
                    ? "w-5 bg-cyan-400"
                    : idx < currentStepIndex
                      ? "w-2 bg-cyan-700"
                      : "w-2 bg-slate-700 hover:bg-slate-600"
                    }`}
                  title={`Step ${idx + 1}: ${step.title}`}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 sm:py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-mono font-bold transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 sm:py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-mono font-extrabold text-xs transition-all shadow-md flex items-center space-x-1 active:scale-95 cursor-pointer"
            >
              <span>{isLastStep ? "Finish" : isFirstStep ? "Start Tour" : "Next"}</span>
              {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Backward-compatible alias
export const WorkstationTour = DashboardTour;

/**
 * Interactive Demo Simulator Switcher rendering micro-interactions per step.
 */
function InteractiveTourSimulator({
  stepId,
  onCompleteAction,
}: {
  stepId: string;
  onCompleteAction: () => void;
}) {
  switch (stepId) {
    case "welcome":
      return <PipelineStageSimulator />;
    case "data-management":
      return <IngestionSimulator />;
    case "well-assets":
      return <WellAssetsSimulator />;
    case "wireline-viewer":
      return <WirelineViewerSimulator />;
    case "mnemonic-standardisation":
      return <StandardisationSimulator />;
    case "qa-engine":
      return <QARepairSimulator />;
    case "well-comparison":
      return <ComparisonSimulator />;
    case "compliance-reports":
      return <ComplianceReportSimulator />;
    case "billing-plans":
      return <PricingTierSimulator />;
    case "completed":
      return <LaunchpadSimulator onLaunch={onCompleteAction} />;
    default:
      return null;
  }
}

/** 1. Pipeline Stages Interactive Map */
function PipelineStageSimulator() {
  const [activeStage, setActiveStage] = useState(0);
  const stages = [
    { name: "1. Ingest", desc: "Drag & drop raw CWLS LAS files with zero row loss.", icon: UploadCloud },
    { name: "2. Standardise", desc: "Map vendor mnemonics (SLB, Baker) to API RP 66.", icon: Layers },
    { name: "3. QA Repair", desc: "Despike cycles & reconstruct nulls via KNN/Spline.", icon: Wrench },
    { name: "4. Correlate", desc: "Align offset wells via Pearson r & dip lag shifts.", icon: GitCompare },
    { name: "5. Certify", desc: "Export Form WQC-08-A certificates with SHA-256.", icon: ShieldCheck },
  ];

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-400 uppercase">
        <span>Interactive Subsurface Pipeline:</span>
        <span className="text-slate-400">Click a stage</span>
      </div>
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
        {stages.map((st, idx) => {
          const Icon = st.icon;
          const isSelected = activeStage === idx;
          return (
            <button
              key={st.name}
              type="button"
              onClick={() => setActiveStage(idx)}
              className={`p-2 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                isSelected
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-sm"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[9px] font-mono font-bold truncate w-full">{st.name.split(" ")[1]}</span>
            </button>
          );
        })}
      </div>
      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>{stages[activeStage].desc}</span>
      </div>
    </div>
  );
}

/** 2. Ingestion Simulator */
function IngestionSimulator() {
  const [status, setStatus] = useState<"IDLE" | "PARSING" | "DONE">("IDLE");

  const runSimulation = () => {
    setStatus("PARSING");
    setTimeout(() => {
      setStatus("DONE");
    }, 600);
  };

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Live Ingestion Simulator:</span>
        <span className="text-slate-400">CWLS 2.0 Parser</span>
      </div>

      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <UploadCloud className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-bold">NIGER_DELTA_EXPLORER_01.las</span>
        </div>
        <span className="text-[10px] text-slate-400">1.4 MB · 12 Curves</span>
      </div>

      {status === "IDLE" && (
        <button
          type="button"
          onClick={runSimulation}
          className="w-full py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Simulate Instant Parser</span>
        </button>
      )}

      {status === "PARSING" && (
        <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 text-center space-y-1.5 font-mono text-xs text-cyan-300">
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-cyan-400 h-full animate-pulse w-3/4" />
          </div>
          <span>Verifying section syntax (~VERSION, ~WELL, ~CURVE)...</span>
        </div>
      )}

      {status === "DONE" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3 h-3 shrink-0" />
              <span>~VERSION 2.0 Verified</span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3 h-3 shrink-0" />
              <span>14,400 Depth Rows</span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3 h-3 shrink-0" />
              <span>Depth: 5,200 - 12,400 FT</span>
            </div>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3 h-3 shrink-0" />
              <span>Saved to Database</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatus("IDLE")}
            className="text-[10px] text-slate-400 hover:text-cyan-300 font-mono flex items-center gap-1 mx-auto cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Replay Simulation</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** 3. Well Assets Dossier Simulator */
function WellAssetsSimulator() {
  const [tab, setTab] = useState<"SPECS" | "CURVES" | "GRADE">("SPECS");

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Well Asset Dossier:</span>
        <span className="text-emerald-400">Status: Registered</span>
      </div>

      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-bold">OML-123_WELL_04</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          91/100 · EXCELLENT
        </span>
      </div>

      <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setTab("SPECS")}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
            tab === "SPECS" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
          }`}
        >
          Specs
        </button>
        <button
          type="button"
          onClick={() => setTab("CURVES")}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
            tab === "CURVES" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
          }`}
        >
          Curve Suite
        </button>
        <button
          type="button"
          onClick={() => setTab("GRADE")}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
            tab === "GRADE" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
          }`}
        >
          Audit Lineage
        </button>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300">
        {tab === "SPECS" && (
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Field:</span> OML-123 Offshore</div>
            <div><span className="text-slate-500">Elevation (KB):</span> 84 FT</div>
            <div><span className="text-slate-500">Total Depth (TD):</span> 12,450 FT</div>
            <div><span className="text-slate-500">Operator:</span> Shell / NNPCL JV</div>
          </div>
        )}
        {tab === "CURVES" && (
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-bold">12 Calibrated Channels:</div>
            <div className="flex flex-wrap gap-1">
              {["DEPTH", "GR", "RES_DEEP", "RHOB", "NPHI", "CALI", "DT", "SP"].map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {tab === "GRADE" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Overall Quality:</span>
              <span className="text-emerald-400 font-bold">91/100 (Cleaned)</span>
            </div>
            <div className="text-[10px] text-slate-400">NUPRC Form WQC-08-A issued · Zero unmapped vendor curves</div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 4. Wireline Viewer Simulator */
function WirelineViewerSimulator() {
  const [depth, setDepth] = useState(7510);
  const [showGR, setShowGR] = useState(true);
  const [showRES, setShowRES] = useState(true);
  const [showRHOB, setShowRHOB] = useState(true);

  // Computed synthetic values based on depth
  const grVal = Math.round(45 + Math.sin(depth / 8) * 35);
  const resVal = Math.max(1, Math.round(25 + Math.cos(depth / 10) * 20));
  const rhobVal = (2.25 + Math.sin(depth / 15) * 0.25).toFixed(2);
  const isPaySand = grVal < 60 && resVal > 25;

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Interactive Wireline Crosshair:</span>
        <span className={isPaySand ? "text-emerald-400" : "text-amber-400"}>
          {isPaySand ? "Target Hydrocarbon Sand" : "Shale Interval"}
        </span>
      </div>

      {/* SVG Canvas Mockup */}
      <div className="relative h-24 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-2 flex items-center justify-between font-mono text-[10px]">
        {/* Track 1: GR */}
        <div className="w-1/3 h-full border-r border-slate-800/80 pr-2 relative flex flex-col justify-between">
          <span className="text-emerald-400 font-bold">GR (0-150 API)</span>
          {showGR && (
            <div
              className="h-1 bg-emerald-400/80 rounded transition-all"
              style={{ width: `${(grVal / 150) * 100}%` }}
            />
          )}
          <span className="text-slate-400">{showGR ? `${grVal} GAPI` : "OFF"}</span>
        </div>

        {/* Track 2: RES */}
        <div className="w-1/3 h-full border-r border-slate-800/80 px-2 relative flex flex-col justify-between">
          <span className="text-cyan-400 font-bold">RES (0.2-2000)</span>
          {showRES && (
            <div
              className="h-1 bg-cyan-400/80 rounded transition-all"
              style={{ width: `${(resVal / 50) * 100}%` }}
            />
          )}
          <span className="text-slate-400">{showRES ? `${resVal} Ω·m` : "OFF"}</span>
        </div>

        {/* Track 3: RHOB */}
        <div className="w-1/3 h-full pl-2 relative flex flex-col justify-between">
          <span className="text-amber-400 font-bold">RHOB (g/cm³)</span>
          {showRHOB && (
            <div
              className="h-1 bg-amber-400/80 rounded transition-all"
              style={{ width: `${((Number(rhobVal) - 1.95) / 1) * 100}%` }}
            />
          )}
          <span className="text-slate-400">{showRHOB ? `${rhobVal} g/cc` : "OFF"}</span>
        </div>

        {/* Red Depth Crosshair Line */}
        <div className="absolute inset-x-0 top-1/2 border-b border-red-500/80 pointer-events-none" />
      </div>

      {/* Depth Slider & Toggles */}
      <div className="space-y-1.5 font-mono">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Depth Crosshair:</span>
          <span className="text-cyan-300 font-bold">{depth} FT</span>
        </div>
        <input
          type="range"
          min={7450}
          max={7570}
          step={2}
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer"
        />

        <div className="flex items-center justify-between pt-1 text-[10px]">
          <span className="text-slate-500">Toggle Channels:</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowGR(!showGR)}
              className={`px-2 py-0.5 rounded font-bold ${showGR ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-500"}`}
            >
              GR
            </button>
            <button
              type="button"
              onClick={() => setShowRES(!showRES)}
              className={`px-2 py-0.5 rounded font-bold ${showRES ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-slate-800 text-slate-500"}`}
            >
              RES
            </button>
            <button
              type="button"
              onClick={() => setShowRHOB(!showRHOB)}
              className={`px-2 py-0.5 rounded font-bold ${showRHOB ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-slate-500"}`}
            >
              RHOB
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 5. Standardisation Simulator */
function StandardisationSimulator() {
  const [standardised, setStandardised] = useState(false);

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Vendor Normalisation:</span>
        <span className={standardised ? "text-emerald-400" : "text-amber-400"}>
          {standardised ? "API RP 66 Compliant" : "3 Aliases Pending"}
        </span>
      </div>

      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-slate-300 font-bold">GR_EDTC (Schlumberger)</span>
          <span className="text-slate-500">→</span>
          <span className={standardised ? "text-emerald-400 font-bold" : "text-amber-400"}>
            {standardised ? "GR (Gamma Ray)" : "Unmapped"}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-slate-300 font-bold">ILD (Baker Hughes)</span>
          <span className="text-slate-500">→</span>
          <span className={standardised ? "text-emerald-400 font-bold" : "text-amber-400"}>
            {standardised ? "RES (Deep Resistivity)" : "Unmapped"}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-slate-300 font-bold">DTCO (Halliburton)</span>
          <span className="text-slate-500">→</span>
          <span className={standardised ? "text-emerald-400 font-bold" : "text-amber-400"}>
            {standardised ? "DT (Sonic Transit)" : "Unmapped"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStandardised(!standardised)}
        className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <Layers className="w-3.5 h-3.5" />
        <span>{standardised ? "Reset Mappings" : "Run API RP 66 Standardiser"}</span>
      </button>
    </div>
  );
}

/** 6. QA Repair Simulator */
function QARepairSimulator() {
  const [repaired, setRepaired] = useState(false);

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Non-Destructive Repair:</span>
        <span className={repaired ? "text-emerald-400" : "text-amber-400"}>
          {repaired ? "Score: 94/100 (EXCELLENT)" : "Score: 68/100 (POOR)"}
        </span>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Telemetry Spike (7,480 FT):</span>
          <span className={repaired ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
            {repaired ? "Despiked (2-pt mean)" : "DT = 240 μs/ft Cycle Skip"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Null Gap (7,530 - 7,545 FT):</span>
          <span className={repaired ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
            {repaired ? "Reconstructed (Spline)" : "15 FT Missing Telemetry"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRepaired(!repaired)}
        className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-mono text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
      >
        <Wrench className="w-3.5 h-3.5" />
        <span>{repaired ? "Reset to Raw Telemetry" : "Apply Despiking & Imputation"}</span>
      </button>

      {repaired && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Closed-Loop: Ready to &quot;Upload Cleaned Log to Database&quot;</span>
        </div>
      )}
    </div>
  );
}

/** 7. Multi-Well Comparison Simulator */
function ComparisonSimulator() {
  const [lagShift, setLagShift] = useState(-8);
  const isAligned = lagShift === -8;
  const pearsonR = isAligned ? 0.942 : Math.max(0.4, Number((0.94 - Math.abs(lagShift - -8) * 0.05).toFixed(3)));

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Cross-Well Correlation:</span>
        <span className={isAligned ? "text-emerald-400" : "text-amber-400"}>
          Pearson r = {pearsonR} ({isAligned ? "Peak Match" : "Offset"})
        </span>
      </div>

      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-cyan-300 font-bold">Well A: TARGET_WELL_01</span>
          <span className="text-amber-300 font-bold">Well B: OFFSET_WELL_02</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Optimal Depth Lag: <span className="text-cyan-400 font-bold">{lagShift} FT</span>
        </div>
      </div>

      <div className="space-y-1 font-mono">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Structural Lag Shift (Δz):</span>
          <span className="text-cyan-300 font-bold">{lagShift} FT</span>
        </div>
        <input
          type="range"
          min={-18}
          max={10}
          step={1}
          value={lagShift}
          onChange={(e) => setLagShift(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>-18 FT (Dip Down)</span>
          <span className="text-emerald-400 font-bold">-8 FT (Peak)</span>
          <span>+10 FT (Dip Up)</span>
        </div>
      </div>
    </div>
  );
}

/** 8. Compliance Report Simulator */
function ComplianceReportSimulator() {
  const [verified, setVerified] = useState(false);

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">NUPRC Form WQC-08-A:</span>
        <span className="text-emerald-400">Regulator Stamp</span>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-1.5">
        <div className="flex items-center justify-between font-bold text-white">
          <span>FEDERAL REPUBLIC OF NIGERIA</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            PIA 2021
          </span>
        </div>
        <div className="text-[10px] text-slate-400">Certificate: WQC-2026-NUPRC-00412 · Status: PASSED</div>
      </div>

      <button
        type="button"
        onClick={() => setVerified(!verified)}
        className="w-full py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{verified ? "Hide SHA-256 Signature" : "Verify SHA-256 Digital Signature"}</span>
      </button>

      {verified && (
        <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 break-all space-y-0.5">
          <div className="font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Cryptographic Proof Stamp:</span>
          </div>
          <div className="text-[9px] text-slate-400">
            SHA256: 8f4b7a129de9013c7a6e14a1fbbd0932a4e58b991b7852b855...
          </div>
        </div>
      )}
    </div>
  );
}

/** 9. Pricing & Tier Switcher Simulator */
function PricingTierSimulator() {
  const [isPro, setIsPro] = useState(true);

  return (
    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
        <span className="text-cyan-400">Paystack Licensing:</span>
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setIsPro(false)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${!isPro ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            Free
          </button>
          <button
            type="button"
            onClick={() => setIsPro(true)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPro ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}
          >
            Pro
          </button>
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-1.5">
        <div className="flex items-center justify-between font-bold text-white">
          <span>{isPro ? "WellQC Pro Subscription" : "Free Starter Tier"}</span>
          <span className="text-cyan-300 font-mono">{isPro ? "₦75,000 / $49/mo" : "₦0 / Free"}</span>
        </div>
        <div className="space-y-1 text-[11px] text-slate-300">
          <div>• Quality Checks: <span className="text-cyan-300 font-bold">{isPro ? "Unlimited" : "2 Free Checks"}</span></div>
          <div>• Anomaly Repair & Imputation: <span className="text-cyan-300 font-bold">{isPro ? "Full Spline / KNN ML" : "Read-Only"}</span></div>
          <div>• Well Comparison & Stratigraphy: <span className="text-cyan-300 font-bold">{isPro ? "Uncapped Access" : "Locked (Pro)"}</span></div>
          <div>• Cleaned LAS & PDF Exports: <span className="text-cyan-300 font-bold">{isPro ? "Uncapped Direct" : "Gated"}</span></div>
        </div>
      </div>
    </div>
  );
}

/** 10. Completed Tour Quick Launchpad */
function LaunchpadSimulator({ onLaunch }: { onLaunch: () => void }) {
  const workspaces = [
    { label: "Data Ingestion", href: "/upload", icon: UploadCloud, color: "text-cyan-400" },
    { label: "Well Assets", href: "/wells", icon: Database, color: "text-blue-400" },
    { label: "Standardisation", href: "/standardisation", icon: Layers, color: "text-purple-400" },
    { label: "Quality Engine", href: "/qa-engine", icon: Wrench, color: "text-amber-400" },
    { label: "Well Comparison", href: "/comparison", icon: GitCompare, color: "text-emerald-400" },
    { label: "Compliance Reports", href: "/reports", icon: ShieldCheck, color: "text-cyan-300" },
  ];

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
        Direct Launchpad:
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {workspaces.map((w) => {
          const Icon = w.icon;
          return (
            <Link
              key={w.label}
              href={w.href}
              onClick={onLaunch}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono font-bold text-slate-200 transition-all flex flex-col items-center justify-center gap-1 text-center group"
            >
              <Icon className={`w-4 h-4 ${w.color} group-hover:scale-110 transition-transform`} />
              <span className="truncate w-full">{w.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Welcoming Onboarding Banner shown for users who have not taken or completed the tour yet.
 */
export function OnboardingWelcomeBanner({ onStartTour }: { onStartTour: () => void }) {
  const isCompleted = useIsTourCompleted();
  const [isLocallyDismissed, setIsLocallyDismissed] = useState(false);

  const handleDismiss = () => {
    setIsLocallyDismissed(true);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "dismissed");
      window.dispatchEvent(new Event("wellqc_tour_updated"));
    } catch { }
  };

  if (isCompleted || isLocallyDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-blue-950/80 border border-cyan-500/30 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center space-x-3 w-full sm:w-auto">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div className="min-w-0">
          <span className="font-bold text-white text-xs block font-sans">
            Welcome to WellQC Studio!
          </span>
          <span className="text-slate-300 text-[11px] leading-tight block sm:inline">
            Take a 1-minute interactive guided tour of LAS ingestion, well assets, wireline telemetry, standardisation, QA repair, and NUPRC compliance.
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
        <button
          onClick={onStartTour}
          className="px-4 py-2 sm:py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 flex items-center space-x-1.5 cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Start Interactive Tour</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Dismiss Banner"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Compact "Tour Guide" button to be placed in top headers or toolbars.
 */
export function TourGuideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm font-mono text-[11px] font-bold active:scale-95 group cursor-pointer shrink-0"
      title="Launch Interactive WellQC Studio Tour"
    >
      <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 group-hover:rotate-45 transition-transform" />
      <span className="hidden sm:inline">Tour Guide</span>
      <span className="sm:hidden text-[10px]">Tour</span>
    </button>
  );
}
