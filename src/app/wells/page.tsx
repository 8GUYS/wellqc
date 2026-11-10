"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ============================================================================
 * WellQC Subsurface Platform - Well Asset Route
 * ============================================================================
 * NOTE: The standalone Well Asset page has been retired and merged into the
 * Data Upload Workstation (/upload) where uploaded well files and LAS logs are
 * managed directly via the Database Wells table.
 *
 * Direct navigation to /wells forwards automatically to /upload.
 * ============================================================================
 */
export default function WellManagementPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/upload");
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-300">Forwarding to Data Upload Workstation...</p>
      </div>
    </div>
  );
}
