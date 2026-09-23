"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Activity,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building2,
  Smartphone,
  HelpCircle,
  Zap,
  Lock,
} from "lucide-react";
import { PAYSTACK_PLANS, PaymentCurrency } from "@/lib/paystack";
import { PaymentModal } from "@/components/pricing/payment-modal";

export default function PricingPage() {
  const [currency, setCurrency] = useState<PaymentCurrency>("NGN");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPlan, setModalPlan] = useState<"pro_monthly" | "pro_annual" | "enterprise">("pro_monthly");
  const [currentUser, setCurrentUser] = useState<{ id?: string; email?: string; tier?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  const proPlan = billingCycle === "annual" ? PAYSTACK_PLANS.pro_annual : PAYSTACK_PLANS.pro_monthly;

  const handleOpenCheckout = (planId: "pro_monthly" | "pro_annual" | "enterprise") => {
    setModalPlan(planId);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1">
                WellQC<span className="text-cyan-400">+</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono -mt-1 uppercase tracking-widest">
                Payment Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center space-x-3">
            {currentUser ? (
              <Link
                href="/dashboard"
                className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-semibold px-3 py-1.5 text-slate-300 hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-md shadow-emerald-500/20"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Pricing Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-12">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Paystack Supported Payment Gateway</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Transparent Pricing for Subsurface Teams
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Seamless payments for Nigerian and global petrophysicists. Pay with Cards (Verve/Visa/MC), Bank Transfer, or USSD via Paystack.
          </p>

          {/* Currency and Interval Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {/* Currency Pill */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
              <span className="text-xs text-slate-400 font-mono px-2">Currency:</span>
              <button
                onClick={() => setCurrency("NGN")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  currency === "NGN"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ₦ NGN (Naira)
              </button>
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  currency === "USD"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                $ USD (Dollar)
              </button>
            </div>

            {/* Billing Interval Pill */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shadow-inner">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  billingCycle === "monthly"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Annual</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-400 text-slate-950 font-black uppercase">
                  Save 17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Starter Card */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Starter Free</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold font-mono">
                  Freemium
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Test and audit your own LAS files with zero commitment.
              </p>
              <div>
                <div className="text-4xl font-black text-white font-mono">$0 / ₦0</div>
                <div className="text-xs text-slate-400 font-mono mt-1">2 free LAS log file checks</div>
              </div>

              <ul className="space-y-3.5 text-xs text-slate-300 border-t border-slate-800/80 pt-6">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>2 Free LAS Log Audits</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Petrophysical Quality Score Report</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Mnemonic Standardisation Engine</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Standardised LAS 2.0 Export</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              {currentUser ? (
                <div className="w-full text-center py-3 px-4 rounded-xl text-xs font-mono font-bold bg-slate-800/60 text-slate-400 border border-slate-700/50">
                  Current Free Starter Plan
                </div>
              ) : (
                <Link
                  href="/register"
                  className="block w-full text-center py-3 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                >
                  Create Free Account
                </Link>
              )}
            </div>
          </div>

          {/* Pro Petrophysicist Card (Highlighted with Paystack Checkout) */}
          <div className="bg-slate-900/90 rounded-2xl border-2 border-emerald-500 p-8 flex flex-col justify-between relative shadow-2xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 text-xs font-black tracking-wider uppercase shadow-md flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Recommended</span>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Pro Petrophysicist</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold font-mono">
                  Unlimited
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Full access for geoscientists and subsurface engineers.
              </p>
              <div>
                <div className="text-4xl font-black text-white font-mono">
                  {currency === "NGN"
                    ? `₦${proPlan.amountNgn.toLocaleString()}`
                    : `$${proPlan.amountUsd}`}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  {billingCycle === "annual" ? "per year (2 months free)" : "per month"}
                </div>
              </div>

              <ul className="space-y-3.5 text-xs text-slate-300 border-t border-slate-800/80 pt-6">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Unlimited LAS File Audits &amp; QA</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Interactive Wireline Multi-Track Viewer</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Machine Learning KNN &amp; Spline Imputation</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Multi-Well Side-by-Side Inversion</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Executive PDF Audit Certificates</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Paystack Instant NGN/USD Activation</span>
                </li>
              </ul>
            </div>

            <div className="pt-8 space-y-2">
              <button
                onClick={() =>
                  handleOpenCheckout(billingCycle === "annual" ? "pro_annual" : "pro_monthly")
                }
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Upgrade via Paystack</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="text-center text-[10px] text-slate-400 font-mono">
                Cards, Bank Transfer, USSD Accepted
              </div>
            </div>
          </div>

          {/* Enterprise Card */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Enterprise Hub</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-semibold font-mono">
                  Custom
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                For E&amp;P operators, energy corporations, and team fleets.
              </p>
              <div>
                <div className="text-4xl font-black text-white font-mono">Custom</div>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Tailored corporate licensing &amp; SLA
                </div>
              </div>

              <ul className="space-y-3.5 text-xs text-slate-300 border-t border-slate-800/80 pt-6">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Everything in Pro Plan</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom Corporate Mnemonic Dictionaries</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>On-Premise / Private Cloud Setup</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited Team Seats &amp; SSO/SAML</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>24/7 Dedicated Support &amp; SLA</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/#contact"
                className="block w-full text-center py-3 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                Contact Enterprise Sales
              </Link>
            </div>
          </div>
        </div>

        {/* Paystack Payment Security & Methods Trust Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Seamless &amp; Secure Payment Experience via Paystack</span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                PCI-DSS Level 1 certified transaction processing designed specifically for Nigerian and African markets.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Instant Automated Activation</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              <div className="text-sm font-bold text-white">All Major Debit &amp; Credit Cards</div>
              <p className="text-xs text-slate-400">
                Supports Verve, Mastercard, Visa cards issued by Nigerian and international banks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <div className="text-sm font-bold text-white">Direct Bank Transfer</div>
              <p className="text-xs text-slate-400">
                Generate a dynamic Paystack virtual account number to transfer funds instantly from your banking app.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <Smartphone className="w-5 h-5 text-purple-400" />
              <div className="text-sm font-bold text-white">USSD &amp; Mobile Banking</div>
              <p className="text-xs text-slate-400">
                Pay quickly via USSD strings from GTBank (*737#), FirstBank (*894#), Zenith (*966#), and more.
              </p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-4xl mx-auto space-y-6 pt-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-400" />
              <span>Frequently Asked Questions</span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Everything you need to know about payments and billing for WellQC+
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-sm font-bold text-white">How does the 2 free checks limit work?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When you create a free account, you can validate and ingest up to 2 LAS well files with full anomaly detection and mnemonic standardisation. After that, upgrade to Pro for unlimited checks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-sm font-bold text-white">Can I pay in Nigerian Naira (NGN)?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes! WellQC+ is integrated with Paystack. You can pay ₦75,000/month or ₦750,000/year using any Nigerian debit card, direct bank transfer, or USSD.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-sm font-bold text-white">Will my subscription activate immediately?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes. As soon as your Paystack transaction is verified, your account tier is instantly upgraded to PRO, unlocking all wireline tracks and KNN imputation.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h4 className="text-sm font-bold text-white">Do you offer corporate or team billing?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes, our Annual Pro plan includes multi-user seat sharing for up to 5 engineers, and Enterprise plans offer tailored corporate invoicing and PO billing.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 text-center text-xs text-slate-500 font-mono">
        <p>&copy; {new Date().getFullYear()} WellQC+ Subsurface Analytics. Secured by Paystack Payment Gateway.</p>
      </footer>

      {/* Paystack Checkout Modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultPlan={modalPlan}
      />
    </div>
  );
}
