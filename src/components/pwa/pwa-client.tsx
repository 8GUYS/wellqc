"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PWAClient() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== "undefined" ? !navigator.onLine : false));
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("wellqc_pwa_dismissed") === "true";
      } catch {}
    }
    return false;
  });
  const [isStandalone] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return Boolean(
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as unknown as { standalone?: boolean })?.standalone === true
        );
      } catch {}
    }
    return false;
  });

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            // Check for updates periodically
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[WellQC PWA] New update ready.");
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn("[WellQC PWA] SW registration failed:", err);
          });
      });
    }

    // 2. Listen for Install Prompt (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 3. Online / Offline status monitoring
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn("[WellQC PWA] Install error:", err);
    }
  };

  const handleDismiss = () => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem("wellqc_pwa_dismissed", "true");
    } catch {}
  };

  return (
    <>
      {/* Offline Toast Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black px-4 py-1.5 text-xs font-semibold flex items-center justify-center space-x-2 shadow-lg animate-in slide-in-from-top duration-200">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline Mode Active &bull; Running on cached workstation telemetry</span>
        </div>
      )}

      {/* Floating Install Prompt (PWA Banner) */}
      {isInstallable && !isStandalone && !bannerDismissed && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full bg-wellqc-panel/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl text-wellqc-text font-sans animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <Download className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-white">Install WellQC App</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    PWA
                  </span>
                </div>
                <p className="text-[11px] text-wellqc-muted leading-tight">
                  Launch WellQC as a high-speed desktop/mobile workstation with offline support.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3.5 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-wellqc-muted hover:text-white transition-colors"
            >
              Maybe Later
            </button>
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/25 transition-all flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Workstation</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
