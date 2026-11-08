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
  HelpCircle,
  Building2,
  Zap,
} from "lucide-react";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";

export default function PricingPage() {
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("PRO_MONTHLY");

  const handleOpenUpgrade = (planId: string) => {
    setSelectedPlanId(planId);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/upload" className="flex items-center space-x-2 font-mono">
          <span className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-sm">
            W
          </span>
          <span className="font-extrabold text-white text-sm tracking-wide">
            WellQC <span className="text-cyan-400">STUDIO</span>
          </span>
        </Link>

        <div className="flex items-center space-x-3">
          <Link
            href="/upload"
            className="px-3.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-mono font-medium transition-colors"
          >
            ← Back to Workstation
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Petrophysical Licensing</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Predictable Pricing for Subsurface Teams
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto font-sans">
            From independent petrophysicists to multinational E&P operators, automate your LAS log quality control with instant Paystack settlement in Naira or US Dollars.
          </p>

          {/* Currency & Billing Period Switcher Controls */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-mono">
            {/* Currency Switcher */}
            <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setCurrency("NGN")}
                className={`px-4 py-2 rounded-xl font-bold transition-all ${
                  currency === "NGN"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                NGN (₦ Naira)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-4 py-2 rounded-xl font-bold transition-all ${
                  currency === "USD"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                USD ($ Dollars)
              </button>
            </div>

            {/* Billing Cycle */}
            <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-2 rounded-xl font-bold transition-all ${
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
                className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                  billingCycle === "annually"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Annual</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {/* Card 1: Starter Free */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Community
                </span>
                <h3 className="text-xl font-black text-white mt-1">Free Starter</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ideal for testing syntax and learning wireline log interpretation.
                </p>
              </div>

              <div className="pt-2">
                <span className="text-3xl font-black text-white">
                  {currency === "NGN" ? "₦0" : "$0"}
                </span>
                <span className="text-xs text-slate-500 font-mono"> / forever</span>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-800 text-xs font-mono">
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>2 Free automated LAS quality checks</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>Standard wireline log viewer</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>Mnemonic dictionary lookups</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>Community knowledgebase access</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Link
                href="/upload"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs text-center block transition-colors border border-slate-700"
              >
                Current Default Tier
              </Link>
            </div>
          </div>

          {/* Card 2: Professional Pro */}
          <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-cyan-950/30 border-2 border-cyan-500 p-6 flex flex-col justify-between relative shadow-2xl shadow-cyan-950/50">
            {/* Popular Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-500 text-slate-950 font-bold font-mono text-[10px] uppercase tracking-wider shadow-md">
              Most Popular
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  Professional E&P
                </span>
                <h3 className="text-xl font-black text-white mt-1">WellQC Pro</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Full automated remediation, gap imputation, and NUPRC certification.
                </p>
              </div>

              <div className="pt-2">
                <span className="text-3xl font-black text-white">
                  {currency === "NGN"
                    ? billingCycle === "monthly"
                      ? "₦75,000"
                      : "₦60,000"
                    : billingCycle === "monthly"
                    ? "$49"
                    : "$39"}
                </span>
                <span className="text-xs text-slate-400 font-mono"> / month</span>
                {billingCycle === "annually" && (
                  <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    Billed annually (save 20%)
                  </p>
                )}
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-800 text-xs font-mono">
                <div className="flex items-start space-x-2 text-white font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Unlimited LAS file ingestion & cleaning</span>
                </div>
                <div className="flex items-start space-x-2 text-white font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>4-Step QA Engine Non-Destructive Repair</span>
                </div>
                <div className="flex items-start space-x-2 text-white font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Spline, KNN & Linear Gap Imputation</span>
                </div>
                <div className="flex items-start space-x-2 text-white font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Official Form WQC-08-A NUPRC Certificates</span>
                </div>
                <div className="flex items-start space-x-2 text-white font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Multi-well offset wireline correlation</span>
                </div>
                <div className="flex items-start space-x-2 text-white font-medium">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Priority email support & full audit trail</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => handleOpenUpgrade("PRO_MONTHLY")}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black font-mono text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
              >
                <Zap className="w-4 h-4 text-slate-950" />
                <span>Upgrade with Paystack</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </button>
            </div>
          </div>

          {/* Card 3: Enterprise */}
          <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                  Enterprise Asset Fleet
                </span>
                <h3 className="text-xl font-black text-white mt-1">Enterprise Fleet</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Custom basin-scale analytics, custom dictionaries, and corporate SSO.
                </p>
              </div>

              <div className="pt-2">
                <span className="text-3xl font-black text-white">
                  {currency === "NGN" ? "₦45,000,000" : "$45,000"}
                </span>
                <span className="text-xs text-slate-500 font-mono"> / year</span>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-800 text-xs font-mono">
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Everything in Pro included</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Unlimited multi-tenant fleet seats</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Custom mnemonic corporate dictionary overrides</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Enterprise SAML 2.0 & Azure Active Directory SSO</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Direct S3 & Azure Blob storage dispatch</span>
                </div>
                <div className="flex items-start space-x-2 text-slate-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>Dedicated Petrophysical SRE & 99.95% SLA</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => handleOpenUpgrade("ENTERPRISE_ANNUAL")}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-mono text-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Contact Enterprise Licensing</span>
              </button>
            </div>
          </div>
        </div>

        {/* Paystack Security & Settlement Strip */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white block">
                PCI-DSS Level 1 Compliant Payments via Paystack
              </span>
              <span className="text-slate-400 text-[11px]">
                Accepts Verve, Visa, Mastercard, Direct Bank Transfer, USSD, and Apple Pay. Sensitive card data is never stored on WellQC servers.
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
              Instant Activation
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
              Cancel Anytime
            </span>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-6 pt-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-black text-white">Frequently Asked Questions</h2>
            <p className="text-xs text-slate-400 font-mono">
              Common questions about WellQC licensing and payments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>How does license activation work?</span>
              </h4>
              <p className="text-slate-400 leading-relaxed pl-6">
                Immediately upon completing checkout on Paystack, our cryptographic webhook updates your account tier in real time. You do not need to wait for manual provisioning.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Can I pay in Nigerian Naira (NGN)?</span>
              </h4>
              <p className="text-slate-400 leading-relaxed pl-6">
                Yes! We natively support Nigerian bank cards (Verve, Mastercard, Visa), bank transfers, and USSD via Paystack, as well as international cards in USD.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Are NUPRC Form WQC-08-A certificates legally recognized?</span>
              </h4>
              <p className="text-slate-400 leading-relaxed pl-6">
                Yes. Our reports are formatted to Nigerian Upstream Petroleum Regulatory Commission and Petroleum Industry Act (PIA 2021) guidelines, complete with cryptographic SHA-256 validation stamps.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h4 className="font-bold text-white flex items-center space-x-2">
                <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Can I cancel or change plans?</span>
              </h4>
              <p className="text-slate-400 leading-relaxed pl-6">
                You can manage or cancel your subscription at any time without long-term lock-in or cancellation penalties.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Checkout Modal */}
      <PaystackUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultPlanId={selectedPlanId}
      />
    </div>
  );
}

