"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, Sliders, Sparkles, ChevronRight } from "lucide-react";
import { useTheme, ThemeConfig } from "./theme-provider";
import { ThemeCustomizerModal } from "./theme-customizer-modal";

export function ThemeSwitcher() {
  const { theme, setTheme, themes, currentTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const standardThemes = themes.filter((t) => t.group === "standard");
  const gradientThemes = themes.filter((t) => t.group === "gradient");
  const customThemeConfig = themes.find((t) => t.group === "custom");

  return (
    <>
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center space-x-1.5 px-2.5 py-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 rounded-lg border border-slate-300/80 dark:border-slate-800 transition-colors text-xs font-mono shadow-sm"
          aria-label="Switch Workstation Color Theme"
          title={`Active Theme: ${currentTheme.name}. Click to change.`}
        >
          <Palette className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span
            className="w-2.5 h-2.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0"
            style={{ backgroundColor: currentTheme.colors.accent }}
          />
          <span className="hidden sm:inline text-[11px] font-medium text-slate-800 dark:text-slate-200">
            {currentTheme.name}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-2xl p-2.5 z-50 text-slate-800 dark:text-slate-200 font-mono animate-in fade-in zoom-in-95 duration-100 max-h-[82vh] overflow-y-auto">
            {/* Dropdown Header */}
            <div className="px-2 py-1.5 border-b border-wellqc-border flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-500" />
                <span>Workstation Palette</span>
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {themes.length} Presets
              </span>
            </div>

            {/* Custom Theme Studio Launch Button */}
            <div className="py-2 border-b border-wellqc-border">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCustomizerOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/15 via-purple-500/15 to-pink-500/15 hover:from-cyan-500/25 hover:to-pink-500/25 border border-cyan-500/30 text-slate-900 dark:text-white transition-all shadow-sm group"
              >
                <div className="flex items-center space-x-2">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-45 transition-transform" />
                  <div className="text-left">
                    <div className="text-xs font-bold leading-none flex items-center gap-1.5">
                      <span>Custom Color Studio</span>
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Build custom linear gradients &amp; tints
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Group 1: Standard Themes */}
            <div className="pt-2">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-wellqc-muted">
                Standard Workstations
              </div>
              <div className="space-y-1">
                {standardThemes.map((item) => (
                  <ThemeOptionRow
                    key={item.id}
                    item={item}
                    isActive={item.id === theme}
                    onSelect={() => {
                      setTheme(item.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Group 2: Radiant Gradients */}
            <div className="pt-3">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-wellqc-muted flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Radiant Gradients</span>
              </div>
              <div className="space-y-1">
                {gradientThemes.map((item) => (
                  <ThemeOptionRow
                    key={item.id}
                    item={item}
                    isActive={item.id === theme}
                    onSelect={() => {
                      setTheme(item.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Group 3: User Custom Theme */}
            {customThemeConfig && (
              <div className="pt-3">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-wellqc-muted">
                  Custom Studio Theme
                </div>
                <div className="relative">
                  <ThemeOptionRow
                    item={customThemeConfig}
                    isActive={theme === "custom"}
                    onSelect={() => {
                      setTheme("custom");
                      setOpen(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setCustomizerOpen(true);
                    }}
                    title="Edit custom theme colors"
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="px-2 pt-2.5 mt-2 border-t border-wellqc-border text-[9px] text-slate-500 dark:text-slate-400 text-center">
              Instantly syncs across all views &amp; stored locally
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Theme Customizer Modal */}
      <ThemeCustomizerModal
        isOpen={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
      />
    </>
  );
}

function ThemeOptionRow({
  item,
  isActive,
  onSelect,
}: {
  item: ThemeConfig;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors border ${
        isActive
          ? "bg-cyan-500/10 border-cyan-500/50 text-slate-950 dark:text-white"
          : "hover:bg-slate-100 dark:hover:bg-slate-800/40 border-transparent text-slate-700 dark:text-slate-300"
      }`}
    >
      <div className="flex items-center space-x-2.5 min-w-0">
        {/* Color Swatch Preview */}
        <div
          className="w-5 h-5 rounded-md border flex items-center justify-center p-0.5 shrink-0 shadow-inner"
          style={{
            background: item.colors.bg,
            borderColor: item.colors.border,
          }}
          title={`${item.name} palette`}
        >
          <div
            className="w-2.5 h-2.5 rounded-sm border"
            style={{
              backgroundColor: item.colors.panel,
              borderColor: item.colors.accent,
            }}
          />
        </div>

        <div className="min-w-0">
          <div className="text-xs font-semibold leading-tight truncate flex items-center space-x-1.5">
            <span className="text-slate-900 dark:text-slate-100">{item.name}</span>
            {item.isLight && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Light
              </span>
            )}
            {item.isGradient && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                Gradient
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate">
            {item.tagline}
          </div>
        </div>
      </div>

      {isActive && (
        <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 ml-2" />
      )}
    </button>
  );
}
