"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ============================================================================
 * WellQC Subsurface Platform - Dashboard Route
 * ============================================================================
 * NOTE: The Dashboard has been commented out / bypassed per application workflow
 * requirements, designating the Data Upload Workstation (/upload) as the primary focus.
 *
 * Any direct navigation to /dashboard is seamlessly forwarded to /upload.
 * The full original dashboard implementation is preserved in:
 * `src/app/dashboard/dashboard.backup.tsx`
 * ============================================================================
 */
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/upload");
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
      <div className="flex flex-col items-center space-y-3">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-300">Redirecting to Data Upload Workstation...</p>
      </div>
    </div>
  );
}
