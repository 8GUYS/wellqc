/**
 * Observability & Error Reporting Client
 * =====================================
 * Captures unhandled client and server errors and forwards them to Sentry
 * if NEXT_PUBLIC_SENTRY_DSN is configured.
 * Operates silently in development/staging when no DSN is provided.
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

type SentryLike = {
  captureException: (error: unknown, hint?: { extra?: Record<string, unknown> }) => void;
};

type WindowWithSentry = Window & { Sentry?: SentryLike };

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    console.error("[WellQC Observability] Client error captured:", error, context);
  }

  if (!SENTRY_DSN) {
    return;
  }

  try {
    // If Sentry is installed / loaded globally
    const win = typeof window !== "undefined" ? (window as WindowWithSentry) : null;
    if (win?.Sentry) {
      win.Sentry.captureException(error, { extra: context });
    }
  } catch (err) {
    console.warn("[WellQC Observability] Failed to ship error to Sentry:", err);
  }
}
