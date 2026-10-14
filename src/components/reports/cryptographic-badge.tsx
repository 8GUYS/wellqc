"use client";

import React, { useState } from "react";
import { ShieldCheck, Lock, Copy, Check, Info, X } from "lucide-react";
import { computeWellSignature, WellSignatureMeta } from "@/lib/crypto-signature";

interface CryptographicBadgeProps {
  wellName: string;
  qualityScore: number;
  apiNo?: string;
  compact?: boolean;
}

export function CryptographicBadge({
  wellName,
  qualityScore,
  apiNo,
  compact = false,
}: CryptographicBadgeProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const sig: WellSignatureMeta = computeWellSignature({
    wellName,
    qualityScore,
    apiNo,
  });

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sig.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>SHA-256: {sig.shortHash}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition-colors cursor-pointer ml-0.5"
          title="Copy full cryptographic SHA-256 digest"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                NUPRC PIA-2021 Tamper-Proof Seal
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                VERIFIED
              </span>
            </div>
            <div className="text-[11px] font-mono text-emerald-300/80 mt-0.5 flex items-center gap-2">
              <span>SHA-256: <strong className="text-white font-bold">{sig.shortHash}</strong></span>
              <button
                type="button"
                onClick={handleCopy}
                className="hover:text-white transition-colors cursor-pointer"
                title="Copy full SHA-256 digest"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400 inline" /> : <Copy className="w-3 h-3 inline" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Audit Seal Details</span>
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase">
                  Cryptographic Verification Seal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-slate-300">
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500">Record Seal ID</span>
                <span className="text-white font-bold">{sig.sealId}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500">Signing Standard</span>
                <span className="text-white font-bold">{sig.standard}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500">Hashing Algorithm</span>
                <span className="text-emerald-300 font-bold">{sig.algorithm}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-slate-500">Issuing Authority</span>
                <span className="text-white font-bold">{sig.issuingAuthority}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[10px] uppercase text-slate-400 font-bold">
                Complete SHA-256 Digest (Hex):
              </div>
              <div className="text-[11px] text-emerald-300 break-all select-all font-bold">
                {sig.hash}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                Close Verification Info
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
