"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import Link from "next/link";
import { ShieldCheck, Layers, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export default function QualityEnginePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Scheduled for Sprint 5
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Next Sprint: Sprint 4</span>
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Quality Assurance &amp; Anomaly Repair Engine
            </h1>
            <p className="text-xs text-wellqc-muted font-mono">
              The automated petrophysical repair and approval engine is scheduled for Sprint 5. The active codebase is currently executing Sprint 4.
            </p>
          </div>

          {/* <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/upload"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold font-mono text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              <span>Explore Sprint 4 Wireline Viewer</span>
            </Link>
          </div> */}
        </header>

        <div className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-8 space-y-6 text-center max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white font-mono">Sprint 4 week 2 Deliverables:  Transform raw petrophysical data into actionable, visual intelligence through an industry-grade wireline multi-track viewer, scientific missing-value imputation benchmarking, basin analytics telemetry, and multi-format compliance reporting.
            </h2>
            <p className="text-xs text-slate-400 font-mono leading-relaxed">


            </p>
          </div>

          <div className="bg-wellqc-dark/70 border border-wellqc-border rounded-xl p-4 text-left space-y-2.5 font-mono text-xs text-slate-300">
            <div className="font-bold text-white text-[11px] uppercase tracking-wide">
              Sprint 4 week 2 Roadmap: Quality Engine

            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Industry-Standard Multi-Track Wireline Log Viewer.</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Scientific Missing-Value & Imputation Engine</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Strict Pipeline Demarcation (Upload vs. QA Engine vs. Reports).</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Mnemonic Standardisation & Custom Alias Dictionary</span>
            </div>

          </div>

          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition-all shadow-md"
          >
            <span>Go to LAS Upload &amp; Wireline Viewer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
