"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Printer,
  Layers,
  ChevronDown,
  Info,
  Maximize2,
  Eye,
  Sliders,
} from "lucide-react";

export interface LogViewerCurve {
  mnemonic: string;
  unit?: string;
  description?: string;
  values: number[];
  color?: string;
}

export interface LogViewerProps {
  wellName: string;
  field?: string;
  operator?: string;
  depthUnit?: string;
  startDepth: number;
  stopDepth: number;
  step?: number;
  depths?: number[];
  curves?: LogViewerCurve[];
  curvesData?: {
    depth: number[];
    curves: Record<string, number[]>;
  };
  anomalies?: {
    depthStart: number;
    depthEnd: number;
    curveMnemonic: string;
    anomalyType: string;
    severity: string;
    description: string;
  }[];
  rawCurves?: LogViewerCurve[]; // Pre-clean curves for comparison
  showCompareToRaw?: boolean;
  nullValue?: number;
  title?: string;
}

// Standard petrophysical track configurations
interface CurveScaleConfig {
  isLog: boolean;
  min: number;
  max: number;
  unit: string;
  defaultColor: string;
  trackIndex: number;
}

const DEFAULT_CURVE_CONFIGS: Record<string, Partial<CurveScaleConfig>> = {
  GR: { isLog: false, min: 0, max: 150, unit: "GAPI", defaultColor: "#10b981", trackIndex: 0 },
  CALI: { isLog: false, min: 6, max: 16, unit: "IN", defaultColor: "#64748b", trackIndex: 0 },
  SP: { isLog: false, min: -80, max: 40, unit: "MV", defaultColor: "#eab308", trackIndex: 0 },
  RT: { isLog: true, min: 0.2, max: 2000, unit: "OHMM", defaultColor: "#ef4444", trackIndex: 1 },
  ILD: { isLog: true, min: 0.2, max: 2000, unit: "OHMM", defaultColor: "#ef4444", trackIndex: 1 },
  LLD: { isLog: true, min: 0.2, max: 2000, unit: "OHMM", defaultColor: "#f97316", trackIndex: 1 },
  RES: { isLog: true, min: 0.2, max: 2000, unit: "OHMM", defaultColor: "#ef4444", trackIndex: 1 },
  AHT90: { isLog: true, min: 0.2, max: 2000, unit: "OHMM", defaultColor: "#ef4444", trackIndex: 1 },
  RHOB: { isLog: false, min: 1.95, max: 2.95, unit: "G/C3", defaultColor: "#06b6d4", trackIndex: 2 },
  NPHI: { isLog: false, min: -0.15, max: 0.45, unit: "V/V", defaultColor: "#3b82f6", trackIndex: 2 },
  DT: { isLog: false, min: 40, max: 140, unit: "US/F", defaultColor: "#3b82f6", trackIndex: 2 },
  SONIC: { isLog: false, min: 40, max: 140, unit: "US/F", defaultColor: "#3b82f6", trackIndex: 2 },
  PEF: { isLog: false, min: 0, max: 10, unit: "B/E", defaultColor: "#ec4899", trackIndex: 2 },
};

function isResistivityCurve(mnemonic: string): boolean {
  const upper = mnemonic.toUpperCase();
  return (
    upper.startsWith("RT") ||
    upper.startsWith("RES") ||
    upper.startsWith("ILD") ||
    upper.startsWith("LLD") ||
    upper.startsWith("MSFL") ||
    upper.startsWith("AHT") ||
    upper.includes("RESIS")
  );
}

