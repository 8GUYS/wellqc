"use client";

import { useState } from "react";
import {
  Sliders,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Layers,
} from "lucide-react";
import {
  useTheme,
  CustomThemeSettings,
  DEFAULT_CUSTOM_THEME,
} from "./theme-provider";

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InspirationPreset {
  name: string;
  settings: CustomThemeSettings;
}

const INSPIRATION_PRESETS: InspirationPreset[] = [
  {
    name: "Hyperdrive Indigo",
    settings: {
      name: "Hyperdrive Indigo",
      isGradient: true,
      bgStart: "#09091f",
      bgEnd: "#1d0838",
      bgAngle: "135deg",
      panel: "#130f2e",
      card: "#1c1642",
      border: "rgba(168, 85, 247, 0.3)",
      accent: "#8b5cf6",
      isLight: false,
    },
  },
  {
    name: "Nordic Glade",
    settings: {
      name: "Nordic Glade",
      isGradient: true,
      bgStart: "#03141b",
      bgEnd: "#0b2529",
      bgAngle: "140deg",
      panel: "#09222c",
      card: "#0d2d3a",
      border: "rgba(34, 211, 238, 0.25)",
      accent: "#06b6d4",
      isLight: false,
    },
  },
  {
    name: "Solar Flare",
    settings: {
      name: "Solar Flare",
      isGradient: true,
      bgStart: "#1a0808",
      bgEnd: "#291307",
      bgAngle: "120deg",
      panel: "#240f09",
      card: "#33160e",
      border: "rgba(249, 115, 22, 0.3)",
      accent: "#f97316",
      isLight: false,
    },
  },
  {
    name: "Obsidian Gold",
    settings: {
      name: "Obsidian Gold",
      isGradient: true,
      bgStart: "#000000",
      bgEnd: "#120f08",
      bgAngle: "135deg",
      panel: "#0d0c07",
      card: "#17150c",
      border: "rgba(234, 179, 8, 0.3)",
      accent: "#eab308",
      isLight: false,
    },
  },
  {
    name: "Apple Studio Rosé",
    settings: {
      name: "Apple Studio Rosé",
      isGradient: true,
      bgStart: "#fbf6f6",
      bgEnd: "#f3e8ee",
      bgAngle: "135deg",
      panel: "#ffffff",
      card: "#ffffff",
      border: "rgba(225, 29, 72, 0.12)",
      accent: "#e11d48",
      isLight: true,
    },
  },
];

const ACCENT_PRESETS = [
  { name: "Dynamic Blue", color: "#0071e3" },
  { name: "Neon Cyan", color: "#06b6d4" },
  { name: "Emerald", color: "#10b981" },
  { name: "Electric Violet", color: "#8b5cf6" },
  { name: "Radiant Rose", color: "#f43f5e" },
  { name: "Amber Gold", color: "#f59e0b" },
  { name: "Sunset Orange", color: "#f97316" },
  { name: "Malachite", color: "#14b8a6" },
];

