"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  FileText,
  Layout,
  Printer,
  Sparkles,
  LineChart,
  Columns,
  Table,
} from "lucide-react";
import { WellLogDataTable } from "./log-data-table";

interface LogViewerProps {
  wellName: string;
  depthUnit: string;
  startDepth: number;
  stopDepth: number;
  curvesData: {
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
  initialLayoutMode?: "GRAPH" | "SPLIT" | "TABLE";
  initialViewMode?: "CLASSIC_PAPER" | "DARK_MODERN";
  layoutMode?: "GRAPH" | "SPLIT" | "TABLE";
  onLayoutModeChange?: (mode: "GRAPH" | "SPLIT" | "TABLE") => void;
}

// Fixed-height scroll viewport for the graphical log pane. Instead of
// laying the entire multi-thousand-px log out in the page at once, the
// pane scrolls internally and only the visible depth window (+ overscan)
// is rendered as real DOM/SVG nodes. This is the main perf/memory fix
// for files with >10,000 depth samples.
const VIEWPORT_HEIGHT = 720; // px, visible pane height
const OVERSCAN_PX = 400; // px, extra rendered above/below the visible window

// Binary search: first index in an ascending sorted array whose value is >= target.
function findDepthIndex(target: number, arr: number[]): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function WellLogViewer({
  wellName,
  depthUnit,
  startDepth,
  stopDepth,
  curvesData,
  anomalies = [],
  initialLayoutMode = "GRAPH",
  initialViewMode = "CLASSIC_PAPER",
  layoutMode: externalLayoutMode,
  onLayoutModeChange,
}: LogViewerProps) {
  const [internalLayoutMode, setInternalLayoutMode] = useState<"GRAPH" | "SPLIT" | "TABLE">(
    externalLayoutMode || initialLayoutMode
  );
  const [viewMode, setViewMode] = useState<"CLASSIC_PAPER" | "DARK_MODERN">(initialViewMode);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDepth, setSelectedDepth] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const scrollRafRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const handleTrackScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(top);
      scrollRafRef.current = null;
    });
  }, []);

  const layoutMode = externalLayoutMode !== undefined ? externalLayoutMode : internalLayoutMode;

  const handleLayoutModeChange = (mode: "GRAPH" | "SPLIT" | "TABLE") => {
    setInternalLayoutMode(mode);
    onLayoutModeChange?.(mode);
  };

  const depthArr = curvesData.depth || [];
  const totalPoints = depthArr.length;

  const grValues = curvesData.curves["GR"] || curvesData.curves["GAMMA"] || [];
  const rtValues = curvesData.curves["RT"] || curvesData.curves["RES"] || curvesData.curves["ILD"] || [];
  const dtValues = curvesData.curves["DT"] || curvesData.curves["SONIC"] || [];
  const rhobValues = curvesData.curves["RHOB"] || [];

  // Calculate missing gap intervals for each track
  const getMissingGaps = (series: number[]) => {
    const gaps: { startIdx: number; endIdx: number; startDepth: number; endDepth: number }[] = [];
    let inGap = false;
    let startIdx = -1;

    for (let i = 0; i <= series.length; i++) {
      const val = series[i];
      const isNull = i === series.length || val === -999.25 || val === -9999 || isNaN(val) || val === null || val === undefined;

      if (isNull && !inGap && i < series.length) {
        inGap = true;
        startIdx = i;
      } else if (!isNull && inGap) {
        inGap = false;
        if (i - startIdx >= 5) {
          gaps.push({
            startIdx,
            endIdx: i - 1,
            startDepth: depthArr[startIdx],
            endDepth: depthArr[i - 1],
          });
        }
      }
    }
    return gaps;
  };

  const grGapsAll = useMemo(() => getMissingGaps(grValues), [grValues, depthArr]);
  const rtGapsAll = useMemo(() => getMissingGaps(rtValues), [rtValues, depthArr]);
  const dtGapsAll = useMemo(() => getMissingGaps(dtValues), [dtValues, depthArr]);

  // Helper to map curve values to SVG X coordinates (0 to 100% of track width)
  const mapValueToX = (
    val: number,
    min: number,
    max: number,
    trackWidth: number,
    isLogScale: boolean = false
  ) => {
    if (isLogScale) {
      const positiveMin = min > 0 ? min : 0.2;
      const positiveMax = max > positiveMin ? max : 2000;
      const safeVal = Math.max(positiveMin, Math.min(positiveMax, val <= 0 ? positiveMin : val));
      const logMin = Math.log10(positiveMin);
      const logMax = Math.log10(positiveMax);
      return ((Math.log10(safeVal) - logMin) / (logMax - logMin)) * trackWidth;
    }
    const clamped = Math.max(min, Math.min(max, val));
    return ((clamped - min) / (max - min)) * trackWidth;
  };

  // Helper to map depth to Y coordinate (0 to canvasHeight)
  const svgHeight = Math.max(900, totalPoints * 6) * zoomLevel;
  const minDepth = depthArr[0] || startDepth;
  const maxDepth = depthArr[depthArr.length - 1] || stopDepth;
  const depthSpan = maxDepth - minDepth || 1;

  const mapDepthToY = (d: number) => {
    return ((d - minDepth) / depthSpan) * (svgHeight - 60) + 30;
  };

  const mapYToDepth = (y: number) => {
    return minDepth + ((y - 30) / (svgHeight - 60)) * depthSpan;
  };

  // --- Windowing: only the visible depth range (+ overscan) gets rendered ---
  // Recomputed on scroll (rAF-throttled above) and on zoom/data changes.
  const { visStartIdx, visEndIdx, visStartDepth, visEndDepth } = useMemo(() => {
    const clampedTop = Math.min(scrollTop, Math.max(0, svgHeight - VIEWPORT_HEIGHT));
    const yTop = Math.max(0, clampedTop - OVERSCAN_PX);
    const yBottom = Math.min(svgHeight, clampedTop + VIEWPORT_HEIGHT + OVERSCAN_PX);
    const dTop = mapYToDepth(yTop);
    const dBottom = mapYToDepth(yBottom);
    const startIdx = Math.max(0, findDepthIndex(dTop, depthArr) - 1);
    const endIdx = Math.min(depthArr.length - 1, findDepthIndex(dBottom, depthArr) + 1);
    return {
      visStartIdx: startIdx,
      visEndIdx: Math.max(startIdx, endIdx),
      visStartDepth: depthArr[startIdx] ?? minDepth,
      visEndDepth: depthArr[endIdx] ?? maxDepth,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTop, svgHeight, depthArr, minDepth, depthSpan]);

  const overlapsVisible = (aStart: number, aEnd: number) => aEnd >= visStartDepth && aStart <= visEndDepth;

  // Render SVG polyline points for a curve, restricted to [startIdx, endIdx].
  const renderSvgCurve = (
    series: number[],
    minVal: number,
    maxVal: number,
    trackWidth: number,
    isLogScale: boolean,
    startIdx: number,
    endIdx: number
  ) => {
    const points: string[] = [];
    for (let idx = startIdx; idx <= endIdx && idx < series.length; idx++) {
      const val = series[idx];
      if (val !== -999.25 && val !== -9999 && !isNaN(val) && val !== null && val !== undefined) {
        const x = mapValueToX(val, minVal, maxVal, trackWidth, isLogScale);
        const y = mapDepthToY(depthArr[idx]);
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
    return points.join(" ");
  };

  // Only the active theme's curves are computed — previously both Classic
  // and Dark variants were memoized on every zoom change even though just
  // one is ever displayed at a time.
  const isDark = viewMode === "DARK_MODERN";
  const grTrackWidth = isDark ? 240 : 220;
  const rtTrackWidth = isDark ? 240 : 300;
  const dtTrackWidth = isDark ? 240 : 220;
  const grColor = isDark ? "#10b981" : "#15803d";
  const rtColor = isDark ? "#ef4444" : "#dc2626";
  const dtColor = isDark ? "#06b6d4" : "#1d4ed8";

  const grPoints = useMemo(
    () => renderSvgCurve(grValues, 0, 150, grTrackWidth, false, visStartIdx, visEndIdx),
    [grValues, depthArr, zoomLevel, visStartIdx, visEndIdx, grTrackWidth]
  );
  const rtPoints = useMemo(
    () => renderSvgCurve(rtValues, 0.2, 2000, rtTrackWidth, true, visStartIdx, visEndIdx),
    [rtValues, depthArr, zoomLevel, visStartIdx, visEndIdx, rtTrackWidth]
  );
  const dtPoints = useMemo(
    () => renderSvgCurve(dtValues, 40, 240, dtTrackWidth, false, visStartIdx, visEndIdx),
    [dtValues, depthArr, zoomLevel, visStartIdx, visEndIdx, dtTrackWidth]
  );

  // Generate depth tick marks (every 50 ft/m), filtered to the visible window
  const depthTicks: number[] = useMemo(() => {
    const ticks: number[] = [];
    const lo = Math.max(minDepth, visStartDepth - 50);
    const hi = Math.min(maxDepth, visEndDepth + 50);
    const startStep = Math.ceil(lo / 50) * 50;
    for (let d = startStep; d <= hi; d += 50) ticks.push(d);
    return ticks;
  }, [minDepth, maxDepth, visStartDepth, visEndDepth]);

  const grGaps = useMemo(
    () => grGapsAll.filter((g) => overlapsVisible(g.startDepth, g.endDepth)),
    [grGapsAll, visStartDepth, visEndDepth]
  );
  const rtGaps = useMemo(
    () => rtGapsAll.filter((g) => overlapsVisible(g.startDepth, g.endDepth)),
    [rtGapsAll, visStartDepth, visEndDepth]
  );
  const dtGaps = useMemo(
    () => dtGapsAll.filter((g) => overlapsVisible(g.startDepth, g.endDepth)),
    [dtGapsAll, visStartDepth, visEndDepth]
  );

  const visibleSpikeAnomalies = useMemo(
    () =>
      anomalies.filter(
        (a) =>
          (a.anomalyType === "EXTREME_SPIKE" || a.anomalyType === "IMPOSSIBLE_VALUE") &&
          overlapsVisible(a.depthStart, a.depthEnd ?? a.depthStart)
      ),
    [anomalies, visStartDepth, visEndDepth]
  );

  // Graphical Log Rendering
  const renderGraphLog = () => {
    const paneHeight = Math.min(svgHeight, VIEWPORT_HEIGHT);

    if (viewMode === "CLASSIC_PAPER") {
      return (
        <div className="bg-white text-black p-4 border-4 border-red-600 rounded-lg shadow-2xl overflow-x-auto select-none font-serif">
          {/* Main Title Banner Header */}
          <div className="border-2 border-black mb-1 p-2 flex flex-col md:flex-row md:items-center justify-between bg-white text-black text-center font-bold">
            <div className="w-24 hidden md:block text-left text-xs font-sans">
              Log Code: <br />
              <span className="font-mono">ISS 102</span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest font-sans border-b-2 border-black pb-1 mb-1">
                BOREHOLE LOG: {wellName}
              </h1>
              <div className="flex justify-around text-xs font-mono">
                <span>Field: Niger Delta</span>
                <span>Depth Range: {minDepth} – {maxDepth} {depthUnit}</span>
                <span>Operator: WellQC+ Telemetry</span>
              </div>
            </div>
            <div className="w-36 text-right text-xs font-sans hidden md:block">
              Log Parameters: ISS 102 <br />
              <span className="text-[10px] text-slate-600">Scale 1:500 Wireline</span>
            </div>
          </div>

          {/* Log Track Header Box */}
          <div className="grid grid-cols-12 border-2 border-black bg-white text-black font-sans font-bold text-center text-xs min-w-[580px]">
            {/* Depth Header */}
            <div className="col-span-2 border-r-2 border-black p-2 flex flex-col justify-between bg-slate-100">
              <div>Depth</div>
              <div className="text-sm font-black">{depthUnit.toLowerCase()}</div>
            </div>

            {/* TRACK 1 Header */}
            <div className="col-span-3 border-r-2 border-black p-1 bg-white">
              <div className="text-xs uppercase border-b border-black pb-0.5">TRACK 1</div>
              <div className="text-sm font-black text-green-700">GAMMA RAY</div>
              <div className="text-xs text-green-700 font-mono">GR (GAPI)</div>
              <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                <span>0</span>
                <span>150</span>
              </div>
            </div>

            {/* TRACK 2 Header */}
            <div className="col-span-4 border-r-2 border-black p-1 bg-white">
              <div className="text-xs uppercase border-b border-black pb-0.5">TRACK 2</div>
              <div className="text-sm font-black text-red-600">RESISTIVITY (LOG)</div>
              <div className="text-xs text-red-600 font-mono">RT (ohm.m) — Logarithmic Scale</div>
              <div className="flex justify-between text-[10px] font-mono px-1 pt-1 border-t border-slate-300 mt-1">
                <span>0.2</span>
                <span>2</span>
                <span>20</span>
                <span>200</span>
                <span>2000</span>
              </div>
            </div>

            {/* TRACK 3 Header */}
            <div className="col-span-3 p-1 bg-white">
              <div className="text-xs uppercase border-b border-black pb-0.5">TRACK 3</div>
              <div className="text-sm font-black text-blue-700">SONIC</div>
              <div className="text-xs text-blue-700 font-mono">DT (&mu;s/ft)</div>
              <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                <span>40</span>
                <span>240</span>
              </div>
            </div>
          </div>

          {/* Main Log Grid Body — fixed-height scroll viewport (windowed rendering) */}
          <div
            ref={undefined}
            onScroll={handleTrackScroll}
            className="relative border-2 border-t-0 border-black bg-white overflow-y-auto overflow-x-hidden min-w-[580px]"
            style={{ height: `${paneHeight}px` }}
          >
            <div className="relative" style={{ height: `${svgHeight}px` }}>
              {/* Background Graph Grid Pattern */}
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

              {/* Selected Depth Marker Line */}
              {selectedDepth !== null && selectedDepth >= minDepth && selectedDepth <= maxDepth && (
                <div
                  className="absolute left-0 right-0 border-b-2 border-cyan-500 z-30 pointer-events-none flex items-center justify-end pr-2"
                  style={{ top: `${mapDepthToY(selectedDepth)}px` }}
                >
                  <span className="bg-cyan-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                    Target Depth: {selectedDepth.toFixed(1)} {depthUnit}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-12 h-full relative z-10 font-sans">
                {/* Depth Column — only visible-window ticks rendered */}
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

                {/* TRACK 1 (GAMMA RAY - Green) */}
                <div className="col-span-3 border-r-2 border-black relative">
                  <svg className="w-full h-full overflow-visible">
                    <polyline
                      fill="none"
                      stroke={grColor}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={grPoints}
                    />
                  </svg>

                  {grGaps.map((gap, i) => {
                    const topY = mapDepthToY(gap.startDepth);
                    const botY = mapDepthToY(gap.endDepth);
                    const h = Math.max(35, botY - topY);
                    return (
                      <div
                        key={i}
                        className="absolute left-2 right-2 border-2 border-black bg-white flex items-center justify-center font-black font-sans text-xs shadow-md"
                        style={{ top: `${topY}px`, height: `${h}px` }}
                      >
                        <span>MISSING GAP</span>
                      </div>
                    );
                  })}
                </div>

                {/* TRACK 2 (RESISTIVITY - Red, Logarithmic Scale) */}
                <div className="col-span-4 border-r-2 border-black relative">
                  <div className="absolute inset-0 pointer-events-none flex justify-between px-0">
                    <div className="border-r border-red-200/60 h-full w-[25%]" />
                    <div className="border-r border-red-200/60 h-full w-[25%]" />
                    <div className="border-r border-red-200/60 h-full w-[25%]" />
                    <div className="h-full w-[25%]" />
                  </div>
                  <svg className="w-full h-full overflow-visible relative z-10">
                    <polyline
                      fill="none"
                      stroke={rtColor}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={rtPoints}
                    />
                  </svg>

                  {rtGaps.map((gap, i) => {
                    const topY = mapDepthToY(gap.startDepth);
                    const botY = mapDepthToY(gap.endDepth);
                    const h = Math.max(35, botY - topY);
                    return (
                      <div
                        key={i}
                        className="absolute left-2 right-2 border-2 border-black bg-white flex items-center justify-center font-black font-sans text-xs shadow-md"
                        style={{ top: `${topY}px`, height: `${h}px` }}
                      >
                        <span>MISSING GAP</span>
                      </div>
                    );
                  })}
                </div>

                {/* TRACK 3 (SONIC - Blue & Anomaly Callouts) */}
                <div className="col-span-3 relative">
                  <svg className="w-full h-full overflow-visible">
                    <polyline
                      fill="none"
                      stroke={dtColor}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={dtPoints}
                    />
                  </svg>

                  {dtGaps.map((gap, i) => {
                    const topY = mapDepthToY(gap.startDepth);
                    const botY = mapDepthToY(gap.endDepth);
                    const h = Math.max(35, botY - topY);
                    return (
                      <div
                        key={i}
                        className="absolute left-2 right-2 border-2 border-black bg-white flex items-center justify-center font-black font-sans text-xs shadow-md"
                        style={{ top: `${topY}px`, height: `${h}px` }}
                      >
                        <span>MISSING GAP</span>
                      </div>
                    );
                  })}

                  {visibleSpikeAnomalies.map((an, i) => {
                    const y = mapDepthToY(an.depthStart);
                    return (
                      <div
                        key={i}
                        className="absolute right-2 border-2 border-black bg-white px-2 py-1 shadow-lg text-[10px] font-black font-sans flex items-center space-x-1"
                        style={{ top: `${y}px`, transform: "translateY(-50%)" }}
                      >
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                        <span>SONIC SPIKE (CYCLE SKIP)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1 px-1">
            Showing depths {visStartDepth.toFixed(0)}–{visEndDepth.toFixed(0)} {depthUnit} · scroll to view more · {totalPoints.toLocaleString()} total samples
          </p>
        </div>
      );
    }

    // Modern Dark Mode
    return (
      <div className="bg-wellqc-card border border-wellqc-border rounded-xl p-5 shadow-2xl space-y-4">
        {selectedDepth !== null && (
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-between text-xs font-mono text-cyan-300">
            <span>Synchronized Depth Marker:</span>
            <span className="font-bold">{selectedDepth.toFixed(1)} {depthUnit}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
          {/* Track 1 Dark */}
          <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-3">
            <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 text-xs font-bold text-emerald-400">
              <span>TRACK 1: GAMMA RAY (GR)</span>
              <span>0 – 150 GAPI</span>
            </div>
            <div
              className="relative bg-wellqc-dark rounded-lg overflow-y-auto overflow-x-hidden p-2 border border-wellqc-border"
              style={{ height: `${Math.min(svgHeight, VIEWPORT_HEIGHT)}px` }}
              onScroll={handleTrackScroll}
            >
              <div style={{ height: `${svgHeight}px`, position: "relative" }}>
                <svg className="w-full h-full overflow-visible">
                  <polyline fill="none" stroke={grColor} strokeWidth="2" points={grPoints} />
                </svg>
              </div>
            </div>
          </div>

          {/* Track 2 Dark */}
          <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-3">
            <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 text-xs font-bold text-red-400">
              <span>TRACK 2: RESISTIVITY (RT) [LOG]</span>
              <span>0.2 – 2000 OHMM (Logarithmic)</span>
            </div>
            <div
              className="relative bg-wellqc-dark rounded-lg overflow-y-auto overflow-x-hidden p-2 border border-wellqc-border"
              style={{ height: `${Math.min(svgHeight, VIEWPORT_HEIGHT)}px` }}
              onScroll={handleTrackScroll}
            >
              <div style={{ height: `${svgHeight}px`, position: "relative" }}>
                <div className="absolute inset-0 pointer-events-none flex justify-between px-0">
                  <div className="border-r border-red-500/10 h-full w-[25%]" />
                  <div className="border-r border-red-500/10 h-full w-[25%]" />
                  <div className="border-r border-red-500/10 h-full w-[25%]" />
                  <div className="h-full w-[25%]" />
                </div>
                <svg className="w-full h-full overflow-visible relative z-10">
                  <polyline fill="none" stroke={rtColor} strokeWidth="2" points={rtPoints} />
                </svg>
              </div>
            </div>
          </div>

          {/* Track 3 Dark */}
          <div className="bg-wellqc-panel border border-wellqc-border rounded-xl p-3">
            <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 text-xs font-bold text-cyan-400">
              <span>TRACK 3: SONIC (DT)</span>
              <span>40 – 240 &mu;s/ft</span>
            </div>
            <div
              className="relative bg-wellqc-dark rounded-lg overflow-y-auto overflow-x-hidden p-2 border border-wellqc-border"
              style={{ height: `${Math.min(svgHeight, VIEWPORT_HEIGHT)}px` }}
              onScroll={handleTrackScroll}
            >
              <div style={{ height: `${svgHeight}px`, position: "relative" }}>
                <svg className="w-full h-full overflow-visible">
                  <polyline fill="none" stroke={dtColor} strokeWidth="2" points={dtPoints} />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-wellqc-muted font-mono">
          Showing depths {visStartDepth.toFixed(0)}–{visEndDepth.toFixed(0)} {depthUnit} · scroll a track to view more · {totalPoints.toLocaleString()} total samples
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-wellqc-panel border border-wellqc-border rounded-xl shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-extrabold text-white tracking-tight">
              {wellName} — Wireline Subsurface Explorer
            </h3>
          </div>
          <p className="text-xs text-wellqc-muted font-mono mt-0.5">
            Depth Interval: {minDepth} – {maxDepth} {depthUnit} | {totalPoints.toLocaleString()} Recorded Samples
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Layout Mode Switcher Toggle (Graph vs Split vs Table) */}
          <div className="flex items-center bg-wellqc-card border border-wellqc-border rounded-xl p-1 shadow-inner">
            <button
              onClick={() => handleLayoutModeChange("GRAPH")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === "GRAPH"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Show graphical well log plot only"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>Log Plot</span>
            </button>

            <button
              onClick={() => handleLayoutModeChange("SPLIT")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === "SPLIT"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Show graphical log and tabular data side-by-side"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>

            <button
              onClick={() => handleLayoutModeChange("TABLE")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === "TABLE"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Show full tabular numerical spreadsheet view"
            >
              <Table className="w-3.5 h-3.5" />
              <span>Data Table</span>
            </button>
          </div>

          {/* Graphical Theme Switcher (Only visible when Graph or Split is active) */}
          {layoutMode !== "TABLE" && (
            <div className="flex items-center bg-wellqc-card border border-wellqc-border rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setViewMode("CLASSIC_PAPER")}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "CLASSIC_PAPER"
                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Switch to Classic Borehole Paper Log styling"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Paper Log</span>
              </button>

              <button
                onClick={() => setViewMode("DARK_MODERN")}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "DARK_MODERN"
                    ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Switch to Dark Subsurface styling"
              >
                <Layout className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark Subsurface</span>
              </button>
            </div>
          )}

          {/* Zoom & Track Controls (For Graph View) */}
          {layoutMode !== "TABLE" && (
            <div className="flex items-center space-x-1 bg-wellqc-card border border-wellqc-border rounded-xl p-1">
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3.0))}
                className="p-1.5 text-slate-300 hover:text-cyan-400"
                title="Zoom In Vertical Scale"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.6))}
                className="p-1.5 text-slate-300 hover:text-cyan-400"
                title="Zoom Out Vertical Scale"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 text-slate-300 hover:text-cyan-400"
                title="Reset Scale"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* RENDER VIEW ACCORDING TO LAYOUT MODE */}

      {/* 1. GRAPH ONLY MODE */}
      {layoutMode === "GRAPH" && renderGraphLog()}

      {/* 2. SPLIT VIEW (SIDE-BY-SIDE GRAPH LOG & TABULAR DATA) */}
      {layoutMode === "SPLIT" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-6 space-y-3 overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-mono text-slate-400">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <LineChart className="w-3.5 h-3.5 text-cyan-400" />
                <span>Wireline Curves Track</span>
              </span>
              <span>Vertical Scale: {Math.round(zoomLevel * 100)}%</span>
            </div>
            {renderGraphLog()}
          </div>

          <div className="xl:col-span-6 space-y-3">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-mono text-slate-400">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Table className="w-3.5 h-3.5 text-cyan-400" />
                <span>Synchronized Tabular Sheet</span>
              </span>
              <span>Click a row to locate on track</span>
            </div>
            <WellLogDataTable
              wellName={wellName}
              depthUnit={depthUnit}
              curvesData={curvesData}
              anomalies={anomalies}
              isCompact={true}
              selectedDepth={selectedDepth}
              onDepthSelect={(d) => setSelectedDepth(d)}
            />
          </div>
        </div>
      )}

      {/* 3. TABLE ONLY MODE */}
      {layoutMode === "TABLE" && (
        <WellLogDataTable
          wellName={wellName}
          depthUnit={depthUnit}
          curvesData={curvesData}
          anomalies={anomalies}
          isCompact={false}
          selectedDepth={selectedDepth}
          onDepthSelect={(d) => setSelectedDepth(d)}
        />
      )}
    </div>
  );
}

export const LogViewer = WellLogViewer;
