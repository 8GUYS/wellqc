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
  Sliders,
  Filter,
  BarChart3,
  TrendingUp,
  PlusCircle,
  GitCompare,
  PieChart,
} from "lucide-react";

export interface TourStep {
  id: string;
  targetId?: string; // HTML element ID to spotlight; if omitted, modal is centered
  title: string;
  badge?: string;
  description: string;
  icon?: React.ReactNode;
  tips?: string;
  preferredPlacement?: "bottom" | "top" | "center";
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to WellQC Asset Platform",
    badge: "Getting Started",
    icon: <Sparkles className="w-5 h-5 text-cyan-400" />,
    description:
      "WellQC automates petrophysical LAS log quality assurance, standardises curve mnemonics, detects sensor anomalies, and produces interpretation-ready well datasets. Let's take a quick 1-minute guided tour of your command centre!",
    preferredPlacement: "center",
  },
  {
    id: "dashboard-mode",
    targetId: "tour-dashboard-mode",
    title: "1. Tailor Your Telemetry View",
    badge: "Display Modes",
    icon: <Sliders className="w-5 h-5 text-cyan-400" />,
    description:
      "Switch between 3 specialised operational views: Executive (Calm) for C-suite KPIs and risk summaries, Operational for fleet distributions, and Full Telemetry for all 18 engineering metrics and scan tables.",
    tips: "Try clicking the mode buttons below to preview each layout live!",
    preferredPlacement: "bottom",
  },
  {
    id: "scope-filter",
    targetId: "tour-scope-filter",
    title: "2. Filter Assets By Verification Health",
    badge: "Asset Scopes",
    icon: <Filter className="w-5 h-5 text-cyan-400" />,
    description:
      "Filter your subsurface portfolio by verification health: All Wells for the complete catalog, Uploaded Wells for production-ready datasets, and Flagged Wells for assets requiring automated remediation.",
    tips: "Toggle between asset scopes below to see your KPI cards adapt dynamically.",
    preferredPlacement: "bottom",
  },
  {
    id: "kpi-grid",
    targetId: "tour-kpi-grid",
    title: "3. Fleet Health & QA Index Cards",
    badge: "Quality Index",
    icon: <BarChart3 className="w-5 h-5 text-cyan-400" />,
    description:
      "Review your corporate Composite Quality Score, verified LAS volumes, and high-impact severity alert cards highlighting critical vs moderate faults.",
    preferredPlacement: "bottom",
  },
  {
    id: "trend-section",
    targetId: "tour-trend-section",
    title: "4. Composite Dial & Ingestion Trends",
    badge: "Analytics Engine",
    icon: <TrendingUp className="w-5 h-5 text-cyan-400" />,
    description:
      "Track your API RP 66 benchmark quality gauge alongside 7-day ingestion volume trajectories and active ML auto-clean engine throughput.",
    preferredPlacement: "top",
  },
  {
    id: "actions",
    targetId: "tour-actions",
    title: "5. Ingest New Logs & Well Registry",
    badge: "Actions & Tools",
    icon: <PlusCircle className="w-5 h-5 text-cyan-400" />,
    description:
      "Click '+' to upload and inspect raw LAS files, test curves against physical limits, preview multi-curve wireline tracks, and upload validated datasets into your database.",
    preferredPlacement: "bottom",
  },
  {
    id: "completed",
    title: "You're Ready to Explore WellQC!",
    badge: "Tour Complete",
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    description:
      "You now know your way around the platform. You can relaunch this walkthrough anytime by clicking the 'Tour Guide' button in the dashboard header.",
    preferredPlacement: "center",
  },
];

const TOUR_STORAGE_KEY = "wellqc_dashboard_tour_completed_v1";

function subscribeToTourStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
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

interface DashboardTourProps {
  isOpen: boolean;
  onClose: () => void;
  onStart?: () => void;
  currentMode?: "executive" | "workstation" | "telemetry";
  onSelectMode?: (mode: "executive" | "workstation" | "telemetry") => void;
  currentScope?: "ALL" | "COMMITTED" | "ATTENTION";
  onSelectScope?: (scope: "ALL" | "COMMITTED" | "ATTENTION") => void;
}

