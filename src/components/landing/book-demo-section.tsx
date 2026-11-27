"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Building2,
  Mail,
  User,
  ShieldCheck,
  FileCheck,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Clock,
} from "lucide-react";
import { ScrollReveal, StaggerContainer, StaggerItem } from "./scroll-reveal";

export function BookDemoSection() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    workEmail: "",
    company: "",
    jobTitle: "",
    fleetSize: "",
    primaryObjective: "NUPRC Regulatory Compliance Filing",
    timeframe: "This Week",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/leads/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(
          errBody?.detail || errBody?.error || "Unable to submit demo request right now. Please try again."
        );
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Unable to submit demo request right now. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="book-demo" className="py-24 relative border-b border-wellqc-border bg-slate-950/60 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-blue-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <ScrollReveal direction="up" delay={0.1} distance={30} className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold font-mono tracking-wide uppercase shadow-inner">
            <Calendar className="w-3.5 h-3.5" />
            <span>Enterprise Subsurface Demonstration</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            See WellQCPlus Live on Your Own Well Logs
          </h2>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Schedule a 25-minute technical walkthrough with our subsurface solutions engineers. Bring 1 or 2 of your challenging or legacy LAS files, and we will audit, repair, and standardise them live.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: What to Expect & Value Pillars */}
          <ScrollReveal direction="left" delay={0.15} distance={36} className="lg:col-span-5 space-y-8">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span>What Happens During Your Demo?</span>
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed font-sans">
                Our sessions are purely technical and tailored for Lead Petrophysicists, Data Managers, and Asset Teams. No high-pressure sales scripts.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <StaggerContainer staggerChildren={0.12} className="space-y-4">
              <StaggerItem direction="up" distance={20} className="p-4 rounded-2xl bg-wellqc-card border border-wellqc-border hover:border-cyan-500/40 transition-all flex items-start gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Live 18-Point Anomaly Audit</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Watch our engine automatically classify sensor flatlines, acoustic cycle skips, spikes, and missing depth gaps on your test file.
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem direction="up" distance={20} className="p-4 rounded-2xl bg-wellqc-card border border-wellqc-border hover:border-emerald-500/40 transition-all flex items-start gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">API RP 66 Mnemonic Translation</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    See how contractor mnemonics (SLB, Baker, Halliburton) are harmonised to standard curve families with tenant alias memory.
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem direction="up" distance={20} className="p-4 rounded-2xl bg-wellqc-card border border-wellqc-border hover:border-amber-500/40 transition-all flex items-start gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">NUPRC Form WQC-08-A Compliance</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Review tamper-evident audit reports with SHA-256 cryptographic seals designed for Nigerian upstream regulatory filing.
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem direction="up" distance={20} className="p-4 rounded-2xl bg-wellqc-card border border-wellqc-border hover:border-purple-500/40 transition-all flex items-start gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Private Cloud &amp; On-Premise Options</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">
                    Discuss air-gapped on-premise deployments, multi-seat licenses, and master service agreements (MSAs) for large asset fleets.
                  </p>
                </div>
              </StaggerItem>
            </StaggerContainer>

            {/* Quick Pilot Guarantee Note */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
              <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Standard 30-day enterprise evaluation pilots available for licensed E&amp;P operators upon request.
              </span>
            </div>
          </ScrollReveal>

          {/* Right Column: Demo Booking Interactive Form */}
          <ScrollReveal direction="right" delay={0.2} distance={36} className="lg:col-span-7">
            <div className="bg-wellqc-card rounded-3xl border border-wellqc-border p-6 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              {submitted ? (
                <div className="py-12 px-4 text-center space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>

                  <div className="space-y-2 max-w-md mx-auto">
                    <h3 className="text-2xl font-black text-white font-mono">
                      Demo Request Received!
                    </h3>
                    <p className="text-sm text-slate-300 font-sans leading-relaxed">
                      Thank you, <span className="text-emerald-400 font-semibold">{formData.fullName}</span>. A subsurface engineering specialist will contact you at <span className="text-cyan-300 font-mono">{formData.workEmail}</span> within 2 business hours to confirm your calendar invitation.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 text-left max-w-md mx-auto space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Operator / Company:</span>
                      <span className="text-white font-bold">{formData.company}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Portfolio Scale:</span>
                      <span className="text-cyan-300 font-bold">{formData.fleetSize}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Primary Objective:</span>
                      <span className="text-emerald-300 font-bold">{formData.primaryObjective}</span>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-mono text-xs transition-colors cursor-pointer"
                    >
                      Submit Another Request
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      Schedule a Private Demonstration
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Complete the details below to tailor the session to your asset basin and data formats.
                    </p>
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
                      {submitError}
                    </div>
                  )}

                  {/* Row 1: Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          placeholder="Dr. Samuel Williams"
                          className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                        Corporate Work Email <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="email"
                          required
                          value={formData.workEmail}
                          onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                          placeholder="s.williams@operator.com"
                          className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Company and Job Title */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                        Company / Operator Name <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        <input
                          type="text"
                          required
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder="e.g. Seplat, TotalEnergies, Chevron"
                          className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                        Job Title / Functional Role
                      </label>
                      <input
                        type="text"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        placeholder="e.g. Lead Petrophysicist, Asset Manager"
                        className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Row 3: Primary Objective & Target Timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                        Primary Technical Focus
                      </label>
                      <select
                        value={formData.primaryObjective}
                        onChange={(e) => setFormData({ ...formData, primaryObjective: e.target.value })}
                        className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none transition"
                      >
                        <option value="NUPRC Regulatory Compliance Filing">NUPRC Form WQC-08-A Compliance</option>
                        <option value="Legacy Basin Archive Clean-up & Standardization">Legacy Archive Mnemonic Cleanup</option>
                        <option value="Pre-Drilling Offset Well Comparison">Pre-Drilling Offset Log Correlation</option>
                        <option value="ML & Subsurface Analytics Data Prep">ML Dataset Quality Assurance</option>
                        <option value="Automated Petrophysical QA Workflow">Comprehensive E&P Department Rollout</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                        Target Demonstration Timeline
                      </label>
                      <select
                        value={formData.timeframe}
                        onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                        className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none transition"
                      >
                        <option value="This Week">This Week (Priority)</option>
                        <option value="Next 2 Weeks">Next 2 Weeks</option>
                        <option value="This Month">This Month</option>
                        <option value="Exploring Solutions">Exploring Solutions</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes / Special Instructions */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                      Specific Inquiries / Challenges (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="e.g. We have 140 legacy CWLS LAS files with non-standard sonic mnemonics and missing density curves we need audited for an upcoming NUPRC data submission..."
                      className="w-full bg-wellqc-panel border border-wellqc-border focus:border-cyan-400 rounded-xl p-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none transition resize-none"
                    />
                  </div>

                  {/* Submit CTA */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black text-sm font-mono tracking-wide shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <span>Reserving Technical Session...</span>
                      ) : (
                        <>
                          <Calendar className="w-4 h-4 text-slate-950" />
                          <span>Request 25-Minute Technical Demonstration</span>
                          <ArrowRight className="w-4 h-4 text-slate-950 ml-1" />
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-center text-slate-400 mt-2.5 font-mono">
                      NDA protected • Zero obligation • Certified petroleum geoscientists
                    </p>
                  </div>
                </form>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
