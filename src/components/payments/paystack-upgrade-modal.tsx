"use client";

import { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { initializePayment } from "@/lib/paystack";

interface PaystackUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  defaultPlanId?: string;
  targetWellId?: string;
}

export function PaystackUpgradeModal({
  isOpen,
  onClose,
  reason,
  defaultPlanId = "PRO_MONTHLY",
  targetWellId,
}: PaystackUpgradeModalProps) {
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [selectedPlan] = useState<string>(defaultPlanId);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isOpen) {
      Promise.resolve().then(() => {
        if (active) {
          setErrorMessage(null);
          setIsLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const queryParam = targetWellId ? `?wellId=${encodeURIComponent(targetWellId)}` : "";
      const callbackUrl = `${window.location.origin}/payment/verify${queryParam}`;
      const response = await initializePayment(selectedPlan, currency, callbackUrl);

      if (response?.authorization_url) {
        window.location.href = response.authorization_url;
      } else {
        throw new Error("Unable to retrieve checkout gateway URL.");
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to launch Paystack checkout. Please try again."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={() => !isLoading && onClose()}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl z-10 overflow-hidden text-slate-100 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Banner */}
        <div className="p-5 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-900 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-400 block">
                WellQC Enterprise Licensing
              </span>
              <h2 className="text-lg font-black text-white tracking-tight">
                Upgrade to WellQC Pro
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {reason && (
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
              <span>{reason}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Currency Toggle */}
          <div className="flex items-center justify-between bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 pl-3 font-medium">Select Currency:</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setCurrency("NGN")}
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
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
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
                  currency === "USD"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* Plan Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900 border-2 border-cyan-500/50 relative shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
                  Professional Tier
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  {currency === "NGN" ? "₦75,000" : "$49"}{" "}
                  <span className="text-xs font-normal text-slate-400 font-mono">/ month</span>
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                Billed Monthly
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Full petrophysical workstation access including automated log repairs, gap imputation, and certified NUPRC reports.
            </p>

            <div className="space-y-2 border-t border-slate-700/60 pt-3 text-xs font-mono">
              <div className="flex items-center space-x-2 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Unlimited LAS file ingestion & validation</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Full 4-Step QA Engine & Non-Destructive Repairs</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Spline, KNN & Linear Gap Imputation</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Official Form WQC-08-A NUPRC Certificates</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Multi-well wireline offset correlation</span>
              </div>
            </div>
          </div>

          {/* Payment Gateway Trust Indicators */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
            <span className="flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>256-bit SSL Encrypted</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Verve · Visa · Mastercard · Transfer</span>
            </span>
          </div>

          {/* Action CTA */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-mono font-black text-sm transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Connecting to Paystack...</span>
              </>
            ) : (
              <>
                <span>Proceed to Paystack Secure Checkout</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 text-[10px] text-center font-mono text-slate-500">
          Transactions are processed securely by Paystack. Subscriptions can be managed or canceled anytime.
        </div>
      </div>
    </div>
  );
}