export function LogViewer({
  wellName,
  field = "Unknown Field",
  operator = "Unknown Operator",
  depthUnit = "FT",
  startDepth,
  stopDepth,
  step = 0.5,
  depths: rawDepths,
  curves: rawCurvesList,
  curvesData,
  rawCurves = [],
  showCompareToRaw = true,
  nullValue = -999.25,
  title = "Cleaned Log Viewer",
}: LogViewerProps) {
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const depths = useMemo(() => rawDepths || curvesData?.depth || [], [rawDepths, curvesData]);
  const curves: LogViewerCurve[] = useMemo(() => {
    if (rawCurvesList && rawCurvesList.length > 0) return rawCurvesList;
    if (curvesData?.curves) {
      return Object.entries(curvesData.curves).map(([mnemonic, values]): LogViewerCurve => ({
        mnemonic,
        values,
        unit: "",
      }));
    }
    return [];
  }, [rawCurvesList, curvesData]);

  // 1. Curve selections for Track 1, Track 2, Track 3
  const availableMnemonics = useMemo(() => curves.map((c) => c.mnemonic), [curves]);

  const defaultTrack1 = useMemo(() => {
    return (
      availableMnemonics.find((m) => m === "GR" || m.includes("GAM")) ||
      availableMnemonics[0] ||
      ""
    );
  }, [availableMnemonics]);

  const defaultTrack2 = useMemo(() => {
    return (
      availableMnemonics.find(isResistivityCurve) ||
      availableMnemonics[1] ||
      availableMnemonics[0] ||
      ""
    );
  }, [availableMnemonics]);

  const defaultTrack3 = useMemo(() => {
    return (
      availableMnemonics.find((m) => m === "RHOB" || m === "DT" || m.includes("DEN") || m.includes("SON")) ||
      availableMnemonics[2] ||
      availableMnemonics[0] ||
      ""
    );
  }, [availableMnemonics]);

  const [selectedTrack1, setSelectedTrack1] = useState<string>(defaultTrack1);
  const [selectedTrack2, setSelectedTrack2] = useState<string>(defaultTrack2);
  const [selectedTrack3, setSelectedTrack3] = useState<string>(defaultTrack3);

  // Sync if availableMnemonics load asynchronously
  React.useEffect(() => {
    if (!selectedTrack1 && defaultTrack1) setSelectedTrack1(defaultTrack1);
    if (!selectedTrack2 && defaultTrack2) setSelectedTrack2(defaultTrack2);
    if (!selectedTrack3 && defaultTrack3) setSelectedTrack3(defaultTrack3);
  }, [defaultTrack1, defaultTrack2, defaultTrack3, selectedTrack1, selectedTrack2, selectedTrack3]);

  // 2. Viewer Controls State
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 0.75, 1, 1.5, 2, 3
  const [compareToRaw, setCompareToRaw] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"standard" | "dense">("standard");

  // Depth range
  const minDepth = Math.min(...(depths.length > 0 ? depths : [startDepth]));
  const maxDepth = Math.max(...(depths.length > 0 ? depths : [stopDepth]));
  const depthSpan = Math.max(1, maxDepth - minDepth);

  // Render dimensions
  const trackWidth = 260; // px per track
  const depthAxisWidth = 70; // px for depth column
  const totalSvgWidth = trackWidth * 3 + depthAxisWidth;
  const pixelsPerDepthUnit = (viewMode === "dense" ? 1.2 : 2.0) * zoomLevel;
  const totalSvgHeight = Math.max(500, Math.min(8000, depthSpan * pixelsPerDepthUnit));

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Helper to get curve configuration
  const getCurveConfig = (mnemonic: string): CurveScaleConfig => {
    const upper = mnemonic.toUpperCase();
    const isLog = isResistivityCurve(upper);

    if (DEFAULT_CURVE_CONFIGS[upper]) {
      const def = DEFAULT_CURVE_CONFIGS[upper];
      return {
        isLog: isLog || Boolean(def.isLog),
        min: def.min ?? (isLog ? 0.2 : 0),
        max: def.max ?? (isLog ? 2000 : 100),
        unit: def.unit || "unit",
        defaultColor: def.defaultColor || (isLog ? "#ef4444" : "#10b981"),
        trackIndex: def.trackIndex ?? 0,
      };
    }

    // Default dynamic config
    if (isLog) {
      return {
        isLog: true,
        min: 0.2,
        max: 2000,
        unit: "OHMM",
        defaultColor: "#ef4444",
        trackIndex: 1,
      };
    }

    // Compute empirical range from curve data
    const c = curves.find((item) => item.mnemonic === mnemonic);
    let min = 0;
    let max = 100;
    if (c && c.values.length > 0) {
      const valid = c.values.filter((v) => v !== nullValue && !Number.isNaN(v));
      if (valid.length > 0) {
        min = Math.floor(Math.min(...valid));
        max = Math.ceil(Math.max(...valid));
        if (min === max) {
          min -= 10;
          max += 10;
        }
      }
    }

    return {
      isLog: false,
      min,
      max,
      unit: c?.unit || "",
      defaultColor: "#06b6d4",
      trackIndex: 0,
    };
  };

  // Maps value to horizontal X coordinate within track (0 to trackWidth)
  const mapValueToX = (
    val: number,
    cfg: CurveScaleConfig
  ): number | null => {
    if (val === nullValue || Number.isNaN(val)) return null;

    if (cfg.isLog) {
      // 4-decade logarithmic scale: 0.2 to 2000 ohm.m
      const logMin = Math.log10(Math.max(0.01, cfg.min));
      const logMax = Math.log10(cfg.max);
      const safeVal = Math.max(cfg.min, Math.min(cfg.max, val));
      const logVal = Math.log10(safeVal);
      const ratio = (logVal - logMin) / (logMax - logMin);
      return Math.max(0, Math.min(trackWidth, ratio * trackWidth));
    }

    // Linear scale
    const ratio = (val - cfg.min) / (cfg.max - cfg.min || 1);
    return Math.max(0, Math.min(trackWidth, ratio * trackWidth));
  };

  // Maps depth to vertical Y coordinate (0 to totalSvgHeight)
  const mapDepthToY = (d: number): number => {
    const ratio = (d - minDepth) / depthSpan;
    return ratio * totalSvgHeight;
  };

  // Builds SVG polyline points or path with gaps at null values
  const buildCurvePath = (
    curveVals: number[],
    cfg: CurveScaleConfig,
    xOffset: number
  ): string => {
    if (!curveVals || curveVals.length === 0 || depths.length === 0) return "";

    const paths: string[] = [];
    let currentSegment: string[] = [];

    const len = Math.min(curveVals.length, depths.length);
    // Downsample if dataset is enormous to guarantee smooth 60fps rendering
    const stride = len > 5000 ? Math.ceil(len / 3000) : 1;

    for (let i = 0; i < len; i += stride) {
      const v = curveVals[i];
      const d = depths[i];

      const x = mapValueToX(v, cfg);
      if (x !== null) {
        const y = mapDepthToY(d);
        currentSegment.push(`${(xOffset + x).toFixed(1)},${y.toFixed(1)}`);
      } else {
        if (currentSegment.length > 0) {
          paths.push(`M ${currentSegment.join(" L ")}`);
          currentSegment = [];
        }
      }
    }

    if (currentSegment.length > 0) {
      paths.push(`M ${currentSegment.join(" L ")}`);
    }

    return paths.join(" ");
  };

  // Generate depth ticks
  const depthTicks = useMemo(() => {
    const ticks: { depth: number; y: number; isMajor: boolean }[] = [];
    const stepInterval = depthSpan > 1000 ? 100 : depthSpan > 300 ? 50 : 20;
    const firstTick = Math.ceil(minDepth / stepInterval) * stepInterval;

    for (let d = firstTick; d <= maxDepth; d += stepInterval) {
      ticks.push({
        depth: d,
        y: mapDepthToY(d),
        isMajor: d % (stepInterval * 2) === 0,
      });
    }
    return ticks;
  }, [minDepth, maxDepth, depthSpan, totalSvgHeight]);

  // Active track curves
  const t1Curve = curves.find((c) => c.mnemonic === selectedTrack1);
  const t2Curve = curves.find((c) => c.mnemonic === selectedTrack2);
  const t3Curve = curves.find((c) => c.mnemonic === selectedTrack3);

  const t1Raw = rawCurves.find((c) => c.mnemonic === selectedTrack1);
  const t2Raw = rawCurves.find((c) => c.mnemonic === selectedTrack2);
  const t3Raw = rawCurves.find((c) => c.mnemonic === selectedTrack3);

  const t1Cfg = getCurveConfig(selectedTrack1);
  const t2Cfg = getCurveConfig(selectedTrack2);
  const t3Cfg = getCurveConfig(selectedTrack3);

  // Horizontal offsets for the 3 tracks
  // Layout: Track 1 (0..trackWidth) | Depth Axis (depthAxisWidth) | Track 2 (trackWidth) | Track 3 (trackWidth)
  const track1X = 0;
  const depthAxisX = trackWidth;
  const track2X = trackWidth + depthAxisWidth;
  const track3X = trackWidth + depthAxisWidth + trackWidth;

  return (
    <div
      ref={viewerContainerRef}
      className="bg-wellqc-panel border border-wellqc-border rounded-2xl overflow-hidden shadow-xl space-y-0"
    >
      {/* 1. Header Bar: Title + Controls */}
      <div className="p-4 border-b border-wellqc-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-card/50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white font-mono tracking-tight flex items-center gap-2">
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                3-Track Wireline
              </span>
            </h3>
            <p className="text-[11px] text-wellqc-muted font-mono">
              Logarithmic Resistivity (0.2–2000 Ω·m) • Linear Gamma &amp; Sonic Logs
            </p>
          </div>
        </div>

        {/* Controls on right: View mode, Zoom, Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-wellqc-dark/80 p-0.5 rounded-lg border border-wellqc-border flex items-center text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode("standard")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                viewMode === "standard"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setViewMode("dense")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                viewMode === "dense"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dense
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-wellqc-dark/80 p-1 rounded-lg border border-wellqc-border text-slate-300 font-mono text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className="p-1 rounded hover:bg-wellqc-panel hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] px-1 font-bold text-cyan-300 w-10 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(3.0, +(z + 0.25).toFixed(2)))}
              className="p-1 rounded hover:bg-wellqc-panel hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded hover:bg-wellqc-panel text-slate-400 hover:text-white ml-0.5"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Print / Export */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-wellqc-card hover:bg-wellqc-panel border border-wellqc-border text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-colors"
            title="Print Wireline Log"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 2. Control Bar: Track 1 / 2 / 3 Dropdowns + Compare to raw checkbox */}
      <div className="p-3 border-b border-wellqc-border bg-wellqc-dark/60 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Track 1 Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-wellqc-muted uppercase font-bold">Track 1:</span>
            <select
              value={selectedTrack1}
              onChange={(e) => setSelectedTrack1(e.target.value)}
              className="bg-wellqc-card border border-wellqc-border rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              {availableMnemonics.map((m) => (
                <option key={`t1-${m}`} value={m}>
                  {m} ({curves.find((c) => c.mnemonic === m)?.unit || ""})
                </option>
              ))}
            </select>
          </div>

          {/* Track 2 Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-wellqc-muted uppercase font-bold">Track 2:</span>
            <select
              value={selectedTrack2}
              onChange={(e) => setSelectedTrack2(e.target.value)}
              className="bg-wellqc-card border border-wellqc-border rounded-lg px-2.5 py-1 text-xs text-rose-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              {availableMnemonics.map((m) => (
                <option key={`t2-${m}`} value={m}>
                  {m} ({isResistivityCurve(m) ? "Logarithmic" : "Linear"})
                </option>
              ))}
            </select>
          </div>

          {/* Track 3 Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-wellqc-muted uppercase font-bold">Track 3:</span>
            <select
              value={selectedTrack3}
              onChange={(e) => setSelectedTrack3(e.target.value)}
              className="bg-wellqc-card border border-wellqc-border rounded-lg px-2.5 py-1 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              {availableMnemonics.map((m) => (
                <option key={`t3-${m}`} value={m}>
                  {m} ({curves.find((c) => c.mnemonic === m)?.unit || ""})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compare to raw (pre-clean) checkbox */}
        {showCompareToRaw && (
          <label className="flex items-center space-x-2 cursor-pointer select-none bg-wellqc-card/80 border border-wellqc-border px-3 py-1 rounded-lg hover:border-cyan-500/40 transition-colors">
            <input
              type="checkbox"
              checked={compareToRaw}
              onChange={(e) => setCompareToRaw(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-wellqc-dark border-slate-700 text-cyan-500 focus:ring-0 focus:outline-none cursor-pointer"
            />
            <span className="text-[11px] font-bold text-slate-200">
              Compare to raw (pre-clean)
            </span>
            {compareToRaw && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
          </label>
        )}
      </div>

      {/* 3. Small Header (Well Info & Track Legend Header) */}
      <div className="border-b border-wellqc-border bg-wellqc-dark p-3 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pb-2 mb-2 border-b border-wellqc-border/40">
          <div>
            <strong className="text-white font-bold">{wellName}</strong> • Field: {field} • Operator: {operator}
          </div>
          <div>
            Depth Interval: {startDepth} – {stopDepth} {depthUnit} (Step: {step})
          </div>
        </div>

        {/* Track Headers Row */}
        <div className="grid grid-cols-[260px_70px_260px_260px] gap-0 text-center font-mono text-xs overflow-x-auto">
          {/* Track 1 Header */}
          <div className="border-r border-wellqc-border p-2 bg-emerald-950/20 text-left">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">{selectedTrack1}</span>
              <span className="text-[10px] text-emerald-300/70">{t1Cfg.unit} (Linear)</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{t1Cfg.min}</span>
              <span className="text-[9px] text-slate-500">Track 1</span>
              <span>{t1Cfg.max}</span>
            </div>
          </div>

          {/* Depth Axis Header */}
          <div className="border-r border-wellqc-border p-2 bg-wellqc-panel flex flex-col justify-center items-center">
            <span className="text-[10px] uppercase font-bold text-cyan-300">DEPTH</span>
            <span className="text-[9px] text-slate-500">({depthUnit})</span>
          </div>

          {/* Track 2 Header (Resistivity / Logarithmic) */}
          <div className="border-r border-wellqc-border p-2 bg-rose-950/20 text-left">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400">{selectedTrack2}</span>
              <span className="text-[10px] text-rose-300/70">
                {t2Cfg.isLog ? "0.2–2000 (Logarithmic)" : `${t2Cfg.unit} (Linear)`}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{t2Cfg.isLog ? "0.2" : t2Cfg.min}</span>
              <span className="text-[9px] text-slate-500">{t2Cfg.isLog ? "1   10   100" : "Track 2"}</span>
              <span>{t2Cfg.isLog ? "2000" : t2Cfg.max}</span>
            </div>
          </div>

          {/* Track 3 Header */}
          <div className="p-2 bg-cyan-950/20 text-left">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400">{selectedTrack3}</span>
              <span className="text-[10px] text-cyan-300/70">{t3Cfg.unit} (Linear)</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>{t3Cfg.min}</span>
              <span className="text-[9px] text-slate-500">Track 3</span>
              <span>{t3Cfg.max}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. The Log Itself: 3-Track Wireline Canvas / SVG */}
      <div className="overflow-auto max-h-[620px] bg-slate-950 relative select-none">
        <svg
          width={totalSvgWidth}
          height={totalSvgHeight}
          className="font-mono text-[10px]"
        >
          <defs>
            {/* Grid Pattern for Linear Tracks */}
            <pattern id="linearGrid" width="52" height="40" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="52" y2="0" stroke="#1e293b" strokeWidth="0.75" />
              <line x1="52" y1="0" x2="52" y2="40" stroke="#1e293b" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background tracks */}
          {/* Track 1 Area */}
          <rect
            x={track1X}
            y="0"
            width={trackWidth}
            height={totalSvgHeight}
            fill="#030712"
          />
          <rect
            x={track1X}
            y="0"
            width={trackWidth}
            height={totalSvgHeight}
            fill="url(#linearGrid)"
          />

          {/* Depth Axis Background */}
          <rect
            x={depthAxisX}
            y="0"
            width={depthAxisWidth}
            height={totalSvgHeight}
            fill="#090d16"
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* Track 2 Area (Resistivity 4-Decade Log Grid) */}
          <rect
            x={track2X}
            y="0"
            width={trackWidth}
            height={totalSvgHeight}
            fill="#030712"
          />
          {/* Draw 4-Decade Logarithmic Vertical Gridlines for Track 2 if isLog */}
          {t2Cfg.isLog ? (
            <>
              {/* Decade boundary lines: 0.2, 1, 10, 100, 1000, 2000 */}
              {[0.2, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].map((v) => {
                const xPos = mapValueToX(v, t2Cfg);
                if (xPos === null) return null;
                const isDecade = [0.2, 1, 10, 100, 1000, 2000].includes(v);
                return (
                  <line
                    key={`log-line-${v}`}
                    x1={track2X + xPos}
                    y1="0"
                    x2={track2X + xPos}
                    y2={totalSvgHeight}
                    stroke={isDecade ? "#334155" : "#1e293b"}
                    strokeWidth={isDecade ? "1" : "0.5"}
                    strokeDasharray={isDecade ? undefined : "2,3"}
                  />
                );
              })}
            </>
          ) : (
            <rect
              x={track2X}
              y="0"
              width={trackWidth}
              height={totalSvgHeight}
              fill="url(#linearGrid)"
            />
          )}

          {/* Track 3 Area */}
          <rect
            x={track3X}
            y="0"
            width={trackWidth}
            height={totalSvgHeight}
            fill="#030712"
          />
          <rect
            x={track3X}
            y="0"
            width={trackWidth}
            height={totalSvgHeight}
            fill="url(#linearGrid)"
          />

          {/* Horizontal Depth Grid Lines across all tracks */}
          {depthTicks.map((tick) => (
            <g key={`dtick-${tick.depth}`}>
              <line
                x1="0"
                y1={tick.y}
                x2={totalSvgWidth}
                y2={tick.y}
                stroke={tick.isMajor ? "#334155" : "#1e293b"}
                strokeWidth={tick.isMajor ? "1" : "0.5"}
              />
              {/* Depth numbers in the depth column */}
              <text
                x={depthAxisX + depthAxisWidth / 2}
                y={tick.y + 3.5}
                fill={tick.isMajor ? "#38bdf8" : "#94a3b8"}
                fontSize={tick.isMajor ? "10" : "9"}
                fontWeight={tick.isMajor ? "bold" : "normal"}
                textAnchor="middle"
              >
                {Math.round(tick.depth)}
              </text>
            </g>
          ))}

          {/* Track Borders */}
          <line x1={trackWidth} y1="0" x2={trackWidth} y2={totalSvgHeight} stroke="#334155" strokeWidth="1.5" />
          <line
            x1={trackWidth + depthAxisWidth}
            y1="0"
            x2={trackWidth + depthAxisWidth}
            y2={totalSvgHeight}
            stroke="#334155"
            strokeWidth="1.5"
          />
          <line
            x1={trackWidth + depthAxisWidth + trackWidth}
            y1="0"
            x2={trackWidth + depthAxisWidth + trackWidth}
            y2={totalSvgHeight}
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* --- CURVE DRAWING: RAW (PRE-CLEAN) DASHED GRAY UNDERNEATH --- */}
          {compareToRaw && (
            <>
              {/* Track 1 Raw */}
              {t1Raw && (
                <path
                  d={buildCurvePath(t1Raw.values, t1Cfg, track1X)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity="0.8"
                />
              )}

              {/* Track 2 Raw */}
              {t2Raw && (
                <path
                  d={buildCurvePath(t2Raw.values, t2Cfg, track2X)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity="0.8"
                />
              )}

              {/* Track 3 Raw */}
              {t3Raw && (
                <path
                  d={buildCurvePath(t3Raw.values, t3Cfg, track3X)}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                  opacity="0.8"
                />
              )}
            </>
          )}

          {/* --- CURVE DRAWING: CLEANED SOLID COLORED CURVES --- */}
          {/* Track 1 Cleaned */}
          {t1Curve && (
            <path
              d={buildCurvePath(t1Curve.values, t1Cfg, track1X)}
              fill="none"
              stroke={t1Cfg.defaultColor}
              strokeWidth="1.75"
            />
          )}

          {/* Track 2 Cleaned */}
          {t2Curve && (
            <path
              d={buildCurvePath(t2Curve.values, t2Cfg, track2X)}
              fill="none"
              stroke={t2Cfg.defaultColor}
              strokeWidth="1.75"
            />
          )}

          {/* Track 3 Cleaned */}
          {t3Curve && (
            <path
              d={buildCurvePath(t3Curve.values, t3Cfg, track3X)}
              fill="none"
              stroke={t3Cfg.defaultColor}
              strokeWidth="1.75"
            />
          )}
        </svg>
      </div>

      {/* 5. Footer Legend */}
      <div className="p-3 bg-wellqc-panel/80 border-t border-wellqc-border flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
            <span>Track 1: {selectedTrack1} (Linear)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-400 inline-block" />
            <span>Track 2: {selectedTrack2} ({t2Cfg.isLog ? "Logarithmic 4-Decade" : "Linear"})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
            <span>Track 3: {selectedTrack3} (Linear)</span>
          </div>
          {compareToRaw && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-0.5 border-t border-dashed border-slate-400 inline-block" />
              <span>Dashed Gray: Raw Pre-Cleaning Baseline</span>
            </div>
          )}
        </div>
        <div className="text-[11px] text-wellqc-muted">
          {depths.length.toLocaleString()} depth records plotted
        </div>
      </div>
    </div>
  );
}

export const WellLogViewer = LogViewer;
