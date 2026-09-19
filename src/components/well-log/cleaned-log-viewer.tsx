"use client";

import { useState, useMemo } from "react";
import { ParsedLAS } from "@/lib/las/parser";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Printer,
  Sparkles,
  Sliders,
  CheckSquare,
  Square,
  Activity,
  ChevronDown,
} from "lucide-react";

interface CleanedLogViewerProps {
  wellName: string;
  field?: string;
  operator?: string;
  depthUnit?: string;
  rawLas: ParsedLAS | null;
  cleanedLas: ParsedLAS | null;
}

interface TrackConfig {
  mnemonic: string;
  min: number;
  max: number;
  unit: string;
  isLogScale: boolean;
  color: string;
}

export function CleanedLogViewer({
  wellName,
  field = "Deepwater Basin",
  operator = "WellQC+ Petrophysics",
  depthUnit = "FT",
  rawLas,
  cleanedLas,
}: CleanedLogViewerProps) {
  // Available curves from raw LAS (~C section)
  const availableCurves = useMemo(() => {
    if (!rawLas?.curves) return [];
    return rawLas.curves
      .map((c) => c.mnemonic)
      .filter((m) => m.toUpperCase() !== "DEPT" && m.toUpperCase() !== "DEPTH");
  }, [rawLas]);

  // Initial curve assignments
  const defaultTrack1 = useMemo(() => {
    const gr = availableCurves.find((c) => /^(GR|GAMMA|CGR|SGR)/i.test(c));
    return gr || availableCurves[0] || "GR";
  }, [availableCurves]);

  const defaultTrack2 = useMemo(() => {
    const rt = availableCurves.find((c) => /^(RT|RES|ILD|ILM|LLD|LLS|AHT|AT|RD)/i.test(c));
    return rt || (availableCurves.length > 1 ? availableCurves[1] : "RT");
  }, [availableCurves]);

  const defaultTrack3 = useMemo(() => {
    const dt = availableCurves.find((c) => /^(DT|SONIC|DTC|DTS|RHOB|NPHI|CALI)/i.test(c));
    return dt || (availableCurves.length > 2 ? availableCurves[2] : "DT");
  }, [availableCurves]);

  const [track1Mnemonic, setTrack1Mnemonic] = useState<string>(defaultTrack1);
  const [track2Mnemonic, setTrack2Mnemonic] = useState<string>(defaultTrack2);
  const [track3Mnemonic, setTrack3Mnemonic] = useState<string>(defaultTrack3);

  const [compareToRaw, setCompareToRaw] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"CLASSIC_PAPER" | "DARK_MODERN">("CLASSIC_PAPER");
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Depth track reference
  const depthArr = useMemo(() => {
    return cleanedLas?.data.depth || rawLas?.data.depth || [];
  }, [cleanedLas, rawLas]);

  const totalPoints = depthArr.length;
  const minDepth = depthArr[0] ?? (rawLas?.wellInfo.startDepth || 5000);
  const maxDepth = depthArr[depthArr.length - 1] ?? (rawLas?.wellInfo.stopDepth || 5500);
  const depthSpan = maxDepth - minDepth || 1;

  // Determine scaling parameters for a curve mnemonic
  const getTrackConfig = (mnemonic: string, defaultColor: string): TrackConfig => {
    const upper = mnemonic.toUpperCase();
    const meta = rawLas?.curves?.find((c) => c.mnemonic.toUpperCase() === upper);
    const unit = meta?.unit || "";

    // 1. Resistivity -> STRICTLY LOGARITHMIC SCALE (0.2 to 2000 ohm.m)
    if (/^(RT|RES|ILD|ILM|LLD|LLS|AHT\d*|AT\d*|RHO|RD)/i.test(upper)) {
      return {
        mnemonic,
        min: 0.2,
        max: 2000,
        unit: unit || "ohm.m",
        isLogScale: true,
        color: defaultColor,
      };
    }

    // 2. Gamma Ray -> STRICTLY LINEAR SCALE (0 to 150 GAPI)
    if (/^(GR|GAMMA|CGR|SGR)/i.test(upper)) {
      return {
        mnemonic,
        min: 0,
        max: 150,
        unit: unit || "GAPI",
        isLogScale: false,
        color: defaultColor,
      };
    }

    // 3. Sonic -> STRICTLY LINEAR SCALE (40 to 240 us/ft)
    if (/^(DT|SONIC|DTC|DTS|AC)/i.test(upper)) {
      return {
        mnemonic,
        min: 40,
        max: 240,
        unit: unit || "us/ft",
        isLogScale: false,
        color: defaultColor,
      };
    }

    // 4. Density
    if (/^(RHOB|DEN|RHOZ)/i.test(upper)) {
      return {
        mnemonic,
        min: 1.95,
        max: 2.95,
        unit: unit || "g/cc",
        isLogScale: false,
        color: defaultColor,
      };
    }

    // 5. Neutron Porosity
    if (/^(NPHI|NEU|TNPH)/i.test(upper)) {
      return {
        mnemonic,
        min: -0.05,
        max: 0.45,
        unit: unit || "v/v",
        isLogScale: false,
        color: defaultColor,
      };
    }

    // 6. Caliper
    if (/^(CALI|CAL)/i.test(upper)) {
      return {
        mnemonic,
        min: 6,
        max: 16,
        unit: unit || "in",
        isLogScale: false,
        color: defaultColor,
      };
    }

    // Default dynamic linear bounds
    const rawVals = (rawLas?.data.curves[mnemonic] || []).filter(
      (v) => v !== -999.25 && v !== -9999 && Number.isFinite(v),
    );
    const minVal = rawVals.length > 0 ? Math.min(...rawVals) : 0;
    const maxVal = rawVals.length > 0 ? Math.max(...rawVals) : 100;
    return {
      mnemonic,
      min: Math.floor(minVal),
      max: Math.ceil(maxVal || 100),
      unit: unit || "-",
      isLogScale: false,
      color: defaultColor,
    };
  };

  const track1Config = useMemo(() => getTrackConfig(track1Mnemonic, "#15803d"), [track1Mnemonic, rawLas]);
  const track2Config = useMemo(() => getTrackConfig(track2Mnemonic, "#dc2626"), [track2Mnemonic, rawLas]);
  const track3Config = useMemo(() => getTrackConfig(track3Mnemonic, "#2563eb"), [track3Mnemonic, rawLas]);

  // Coordinate mapping
  const svgHeight = Math.max(950, totalPoints * 6.5) * zoomLevel;

  const mapDepthToY = (d: number) => {
    return ((d - minDepth) / depthSpan) * (svgHeight - 60) + 30;
  };

  const mapValueToX = (
    val: number,
    min: number,
    max: number,
    trackWidth: number,
    isLogScale: boolean,
  ) => {
    if (isLogScale) {
      const posMin = min > 0 ? min : 0.2;
      const posMax = max > posMin ? max : 2000;
      const safeVal = Math.max(posMin, Math.min(posMax, val <= 0 ? posMin : val));
      const logMin = Math.log10(posMin);
      const logMax = Math.log10(posMax);
      return ((Math.log10(safeVal) - logMin) / (logMax - logMin)) * trackWidth;
    }
    const clamped = Math.max(min, Math.min(max, val));
    return ((clamped - min) / (max - min)) * trackWidth;
  };

  const renderSvgCurve = (
    series: number[] | undefined,
    config: TrackConfig,
    trackWidth: number,
  ) => {
    if (!series || series.length === 0) return "";
    const points: string[] = [];

    series.forEach((val, idx) => {
      if (
        val !== -999.25 &&
        val !== -9999 &&
        Number.isFinite(val) &&
        val !== null &&
        val !== undefined
      ) {
        const x = mapValueToX(val, config.min, config.max, trackWidth, config.isLogScale);
        const y = mapDepthToY(depthArr[idx]);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    });

    return points.join(" ");
  };

  // Depth ticks
  const depthTicks: number[] = [];
  const startStep = Math.ceil(minDepth / 50) * 50;
  for (let d = startStep; d <= maxDepth; d += 50) {
    depthTicks.push(d);
  }

  // Active series: cleaned vs raw
  const getCleanedSeries = (mnemonic: string) => {
    return cleanedLas?.data.curves[mnemonic] || rawLas?.data.curves[mnemonic] || [];
  };

  const getRawSeries = (mnemonic: string) => {
    return rawLas?.data.curves[mnemonic] || [];
  };

  const isCleanedAvailable = Boolean(cleanedLas);

  return (
    <section className="bg-wellqc-panel border border-wellqc-border rounded-2xl p-4 md:p-6 shadow-2xl space-y-4">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-wellqc-border">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] animate-pulse" />
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Cleaned Log Viewer
            </h2>
            {isCleanedAvailable && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Fixes Applied ✓
              </span>
            )}
            {!isCleanedAvailable && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Raw Baseline Preview
              </span>
            )}
          </div>
          <p className="text-xs text-wellqc-muted font-mono mt-0.5">
            Synchronized 3-track wireline petrophysical display with logarithmic resistivity &amp; linear acoustic/gamma scales.
          </p>
        </div>

        {/* Controls on the right: View Mode, Zoom, Print */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-wellqc-card border border-wellqc-border rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setViewMode("CLASSIC_PAPER")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === "CLASSIC_PAPER"
                  ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Classic Paper
            </button>
            <button
              onClick={() => setViewMode("DARK_MODERN")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === "DARK_MODERN"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Modern Dark
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-wellqc-card border border-wellqc-border rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-wellqc-panel rounded-lg"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-bold text-cyan-300 min-w-[42px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-wellqc-panel rounded-lg"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-wellqc-panel rounded-lg"
              title="Reset zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-wellqc-card hover:bg-wellqc-card/80 border border-wellqc-border rounded-xl text-slate-300 hover:text-white transition-all shadow-sm"
            title="Print or export wireline log to PDF"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 2. Control Bar: Track Slots (Track 1, 2, 3) & Compare to Raw Checkbox */}
      <div className="bg-wellqc-card/90 border border-wellqc-border p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Track 1 Selector */}
          <div className="flex items-center space-x-2">
            <span className="font-bold text-emerald-400">Track 1:</span>
            <select
              value={track1Mnemonic}
              onChange={(e) => setTrack1Mnemonic(e.target.value)}
              className="bg-wellqc-panel border border-emerald-500/40 text-emerald-300 rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-emerald-400"
            >
              {availableCurves.map((c) => (
                <option key={`t1-${c}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Track 2 Selector */}
          <div className="flex items-center space-x-2">
            <span className="font-bold text-red-400">Track 2:</span>
            <select
              value={track2Mnemonic}
              onChange={(e) => setTrack2Mnemonic(e.target.value)}
              className="bg-wellqc-panel border border-red-500/40 text-red-300 rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-red-400"
            >
              {availableCurves.map((c) => (
                <option key={`t2-${c}`} value={c}>
                  {c} {/^(RT|RES|ILD|ILM|LLD|LLS)/i.test(c) ? "(LOG)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Track 3 Selector */}
          <div className="flex items-center space-x-2">
            <span className="font-bold text-blue-400">Track 3:</span>
            <select
              value={track3Mnemonic}
              onChange={(e) => setTrack3Mnemonic(e.target.value)}
              className="bg-wellqc-panel border border-blue-500/40 text-blue-300 rounded-lg px-2.5 py-1.5 font-bold focus:outline-none focus:border-blue-400"
            >
              {availableCurves.map((c) => (
                <option key={`t3-${c}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compare to raw (pre-clean) Checkbox at the end of the row */}
        <label className="flex items-center space-x-2 cursor-pointer select-none bg-wellqc-panel/80 hover:bg-wellqc-panel px-3 py-1.5 rounded-lg border border-wellqc-border transition-colors">
          <input
            type="checkbox"
            checked={compareToRaw}
            onChange={(e) => setCompareToRaw(e.target.checked)}
            className="w-4 h-4 rounded text-cyan-500 bg-wellqc-card border-slate-600 focus:ring-cyan-500"
          />
          <span className="font-bold text-slate-200">
            Compare to raw (pre-clean)
          </span>
          <span className="text-[10px] text-slate-400">
            (Dashed gray overlay)
          </span>
        </label>
      </div>

      {/* Legend Indicator when Compare to Raw is active */}
      {compareToRaw && (
        <div className="flex items-center space-x-6 px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] font-mono">
          <div className="flex items-center space-x-2">
            <span className="w-5 h-0.5 bg-emerald-400 rounded-full" />
            <span className="text-slate-300 font-bold">Solid colored line:</span>
            <span className="text-slate-400">Cleaned curve</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-5 h-0.5 border-b-2 border-dashed border-slate-400" />
            <span className="text-slate-300 font-bold">Dashed muted line:</span>
            <span className="text-slate-400">Raw pre-clean baseline</span>
          </div>
        </div>
      )}

      {/* 3. The Log Itself: Classic 3-Track Wireline Display */}
      {viewMode === "CLASSIC_PAPER" ? (
        /* Classic Borehole Paper Log */
        <div className="bg-white text-black p-4 border-4 border-red-600 rounded-lg shadow-2xl overflow-x-auto select-none font-serif">
          {/* Header Box (Log code, field, depth range, operator, scale) */}
          <div className="border-2 border-black mb-1 p-2 flex flex-col md:flex-row md:items-center justify-between bg-white text-black text-center font-bold">
            <div className="w-28 hidden md:block text-left text-xs font-sans">
              Log Code: <br />
              <span className="font-mono">ISS 102</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-black uppercase tracking-widest font-sans border-b-2 border-black pb-1 mb-1">
                BOREHOLE LOG: {wellName}
              </h3>
              <div className="flex justify-around text-xs font-mono font-normal">
                <span>Field: {field}</span>
                <span>Depth Range: {minDepth.toFixed(1)} – {maxDepth.toFixed(1)} {depthUnit}</span>
                <span>Operator: {operator}</span>
              </div>
            </div>
            <div className="w-36 text-right text-xs font-sans hidden md:block">
              Scale: 1:500 Wireline <br />
              <span className="text-[10px] text-slate-600 font-mono">WellQC+ Calibrated</span>
            </div>
          </div>

          {/* Track Headers Box */}
          <div className="grid grid-cols-12 border-2 border-black bg-white text-black font-sans font-bold text-center text-xs min-w-[620px]">
            {/* Depth Column Header */}
            <div className="col-span-2 border-r-2 border-black p-2 flex flex-col justify-between bg-slate-100">
              <div>Depth</div>
              <div className="text-sm font-black">{depthUnit.toLowerCase()}</div>
            </div>

            {/* TRACK 1 Header */}
            <div className="col-span-3 border-r-2 border-black p-1 bg-white">
              <div className="text-[10px] uppercase border-b border-black pb-0.5">TRACK 1</div>
              <div className="text-sm font-black text-green-700">{track1Config.mnemonic}</div>
              <div className="text-[10px] text-green-700 font-mono">
                {track1Config.unit} (Linear)
              </div>
              <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                <span>{track1Config.min}</span>
                <span>{track1Config.max}</span>
              </div>
            </div>

            {/* TRACK 2 Header (Resistivity Logarithmic) */}
            <div className="col-span-4 border-r-2 border-black p-1 bg-white">
              <div className="text-[10px] uppercase border-b border-black pb-0.5">TRACK 2</div>
              <div className="text-sm font-black text-red-600">{track2Config.mnemonic}</div>
              <div className="text-[10px] text-red-600 font-mono">
                {track2Config.unit} {track2Config.isLogScale ? "(Logarithmic Scale)" : "(Linear)"}
              </div>
              <div className="flex justify-between text-[10px] font-mono px-1 pt-1 border-t border-slate-300 mt-1">
                {track2Config.isLogScale ? (
                  <>
                    <span>0.2</span>
                    <span>2</span>
                    <span>20</span>
                    <span>200</span>
                    <span>2000</span>
                  </>
                ) : (
                  <>
                    <span>{track2Config.min}</span>
                    <span>{track2Config.max}</span>
                  </>
                )}
              </div>
            </div>

            {/* TRACK 3 Header */}
            <div className="col-span-3 p-1 bg-white">
              <div className="text-[10px] uppercase border-b border-black pb-0.5">TRACK 3</div>
              <div className="text-sm font-black text-blue-700">{track3Config.mnemonic}</div>
              <div className="text-[10px] text-blue-700 font-mono">
                {track3Config.unit} (Linear)
              </div>
              <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                <span>{track3Config.min}</span>
                <span>{track3Config.max}</span>
              </div>
            </div>
          </div>

          {/* Wireline Tracks Grid Body */}
          <div
            className="relative border-2 border-t-0 border-black bg-white overflow-hidden min-w-[620px]"
            style={{ height: `${svgHeight}px` }}
          >
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #cbd5e1 1px, transparent 1px),
                  linear-gradient(to bottom, #94a3b8 1px, transparent 1px),
                  linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                `,
                backgroundSize: `16.66% 40px, 100% 40px, 100% 10px`,
              }}
            />

            <div className="grid grid-cols-12 h-full relative z-10 font-sans">
              {/* Depth Column */}
              <div className="col-span-2 border-r-2 border-black bg-slate-50/50 relative">
                {depthTicks.map((d) => {
                  const y = mapDepthToY(d);
                  return (
                    <div
                      key={d}
                      className="absolute left-0 right-0 flex items-center justify-between px-2 text-xs font-mono font-bold text-black border-t border-black/40"
                      style={{ top: `${y}px`, transform: "translateY(-50%)" }}
                    >
                      <span className="text-sm">{d}</span>
                      <span className="text-[10px] text-slate-500">—</span>
                    </div>
                  );
                })}
              </div>

              {/* TRACK 1 (Green) */}
              <div className="col-span-3 border-r-2 border-black relative">
                <svg className="w-full h-full overflow-visible">
                  {/* Raw line behind (dashed gray) */}
                  {compareToRaw && (
                    <polyline
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      points={renderSvgCurve(getRawSeries(track1Config.mnemonic), track1Config, 220)}
                    />
                  )}
                  {/* Cleaned line on top (solid) */}
                  <polyline
                    fill="none"
                    stroke="#15803d"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={renderSvgCurve(getCleanedSeries(track1Config.mnemonic), track1Config, 220)}
                  />
                </svg>
              </div>

              {/* TRACK 2 (Resistivity - Red, Logarithmic) */}
              <div className="col-span-4 border-r-2 border-black relative">
                {/* Vertical Decade Grid Lines for Logarithmic Scale */}
                {track2Config.isLogScale && (
                  <div className="absolute inset-0 pointer-events-none flex justify-between px-0">
                    <div className="border-r border-red-300/60 h-full w-[25%]" />
                    <div className="border-r border-red-300/60 h-full w-[25%]" />
                    <div className="border-r border-red-300/60 h-full w-[25%]" />
                    <div className="h-full w-[25%]" />
                  </div>
                )}
                <svg className="w-full h-full overflow-visible relative z-10">
                  {/* Raw line behind (dashed gray) */}
                  {compareToRaw && (
                    <polyline
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      points={renderSvgCurve(getRawSeries(track2Config.mnemonic), track2Config, 300)}
                    />
                  )}
                  {/* Cleaned line on top (solid) */}
                  <polyline
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={renderSvgCurve(getCleanedSeries(track2Config.mnemonic), track2Config, 300)}
                  />
                </svg>
              </div>

              {/* TRACK 3 (Blue) */}
              <div className="col-span-3 relative">
                <svg className="w-full h-full overflow-visible">
                  {/* Raw line behind (dashed gray) */}
                  {compareToRaw && (
                    <polyline
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      points={renderSvgCurve(getRawSeries(track3Config.mnemonic), track3Config, 220)}
                    />
                  )}
                  {/* Cleaned line on top (solid) */}
                  <polyline
                    fill="none"
                    stroke="#1d4ed8"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={renderSvgCurve(getCleanedSeries(track3Config.mnemonic), track3Config, 220)}
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Modern Dark Mode Log Viewer */
        <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-4 md:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-wellqc-border text-xs font-mono text-slate-300">
            <span>BOREHOLE LOG: {wellName}</span>
            <span>Interval: {minDepth.toFixed(1)} – {maxDepth.toFixed(1)} {depthUnit}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* Track 1 Dark */}
            <div className="bg-wellqc-card border border-wellqc-border rounded-xl p-3">
              <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 font-bold text-emerald-400">
                <span>TRACK 1: {track1Config.mnemonic}</span>
                <span>{track1Config.min} – {track1Config.max} {track1Config.unit}</span>
              </div>
              <div className="h-96 relative bg-wellqc-dark rounded-lg overflow-hidden p-2 border border-wellqc-border">
                <svg className="w-full h-full overflow-visible">
                  {compareToRaw && (
                    <polyline
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      points={renderSvgCurve(getRawSeries(track1Config.mnemonic), track1Config, 240)}
                    />
                  )}
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    points={renderSvgCurve(getCleanedSeries(track1Config.mnemonic), track1Config, 240)}
                  />
                </svg>
              </div>
            </div>

            {/* Track 2 Dark (Resistivity Logarithmic) */}
            <div className="bg-wellqc-card border border-wellqc-border rounded-xl p-3">
              <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 font-bold text-red-400">
                <span>TRACK 2: {track2Config.mnemonic} {track2Config.isLogScale ? "[LOG]" : ""}</span>
                <span>{track2Config.min} – {track2Config.max} {track2Config.unit}</span>
              </div>
              <div className="h-96 relative bg-wellqc-dark rounded-lg overflow-hidden p-2 border border-wellqc-border">
                {track2Config.isLogScale && (
                  <div className="absolute inset-0 pointer-events-none flex justify-between px-0">
                    <div className="border-r border-red-500/10 h-full w-[25%]" />
                    <div className="border-r border-red-500/10 h-full w-[25%]" />
                    <div className="border-r border-red-500/10 h-full w-[25%]" />
                    <div className="h-full w-[25%]" />
                  </div>
                )}
                <svg className="w-full h-full overflow-visible relative z-10">
                  {compareToRaw && (
                    <polyline
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      points={renderSvgCurve(getRawSeries(track2Config.mnemonic), track2Config, 240)}
                    />
                  )}
                  <polyline
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    points={renderSvgCurve(getCleanedSeries(track2Config.mnemonic), track2Config, 240)}
                  />
                </svg>
              </div>
            </div>

            {/* Track 3 Dark */}
            <div className="bg-wellqc-card border border-wellqc-border rounded-xl p-3">
              <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 font-bold text-cyan-400">
                <span>TRACK 3: {track3Config.mnemonic}</span>
                <span>{track3Config.min} – {track3Config.max} {track3Config.unit}</span>
              </div>
              <div className="h-96 relative bg-wellqc-dark rounded-lg overflow-hidden p-2 border border-wellqc-border">
                <svg className="w-full h-full overflow-visible">
                  {compareToRaw && (
                    <polyline
                      fill="none"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      points={renderSvgCurve(getRawSeries(track3Config.mnemonic), track3Config, 240)}
                    />
                  )}
                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    points={renderSvgCurve(getCleanedSeries(track3Config.mnemonic), track3Config, 240)}
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
