"use client";

import { useState } from "react";
import { UploadCloud, Lock, Sparkles } from "lucide-react";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  isFreeTier?: boolean;
  freeChecksUsed?: number;
  maxFreeChecks?: number;
  onUpgradeRequest?: () => void;
}

export function UploadDropzone({
  onFilesSelected,
  disabled,
  isFreeTier = false,
  freeChecksUsed = 0,
  maxFreeChecks = 3,
  onUpgradeRequest,
}: UploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const isLimitReached = isFreeTier && freeChecksUsed >= maxFreeChecks;
  const remaining = Math.max(0, maxFreeChecks - freeChecksUsed);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isLimitReached) setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    if (isLimitReached) {
      onUpgradeRequest?.();
      return;
    }
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLimitReached) {
      e.target.value = "";
      onUpgradeRequest?.();
      return;
    }
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = "";
  };

  if (isLimitReached) {
    return (
      <section
        aria-label="Upload Zone Limit Reached"
        className="border-2 border-dashed border-amber-500/40 rounded-2xl p-8 text-center bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-950/80 shadow-xl space-y-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Free Tier Upload Limit Reached ({freeChecksUsed} / {maxFreeChecks} Used)</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white font-mono">
            You Have Uploaded 3 of 3 Allowed LAS Files
          </h3>
          <p className="text-xs text-slate-400 font-mono leading-relaxed">
            Free Starter accounts are limited to 3 LAS well log uploads. Upgrade to WellQC Pro to unlock unlimited file uploads, automated petrophysical repair, and certified NUPRC exports.
          </p>
        </div>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onUpgradeRequest}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs font-mono shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>Upgrade to WellQC Pro (₦75,000 / $49)</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Upload Zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
        dragActive
          ? "border-cyan-400 bg-cyan-500/10 shadow-2xl shadow-cyan-500/20"
          : "border-wellqc-border hover:border-cyan-500/40 bg-wellqc-panel/40"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        type="file"
        accept=".las,.txt"
        multiple
        onChange={handleInputChange}
        className="hidden"
        id="las-file-input"
        disabled={disabled}
      />
      <label htmlFor="las-file-input" className="cursor-pointer block space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
          <UploadCloud className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <span className="text-base font-bold text-white block">
            Drag and drop raw LAS files here, or click to browse
          </span>
          <p className="text-xs text-wellqc-muted font-mono">
            Supports LAS 2.0 &amp; 3.0 ASCII well log files (.las, .txt up to 20MB per file)
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
            LAS 2.0 / 3.0
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
            Batch Ingestion
          </span>
          {isFreeTier && (
            <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-[11px] font-mono font-bold text-amber-300">
              Free Tier: {remaining} of {maxFreeChecks} uploads left
            </span>
          )}
        </div>
      </label>
    </section>
  );
}
