import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden border-b border-slate-800/60"
    >
      {/* Background Gradients & Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-600/20 to-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Petrophysical Quality Assurance</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.15]">
            Automated Well Log <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Quality Assurance & Standardisation
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed max-w-3xl mx-auto">
            WellQC+ automatically validates LAS 2.0 files, detects anomalous spikes & flatlines, standardises raw mnemonics, and imputes missing curves with KNN ML models.
          </p>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Check Log Files for Free</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Freemium Trust Note */}
          <p className="text-xs text-slate-400 flex items-center justify-center gap-2 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>No credit card required for your free log file checks</span>
          </p>
        </div>

        {/* Hero Visual Mockup Preview — Privacy-Safe & Anonymized */}
        <div className="mt-14 relative max-w-5xl mx-auto">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            <div className="bg-slate-950 rounded-xl p-4 sm:p-6 space-y-6">
              {/* Mock Top Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs text-slate-400 font-mono ml-2">
                    LAS Automated Audit Workspace &mdash; Well: ND-DEMO-01X (Synthetic Benchmark)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                    94% EXCELLENT GRADE
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-300 text-xs font-mono border border-cyan-500/20">
                    <Lock className="w-3 h-3 text-cyan-400" />
                    <span>Encrypted Tenant Sandbox</span>
                  </span>
                </div>
              </div>

              {/* Mock Dashboard Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Overall Health</span>
                  <span className="text-2xl font-bold text-emerald-400">94 / 100</span>
                  <span className="text-[11px] text-emerald-500/80 block mt-1">Ready for Petrophysical Audit</span>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Mnemonics Matched</span>
                  <span className="text-2xl font-bold text-cyan-400">8 / 8 Standard</span>
                  <span className="text-[11px] text-slate-400 block mt-1">100% Alias Confidence</span>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Anomalies Detected</span>
                  <span className="text-2xl font-bold text-amber-400">2 Spikes</span>
                  <span className="text-[11px] text-amber-400/80 block mt-1">Sonic Cycle Skips Flagged</span>
                </div>
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Missing Data Imputed</span>
                  <span className="text-2xl font-bold text-emerald-400">KNN ML</span>
                  <span className="text-[11px] text-slate-400 block mt-1">R² Score: 0.94 Preserved</span>
                </div>
              </div>

              {/* Mock Curve Rows */}
              <div className="space-y-2">
                <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-slate-200">Gamma Ray (GR)</span>
                      <span className="text-slate-400 block text-[11px]">Mapped from GAPI &bull; Range: 15.2 - 138.4 GAPI</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">0.0% Nulls</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[11px]">VALID</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="font-semibold text-slate-200">Deep Resistivity (RT)</span>
                      <span className="text-slate-400 block text-[11px]">Mapped from OHMM &bull; Logarithmic Range: 0.2 - 2000 &Omega;.m</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">100% Quality</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[11px]">VALID</span>
                  </div>
                </div>
              </div>

              {/* Enterprise Confidentiality Assurance Banner */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400 font-mono">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Enterprise Privacy Guarantee: Real customer well logs remain private and encrypted (AES-256), accessible exclusively within authenticated corporate workspaces.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof Metric Bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-slate-800/80 text-center">
          <div>
            <span className="text-3xl font-extrabold text-white">10,000+</span>
            <span className="block text-sm text-slate-400 mt-1">LAS Files Processed</span>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-emerald-400">99.4%</span>
            <span className="block text-sm text-slate-400 mt-1">Mnemonic Accuracy</span>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-cyan-400">&lt; 3 Secs</span>
            <span className="block text-sm text-slate-400 mt-1">Audit Generation Time</span>
          </div>
          <div>
            <span className="text-3xl font-extrabold text-white">100%</span>
            <span className="block text-sm text-slate-400 mt-1">Multi-Tenant Data Isolation</span>
          </div>
        </div>
      </div>
    </section>
  );
}
