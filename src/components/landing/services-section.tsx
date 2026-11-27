import {
  Activity,
  BarChart3,
  FileCheck,
  FileSpreadsheet,
  Sliders,
  Zap,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ScrollReveal, StaggerContainer, StaggerItem } from "./scroll-reveal";

export function ServicesSection() {
  return (
    <section id="capabilities" className="py-24 relative border-b border-wellqc-border scroll-mt-16">
      <div id="services" className="sr-only">Services &amp; Features</div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal direction="up" delay={0.1} distance={30} className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            <span>Enterprise Subsurface Capability Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-wellqc-text tracking-tight">
            Complete Subsurface Log Data Lifecycle
          </h2>
          <p className="text-wellqc-muted text-base leading-relaxed">
            Engineered for oil &amp; gas operators, subsurface data teams, and independent petrophysicists to audit, clean, standardise, and correlate well log fleets with zero manual overhead.
          </p>
        </ScrollReveal>

        <StaggerContainer staggerChildren={0.12} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Pillar 1: Inspect & Audit (LASWorx Model) */}
          <StaggerItem direction="up" distance={28} className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Pillar 1
                </span>
              </div>
              <h3 className="text-lg font-bold text-wellqc-text mb-2">1. Inspect &amp; Audit</h3>
              <p className="text-wellqc-muted text-sm leading-relaxed mb-4">
                Automated 18-point QA audit engine detecting impossible thermodynamic values, sensor flatlines (&gt;25 samples), depth gaps, step glitches, and statistical outlier spikes (&gt;4&sigma;).
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Instant 0–100 Objective Quality Score</span>
            </div>
          </StaggerItem>

          {/* Pillar 2: Repair & Impute (LASWorx Model) */}
          <StaggerItem direction="up" distance={28} className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  Pillar 2
                </span>
              </div>
              <h3 className="text-lg font-bold text-wellqc-text mb-2">2. Repair &amp; Impute</h3>
              <p className="text-wellqc-muted text-sm leading-relaxed mb-4">
                Automated petrophysical remediation with 2-point neighbour despiking, physical boundary bounding, and machine learning gap imputation (KNN, Spline, Multi-Linear) with cross-validated RMSE.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Deterministic SPE Physical Guardrails</span>
            </div>
          </StaggerItem>

          {/* Pillar 3: Standardise & Store (LASWorx Model) */}
          <StaggerItem direction="up" distance={28} className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sliders className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/10 text-teal-500 border border-teal-500/20">
                  Pillar 3
                </span>
              </div>
              <h3 className="text-lg font-bold text-wellqc-text mb-2">3. Standardise &amp; Store</h3>
              <p className="text-wellqc-muted text-sm leading-relaxed mb-4">
                API RP 66 compliant curve ontology mapping raw multi-vendor tool mnemonics (Schlumberger, Baker Hughes, Halliburton, Weatherford) to standard curve families with corporate memory dictionary.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Vendor Tool Alias Harmonisation</span>
            </div>
          </StaggerItem>

          {/* Pillar 4: Governance & Certification */}
          <StaggerItem direction="up" distance={28} className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  Pillar 4
                </span>
              </div>
              <h3 className="text-lg font-bold text-wellqc-text mb-2">4. Governance &amp; Certification</h3>
              <p className="text-wellqc-muted text-sm leading-relaxed mb-4">
                Immutable petrophysical audit trails with tamper-evident digital verification seals, generating official NUPRC Form WQC-08-A compliance certificates for statutory regulatory filing under PIA 2021.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>NUPRC Form WQC-08-A Compliance</span>
            </div>
          </StaggerItem>

          {/* Pillar 5: Interactive Multi-Track Workstation */}
          <StaggerItem direction="up" distance={28} className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Visualization
                </span>
              </div>
              <h3 className="text-lg font-bold text-wellqc-text mb-2">Interactive Multi-Track Viewer</h3>
              <p className="text-wellqc-muted text-sm leading-relaxed mb-4">
                Calibrated log display with API standard track scales (GR 0–150 GAPI, NPHI-RHOB overlays, Resistivity logarithmic decades), real-time zoom, depth pan, and visual anomaly highlight banners.
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>High-Performance Responsive SVG Engine</span>
            </div>
          </StaggerItem>

          {/* Pillar 6: Enterprise E&P Interoperability */}
          <StaggerItem direction="up" distance={28} className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Interoperability
                </span>
              </div>
              <h3 className="text-lg font-bold text-wellqc-text mb-2">Enterprise Petrel / Techlog Export</h3>
              <p className="text-wellqc-muted text-sm leading-relaxed mb-4">
                Export standardised, certified LAS 2.0 / 3.0 files guaranteed to import seamlessly into Petrel, Techlog, Interactive Petrophysics (IP), and cloud subsurface data lakes (OSDU).
              </p>
            </div>
            <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800/60 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero Ingestion Rejections in Geomodeling Tools</span>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Section Bottom Banner */}
        <ScrollReveal direction="up" delay={0.2} distance={30} className="enterprise-cta-banner mt-16 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <h4
              className="enterprise-cta-heading text-xl sm:text-2xl font-bold text-white"
              style={{ color: "#ffffff" }}
            >
              Need custom petrophysical rules or private cloud deployment?
            </h4>
            <p
              className="enterprise-cta-subtext text-slate-300 text-sm max-w-2xl"
              style={{ color: "#cbd5e1" }}
            >
              We offer dedicated on-premise instances, custom SPE parameter palettes, and direct integration with your enterprise subsurface database.
            </p>
          </div>
          <Link
            href="#book-demo"
            className="btn-apple-primary inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-full shrink-0 shadow-lg"
          >
            <span>Request Enterprise Consultation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