export function ThemeCustomizerModal({ isOpen, onClose }: ThemeCustomizerModalProps) {
  const { customTheme, setCustomTheme } = useTheme();

  const [form, setForm] = useState<CustomThemeSettings>(customTheme || DEFAULT_CUSTOM_THEME);

  if (!isOpen) return null;

  const handleApply = () => {
    setCustomTheme(form);
    onClose();
  };

  const handleReset = () => {
    setForm(DEFAULT_CUSTOM_THEME);
    setCustomTheme(DEFAULT_CUSTOM_THEME);
  };

  const handlePresetSelect = (preset: InspirationPreset) => {
    setForm(preset.settings);
    setCustomTheme(preset.settings);
  };

  const previewBackground = form.isGradient
    ? `linear-gradient(${form.bgAngle || "135deg"}, ${form.bgStart}, ${form.bgEnd})`
    : form.bgStart;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-wellqc-panel border border-wellqc-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-wellqc-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-wellqc-text leading-tight">
                Studio Theme &amp; Gradient Studio
              </h2>
              <p className="text-xs text-wellqc-muted">
                Craft custom linear gradients, panel surfaces, and telemetry accents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-5 space-y-6">
          {/* Inspiration Quick Starters */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wellqc-muted block mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspiration Templates</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INSPIRATION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-wellqc-border hover:border-cyan-500/40 bg-wellqc-card/60 hover:bg-wellqc-card transition-all text-left group"
                >
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                    style={{
                      background: p.settings.isGradient
                        ? `linear-gradient(135deg, ${p.settings.bgStart}, ${p.settings.bgEnd})`
                        : p.settings.bgStart,
                    }}
                  />
                  <span className="text-xs font-medium text-wellqc-text group-hover:text-cyan-400 truncate">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Live Mockup Preview */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-wellqc-muted block mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live Workspace Preview</span>
            </label>
            <div
              className="p-4 rounded-2xl border shadow-inner transition-all duration-300 relative overflow-hidden"
              style={{
                background: previewBackground,
                borderColor: form.border,
              }}
            >
              <div
                className="p-3.5 rounded-xl border shadow-lg space-y-2.5 backdrop-blur-sm"
                style={{
                  backgroundColor: form.panel,
                  borderColor: form.border,
                  color: form.isLight ? "#1c1917" : "#f8fafc",
                }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: form.accent }}
                    />
                    <span className="font-bold">WELLQC TELEMETRY</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${form.accent}25`,
                      color: form.accent,
                    }}
                  >
                    LIVE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div
                    className="p-2.5 rounded-lg border shadow-sm"
                    style={{
                      backgroundColor: form.card,
                      borderColor: form.border,
                    }}
                  >
                    <span className="block text-[10px] opacity-70">Quality Score</span>
                    <span className="text-lg font-extrabold" style={{ color: form.accent }}>
                      98.4%
                    </span>
                  </div>
                  <div
                    className="p-2.5 rounded-lg border shadow-sm"
                    style={{
                      backgroundColor: form.card,
                      borderColor: form.border,
                    }}
                  >
                    <span className="block text-[10px] opacity-70">Fleet Wells</span>
                    <span className="text-lg font-extrabold">24 Active</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-white shadow-md transition-transform"
                  style={{ backgroundColor: form.accent }}
                >
                  Action Preview Button
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Background & Gradient Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-wellqc-text uppercase tracking-wider">
                1. Canvas Background Mode
              </label>
              <div className="inline-flex rounded-lg border border-wellqc-border p-0.5 bg-wellqc-card/80 text-xs">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isGradient: true })}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    form.isGradient
                      ? "bg-cyan-500 text-black shadow-sm font-semibold"
                      : "text-wellqc-muted hover:text-wellqc-text"
                  }`}
                >
                  Linear Gradient
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isGradient: false })}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${
                    !form.isGradient
                      ? "bg-cyan-500 text-black shadow-sm font-semibold"
                      : "text-wellqc-muted hover:text-wellqc-text"
                  }`}
                >
                  Solid Color
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-wellqc-muted mb-1 block font-medium">
                  {form.isGradient ? "Gradient Start Color" : "Background Solid Color"}
                </label>
                <div className="flex items-center space-x-2 bg-wellqc-card border border-wellqc-border rounded-xl p-2">
                  <input
                    type="color"
                    value={form.bgStart}
                    onChange={(e) => setForm({ ...form, bgStart: e.target.value })}
                    className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.bgStart}
                    onChange={(e) => setForm({ ...form, bgStart: e.target.value })}
                    className="w-full bg-transparent text-xs font-mono text-wellqc-text focus:outline-none uppercase"
                  />
                </div>
              </div>

              {form.isGradient && (
                <div>
                  <label className="text-[11px] text-wellqc-muted mb-1 block font-medium">
                    Gradient End Color
                  </label>
                  <div className="flex items-center space-x-2 bg-wellqc-card border border-wellqc-border rounded-xl p-2">
                    <input
                      type="color"
                      value={form.bgEnd}
                      onChange={(e) => setForm({ ...form, bgEnd: e.target.value })}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={form.bgEnd}
                      onChange={(e) => setForm({ ...form, bgEnd: e.target.value })}
                      className="w-full bg-transparent text-xs font-mono text-wellqc-text focus:outline-none uppercase"
                    />
                  </div>
                </div>
              )}
            </div>

            {form.isGradient && (
              <div>
                <label className="text-[11px] text-wellqc-muted mb-1.5 block font-medium">
                  Gradient Angle: {form.bgAngle || "135deg"}
                </label>
                <div className="flex items-center gap-2">
                  {["45deg", "90deg", "135deg", "180deg", "225deg"].map((ang) => (
                    <button
                      key={ang}
                      type="button"
                      onClick={() => setForm({ ...form, bgAngle: ang })}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors border ${
                        form.bgAngle === ang
                          ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 font-bold"
                          : "bg-wellqc-card border-wellqc-border text-wellqc-muted hover:text-wellqc-text"
                      }`}
                    >
                      {ang}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Accent & Telemetry Color */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-wellqc-text uppercase tracking-wider block">
              2. Accent &amp; Telemetry Color
            </label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((acc) => (
                <button
                  key={acc.name}
                  type="button"
                  onClick={() => setForm({ ...form, accent: acc.color })}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                    form.accent.toLowerCase() === acc.color.toLowerCase()
                      ? "border-white bg-white/10 text-white font-bold ring-2 ring-cyan-400"
                      : "border-wellqc-border bg-wellqc-card text-wellqc-muted hover:text-wellqc-text"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: acc.color }}
                  />
                  <span>{acc.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 bg-wellqc-card border border-wellqc-border rounded-xl p-2 max-w-xs">
              <input
                type="color"
                value={form.accent}
                onChange={(e) => setForm({ ...form, accent: e.target.value })}
                className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
              />
              <span className="text-xs text-wellqc-muted">Custom Hex:</span>
              <input
                type="text"
                value={form.accent}
                onChange={(e) => setForm({ ...form, accent: e.target.value })}
                className="w-full bg-transparent text-xs font-mono text-wellqc-text focus:outline-none uppercase"
              />
            </div>
          </div>

          {/* Section 3: Surface Panels & Contrast */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-wellqc-text uppercase tracking-wider">
                3. Surface Panels &amp; Contrast
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isLight: false })}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    !form.isLight
                      ? "bg-slate-800 border-cyan-500 text-cyan-400 font-bold"
                      : "border-wellqc-border text-wellqc-muted"
                  }`}
                >
                  <Moon className="w-3 h-3" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isLight: true })}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                    form.isLight
                      ? "bg-slate-200 text-black border-cyan-500 font-bold"
                      : "border-wellqc-border text-wellqc-muted"
                  }`}
                >
                  <Sun className="w-3 h-3" />
                  <span>Light</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-wellqc-muted mb-1 block font-medium">
                  Panel Surface (Sidebar / Header)
                </label>
                <div className="flex items-center space-x-2 bg-wellqc-card border border-wellqc-border rounded-xl p-2">
                  <input
                    type="color"
                    value={form.panel.startsWith("#") ? form.panel : "#0f172a"}
                    onChange={(e) => setForm({ ...form, panel: e.target.value })}
                    className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.panel}
                    onChange={(e) => setForm({ ...form, panel: e.target.value })}
                    className="w-full bg-transparent text-xs font-mono text-wellqc-text focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-wellqc-muted mb-1 block font-medium">
                  Card Surface (Inner Tiles / Modals)
                </label>
                <div className="flex items-center space-x-2 bg-wellqc-card border border-wellqc-border rounded-xl p-2">
                  <input
                    type="color"
                    value={form.card.startsWith("#") ? form.card : "#141e33"}
                    onChange={(e) => setForm({ ...form, card: e.target.value })}
                    className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.card}
                    onChange={(e) => setForm({ ...form, card: e.target.value })}
                    className="w-full bg-transparent text-xs font-mono text-wellqc-text focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-wellqc-border bg-wellqc-card/40">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs text-wellqc-muted hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-wellqc-text hover:bg-white/5 border border-wellqc-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/25 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Apply Custom Theme</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
