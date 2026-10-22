"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Sliders,
  CheckCircle2,
  Cpu,
  Palette,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HeroSlide {
  id: string;
  name: string;
  title: string;
  category: string;
  badge: string;
  url: string;
  image: string;
  alt: string;
  accent: "emerald" | "blue" | "cyan" | "purple" | "amber";
  tagline: string;
  highlights: string[];
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "dashboard-dark",
    name: "OLED Obsidian",
    title: "Executive Asset Dashboard",
    category: "Workstation Telemetry",
    badge: "OLED Obsidian Dark",
    url: "wellqc.internal/dashboard?theme=obsidian",
    image: "/brand/dashboard-dark.png",
    alt: "WellQC Production Asset Dashboard in OLED Obsidian Mode",
    accent: "emerald",
    tagline: "Ultra-high contrast petrophysical KPI telemetry & fleet health metrics",
    highlights: ["99.4% Grading Accuracy", "Real-time Defect Exposure", "Corporate Asset Catalog"],
  },
  {
    id: "dashboard-light",
    name: "Apple Studio Light",
    title: "Apple Studio Light Workstation",
    category: "Ergonomic Studio Mode",
    badge: "Apple Studio Light",
    url: "wellqc.internal/dashboard?theme=light",
    image: "/brand/dashboard-light.png",
    alt: "WellQC Asset Dashboard in Apple Studio Light Theme",
    accent: "blue",
    tagline: "Warm creamy background with zero eye-strain typography & multi-layer ambient shadows",
    highlights: ["#f7f4ec Creamy Canvas", "Studio Shadow Physics", "Clean Daylight Workspace"],
  },
  {
    id: "qa-engine",
    name: "AI Quality Engine",
    title: "Automated QA Diagnostics",
    category: "Anomaly Detection",
    badge: "API RP 66 Benchmark",
    url: "wellqc.internal/qa-engine",
    image: "/brand/qa-engine.png",
    alt: "WellQC Automated Petrophysical Quality Assurance Engine",
    accent: "cyan",
    tagline: "Deterministic anomaly detection for duplicate depths, null clusters, and extreme spikes",
    highlights: ["Spike & Flatline Isolation", "Step-Interval Verification", "Non-destructive Certified Patches"],
  },
  {
    id: "las-parser",
    name: "LAS Standardisation",
    title: "Curve Standardisation Dictionary",
    category: "Ontology Harmonisation",
    badge: "CWLS LAS 2.0 & API Rules",
    url: "wellqc.internal/standardisation",
    image: "/brand/las-parser.png",
    alt: "WellQC Curve Mnemonic Standardisation & Tool Aliasing",
    accent: "purple",
    tagline: "Multi-vendor tool alias harmonisation across 19 standard API curve families",
    highlights: ["19 API Standard Families", "Custom Corporate Aliases", "Ontology Auto-Mapping"],
  },
  {
    id: "las-upload",
    name: "Log Ingestion",
    title: "High-Speed Log Ingestion",
    category: "Subsurface Parser",
    badge: "CWLS Standard V2.0",
    url: "wellqc.internal/upload",
    image: "/brand/las-upload.png",
    alt: "WellQC Subsurface Log Ingestion Workstation",
    accent: "amber",
    tagline: "Instant multi-well LAS file parser with instant header and curve extraction",
    highlights: ["Instant Header Parsing", "Batch Ingest Automation", "Zero-Footprint Local Memory"],
  },
];

const ACCENT_STYLES = {
  emerald: {
    pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    glow: "from-emerald-500/20 to-teal-500/20",
    indicator: "bg-emerald-500",
    border: "border-emerald-500/40",
  },
  blue: {
    pill: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
    glow: "from-blue-500/20 to-indigo-500/20",
    indicator: "bg-blue-500",
    border: "border-blue-500/40",
  },
  cyan: {
    pill: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
    glow: "from-cyan-500/20 to-teal-500/20",
    indicator: "bg-cyan-500",
    border: "border-cyan-500/40",
  },
  purple: {
    pill: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    glow: "from-purple-500/20 to-pink-500/20",
    indicator: "bg-purple-500",
    border: "border-purple-500/40",
  },
  amber: {
    pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    glow: "from-amber-500/20 to-orange-500/20",
    indicator: "bg-amber-500",
    border: "border-amber-500/40",
  },
};

