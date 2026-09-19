"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  CheckCircle2,
  Sparkles,
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
  Lock,
  RotateCcw,
  Check,
  LogIn,
} from "lucide-react";
import { PAYSTACK_PLANS, PaymentCurrency } from "@/lib/paystack";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: "pro_monthly" | "pro_annual" | "enterprise";
  onSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  defaultPlan = "pro_monthly",
  onSuccess,
}: PaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(defaultPlan);
  const [currency, setCurrency] = useState<PaymentCurrency>("NGN");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [isDemoSigningIn, setIsDemoSigningIn] = useState(false);

  // Payment Runner Stages: "selection" | "processing_demo" | "success"
  const [paymentStage, setPaymentStage] = useState<"selection" | "processing_demo" | "success">("selection");
  const [demoStep, setDemoStep] = useState<number>(1);
  const [demoStatusText, setDemoStatusText] = useState<string>("");
  const [successDetails, setSuccessDetails] = useState<{
    planName: string;
    amount: string;
    reference: string;
    channel: string;
  } | null>(null);

  // Ensure portal target (document.body) is available on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset stage and error state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentStage("selection");
      setErrorMessage("");
      setAuthRequired(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Update default plan if prop changes
  useEffect(() => {
    if (defaultPlan) {
      setSelectedPlanId(defaultPlan);
      if (defaultPlan === "pro_annual") {
        setBillingCycle("annual");
      }
    }
  }, [defaultPlan]);

  // Lock body scroll and listen for ESC key when modal is active
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const currentPlanKey =
    selectedPlanId === "enterprise"
      ? "enterprise"
      : billingCycle === "annual"
      ? "pro_annual"
      : "pro_monthly";

  const selectedPlan = PAYSTACK_PLANS[currentPlanKey] || PAYSTACK_PLANS.pro_monthly;

  // 1-Click Demo Login if unauthenticated
  const handleQuickDemoLogin = async () => {
    setIsDemoSigningIn(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login" }),
      });
      if (!res.ok) throw new Error("Could not initialize demo session.");
      setAuthRequired(false);
      // Dispatch user updated event
      window.dispatchEvent(new CustomEvent("wellqc_user_updated"));
      // Immediately proceed with checkout
      await runPaystackCheckout();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to sign in demo account.");
    } finally {
      setIsDemoSigningIn(false);
    }
  };

  const handlePaystackCheckout = async () => {
    await runPaystackCheckout();
  };

  const runPaystackCheckout = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setAuthRequired(false);

    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          currency,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setAuthRequired(true);
        setIsLoading(false);
        return;
      }

      if (!response.ok || !data.status) {
        throw new Error(data.error || "Unable to initialize Paystack transaction.");
      }

      // Check if we are in demo / sandbox mode
      if (data.isDemo || data.authorizationUrl?.includes("demo=true")) {
        // Run the interactive demo payment simulator in-modal!
        setIsLoading(false);
        setPaymentStage("processing_demo");
        await executeDemoPaymentSimulation(data.reference || `wellqc_demo_${Date.now()}`);
        return;
      }

      // Live Paystack Redirect (Only when real credentials configured)
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error("No Paystack authorization URL returned.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Payment initialization failed.");
      setIsLoading(false);
      setPaymentStage("selection");
    }
  };

  const executeDemoPaymentSimulation = async (reference: string) => {
    const formattedAmount =
      currency === "NGN"
        ? `₦${selectedPlan.amountNgn.toLocaleString()}`
        : `$${selectedPlan.amountUsd}`;

    try {
      // Step 1: Connecting
      setDemoStep(1);
      setDemoStatusText("Connecting to Paystack Sandbox Payment Gateway...");
      await new Promise((r) => setTimeout(r, 650));

      // Step 2: Processing test card/transfer
      setDemoStep(2);
      setDemoStatusText(`Authorizing Demo Payment of ${formattedAmount} via Paystack Test Card/Transfer...`);
      await new Promise((r) => setTimeout(r, 850));

      // Step 3: Verifying transaction with WellQC+ Engine
      setDemoStep(3);
      setDemoStatusText(`Verifying Transaction Reference (${reference.slice(0, 18)}...)...`);

      const verifyRes = await fetch("/api/paystack/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          planId: selectedPlan.id,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok || !verifyData.status) {
        throw new Error(verifyData.error || "Sandbox transaction verification failed.");
      }

      // Step 4: Finalize & Success
      setDemoStep(4);
      setDemoStatusText("Payment Approved! Activating Pro Subscription...");
      await new Promise((r) => setTimeout(r, 500));

      setSuccessDetails({
        planName: selectedPlan.name,
        amount: formattedAmount,
        reference: verifyData.reference || reference,
        channel: verifyData.channel || "Paystack Sandbox (Card/Transfer)",
      });

      setPaymentStage("success");

      // Dispatch global user updated event to re-fetch session across app
      window.dispatchEvent(new CustomEvent("wellqc_user_updated"));
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sandbox payment simulation failed.");
      setPaymentStage("selection");
    }
  };

  const handleResetToFree = async () => {
    try {
      await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      window.dispatchEvent(new CustomEvent("wellqc_user_updated"));
      setPaymentStage("selection");
    } catch {}
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && paymentStage !== "processing_demo") {
          onClose();
        }
      }}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto text-slate-100 relative z-[100000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border-b border-slate-800 flex items-start justify-between relative">
          <div className="space-y-1 pr-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>WellQC+ Paystack Gateway &bull; Demo Sandbox</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {paymentStage === "success"
                ? "Payment Verified & Upgraded"
                : paymentStage === "processing_demo"
                ? "Paystack Sandbox Simulator"
                : "Upgrade Subscription Tier"}
            </h2>
            <p className="text-xs text-slate-400">
              {paymentStage === "success"
                ? "Your subscription is now active with unlimited LAS audits and KNN imputation."
                : paymentStage === "processing_demo"
                ? "Simulating seamless Paystack debit card and bank transfer checkout."
                : "Unlock unlimited petrophysical log audits, KNN curve imputation, and PDF certificates."}
            </p>
          </div>

          {paymentStage !== "processing_demo" && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body: Processing Demo State */}
        {paymentStage === "processing_demo" && (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-blue-500/20 border border-emerald-500/40 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold">
                <span>Running Paystack Demo Payment</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {demoStatusText}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Simulating {selectedPlan.name} (
                {currency === "NGN"
                  ? `₦${selectedPlan.amountNgn.toLocaleString()}`
                  : `$${selectedPlan.amountUsd}`}
                )
              </p>
            </div>

            {/* Stepper Progress Indicators */}
            <div className="space-y-3 pt-2 max-w-sm mx-auto">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className={demoStep >= 1 ? "text-emerald-400 font-bold" : ""}>1. Connect</span>
                <span className={demoStep >= 2 ? "text-emerald-400 font-bold" : ""}>2. Authorize</span>
                <span className={demoStep >= 3 ? "text-emerald-400 font-bold" : ""}>3. Verify</span>
                <span className={demoStep >= 4 ? "text-emerald-400 font-bold" : ""}>4. Activate</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
                  style={{ width: `${(demoStep / 4) * 100}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono flex items-center justify-center gap-1.5 pt-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Testing sandbox credentials safely. No real funds are debited.</span>
            </div>
          </div>
        )}

        {/* Modal Body: Success State */}
        {paymentStage === "success" && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Subscription Upgraded to PRO!
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Your transaction was verified via Paystack sandbox. All limit restrictions have been removed.
                </p>
              </div>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-2">
                <span>Plan Tier:</span>
                <span className="font-bold text-white text-right">{successDetails?.planName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-2">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-400">{successDetails?.amount}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400 border-b border-slate-800/80 pb-2">
                <span>Reference:</span>
                <span className="text-slate-300 text-[11px] truncate max-w-[200px]">{successDetails?.reference}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Gateway Status:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                  ACTIVE &bull; DEMO VERIFIED
                </span>
              </div>
            </div>

            {/* Unlocked Benefits */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 text-xs text-slate-200 space-y-1.5">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Unlimited Features Unlocked:</span>
              </div>
              <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 pl-5 list-disc">
                <li>Unlimited LAS log audits</li>
                <li>KNN curve imputation</li>
                <li>Multi-track wireline plots</li>
                <li>PDF quality certificates</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <span>Continue in Pro Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetToFree}
                className="w-full py-2 px-3 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Test again (Reset to Free Starter 2/2 Checks)</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body: Standard Plan Selection State */}
        {paymentStage === "selection" && (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Unauthenticated Alert if triggered */}
            {authRequired && (
              <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <LogIn className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-white text-sm">Authentication Required</div>
                    <p className="text-slate-300 leading-relaxed">
                      You must be signed in so your account can be linked to the Pro subscription.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    disabled={isDemoSigningIn}
                    className="px-3.5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-60"
                  >
                    {isDemoSigningIn ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>1-Click Demo Sign-In</span>
                  </button>

                  <Link
                    href="/login"
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Go to Login Page
                  </Link>
                </div>
              </div>
            )}

            {/* Currency & Billing Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {/* Currency Toggle */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-400 font-mono">Currency:</span>
                <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrency("NGN")}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                      currency === "NGN"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ₦ NGN (Naira)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                      currency === "USD"
                        ? "bg-emerald-500 text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    $ USD (Dollar)
                  </button>
                </div>
              </div>

              {/* Billing Interval Toggle */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-slate-400 font-mono">Billing:</span>
                <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setBillingCycle("monthly");
                      setSelectedPlanId("pro_monthly");
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      billingCycle === "monthly" && selectedPlanId !== "enterprise"
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillingCycle("annual");
                      setSelectedPlanId("pro_annual");
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                      billingCycle === "annual" && selectedPlanId !== "enterprise"
                        ? "bg-cyan-500 text-slate-950 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>Annual</span>
                    <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-400 text-slate-950 font-black">
                      -17%
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Plan Details Card */}
            <div className="bg-gradient-to-b from-slate-800/60 to-slate-900/90 border-2 border-emerald-500/60 rounded-xl p-4 sm:p-5 relative shadow-lg shadow-emerald-500/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <span>{selectedPlan.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Active Choice
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedPlan.description}</p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                    {currency === "NGN"
                      ? `₦${selectedPlan.amountNgn.toLocaleString()}`
                      : `$${selectedPlan.amountUsd}`}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {selectedPlan.interval === "annually"
                      ? "/ year (2 months free)"
                      : "/ month"}
                  </div>
                </div>
              </div>

              {/* Plan Features Checklist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-700/60 text-xs text-slate-300">
                {selectedPlan.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported Nigerian & Global Payment Channels (Paystack) */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                <span>Accepted Payment Methods (Powered by Paystack)</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  256-Bit SSL Encrypted
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-semibold">Cards (Verve / Visa / MC)</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-semibold">Bank Transfer</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 flex flex-col items-center justify-center gap-1">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span className="text-[11px] font-semibold">USSD &amp; Mobile</span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                {errorMessage}
              </div>
            )}

            {/* Checkout CTA */}
            <div className="space-y-2.5 pt-1">
              <button
                onClick={handlePaystackCheckout}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Paystack...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>
                      Pay{" "}
                      {currency === "NGN"
                        ? `₦${selectedPlan.amountNgn.toLocaleString()}`
                        : `$${selectedPlan.amountUsd}`}{" "}
                      with Paystack
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Demo mode active: Instant automated activation</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
