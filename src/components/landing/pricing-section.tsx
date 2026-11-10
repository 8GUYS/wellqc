"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Lock,
  ArrowRight,
  Zap,
  Building2,
  BadgeCheck,
} from "lucide-react";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

export function PricingSection() {
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("PRO_MONTHLY");

  const handleOpenUpgrade = (planId: string) => {
    setSelectedPlanId(planId);
    setModalOpen(true);
  };

  return (
    <section id="pricing" className="py-24 relative border-b border-wellqc-border bg-slate-950/40">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/5 dark:bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold font-mono">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Commercial Proposal &amp; Petrophysical Licensing</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-wellqc-text tracking-tight">
            Transparent, Value-Driven Pricing
          </h2>

          <p className="text-wellqc-muted text-base sm:text-lg leading-relaxed">
            Diagnosis is <span className="text-emerald-500 dark:text-emerald-400 font-bold">100% Free</span>.
            Audit your raw well logs and uncover critical anomalies with zero upfront cost.
            Upgrade to <span className="text-cyan-500 dark:text-cyan-400 font-bold">WellQC Pro</span> or Enterprise to unlock automated repairs, AI imputation, and NUPRC-compliant certificates.
          </p>

          {/* Currency & Billing Cycle Controls */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* Currency Selector */}
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setCurrency("NGN")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  currency === "NGN"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                NGN (₦)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                  currency === "USD"
                    ? "bg-emerald-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* Monthly / Annual Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 shadow-inner items-center">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annually")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                  billingCycle === "annually"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Annually</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Save 17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid (From Section 5.1 of Business Plan) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {/* 1. Free Diagnostic Tier */}
          <div className="rounded-3xl bg-wellqc-card border border-wellqc-border p-8 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  FREE DIAGNOSTICS
                </span>
                <h3 className="text-2xl font-bold text-wellqc-text">Starter Tier</h3>
                <p className="text-wellqc-muted text-xs leading-relaxed">
                  For students, independent researchers, and petrophysicists evaluating raw data health before committing.
                </p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline space-x-1 font-mono">
                  <span className="text-4xl font-extrabold text-wellqc-text">
                    {currency === "NGN" ? "₦0" : "$0"}
                  </span>
                  <span className="text-wellqc-muted text-xs">/ forever</span>
                </div>
                <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  Up to 2 LAS files completely free
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-wellqc-border text-xs">
                <p className="font-mono text-slate-400 font-bold tracking-wide uppercase text-[10px]">
                  What&apos;s Included:
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Upload &amp; parse up to 2 CWLS LAS 2.0/3.0 files</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Automated 0–100 Well Quality Score &amp; letter grade</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Full anomaly detection (spikes, limits, duplicates, nulls)</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Installable PWA Workstation (Offline rig mode for all users)</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-through">Interactive Wireline Log Viewer (Pro only)</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-through">Automated QA Engine repair &amp; despiking</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span className="line-through">NUPRC Form WQC-08-A digital certificates</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <Link
                href="/register"
                className="w-full py-3 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Start Free Audit</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          {/* 2. Pro Tier (Core Monetization from Proposal) */}
          <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-2 border-cyan-500/80 p-8 flex flex-col justify-between shadow-2xl shadow-cyan-500/10 relative">
            {/* Recommended Pill */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-[10px] font-mono font-black tracking-wider uppercase shadow-md flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-slate-950" />
              <span>CORE REVENUE ENGINE</span>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  QA ENGINE UNLOCKED
                </span>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>WellQC Pro</span>
                  <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed">
                  For active petrophysicists, asset geologists, and consulting teams requiring automated log cleaning and exports.
                </p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline space-x-1 font-mono">
                  <span className="text-4xl font-extrabold text-white">
                    {currency === "NGN"
                      ? billingCycle === "monthly"
                        ? "₦75,000"
                        : "₦750,000"
                      : billingCycle === "monthly"
                        ? "$49"
                        : "$490"}
                  </span>
                  <span className="text-slate-400 text-xs">
                    /{billingCycle === "monthly" ? "month" : "year"}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-cyan-400 mt-1">
                  {billingCycle === "annually"
                    ? "₦62,500/mo equivalent • 2 months free"
                    : "Billed monthly • Instant Paystack activation"}
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-800 text-xs">
                <p className="font-mono text-cyan-400 font-bold tracking-wide uppercase text-[10px]">
                  Everything in Starter, plus:
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Full QA Engine Workstation:</strong> Non-destructive log repair</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Automated Despiking:</strong> Two-point neighbour average on sonic DT</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Physical Clipping:</strong> Clamps to SPE thermodynamic bounds</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Multi-Curve AI Imputation:</strong> KNN, Spline, Linear benchmark</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>NUPRC Compliance:</strong> Certified Form WQC-08-A digital certificates</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Clean Exports:</strong> Production-ready CWLS LAS 2.0 &amp; CSV files</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-100 font-medium">
                    <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Mnemonic Dictionary:</strong> Custom alias memory across wells</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <button
                type="button"
                onClick={() =>
                  handleOpenUpgrade(
                    billingCycle === "monthly" ? "PRO_MONTHLY" : "PRO_ANNUAL"
                  )
                }
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-mono font-black tracking-wide shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 group"
              >
                <Sparkles className="w-4 h-4 text-slate-950 group-hover:rotate-12 transition-transform" />
                <span>Upgrade to Pro with Paystack</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* 3. Enterprise Asset License */}
          <div className="rounded-3xl bg-wellqc-card border border-wellqc-border p-8 flex flex-col justify-between hover:border-slate-700 transition-all shadow-sm">
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  E&amp;P OPERATORS
                </span>
                <h3 className="text-2xl font-bold text-wellqc-text flex items-center gap-2">
                  <span>Enterprise</span>
                  <Building2 className="w-4 h-4 text-purple-500" />
                </h3>
                <p className="text-wellqc-muted text-xs leading-relaxed">
                  For independent E&amp;P operators, marginal field holders, and asset management teams across the Niger Delta.
                </p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline space-x-1 font-mono">
                  <span className="text-3xl font-extrabold text-wellqc-text">
                    {currency === "NGN" ? "₦18M – ₦36M" : "$15K – $30K"}
                  </span>
                  <span className="text-wellqc-muted text-xs">/ year</span>
                </div>
                <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 mt-1">
                  Up to 25 seats • Custom fleet audit included
                </p>
              </div>

              <div className="space-y-3 pt-4 border-t border-wellqc-border text-xs">
                <p className="font-mono text-slate-400 font-bold tracking-wide uppercase text-[10px]">
                  Enterprise Capabilities:
                </p>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Multi-Well Correlation:</strong> Akata, Agbada &amp; Benin cutoffs</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Fleet Telemetry:</strong> Central executive health dashboard</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Integration:</strong> Direct Petrel, Techlog &amp; GeoGraphix flow</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Deployment:</strong> Dedicated VPC or Air-Gapped On-Premises</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>SLA &amp; Support:</strong> Dedicated Technical Account Manager (2h SLA)</span>
                  </li>
                  <li className="flex items-start gap-2 text-wellqc-text">
                    <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                    <span><strong>Regulatory:</strong> Official NUPRC PIA filing endorsement</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-8">
              <Link
                href="#contact"
                className="w-full py-3 rounded-xl border border-purple-500/40 hover:border-purple-500 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Request Fleet Audit &amp; Quote</span>
                <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
              </Link>
            </div>
          </div>
        </div>

        {/* Commercial Trust & Payment Infrastructure Strip */}
        <div className="rounded-2xl bg-wellqc-card border border-wellqc-border p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-wellqc-text">
                Multi-Channel Payment Infrastructure Powered by Paystack
              </h4>
              <p className="text-xs text-wellqc-muted mt-0.5">
                Instant checkout via Nigerian Naira (Verve, Mastercard, Visa, Bank Transfer, USSD) and International USD Cards. Zero downtime. Cancel anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-wellqc-muted shrink-0">
            <BadgeCheck className="w-4 h-4 text-emerald-500" />
            <span>NDPR &amp; AES-256 Compliant</span>
          </div>
        </div>
      </div>

      {/* Paystack Upgrade Modal */}
      <PaystackUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultPlanId={selectedPlanId}
        reason="Activate WellQC Pro to unlock the Quality Engine & automated LAS repair."
      />
    </section>
  );
}

