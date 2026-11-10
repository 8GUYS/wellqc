"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { verifyPaymentReference, PaymentVerificationResponse } from "@/lib/paystack";
import { safeReadJson } from "@/lib/http-client";
import { WellDetailResponse } from "@/lib/api-types";

function PaymentVerifyContent() {
  const searchParams = useSearchParams();

  const reference = searchParams.get("reference");
  const targetWellId = searchParams.get("wellId");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaymentVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetWell, setTargetWell] = useState<{
    id: string;
    name: string;
    qualityGrade?: string;
  } | null>(null);

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
          setTargetWell({
            id: parsed.data.well.id,
            name: parsed.data.well.name,
            qualityGrade: parsed.data.well.qualityGrade,
          });
        }
      } catch {
        // Non-critical; fallback to generic label if well fetch fails
      }
    }

    loadWellContext();
    return () => {
      active = false;
    };
  }, [targetWellId]);

  useEffect(() => {
    let active = true;

    async function executeVerification() {
      if (!reference) {
        if (active) {
          setError("Missing transaction reference parameter.");
          setLoading(false);
        }
        return;
      }

      try {
        if (active) {
          setLoading(true);
          setError(null);
        }

        const data = await verifyPaymentReference(reference);
        if (!active) return;

        if (data.status === "SUCCESS") {
          setResult(data);
          // Trigger global user session update so headers and shells immediately reflect PRO
          try {
            window.dispatchEvent(new Event("wellqc_user_updated"));
          } catch {}
        } else {
          setError(data.message || "Payment has not been completed.");
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to verify transaction settlement.");
      } finally {
        if (active) setLoading(false);
      }
    }

    Promise.resolve().then(() => {
      if (active) executeVerification();
    });

    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500" />

        {loading && (
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-white font-mono">
                Verifying Transaction...
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Validating settlement with Paystack gateway.
              </p>
              {reference && (
                <div className="pt-2 text-[11px] font-mono text-cyan-400">
                  Ref: <span className="font-bold">{reference}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-black text-white font-mono">
                Payment Verification Failed
              </h2>
              <p className="text-xs text-rose-300 font-mono leading-relaxed bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20">
                {error}
              </p>
              {reference && (
                <p className="text-[10px] font-mono text-slate-500">
                  Reference: {reference}
                </p>
              )}
            </div>

            <div className="flex flex-col w-full space-y-2 pt-2">
              <Link
                href="/pricing"
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs text-center transition-all shadow-md"
              >
                Return to Pricing
              </Link>
              <Link
                href="/upload"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs text-center transition-all border border-slate-700"
              >
                Go to Workstation
              </Link>
            </div>
          </div>
        )}

        {!loading && result && (
          <div className="flex flex-col items-center text-center space-y-5 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-emerald-400 block">
                Settlement Confirmed
              </span>
              <h2 className="text-xl font-black text-white tracking-tight">
                Welcome to WellQC Pro!
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
                Your subscription has been activated. You now have full access to automated petrophysical repair and NUPRC certification.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="w-full bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs font-mono text-left">
              <div className="flex justify-between items-center text-slate-400">
                <span>Plan:</span>
                <span className="font-bold text-white uppercase">{result.plan}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Amount Paid:</span>
                <span className="font-bold text-emerald-400">
                  {result.currency} {(result.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Reference:</span>
                <span className="text-[11px] text-cyan-400 truncate max-w-[180px]">
                  {result.reference}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  ACTIVE (PRO)
                </span>
              </div>
            </div>

            {/* Context Target Banner if initiated from a specific well */}
            {targetWell && (
              <div className="w-full bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-3 flex items-center justify-between text-xs font-mono text-left">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Ready for Calibration</span>
                    <span className="font-bold text-cyan-300 truncate block">{targetWell.name}</span>
                  </div>
                </div>
                {targetWell.qualityGrade && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold shrink-0">
                    Grade {targetWell.qualityGrade}
                  </span>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col w-full space-y-2 pt-2">
              <Link
                href={targetWellId ? `/qa-engine?wellId=${encodeURIComponent(targetWellId)}` : "/qa-engine"}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>
                  {targetWell?.name
                    ? `Proceed to Repair "${targetWell.name}"`
                    : targetWellId
                    ? "Proceed to Repair Well"
                    : "Launch QA Repair Engine"}
                </span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
              <Link
                href="/wells"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
              >
                <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Well Assets Registry</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono text-xs">
          Loading verification...
        </div>
      }
    >
      <PaymentVerifyContent />
    </Suspense>
  );
}