export function DashboardTour({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
  currentScope,
  onSelectScope,
}: DashboardTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [effectivePlacement, setEffectivePlacement] = useState<"top" | "bottom" | "center">("bottom");
  const cardRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Measure and scroll target element into view
  const updateTargetRect = useCallback(() => {
    if (!currentStep.targetId) {
      setTargetRect(null);
      setEffectivePlacement("center");
      return;
    }

    const el =
      document.getElementById(currentStep.targetId) ||
      (currentStep.targetId === "tour-trend-section"
        ? document.getElementById("tour-trend-section-alt")
        : null);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Determine smart auto-flip placement
      const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
      const estimatedCardHeight = 340;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      let placement = currentStep.preferredPlacement || "bottom";
      if (placement === "bottom" && spaceBelow < estimatedCardHeight + 20 && spaceAbove > spaceBelow) {
        placement = "top";
      } else if (placement === "top" && spaceAbove < estimatedCardHeight + 20 && spaceBelow > spaceAbove) {
        placement = "bottom";
      }
      setEffectivePlacement(placement);
    } else {
      setTargetRect(null);
      setEffectivePlacement("center");
    }
  }, [currentStep.targetId, currentStep.preferredPlacement]);

  useEffect(() => {
    if (!isOpen) return;

    // Small delay to allow scroll and rendering
    const timer = setTimeout(() => {
      updateTargetRect();
    }, 150);

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [isOpen, currentStepIndex, updateTargetRect]);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      window.dispatchEvent(new Event("wellqc_tour_updated"));
    } catch {}
    onClose();
  }, [onClose]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      window.dispatchEvent(new Event("wellqc_tour_updated"));
    } catch {}
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
      } else if (e.key === "ArrowRight" || e.key === " ") {
        if (!isLastStep) {
          e.preventDefault();
          setCurrentStepIndex((prev) => prev + 1);
        } else if (e.key === " ") {
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

  // Compute tooltip card position relative to target or viewport center
  const getCardPositionStyle = (): React.CSSProperties => {
    if (!targetRect || effectivePlacement === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed",
      };
    }

    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    // Mobile layout: dock nicely at bottom as a floating sheet
    if (viewportWidth < 640) {
      return {
        bottom: "16px",
        left: "12px",
        right: "12px",
        position: "fixed",
        width: "auto",
        maxWidth: "none",
      };
    }

    const cardWidth = 440;
    const estimatedHeight = 330;
    const padding = 16;

    let left = targetRect.left + targetRect.width / 2 - cardWidth / 2;
    // Keep inside horizontal viewport
    left = Math.max(padding, Math.min(left, viewportWidth - cardWidth - padding));

    let top = 0;
    if (effectivePlacement === "top") {
      top = Math.max(padding, targetRect.top - estimatedHeight - 16);
    } else {
      top = Math.min(viewportHeight - estimatedHeight - padding, targetRect.bottom + 16);
    }

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      position: "fixed",
    };
  };

  const progressPercentage = Math.round(((currentStepIndex + 1) / TOUR_STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans select-none pointer-events-auto">
      {/* Dark backdrop with blur */}
      <div
        onClick={handleDismiss}
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-opacity duration-300"
      />

      {/* Target Element Spotlight Cutout Ring */}
      {targetRect && (
        <div
          className="fixed rounded-2xl border-2 border-cyan-400 pointer-events-none transition-all duration-300 ease-out z-50 shadow-[0_0_0_9999px_rgba(2,6,23,0.72),0_0_30px_rgba(6,182,212,0.5)] ring-4 ring-cyan-500/20"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        >
          {/* Subtle pulsing beacon pill */}
          <span className="absolute -top-3 -right-2 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-cyan-500 border border-slate-900 text-[10px] text-slate-950 font-bold items-center justify-center font-mono">
              {currentStepIndex}
            </span>
          </span>
        </div>
      )}

      {/* Floating Tour Guide Dialog Card */}
      <div
        ref={cardRef}
        style={getCardPositionStyle()}
        className="w-[92vw] sm:w-[440px] bg-slate-900/95 dark:bg-slate-900/95 border border-cyan-500/40 rounded-3xl shadow-2xl z-[60] overflow-hidden text-slate-100 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
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
            <span className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              {currentStep.icon || <Compass className="w-4 h-4" />}
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-400 block">
                {currentStep.badge || "WellQC Walkthrough"}
              </span>
              <span className="text-xs font-mono text-slate-300 font-medium">
                Step {currentStepIndex + 1} of {TOUR_STEPS.length} · {progressPercentage}%
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
        <div className="p-5 space-y-3.5">
          <h3 className="text-base font-extrabold text-white tracking-tight leading-snug">
            {currentStep.title}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Interactive Live Preview Controls for Step 1 (Dashboard Modes) */}
          {currentStep.id === "dashboard-mode" && onSelectMode && (
            <div className="pt-1 pb-1">
              <div className="text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Interactive Preview — Try It Live:</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => onSelectMode("executive")}
                  className={`px-2 py-1.5 rounded-lg border font-bold transition-all text-center ${
                    currentMode === "executive"
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  Executive
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMode("workstation")}
                  className={`px-2 py-1.5 rounded-lg border font-bold transition-all text-center ${
                    currentMode === "workstation"
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  Operational
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMode("telemetry")}
                  className={`px-2 py-1.5 rounded-lg border font-bold transition-all text-center ${
                    currentMode === "telemetry"
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  Full Telemetry
                </button>
              </div>
            </div>
          )}

          {/* Interactive Live Preview Controls for Step 2 (Asset Filter Scopes) */}
          {currentStep.id === "scope-filter" && onSelectScope && (
            <div className="pt-1 pb-1">
              <div className="text-[10px] text-cyan-400 font-mono font-bold uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Interactive Preview — Try It Live:</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => onSelectScope("ALL")}
                  className={`px-2 py-1.5 rounded-lg border font-bold transition-all text-center ${
                    currentScope === "ALL"
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  All Wells
                </button>
                <button
                  type="button"
                  onClick={() => onSelectScope("COMMITTED")}
                  className={`px-2 py-1.5 rounded-lg border font-bold transition-all text-center ${
                    currentScope === "COMMITTED"
                      ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  Uploaded Wells
                </button>
                <button
                  type="button"
                  onClick={() => onSelectScope("ATTENTION")}
                  className={`px-2 py-1.5 rounded-lg border font-bold transition-all text-center ${
                    currentScope === "ATTENTION"
                      ? "bg-rose-600 text-white border-rose-400 shadow-sm"
                      : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  Flagged Wells
                </button>
              </div>
            </div>
          )}

          {currentStep.tips && (
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 font-mono flex items-start space-x-2">
              <span className="font-bold shrink-0">💡 Tip:</span>
              <span>{currentStep.tips}</span>
            </div>
          )}

          {/* Quick links on completion step */}
          {isLastStep && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                href="/upload"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Ingest First Log</span>
              </Link>
              <Link
                href="/comparison"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Well Comparison</span>
              </Link>
              <Link
                href="/analytics"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <PieChart className="w-3.5 h-3.5 text-sky-400" />
                <span>Basin Analytics</span>
              </Link>
              <Link
                href="/wells"
                onClick={handleComplete}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <span>Well Registry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Controls Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
          {/* Keyboard Hotkeys Legend on Desktop, Dots on Mobile */}
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
          <div className="flex sm:hidden items-center space-x-1.5">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? "w-4 bg-cyan-400"
                    : idx < currentStepIndex
                    ? "bg-cyan-700"
                    : "bg-slate-700 hover:bg-slate-600"
                }`}
                title={`Go to Step ${idx + 1}: ${step.title}`}
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
    } catch {}
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
            Welcome to WellQC! New here?
          </span>
          <span className="text-slate-300 text-[11px] leading-tight">
            Take a quick 1-minute guided tour to explore automated QA diagnostics, multi-track wireline views, and fleet verification.
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
      title="Launch Interactive Dashboard Tour"
    >
      <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 group-hover:rotate-45 transition-transform" />
      <span>Tour Guide</span>
    </button>
  );
}
