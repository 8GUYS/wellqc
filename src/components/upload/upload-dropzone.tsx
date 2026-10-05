"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFilesSelected, disabled }: UploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = "";
  };

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
        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
            LAS 2.0 / 3.0
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-900 border border-wellqc-border text-[11px] font-mono text-slate-300">
            Batch Ingestion
          </span>
        </div>
      </label>
    </section>
  );
}
