"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Sparkles,
  ShieldCheck,
  Lock,
  HelpCircle,
  Zap,
  Receipt,
  Clock,
  RefreshCw,
} from "lucide-react";
import { WellQCLogo } from "@/components/ui/wellqc-logo";
import { PaystackUpgradeModal } from "@/components/payments/paystack-upgrade-modal";
import { getPaymentHistory, PaymentHistoryItem } from "@/lib/paystack";
import { safeReadJson } from "@/lib/http-client";
import { WellDetailResponse } from "@/lib/api-types";

function PricingContent() {
  const searchParams = useSearchParams();
  const targetWellId = searchParams.get("wellId");

  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">("monthly");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("PRO_MONTHLY");
  const [targetWellName, setTargetWellName] = useState<string | null>(null);

  // Payment History State
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [userTier, setUserTier] = useState<string>("FREE");
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch well name if wellId passed in URL
  useEffect(() => {
    if (!targetWellId) return;
    let active = true;

    async function loadWellContext() {
      try {
        const res = await fetch(`/api/wells/${encodeURIComponent(targetWellId!)}`, {
          cache: "no-store",
        });
        const parsed = await safeReadJson<WellDetailResponse>(res, "Unable to load well.");
        if (active && parsed.ok && parsed.data?.well) {
          setTargetWellName(parsed.data.well.name);
        }
      } catch {
        // Non-critical
      }
    }

    loadWellContext();
    return () => {
      active = false;
    };
  }, [targetWellId]);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await getPaymentHistory();
      setPaymentHistory(data.transactions || []);
      setUserTier(data.currentTier || "FREE");
    } catch {
      // Free or guest users might not have a session
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchHistory();
    });
    return () => {
      active = false;
    };
  }, []);

  const handleOpenUpgrade = (planId: string) => {
    setSelectedPlanId(planId);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link href="/upload" className="flex items-center space-x-2 font-mono">
          <WellQCLogo iconSize={32} showTagline={false} />
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            ENTERPRISE LICENSING
          </span>
        </Link>

        <div className="flex items-center space-x-3">
          <Link
            href="/wells"
            className="px-3.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-mono font-medium transition-colors hidden sm:inline-flex"
          >
            Well Assets
          </Link>
          <Link
            href="/upload"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-medium transition-colors"
          >
            ← Back to Workstation
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Petrophysical Licensing</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Predictable Pricing for Subsurface Teams
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto font-sans">
            From independent petrophysicists to multinational E&amp;P operators, automate your LAS log quality control with instant Paystack settlement in Naira or US Dollars.
          </p>

          {/* Contextual Target Banner if navigated from a specific well */}
          {(targetWellName || targetWellId) && (
            <div className="pt-2">
              <div className="inline-flex items-center space-x-2.5 px-4 py-2 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono shadow-inner">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Context Target:</span>
                <span className="font-bold text-white">{targetWellName || targetWellId}</span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">— Upgrade to activate automated QA anomaly repair</span>
              </div>
            </div>
          )}

          {/* Currency & Billing Period Switcher Controls */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs font-mono">
            {/* Currency Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setCurrency("NGN")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  currency === "NGN"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                NGN (₦)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  currency === "USD"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* Billing Cycle Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  billingCycle === "monthly"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annually")}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center space-x-1.5 ${
                  billingCycle === "annually"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Annual Billing</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  Save 17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {/* Plan 1: Starter / Free */}
          <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all shadow-xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Community Tier
                </span>
                <h3 className="text-2xl font-black text-white">Starter Free</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Essential wireline validation tools for individual students and academic researchers.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-3xl font-black text-white font-mono">
                  {currency === "NGN" ? "₦0" : "$0"}
                </div>
                <span className="text-xs text-slate-500 font-mono">Free forever</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300 font-mono pt-4 border-t border-slate-800">
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>CWLS LAS 2.0 / 3.0 Header Parsing</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Rule-Based Wireline Quality Audit</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Interactive Multi-Track Wireline Log Viewer</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Installable PWA (Offline Rig Mode for All)</span>
                </li>
                <li className="flex items-center space-x-2 text-slate-500">
                  <span className="w-4 h-4 text-center">—</span>
                  <span>Automated Despiking &amp; Repair</span>
                </li>
                <li className="flex items-center space-x-2 text-slate-500">
                  <span className="w-4 h-4 text-center">—</span>
                  <span>Cleaned LAS File Exports</span>
                </li>
              </ul>
            </div>

            <Link
              href="/upload"
              className="w-full py-3 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs text-center transition-all block shadow-sm"
            >
              Get Started Free
            </Link>
          </div>

          {/* Plan 2: WellQC Pro (Featured) */}
          <div className="rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-2 border-cyan-500/80 p-6 sm:p-8 flex flex-col justify-between space-y-6 relative shadow-2xl shadow-cyan-950/40">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-[10px] font-mono uppercase tracking-widest shadow-md">
              Most Popular Subsurface Choice
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                  Professional Tier
                </span>
                <h3 className="text-2xl font-black text-white">WellQC Pro</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Complete petrophysical repair studio for asset consultants, service companies, and operating teams.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-3xl font-black text-white font-mono flex items-baseline space-x-1">
                  <span>
                    {currency === "NGN"
                      ? billingCycle === "monthly" ? "₦75,000" : "₦750,000"
                      : billingCycle === "monthly" ? "$49" : "$490"}
                  </span>
                  <span className="text-xs text-slate-400 font-normal">
                    /{billingCycle === "monthly" ? "month" : "year"}
                  </span>
                </div>
                <span className="text-xs text-cyan-400 font-mono">Instant Paystack Activation</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-200 font-mono pt-4 border-t border-slate-800">
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Everything in Starter Free (including PWA)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Interactive Quality Engine Repair Workstation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Non-Destructive Despiking &amp; Baseline Drift</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Multi-Curve ML Gap Imputation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Uncapped Cleaned CWLS LAS 2.0 Exports</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>NUPRC Form WQC-08-A Digital Certificates</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => handleOpenUpgrade(billingCycle === "monthly" ? "PRO_MONTHLY" : "PRO_ANNUAL")}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono font-black text-xs text-center transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Upgrade to WellQC Pro</span>
            </button>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all shadow-xl">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  Enterprise Tier
                </span>
                <h3 className="text-2xl font-black text-white">Enterprise Hub</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  Dedicated tenant deployment for upstream E&amp;P operators, national data repositories, and IOCs.
                </p>
              </div>

              <div className="pt-2">
                <div className="text-2xl font-black text-white font-mono">Custom Quote</div>
                <span className="text-xs text-slate-500 font-mono">Billed annually · Dedicated SLA</span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300 font-mono pt-4 border-t border-slate-800">
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Everything in WellQC Pro</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Automated Batch Ingestion (10,000+ Wells)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>On-Premises / Private VPC Isolation</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>SSO / Active Directory Integration</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated Petrophysics Support Engineer</span>
                </li>
              </ul>
            </div>

            <Link
              href="mailto:contact@wellqc.internal?subject=WellQC%20Enterprise%20Inquiry"
              className="w-full py-3 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-mono font-bold text-xs text-center transition-all block shadow-sm"
            >
              Contact Enterprise Sales
            </Link>
          </div>
        </div>

        {/* Security / Compliance Badges */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
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

        {/* Subscription & Payment Transaction History Section */}
        <section aria-label="Subscription & Payment History" className="space-y-4 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold font-mono text-white tracking-tight">
                    Billing &amp; Payment History
                  </h2>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${
                      userTier === "PRO" || userTier === "ENTERPRISE"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    Active Tier: {userTier}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Review historical checkout settlements, Paystack transaction references, and digital invoices.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchHistory}
              disabled={historyLoading}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-mono text-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${historyLoading ? "animate-spin" : ""}`} />
              <span>Refresh History</span>
            </button>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {historyLoading && paymentHistory.length === 0 ? (
              <div className="p-8 text-center text-cyan-300 text-xs font-mono flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Loading payment records...</span>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="p-8 text-center space-y-2 font-mono">
                <Clock className="w-7 h-7 text-slate-600 mx-auto" />
                <div className="text-xs font-bold text-white">No payment transactions recorded yet</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  When you subscribe or upgrade your account to WellQC Pro, your transaction receipts and invoices will be cataloged here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Date &amp; Time</th>
                      <th className="p-3.5">Reference Code</th>
                      <th className="p-3.5">Plan Activated</th>
                      <th className="p-3.5">Amount Settled</th>
                      <th className="p-3.5">Channel</th>
                      <th className="p-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paymentHistory.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3.5 text-slate-300 whitespace-nowrap">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "Recent"}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-semibold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                            {tx.reference}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-white uppercase whitespace-nowrap">
                          {tx.plan}
                        </td>
                        <td className="p-3.5 text-emerald-400 font-bold whitespace-nowrap">
                          {tx.currency} {(tx.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-slate-400 uppercase text-[11px] whitespace-nowrap">
                          {tx.channel || "Standard"}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              tx.status === "SUCCESS"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : tx.status === "PENDING"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

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
        onClose={() => {
          setModalOpen(false);
          fetchHistory();
        }}
        defaultPlanId={selectedPlanId}
        targetWellId={targetWellId || undefined}
      />
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono text-xs">
          Loading enterprise licensing...
        </div>
      }
    >
      <PricingContent />
    </Suspense>
  );
}
