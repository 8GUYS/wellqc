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
  FileCheck2,
  ExternalLink,
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
      "WellQC Studio is an enterprise petrophysical quality assurance and compliance platform. It standardises vendor curve mnemonics, detects sensor anomalies, applies non-destructive repairs, and generates NUPRC-compliant digital certificates for subsurface assets.",
    highlights: [
      "API RP 66 Mnemonic Standardisation",
      "Physics-based Anomaly & Sensor Fault Detection",
      "Non-Destructive Spline & KNN Null Imputation",
      "Form WQC-08-A NUPRC Compliance Digital Certificates",
    ],
    tips: "Use the Left (←) and Right (→) arrow keys to navigate steps, or press Esc to exit at any time.",
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
    tips: "Review your saved wells at the bottom of the Upload page to immediately inspect logs or send them to the QA Engine.",
    preferredPlacement: "center",
  },
  {
    id: "wireline-viewer",
    title: "2. Calibrated Wireline Log Viewer & Telemetry",
    badge: "Module 2: Visualisation",
    icon: <Activity className="w-5 h-5 text-cyan-400" />,
    description:
      "Inspect high-resolution multi-track wireline curves in calibrated Classic Paper Log view. Toggle between Log Plot, raw Data Table, and Split View. Interactive depth crosshairs display instantaneous depth, curve readings, and engineering units in real time.",
    highlights: [
      "Calibrated Log Plot, Data Table & Split View Layouts",
      "Interactive Depth Crosshairs with Instantaneous Readings",
      "Selective Multi-Track Display with One-Click Curve Selection",
    ],
    tips: "Use 'Select All' or 'Clear' in the curve selector to focus on specific petrophysical tracks (GR, RES, SONIC, DENS).",
    preferredPlacement: "center",
  },
  {
    id: "mnemonic-standardisation",
    title: "3. Mnemonic Standardisation Engine",
    badge: "Module 3: Normalisation",
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
    title: "4. Quality Engine & Non-Destructive Repair",
    badge: "Module 4: Remediation",
    icon: <Wrench className="w-5 h-5 text-cyan-400" />,
    description:
      "Remediate data quality faults through an interactive 4-step workflow: Review flagged anomalies, select recommended fixes via the toggleable Suggested Fixes menu (Despiking, Outlier Clipping, Spline/KNN Null Imputation), preview before/after curves, and export clean LAS files.",
    highlights: [
      "Step 1: Automated Physical Bounds & Spike Diagnostics",
      "Step 2: Toggleable Suggested Fixes Dropdown Menu",
      "Step 3: Interactive Before vs After Diff Preview",
      "Step 4: Non-Destructive Repair with Interpretation-Ready Export",
    ],
    actionLink: {
      href: "/qa-engine",
      label: "Launch Quality Engine",
    },
    tips: "Original raw logs remain untouched in the database; repaired files are exported with full audit lineage.",
    preferredPlacement: "center",
  },
  {
    id: "compliance-reports",
    title: "5. NUPRC Compliance & Digital Certificates",
    badge: "Module 5: Governance",
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
    id: "completed",
    title: "You're Ready to Use WellQC Studio!",
    badge: "Tour Complete",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    description:
      "You now know your way around WellQC Studio. You can relaunch this guide anytime by clicking the 'Tour Guide' button in the top navigation bar. Jump directly into any workspace below:",
    highlights: [
      "Data Ingestion & Well Database: /upload",
      "Mnemonic Normalisation: /standardisation",
      "Quality Engine Remediation: /qa-engine",
      "Compliance Certificates: /reports",
    ],
    preferredPlacement: "center",
  },
];

const TOUR_STORAGE_KEY = "wellqc_studio_tour_completed_v2";

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

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Reset to first step whenever reopened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
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
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans select-none pointer-events-auto flex items-center justify-center p-4">
      {/* Dark backdrop with blur */}
      <div
        onClick={handleDismiss}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Floating Tour Guide Dialog Card */}
      <div
        ref={cardRef}
        className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl z-[60] overflow-hidden text-slate-100 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* Animated Linear Progress Bar */}
        <div className="h-1.5 w-full bg-slate-800/80 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Top Header Strip */}
        <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {currentStep.icon || <Compass className="w-4 h-4" />}
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-400 block">
                {currentStep.badge || "WellQC Studio"}
              </span>
              <span className="text-xs font-mono text-slate-300 font-medium">
                Step {currentStepIndex + 1} of {TOUR_STEPS.length} · {progressPercentage}% Complete
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Exit Tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-white tracking-tight leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mt-2">
              {currentStep.description}
            </p>
          </div>

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
            <div className="pt-1">
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

          {/* Quick links on completion step */}
          {isLastStep && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href="/upload"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Ingest LAS File</span>
              </Link>
              <Link
                href="/standardisation"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Standardisation</span>
              </Link>
              <Link
                href="/qa-engine"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Quality Engine</span>
              </Link>
              <Link
                href="/reports"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Form WQC-08-A</span>
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Controls Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
          {/* Keyboard Hotkeys Legend */}
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

          {/* Progress Dots */}
          <div className="flex items-center space-x-1.5">
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

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-mono font-bold transition-colors flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-mono font-extrabold text-xs transition-all shadow-md flex items-center space-x-1 active:scale-95"
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
    <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900/90 to-blue-950/80 border border-cyan-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <span className="font-bold text-white text-xs block font-sans">
            Welcome to WellQC Studio!
          </span>
          <span className="text-slate-300 text-[11px] leading-tight">
            Take a quick 1-minute guided tour of LAS ingestion, wireline telemetry, standardisation, and NUPRC compliance.
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
        <button
          onClick={onStartTour}
          className="px-4 py-1.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 flex items-center space-x-1.5"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Start Tour</span>
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm font-mono text-[11px] font-bold active:scale-95 group"
      title="Launch Interactive WellQC Studio Tour"
    >
      <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 group-hover:rotate-45 transition-transform" />
      <span>Tour Guide</span>
    </button>
  );
}
