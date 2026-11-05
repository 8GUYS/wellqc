"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        An unexpected error occurred. Our team has been notified via automated telemetry.
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <RotateCcw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}