export function HeroSection() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [autoplayProgress, setAutoplayProgress] = useState(0);

  const SLIDE_DURATION = 5000; // 5 seconds per slide
  const TICK_INTERVAL = 50;

  const currentSlide = HERO_SLIDES[currentSlideIndex];
  const accent = ACCENT_STYLES[currentSlide.accent];

  const handleNext = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    setAutoplayProgress(0);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    setAutoplayProgress(0);
  }, []);

  const goToSlide = (idx: number) => {
    setCurrentSlideIndex(idx);
    setAutoplayProgress(0);
  };

  // Autoplay timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setAutoplayProgress((prev) => {
        const next = prev + (TICK_INTERVAL / SLIDE_DURATION) * 100;
        if (next >= 100) {
          handleNext();
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL);

    return () => clearInterval(timer);
  }, [isPaused, handleNext]);

  return (
    <section
      id="home"
      className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden border-b border-slate-200/70 dark:border-slate-800/60"
    >
      {/* Background Dynamic Ambient Glows */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr ${accent.glow} rounded-full blur-[140px] pointer-events-none transition-all duration-1000`} />
      <div className="absolute top-1/3 left-10 w-[300px] h-[300px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold tracking-wide uppercase shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Petrophysical Quality Assurance</span>
          </div>

          {/* Main Headline */}
          <h1 className="hero-heading text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Automated Well Log <br />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent">
              Quality Assurance &amp; Standardisation
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-3xl mx-auto">
            WellQC automatically validates LAS 2.0 files, detects anomalous spikes &amp; flatlines, standardises raw mnemonics, and imputes missing curves with KNN ML models.
          </p>

          {/* CTA Buttons — Apple Style Pill Pair */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/register"
              className="btn-apple-primary w-full sm:w-auto text-base px-8 py-3.5 shadow-lg shadow-blue-500/25"
            >
              <span>Check Log Files for Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#services"
              className="btn-apple-secondary w-full sm:w-auto text-base px-7 py-3.5"
            >
              <span>Explore Platform Modules</span>
            </Link>
          </div>

          {/* Freemium Trust Note */}
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 pt-1 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>No credit card required for your free log file checks</span>
          </p>
        </div>

        {/* Dynamic Interactive Laptop Slideshow Showcase */}
        <div
          className="mt-14 relative max-w-5xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Laptop Lid Housing */}
          <div className="relative rounded-[28px] bg-slate-950 dark:bg-slate-900 p-2.5 sm:p-3.5 shadow-2xl shadow-black/60 border border-slate-700/60 ring-1 ring-white/10">
            {/* Top Display Bezel with Chrome & Dynamic Status */}
            <div className="flex items-center justify-between pb-2.5 px-3">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] inline-block shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24] inline-block shadow-sm" />
                <span className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] inline-block shadow-sm" />
              </div>

              {/* Dynamic URL Bar */}
              <div className="flex items-center space-x-2 px-3 py-0.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-mono transition-colors duration-300">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-300 font-medium">{currentSlide.url}</span>
                <span className="text-slate-600">|</span>
                <span className="text-cyan-400 font-bold uppercase tracking-wider">{currentSlide.badge}</span>
              </div>

              {/* Play/Pause & Slide counter */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  title={isPaused ? "Resume slideshow" : "Pause slideshow"}
                  aria-label={isPaused ? "Resume slideshow" : "Pause slideshow"}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <div className="text-[11px] font-mono text-slate-400">
                  <span className="text-white font-bold">{currentSlideIndex + 1}</span>
                  <span className="text-slate-600">/</span>
                  <span>{HERO_SLIDES.length}</span>
                </div>
              </div>
            </div>

            {/* Laptop Display Screen Area */}
            <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-slate-950 group border border-slate-800/80 shadow-inner">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide.id}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.01 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full h-full relative"
                >
                  <img
                    src={currentSlide.image}
                    alt={currentSlide.alt}
                    className="w-full h-full object-cover object-top"
                  />

                  {/* Subtle Top Vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-black/20 pointer-events-none" />
                </motion.div>
              </AnimatePresence>

              {/* Next/Prev Arrow Controls — appear on hover */}
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 shadow-xl"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-105 shadow-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Status Overlay Tagline & Badges */}
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-700/70 text-white text-xs shadow-2xl">
                  <span className={`w-2 h-2 rounded-full ${accent.indicator} animate-pulse`} />
                  <span className="font-bold tracking-tight">{currentSlide.title}</span>
                  <span className="hidden sm:inline text-slate-500">&bull;</span>
                  <span className="hidden sm:inline text-slate-300 font-normal truncate max-w-md">
                    {currentSlide.tagline}
                  </span>
                </div>

                {/* Highlights Chips */}
                <div className="hidden lg:flex items-center gap-1.5">
                  {currentSlide.highlights.slice(0, 2).map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-medium text-slate-300 shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Laptop Base / Deck Edge & Thumb Notch */}
          <div className="relative mx-auto w-[92%] sm:w-[94%] h-3.5 sm:h-4 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 rounded-b-2xl shadow-xl border-t border-slate-600/50 flex items-center justify-center">
            <div className="w-24 sm:w-32 h-1 bg-slate-950/80 rounded-b-md border-b border-slate-600/30" />
          </div>

          {/* Soft Bottom Ambient Glow */}
          <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-14 bg-gradient-to-r ${accent.glow} blur-3xl pointer-events-none rounded-full transition-all duration-1000`} />

          {/* Interactive Slide Switcher Navigation Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {HERO_SLIDES.map((slide, idx) => {
              const isActive = idx === currentSlideIndex;
              const slideAccent = ACCENT_STYLES[slide.accent];
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  className={`hero-switcher-btn relative flex items-center gap-2.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 border ${
                    isActive
                      ? "hero-switcher-btn-active bg-white text-stone-900 border-stone-300 shadow-md shadow-stone-900/5 scale-[1.02] dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:shadow-xl dark:shadow-black/40"
                      : "bg-white/85 text-stone-700 border-stone-200/90 hover:bg-white hover:text-stone-950 hover:border-stone-300 shadow-2xs dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-white dark:hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full transition-transform duration-300 ${
                      isActive
                        ? `${slideAccent.indicator} scale-125 ring-2 ring-current/25`
                        : `${slideAccent.indicator} opacity-70`
                    }`}
                  />
                  <span className="font-medium tracking-tight">
                    {slide.name}
                  </span>

                  {/* Active Slide Progress Bar */}
                  {isActive && !isPaused && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-stone-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${slideAccent.indicator} transition-all duration-75 ease-linear`}
                        style={{ width: `${autoplayProgress}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Social Proof Metric Bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-stone-300/70 dark:border-slate-800/80 text-center">
          <div>
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">10,000+</span>
            <span className="block text-sm text-stone-700 dark:text-slate-400 mt-1 font-medium">LAS Files Processed</span>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">99.4%</span>
            <span className="block text-sm text-stone-700 dark:text-slate-400 mt-1 font-medium">Mnemonic Accuracy</span>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">&lt; 3 Secs</span>
            <span className="block text-sm text-stone-700 dark:text-slate-400 mt-1 font-medium">Audit Generation Time</span>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-violet-600 dark:text-purple-400">100%</span>
            <span className="block text-sm text-stone-700 dark:text-slate-400 mt-1 font-medium">Multi-Tenant Data Isolation</span>
          </div>
        </div>
      </div>
    </section>
  );
}
