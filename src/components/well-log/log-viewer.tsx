"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LineChart,
  Columns,
  Table,
  SlidersHorizontal,
  ChevronDown,
  Check,
  Search,
  X,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { WellLogDataTable } from "./log-data-table";
import { STANDARD_CURVES, standardiseMnemonic } from "@/lib/las/standardiser";

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
  initialSelectedCurves?: string[];
}

interface CurveMeta {
  key: string;
  mnemonic: string;
  name: string;
  unit: string;
  category: string;
  minVal: number;
  maxVal: number;
  isLogScale: boolean;
  colorDark: string;
  colorPaper: string;
  ticks: number[];
}

// Fixed-height scroll viewport for the graphical log pane. Instead of
// laying the entire multi-thousand-px log out in the page at once, the
// pane scrolls internally and only the visible depth window (+ overscan)
// is rendered as real DOM/SVG nodes. This is the main perf/memory fix
// for files with >10,000 depth samples.
const VIEWPORT_HEIGHT = 720; // px, visible pane height
const OVERSCAN_PX = 400; // px, extra rendered above/below the visible window

// Curated petrophysical color palettes for dark modern and classic paper modes
const DEFAULT_CURVE_PALETTE = [
  { dark: "#10b981", paper: "#15803d" }, // Green (GR)
  { dark: "#ef4444", paper: "#dc2626" }, // Red (RT)
  { dark: "#06b6d4", paper: "#1d4ed8" }, // Cyan (DT)
  { dark: "#f59e0b", paper: "#b45309" }, // Amber (RHOB)
  { dark: "#3b82f6", paper: "#1e40af" }, // Royal Blue (NPHI)
  { dark: "#8b5cf6", paper: "#6d28d9" }, // Violet (CALI)
  { dark: "#ec4899", paper: "#be185d" }, // Pink (SP)
  { dark: "#14b8a6", paper: "#0f766e" }, // Teal (PEF)
  { dark: "#f97316", paper: "#c2410c" }, // Orange
  { dark: "#a855f7", paper: "#7e22ce" }, // Purple
  { dark: "#84cc16", paper: "#4d7c0f" }, // Lime
  { dark: "#e11d48", paper: "#9f1239" }, // Rose
];

function getCurveColor(category: string, standardMnemonic: string, index: number) {
  const m = standardMnemonic.toUpperCase();
  if (m === "GR" || category === "GAMMA") return { dark: "#10b981", paper: "#15803d" };
  if (m === "RT" || category === "RESISTIVITY") return { dark: "#ef4444", paper: "#dc2626" };
  if (m === "DT" || category === "SONIC") return { dark: "#06b6d4", paper: "#1d4ed8" };
  if (m === "RHOB" || category === "DENSITY") return { dark: "#f59e0b", paper: "#b45309" };
  if (m === "NPHI" || category === "POROSITY") return { dark: "#3b82f6", paper: "#1e40af" };
  if (m === "CALI" || category === "CALIPER") return { dark: "#8b5cf6", paper: "#6d28d9" };
  if (m === "SP" || category === "POTENTIAL") return { dark: "#ec4899", paper: "#be185d" };
  if (m === "PEF") return { dark: "#14b8a6", paper: "#0f766e" };
  return DEFAULT_CURVE_PALETTE[index % DEFAULT_CURVE_PALETTE.length];
}

// Compute statistics and extents from valid, non-sentinel curve series values
function computeSeriesExtents(series: number[]): { min: number; max: number; hasData: boolean } {
  let min = Infinity;
  let max = -Infinity;
  let count = 0;
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v !== -999.25 && v !== -9999 && v !== -999 && !isNaN(v) && v !== null && v !== undefined) {
      if (v < min) min = v;
      if (v > max) max = v;
      count++;
    }
  }
  if (count === 0 || !isFinite(min) || !isFinite(max)) {
    return { min: 0, max: 100, hasData: false };
  }
  return { min, max, hasData: true };
}

// Intelligent default curve selection: picks standard 3-track or up to 3 available curves
function getDefaultSelectedCurves(available: string[]): string[] {
  if (available.length <= 3) return [...available];
  const prioritized: string[] = [];
  const priorityGroups = [
    ["GR", "GAMMA", "GRC", "GAM"],
    ["RT", "RES", "ILD", "LLD", "RD", "RES_DEEP", "LLS", "ILM"],
    ["DT", "SONIC", "DTCO", "AC", "RHOB", "DEN", "NPHI", "NEUT", "CALI"],
  ];

  for (const group of priorityGroups) {
    const found = available.find(
      (k) => group.includes(k.toUpperCase()) && !prioritized.includes(k)
    );
    if (found) prioritized.push(found);
  }

  // If fewer than 3, add other available curves until reaching 3
  for (const k of available) {
    if (prioritized.length >= 3) break;
    if (!prioritized.includes(k)) prioritized.push(k);
  }

  return prioritized.length > 0 ? prioritized : available.slice(0, 3);
}

// Helper to detect null or missing values in well log series
export function isNullOrGap(val: number | null | undefined): boolean {
  return (
    val === null ||
    val === undefined ||
    isNaN(val) ||
    !isFinite(val) ||
    val === -999.25 ||
    val === -9999 ||
    val === -999 ||
    val <= -999
  );
}

// Binary search with nearest-neighbor snapping for accurate depth coordinate mapping
function findDepthIndex(target: number, arr: number[]): number {
  if (arr.length === 0) return 0;
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(arr[lo - 1] - target) < Math.abs(arr[lo] - target)) {
    return lo - 1;
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
  initialSelectedCurves,
}: LogViewerProps) {
  const [internalLayoutMode, setInternalLayoutMode] = useState<"GRAPH" | "SPLIT" | "TABLE">(
    externalLayoutMode || initialLayoutMode
  );
  const [viewMode] = useState<"CLASSIC_PAPER" | "DARK_MODERN">(initialViewMode);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDepth, setSelectedDepth] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Live Wireline Hover & Depth Inspection State
  const [hoverDepth, setHoverDepth] = useState<number | null>(null);
  const [hoverSampleIdx, setHoverSampleIdx] = useState<number | null>(null);
  const [hoverClientPos, setHoverClientPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverTrackKey, setHoverTrackKey] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  // Dropdown selector state
  const [isTrackDropdownOpen, setIsTrackDropdownOpen] = useState(false);
  const [curveSearchQuery, setCurveSearchQuery] = useState("");
  const [dropdownAlign, setDropdownAlign] = useState<"left" | "right">("left");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine optimal dropdown alignment based on screen boundaries
  useEffect(() => {
    if (isTrackDropdownOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const popupWidth = 384;
      // If expanding to the right would overflow the screen and there's sufficient room on the left
      if (rect.left + popupWidth > window.innerWidth - 16 && rect.right >= popupWidth) {
        setDropdownAlign("right");
      } else {
        setDropdownAlign("left");
      }
    }
  }, [isTrackDropdownOpen]);

  // Close dropdown on click or touch outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsTrackDropdownOpen(false);
      }
    }
    if (isTrackDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [isTrackDropdownOpen]);

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

  const depthArr = useMemo(() => curvesData.depth || [], [curvesData.depth]);
  const totalPoints = depthArr.length;

  // All valid curve channels excluding depth indicators
  const allCurveKeys = useMemo(() => {
    return Object.keys(curvesData.curves || {}).filter(
      (k) => !["DEPTH", "DEPT", "MD", "INDEX"].includes(k.trim().toUpperCase())
    );
  }, [curvesData.curves]);

  // User custom curve selection override; when null, automatically resolves to smart default
  const [userSelectedCurves, setUserSelectedCurves] = useState<string[] | null>(
    initialSelectedCurves && initialSelectedCurves.length > 0 ? initialSelectedCurves : null
  );

  // Derived active curve keys: uses user selection (filtered to current valid curves) or smart default
  const selectedCurveKeys = useMemo(() => {
    if (userSelectedCurves !== null) {
      const valid = userSelectedCurves.filter((k) => allCurveKeys.includes(k));
      if (valid.length > 0) return valid;
      if (userSelectedCurves.length === 0) return [];
    }
    return getDefaultSelectedCurves(allCurveKeys);
  }, [userSelectedCurves, allCurveKeys]);

  // Compute rich metadata (ranges, log/linear scale, units, colors, ticks) for all available curves
  const curveMetaMap = useMemo(() => {
    const map: Record<string, CurveMeta> = {};
    allCurveKeys.forEach((key, index) => {
      const std = standardiseMnemonic(key);
      const series = curvesData.curves[key] || [];
      const ext = computeSeriesExtents(series);
      const stdDef = STANDARD_CURVES[std.standardMnemonic];

      const isResistivity =
        std.standardMnemonic === "RT" ||
        std.category === "RESISTIVITY" ||
        (ext.hasData && ext.min > 0 && ext.max / ext.min >= 100);

      let minVal = 0;
      let maxVal = 100;

      if (isResistivity) {
        minVal = 0.2;
        maxVal = 2000;
      } else if (std.standardMnemonic === "GR" || std.category === "GAMMA") {
        minVal = 0;
        maxVal = 150;
      } else if (std.standardMnemonic === "RHOB" || std.category === "DENSITY") {
        minVal = 1.65;
        maxVal = 2.65;
      } else if (std.standardMnemonic === "NPHI" || std.category === "POROSITY") {
        minVal = 0;
        maxVal = 0.6;
      } else if (std.standardMnemonic === "DT" || std.category === "SONIC") {
        minVal = 40;
        maxVal = 240;
      } else if (std.standardMnemonic === "CALI" || std.category === "CALIPER") {
        minVal = 6;
        maxVal = 16;
      } else if (std.standardMnemonic === "PEF") {
        minVal = 0;
        maxVal = 10;
      } else if (std.standardMnemonic === "SP" || std.category === "POTENTIAL") {
        minVal = -150;
        maxVal = 50;
      } else if (stdDef?.minPhysical !== undefined && stdDef?.maxPhysical !== undefined) {
        minVal = stdDef.minPhysical;
        maxVal = stdDef.maxPhysical;
      } else if (ext.hasData) {
        minVal = Math.floor(ext.min);
        maxVal = Math.ceil(ext.max);
        if (minVal === maxVal) maxVal = minVal + 10;
      }

      const isLogScale = isResistivity;
      const isGamma = std.standardMnemonic === "GR" || std.category === "GAMMA";
      const ticks = isLogScale
        ? [0.2, 2, 20, 200, 2000]
        : isGamma
        ? [0, 100, 150]
        : [
            minVal,
            Number(((minVal + maxVal) / 2).toFixed(minVal < 2 ? 2 : 0)),
            maxVal,
          ];

      const colors = getCurveColor(std.category, std.standardMnemonic, index);

      map[key] = {
        key,
        mnemonic: std.standardMnemonic !== "UNKN" ? std.standardMnemonic : key,
        name: std.matchedName,
        unit: std.standardUnit || "—",
        category: std.category,
        minVal,
        maxVal,
        isLogScale,
        colorDark: colors.dark,
        colorPaper: colors.paper,
        ticks,
      };
    });
    return map;
  }, [allCurveKeys, curvesData.curves]);

  // Missing gaps detector for any curve series
  const getMissingGaps = useCallback(
    (series: number[]) => {
      const gaps: { startIdx: number; endIdx: number; startDepth: number; endDepth: number }[] = [];
      let inGap = false;
      let startIdx = -1;

      for (let i = 0; i <= series.length; i++) {
        const val = series[i];
        const isNull =
          i === series.length ||
          val === -999.25 ||
          val === -9999 ||
          val === -999 ||
          isNaN(val) ||
          val === null ||
          val === undefined;

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
    },
    [depthArr]
  );

  // Helper to map curve values to SVG X coordinates (normalized 0 to 100 width)
  const mapValueToX = (
    val: number,
    min: number,
    max: number,
    trackWidth: number = 100,
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

  const mapDepthToY = useCallback(
    (d: number) => {
      return ((d - minDepth) / depthSpan) * (svgHeight - 60) + 30;
    },
    [minDepth, depthSpan, svgHeight]
  );

  const mapYToDepth = (y: number) => {
    return minDepth + ((y - 30) / (svgHeight - 60)) * depthSpan;
  };

  // Windowing: only visible depth range (+ overscan) gets rendered
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

  const overlapsVisible = useCallback(
    (aStart: number, aEnd: number) => aEnd >= visStartDepth && aStart <= visEndDepth,
    [visStartDepth, visEndDepth]
  );

  // Render SVG polyline points for a curve normalized to 0-100 width
  const renderSvgCurve = useCallback(
    (
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
        if (val !== -999.25 && val !== -9999 && val !== -999 && !isNaN(val) && val !== null && val !== undefined) {
          const x = mapValueToX(val, minVal, maxVal, trackWidth, isLogScale);
          const y = mapDepthToY(depthArr[idx]);
          points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
      }
      return points.join(" ");
    },
    [depthArr, mapDepthToY]
  );

  // Generate depth tick marks every 50 ft/m, filtered to visible window
  const depthTicks: number[] = useMemo(() => {
    const ticks: number[] = [];
    const lo = Math.max(minDepth, visStartDepth - 50);
    const hi = Math.min(maxDepth, visEndDepth + 50);
    const startStep = Math.ceil(lo / 50) * 50;
    for (let d = startStep; d <= hi; d += 50) ticks.push(d);
    return ticks;
  }, [minDepth, maxDepth, visStartDepth, visEndDepth]);

  // Filter anomalies visible in the current scroll window
  const visibleSpikeAnomalies = useMemo(
    () =>
      anomalies.filter((a) =>
        overlapsVisible(a.depthStart, a.depthEnd ?? a.depthStart)
      ),
    [anomalies, overlapsVisible]
  );

  // Computed data for each selected curve track
  const selectedTracks = useMemo(() => {
    return selectedCurveKeys
      .filter((k) => allCurveKeys.includes(k))
      .map((key) => {
        const meta =
          curveMetaMap[key] || {
            key,
            mnemonic: key,
            name: key,
            unit: "—",
            category: "OTHER",
            minVal: 0,
            maxVal: 100,
            isLogScale: false,
            colorDark: "#06b6d4",
            colorPaper: "#1d4ed8",
            ticks: [0, 50, 100],
          };
        const series = curvesData.curves[key] || [];
        const gapsAll = getMissingGaps(series);
        const visibleGaps = gapsAll.filter((g) => overlapsVisible(g.startDepth, g.endDepth));
        const points = renderSvgCurve(
          series,
          meta.minVal,
          meta.maxVal,
          100, // normalized track width 100
          meta.isLogScale,
          visStartIdx,
          visEndIdx
        );

        const curveAnomalies = visibleSpikeAnomalies
          .filter((a) => a.anomalyType !== "IMPOSSIBLE_VALUE")
          .filter((a) => {
            const aMnem = a.curveMnemonic?.toUpperCase() || "";
            return (
              aMnem === key.toUpperCase() ||
              aMnem === meta.mnemonic.toUpperCase() ||
              standardiseMnemonic(aMnem).standardMnemonic === meta.mnemonic
            );
          });

        return {
          key,
          meta,
          series,
          points,
          visibleGaps,
          curveAnomalies,
        };
      });
  }, [
    selectedCurveKeys,
    allCurveKeys,
    curveMetaMap,
    curvesData.curves,
    getMissingGaps,
    overlapsVisible,
    renderSvgCurve,
    visStartIdx,
    visEndIdx,
    visibleSpikeAnomalies,
  ]);

  // Actions for curve selection
  const handleToggleCurve = (key: string) => {
    setUserSelectedCurves((prev) => {
      const current = prev !== null ? prev.filter((k) => allCurveKeys.includes(k)) : selectedCurveKeys;
      if (current.includes(key)) {
        return current.filter((k) => k !== key);
      } else {
        return [...current, key];
      }
    });
  };

  const handleSelectOnlyCurve = (key: string) => {
    setUserSelectedCurves([key]);
    setIsTrackDropdownOpen(false);
  };

  const handleSelectAllCurves = () => {
    setUserSelectedCurves([...allCurveKeys]);
  };

  const handleResetDefaultCurves = () => {
    setUserSelectedCurves(getDefaultSelectedCurves(allCurveKeys));
  };

  const handleClearAllCurves = () => {
    setUserSelectedCurves([]);
  };

  const handleRemoveTrack = (key: string) => {
    setUserSelectedCurves((prev) => {
      const current = prev !== null ? prev.filter((k) => allCurveKeys.includes(k)) : selectedCurveKeys;
      return current.filter((k) => k !== key);
    });
  };

  const handleSwitchTrack = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    setUserSelectedCurves((prev) => {
      const current = prev !== null ? prev.filter((k) => allCurveKeys.includes(k)) : selectedCurveKeys;
      const next = [...current];
      const idx = next.indexOf(oldKey);
      if (idx !== -1) {
        next[idx] = newKey;
      }
      return Array.from(new Set(next));
    });
  };

  // Filtered curves for dropdown search
  const filteredCurvesForDropdown = useMemo(() => {
    if (!curveSearchQuery.trim()) return allCurveKeys;
    const q = curveSearchQuery.toLowerCase();
    return allCurveKeys.filter((k) => {
      const meta = curveMetaMap[k];
      return (
        k.toLowerCase().includes(q) ||
        meta?.name.toLowerCase().includes(q) ||
        meta?.mnemonic.toLowerCase().includes(q) ||
        meta?.unit.toLowerCase().includes(q)
      );
    });
  }, [allCurveKeys, curveSearchQuery, curveMetaMap]);

  // Hover & Real-time inspection event handlers
  const handleTrackMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, trackKey?: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollY = e.currentTarget.scrollTop;
      const clientYInContent = e.clientY - rect.top + scrollY;
      const rawDepth = minDepth + ((clientYInContent - 30) / (svgHeight - 60)) * depthSpan;
      const clampedDepth = Math.max(minDepth, Math.min(maxDepth, rawDepth));
      const idx = findDepthIndex(clampedDepth, depthArr);
      const resolvedDepth = depthArr[idx] ?? clampedDepth;

      setIsHovering(true);
      setHoverDepth(resolvedDepth);
      setHoverSampleIdx(idx);
      setHoverClientPos({ x: e.clientX, y: e.clientY });
      if (trackKey) setHoverTrackKey(trackKey);
    },
    [minDepth, maxDepth, depthSpan, svgHeight, depthArr]
  );

  const handleTrackMouseLeave = useCallback(() => {
    setIsHovering(false);
    setHoverDepth(null);
    setHoverSampleIdx(null);
    setHoverClientPos(null);
    setHoverTrackKey(null);
  }, []);

  const handleTrackTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>, trackKey?: string) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollY = e.currentTarget.scrollTop;
      const clientYInContent = touch.clientY - rect.top + scrollY;
      const rawDepth = minDepth + ((clientYInContent - 30) / (svgHeight - 60)) * depthSpan;
      const clampedDepth = Math.max(minDepth, Math.min(maxDepth, rawDepth));
      const idx = findDepthIndex(clampedDepth, depthArr);
      const resolvedDepth = depthArr[idx] ?? clampedDepth;

      setIsHovering(true);
      setHoverDepth(resolvedDepth);
      setHoverSampleIdx(idx);
      setHoverClientPos({ x: touch.clientX, y: touch.clientY });
      if (trackKey) setHoverTrackKey(trackKey);
    },
    [minDepth, maxDepth, depthSpan, svgHeight, depthArr]
  );

  const handleTrackClick = useCallback(() => {
    if (hoverDepth !== null) {
      setSelectedDepth((prev) => (prev === hoverDepth ? null : hoverDepth));
    }
  }, [hoverDepth]);

  // Derived telemetry metrics for the hovered depth & sample
  const hoverTelemetry = useMemo(() => {
    if (
      hoverSampleIdx === null ||
      hoverDepth === null ||
      hoverSampleIdx < 0 ||
      hoverSampleIdx >= depthArr.length
    ) {
      return null;
    }

    const currentDepth = depthArr[hoverSampleIdx] ?? hoverDepth;
    const curveReadings = selectedTracks.map((track) => {
      const val = track.series[hoverSampleIdx];
      const isNull = isNullOrGap(val);
      const inGap = track.visibleGaps.find(
        (g) => currentDepth >= g.startDepth && currentDepth <= g.endDepth
      );
      const anomaly = track.curveAnomalies.find(
        (a) => currentDepth >= a.depthStart && currentDepth <= (a.depthEnd ?? a.depthStart)
      );

      return {
        key: track.key,
        mnemonic: track.meta.mnemonic,
        name: track.meta.name,
        unit: track.meta.unit,
        val,
        isNull,
        inGap,
        anomaly,
        colorPaper: track.meta.colorPaper,
        colorDark: track.meta.colorDark,
        minVal: track.meta.minVal,
        maxVal: track.meta.maxVal,
        isLogScale: track.meta.isLogScale,
      };
    });

    const nullCount = curveReadings.filter((c) => c.isNull).length;
    const hasAnyNull = nullCount > 0;
    const anomaliesAtDepth = anomalies.filter(
      (a) => currentDepth >= a.depthStart && currentDepth <= (a.depthEnd ?? a.depthStart)
    );

    return {
      depth: currentDepth,
      sampleIdx: hoverSampleIdx,
      readings: curveReadings,
      hasAnyNull,
      nullCount,
      anomaliesAtDepth,
    };
  }, [hoverSampleIdx, hoverDepth, depthArr, selectedTracks, anomalies]);

  const renderTelemetryHudBar = () => {
    const isDark = viewMode === "DARK_MODERN";

    if (!hoverTelemetry) {
      return (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-mono transition-all duration-200 border ${
            isDark
              ? "bg-wellqc-panel/90 border-wellqc-border text-slate-300"
              : "bg-slate-100 border-slate-300 text-slate-700 font-sans font-medium"
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="font-bold">Real-Time Wireline Telemetry:</span>
            <span className="text-slate-400 font-normal hidden sm:inline">
              Hover cursor over any wireline curve to inspect live values, locate null intervals (-999.25), and audit anomalies.
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px]">
            {selectedDepth !== null ? (
              <div className="flex items-center space-x-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-2 py-0.5 rounded-lg">
                <Crosshair className="w-3 h-3" />
                <span>Locked Depth: {selectedDepth.toFixed(1)} {depthUnit}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDepth(null)}
                  className="hover:text-red-400 ml-1 text-slate-400"
                  title="Clear locked depth"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Click log to lock depth</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all duration-150 border shadow-lg ${
          isDark
            ? "bg-slate-900/95 border-cyan-500/40 text-white"
            : "bg-white border-2 border-red-600 text-black font-sans"
        }`}
      >
        {/* Depth & Sample Indicator */}
        <div className="flex items-center space-x-2.5 shrink-0">
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-black text-xs ${
              hoverTelemetry.hasAnyNull
                ? isDark
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-amber-100 text-amber-950 border border-amber-400"
                : isDark
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-slate-900 text-white"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="font-mono text-sm tracking-wide">
              {hoverTelemetry.depth.toFixed(2)} {depthUnit}
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
            Point #{hoverTelemetry.sampleIdx + 1} of {totalPoints.toLocaleString()}
            {hoverTrackKey && (
              <span className="text-cyan-400 ml-1.5 font-bold">[{hoverTrackKey}]</span>
            )}
          </span>
        </div>

        {/* Live Active Curve Readings */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {hoverTelemetry.readings.map((r) => {
            return (
              <div
                key={r.key}
                className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border text-xs transition-all ${
                  r.isNull
                    ? isDark
                      ? "bg-red-950/80 border-red-500/80 text-red-200 animate-pulse font-bold"
                      : "bg-red-50 border-2 border-red-600 text-red-700 font-bold"
                    : isDark
                    ? "bg-slate-800/80 border-slate-700 text-slate-200"
                    : "bg-slate-50 border border-slate-300 text-slate-900"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isDark ? r.colorDark : r.colorPaper }}
                />
                <span className="font-bold uppercase">{r.mnemonic}:</span>
                {r.isNull ? (
                  <span className="font-mono font-black text-red-400 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span>NULL ({r.val !== undefined && r.val !== null ? r.val : "-999.25"})</span>
                  </span>
                ) : (
                  <span className="font-mono font-extrabold text-cyan-400 dark:text-cyan-300">
                    {r.val.toFixed(2)} <span className="text-[10px] text-slate-400">{r.unit}</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Status Callout Badge */}
        <div className="flex items-center space-x-2 shrink-0">
          {hoverTelemetry.hasAnyNull ? (
            <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-[11px] font-bold flex items-center space-x-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>{hoverTelemetry.nullCount} NULL VALUE{hoverTelemetry.nullCount > 1 ? "S" : ""}</span>
            </span>
          ) : hoverTelemetry.anomaliesAtDepth.length > 0 ? (
            <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>{hoverTelemetry.anomaliesAtDepth[0].anomalyType.replace(/_/g, " ")}</span>
            </span>
          ) : (
            <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center space-x-1 hidden lg:flex">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>VALID READINGS</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderFloatingTooltip = () => {
    if (!isHovering || !hoverClientPos || !hoverTelemetry) return null;

    const left = Math.min(
      hoverClientPos.x + 18,
      typeof window !== "undefined" ? window.innerWidth - 260 : 800
    );
    const top = Math.min(
      hoverClientPos.y + 12,
      typeof window !== "undefined" ? window.innerHeight - 280 : 600
    );

    return (
      <div
        className="fixed pointer-events-none z-50 bg-slate-950/95 backdrop-blur-md border border-slate-700/80 text-white rounded-xl shadow-2xl p-3 min-w-[220px] max-w-xs space-y-2 text-xs font-mono transition-transform duration-75 select-none animate-in fade-in zoom-in-95 duration-100"
        style={{ left: `${left}px`, top: `${top}px` }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <div className="flex items-center space-x-1.5">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-extrabold text-white text-sm">
              {hoverTelemetry.depth.toFixed(2)} {depthUnit}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            #{hoverTelemetry.sampleIdx + 1}
          </span>
        </div>

        <div className="space-y-1">
          {hoverTelemetry.readings.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center space-x-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.colorDark }}
                />
                <span className="font-bold text-slate-200 truncate">{r.mnemonic}:</span>
              </div>

              {r.isNull ? (
                <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-black border border-red-500/40 text-[10px] animate-pulse flex items-center space-x-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  <span>NULL ({r.val !== undefined && r.val !== null ? r.val : "-999.25"})</span>
                </span>
              ) : (
                <span className="font-bold text-cyan-300">
                  {r.val.toFixed(2)} <span className="text-[10px] text-slate-400">{r.unit}</span>
                </span>
              )}
            </div>
          ))}
        </div>

        {hoverTelemetry.hasAnyNull && (
          <div className="pt-1.5 border-t border-slate-800 text-[10px] text-amber-400 font-sans flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Missing petrophysical data (-999.25) at this depth</span>
          </div>
        )}

        {hoverTelemetry.anomaliesAtDepth.length > 0 && (
          <div className="pt-1.5 border-t border-slate-800 text-[10px] text-rose-400 font-sans flex items-center space-x-1">
            <Activity className="w-3 h-3 text-rose-400 shrink-0" />
            <span>Anomaly: {hoverTelemetry.anomaliesAtDepth[0].anomalyType.replace(/_/g, " ")}</span>
          </div>
        )}
      </div>
    );
  };

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
                <span>Tracks: {selectedTracks.length} active</span>
              </div>
            </div>
            <div className="w-36 text-right text-xs font-sans hidden md:block">
              Scale 1:500 Wireline <br />
              <span className="text-[10px] text-slate-600">WellQC Telemetry</span>
            </div>
          </div>

          {/* Real-time Wireline Telemetry HUD */}
          <div className="mb-2">{renderTelemetryHudBar()}</div>

          {/* Log Track Header Box */}
          <div className="flex border-2 border-black bg-white text-black font-sans font-bold text-center text-xs min-w-[580px]">
            {/* Depth Header */}
            <div className="w-20 md:w-24 shrink-0 border-r-2 border-black p-2 flex flex-col justify-between bg-slate-100">
              <div>Depth</div>
              <div className="text-sm font-black">{depthUnit.toLowerCase()}</div>
            </div>

            {/* Dynamic Curve Track Headers */}
            {selectedTracks.map((track, i) => (
              <div
                key={track.key}
                className="flex-1 min-w-[180px] border-r-2 border-black last:border-r-0 p-1 bg-white flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b border-black pb-0.5 text-xs">
                  <span className="uppercase text-[11px] text-slate-700">TRACK {i + 1}</span>
                  <div className="flex items-center space-x-1">
                    {/* Inline Curve Switcher */}
                    <select
                      value={track.key}
                      onChange={(e) => handleSwitchTrack(track.key, e.target.value)}
                      className="bg-transparent text-[10px] font-mono font-bold cursor-pointer hover:bg-slate-100 rounded px-1 border-none focus:outline-none"
                      title="Switch this track to another curve"
                    >
                      {allCurveKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(track.key)}
                      title={`Hide ${track.meta.mnemonic} track`}
                      className="text-slate-400 hover:text-red-600 p-0.5 rounded text-[11px]"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="text-sm font-black truncate px-1 pt-0.5" style={{ color: track.meta.colorPaper }}>
                  {track.meta.name.toUpperCase()}
                </div>
                <div className="text-xs font-mono" style={{ color: track.meta.colorPaper }}>
                  {track.meta.mnemonic} ({track.meta.unit}) {track.meta.isLogScale ? "— Log Scale" : ""}
                </div>

                <div className="flex justify-between text-[11px] font-mono px-2 pt-1 border-t border-slate-300 mt-1">
                  {track.meta.isLogScale ? (
                    <>
                      <span>0.2</span>
                      <span>2</span>
                      <span>20</span>
                      <span>200</span>
                      <span>2000</span>
                    </>
                  ) : (
                    <>
                      <span>{track.meta.ticks[0]}</span>
                      <span>{track.meta.ticks[1]}</span>
                      <span>{track.meta.ticks[2]}</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {selectedTracks.length === 0 && (
              <div className="flex-1 p-3 text-center text-slate-500 font-mono text-xs">
                No tracks displayed. Click &ldquo;Curves&rdquo; selector above to choose channels.
              </div>
            )}
          </div>

          {/* Main Log Grid Body — fixed-height scroll viewport (windowed rendering) */}
          <div
            onScroll={handleTrackScroll}
            onMouseMove={(e) => handleTrackMouseMove(e)}
            onMouseLeave={handleTrackMouseLeave}
            onTouchMove={(e) => handleTrackTouchMove(e)}
            onTouchEnd={handleTrackMouseLeave}
            onClick={handleTrackClick}
            className="relative border-2 border-t-0 border-black bg-white overflow-y-auto overflow-x-hidden min-w-[580px] cursor-crosshair"
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

              {/* Hover Crosshair Guide Line spanning all tracks */}
              {hoverDepth !== null && (
                <div
                  className="absolute left-0 right-0 border-b-2 border-red-600/90 z-30 pointer-events-none flex items-center justify-between"
                  style={{ top: `${mapDepthToY(hoverDepth)}px`, transform: "translateY(-50%)" }}
                >
                  <div className="bg-red-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-r shadow-md flex items-center space-x-1.5">
                    <Crosshair className="w-3 h-3 text-white" />
                    <span>{hoverDepth.toFixed(2)} {depthUnit}</span>
                    {hoverTelemetry?.hasAnyNull && (
                      <span className="bg-amber-400 text-black px-1 rounded text-[9px] font-black uppercase">
                        NULL DETECTED
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex h-full relative z-10 font-sans">
                {/* Depth Column */}
                <div className="w-20 md:w-24 shrink-0 border-r-2 border-black bg-slate-50/50 relative">
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

                {/* Dynamic Curve Tracks */}
                {selectedTracks.map((track) => (
                  <div
                    key={track.key}
                    className="flex-1 min-w-[180px] border-r-2 border-black last:border-r-0 relative"
                  >
                    {/* Logarithmic Decades Grid */}
                    {track.meta.isLogScale && (
                      <div className="absolute inset-0 pointer-events-none flex justify-between px-0">
                        <div className="border-r border-red-200/60 h-full w-[25%]" />
                        <div className="border-r border-red-200/60 h-full w-[25%]" />
                        <div className="border-r border-red-200/60 h-full w-[25%]" />
                        <div className="h-full w-[25%]" />
                      </div>
                    )}

                    {/* SVG Polyline with non-scaling stroke across width */}
                    <svg
                      className="w-full h-full overflow-visible relative z-10"
                      viewBox={`0 0 100 ${svgHeight}`}
                      preserveAspectRatio="none"
                    >
                      <polyline
                        fill="none"
                        stroke={track.meta.colorPaper}
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={track.points}
                      />

                      {/* Hover Point on Curve */}
                      {hoverDepth !== null && (() => {
                        const reading = hoverTelemetry?.readings.find((r) => r.key === track.key);
                        if (!reading || reading.isNull || reading.val === undefined) return null;
                        const x = mapValueToX(reading.val, track.meta.minVal, track.meta.maxVal, 100, track.meta.isLogScale);
                        const y = mapDepthToY(hoverDepth);
                        return (
                          <circle
                            cx={x}
                            cy={y}
                            r="4"
                            fill={track.meta.colorPaper}
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="pointer-events-none"
                          />
                        );
                      })()}
                    </svg>

                    {/* Hover Value Badge & Explicit Null Value Callout on Line */}
                    {hoverDepth !== null && (() => {
                      const reading = hoverTelemetry?.readings.find((r) => r.key === track.key);
                      if (!reading) return null;
                      const y = mapDepthToY(hoverDepth);

                      if (reading.isNull) {
                        return (
                          <div
                            className="absolute left-1 right-1 bg-red-600 text-white border-2 border-black px-1.5 py-0.5 rounded shadow-lg text-[10px] font-black font-sans flex items-center justify-center space-x-1 z-30 pointer-events-none animate-pulse"
                            style={{ top: `${y}px`, transform: "translateY(-50%)" }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span className="truncate">
                              ⚠️ NULL VALUE ({reading.val !== undefined && reading.val !== null ? reading.val : "-999.25"})
                            </span>
                          </div>
                        );
                      }

                      const x = mapValueToX(reading.val, track.meta.minVal, track.meta.maxVal, 100, track.meta.isLogScale);
                      return (
                        <div
                          className="absolute font-mono font-black text-[10px] px-1.5 py-0.5 rounded shadow z-30 pointer-events-none text-white whitespace-nowrap"
                          style={{
                            left: `${Math.min(75, Math.max(8, x))}%`,
                            top: `${y - 20}px`,
                            backgroundColor: track.meta.colorPaper,
                          }}
                        >
                          {reading.val.toFixed(2)} {track.meta.unit}
                        </div>
                      );
                    })()}

                    {/* Missing Gaps Callouts */}
                    {track.visibleGaps.map((gap, i) => {
                      const topY = mapDepthToY(gap.startDepth);
                      const botY = mapDepthToY(gap.endDepth);
                      const h = Math.max(35, botY - topY);
                      return (
                        <div
                          key={i}
                          className="absolute left-2 right-2 border-2 border-black bg-white flex items-center justify-center font-black font-sans text-xs shadow-md z-20"
                          style={{ top: `${topY}px`, height: `${h}px` }}
                        >
                          <span>MISSING GAP</span>
                        </div>
                      );
                    })}

                    {/* Anomalies on this curve track */}
                    {track.curveAnomalies.map((an, i) => {
                      const y = mapDepthToY(an.depthStart);
                      return (
                        <div
                          key={i}
                          className="absolute right-2 border-2 border-black bg-white px-2 py-1 shadow-lg text-[10px] font-black font-sans flex items-center space-x-1 z-20"
                          style={{ top: `${y}px`, transform: "translateY(-50%)" }}
                        >
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                          <span className="truncate max-w-[140px] uppercase">
                            {an.anomalyType.replace(/_/g, " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1 px-1">
            Showing depths {visStartDepth.toFixed(0)}–{visEndDepth.toFixed(0)} {depthUnit} · {selectedTracks.length} tracks active · {totalPoints.toLocaleString()} total samples
          </p>
        </div>
      );
    }

    // Modern Dark Mode
    return (
      <div className="bg-wellqc-card border border-wellqc-border rounded-xl p-5 shadow-2xl space-y-4">
        {/* Real-time Wireline Telemetry HUD */}
        {renderTelemetryHudBar()}

        {selectedDepth !== null && (
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-between text-xs font-mono text-cyan-300">
            <span>Synchronized Depth Marker:</span>
            <span className="font-bold">{selectedDepth.toFixed(1)} {depthUnit}</span>
          </div>
        )}

        {selectedTracks.length === 0 ? (
          <div className="p-8 text-center bg-wellqc-panel border border-wellqc-border rounded-xl space-y-3 font-mono">
            <SlidersHorizontal className="w-8 h-8 text-cyan-400 mx-auto" />
            <p className="text-sm font-bold text-white">No curve tracks currently displayed</p>
            <p className="text-xs text-wellqc-muted">
              Use the &ldquo;Curves&rdquo; selector dropdown in the toolbar above to choose curve tracks.
            </p>
            <button
              type="button"
              onClick={handleResetDefaultCurves}
              className="px-4 py-2 bg-cyan-500 text-slate-950 text-xs font-bold rounded-lg shadow-md hover:bg-cyan-400 transition-colors"
            >
              Restore Standard Tracks
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 ${
              selectedTracks.length === 2
                ? "md:grid-cols-2"
                : selectedTracks.length >= 3
                ? "md:grid-cols-3"
                : ""
            } gap-4 font-mono`}
          >
            {selectedTracks.map((track, i) => (
              <div key={track.key} className="bg-wellqc-panel border border-wellqc-border rounded-xl p-3">
                <div className="flex items-center justify-between pb-2 border-b border-wellqc-border mb-2 text-xs font-bold">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: track.meta.colorDark }}
                    />
                    <span className="truncate text-white">
                      TRACK {i + 1}: {track.meta.name.toUpperCase()} ({track.meta.mnemonic})
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-slate-400 text-[10px] hidden sm:inline">
                      {track.meta.minVal} – {track.meta.maxVal} {track.meta.unit}{" "}
                      {track.meta.isLogScale ? "[LOG]" : ""}
                    </span>

                    {/* Inline Track Switcher */}
                    <select
                      value={track.key}
                      onChange={(e) => handleSwitchTrack(track.key, e.target.value)}
                      className="bg-wellqc-dark text-cyan-300 text-[10px] font-mono rounded px-1.5 py-0.5 border border-wellqc-border focus:outline-none cursor-pointer"
                      title="Switch track"
                    >
                      {allCurveKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(track.key)}
                      className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                      title={`Hide ${track.meta.mnemonic} track`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div
                  className="relative bg-wellqc-dark rounded-lg overflow-y-auto overflow-x-hidden p-2 border border-wellqc-border cursor-crosshair"
                  style={{ height: `${Math.min(svgHeight, VIEWPORT_HEIGHT)}px` }}
                  onScroll={handleTrackScroll}
                  onMouseMove={(e) => handleTrackMouseMove(e, track.key)}
                  onMouseLeave={handleTrackMouseLeave}
                  onTouchMove={(e) => handleTrackTouchMove(e, track.key)}
                  onTouchEnd={handleTrackMouseLeave}
                  onClick={handleTrackClick}
                >
                  <div style={{ height: `${svgHeight}px`, position: "relative" }}>
                    {/* Logarithmic Guide Lines */}
                    {track.meta.isLogScale && (
                      <div className="absolute inset-0 pointer-events-none flex justify-between px-0">
                        <div className="border-r border-red-500/10 h-full w-[25%]" />
                        <div className="border-r border-red-500/10 h-full w-[25%]" />
                        <div className="border-r border-red-500/10 h-full w-[25%]" />
                        <div className="h-full w-[25%]" />
                      </div>
                    )}

                    {/* Synchronized Crosshair on Dark Track */}
                    {hoverDepth !== null && (
                      <div
                        className="absolute left-0 right-0 border-b border-cyan-400/80 z-30 pointer-events-none flex items-center justify-between"
                        style={{ top: `${mapDepthToY(hoverDepth)}px`, transform: "translateY(-50%)" }}
                      >
                        <div className="bg-cyan-500 text-slate-950 text-[9px] font-mono font-black px-1.5 py-0.5 rounded shadow flex items-center space-x-1">
                          <Crosshair className="w-2.5 h-2.5" />
                          <span>{hoverDepth.toFixed(1)} {depthUnit}</span>
                        </div>
                      </div>
                    )}

                    <svg
                      className="w-full h-full overflow-visible relative z-10"
                      viewBox={`0 0 100 ${svgHeight}`}
                      preserveAspectRatio="none"
                    >
                      <polyline
                        fill="none"
                        stroke={track.meta.colorDark}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        points={track.points}
                      />

                      {/* Hover Point on Curve */}
                      {hoverDepth !== null && (() => {
                        const reading = hoverTelemetry?.readings.find((r) => r.key === track.key);
                        if (!reading || reading.isNull || reading.val === undefined) return null;
                        const x = mapValueToX(reading.val, track.meta.minVal, track.meta.maxVal, 100, track.meta.isLogScale);
                        const y = mapDepthToY(hoverDepth);
                        return (
                          <circle
                            cx={x}
                            cy={y}
                            r="4"
                            fill={track.meta.colorDark}
                            stroke="#030712"
                            strokeWidth="1.5"
                            className="pointer-events-none"
                          />
                        );
                      })()}
                    </svg>

                    {/* Hover Value Badge & Explicit Null Value Callout on Dark Line */}
                    {hoverDepth !== null && (() => {
                      const reading = hoverTelemetry?.readings.find((r) => r.key === track.key);
                      if (!reading) return null;
                      const y = mapDepthToY(hoverDepth);

                      if (reading.isNull) {
                        return (
                          <div
                            className="absolute left-2 right-2 bg-red-950/95 border border-red-500 text-red-200 px-2 py-1 rounded shadow-lg text-[10px] font-mono font-bold flex items-center justify-center space-x-1.5 z-30 pointer-events-none animate-pulse"
                            style={{ top: `${y}px`, transform: "translateY(-50%)" }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="truncate">
                              NULL VALUE ({reading.val !== undefined && reading.val !== null ? reading.val : "-999.25"})
                            </span>
                          </div>
                        );
                      }

                      const x = mapValueToX(reading.val, track.meta.minVal, track.meta.maxVal, 100, track.meta.isLogScale);
                      return (
                        <div
                          className="absolute font-mono font-black text-[10px] px-1.5 py-0.5 rounded shadow-lg z-30 pointer-events-none text-slate-950 whitespace-nowrap"
                          style={{
                            left: `${Math.min(75, Math.max(8, x))}%`,
                            top: `${y - 22}px`,
                            backgroundColor: track.meta.colorDark,
                          }}
                        >
                          {reading.val.toFixed(2)} {track.meta.unit}
                        </div>
                      );
                    })()}

                    {/* Missing Gaps */}
                    {track.visibleGaps.map((gap, idx) => {
                      const topY = mapDepthToY(gap.startDepth);
                      const botY = mapDepthToY(gap.endDepth);
                      const h = Math.max(30, botY - topY);
                      return (
                        <div
                          key={idx}
                          className="absolute left-2 right-2 border border-amber-500/40 bg-amber-500/10 rounded flex items-center justify-center font-bold font-mono text-[10px] text-amber-300 z-20"
                          style={{ top: `${topY}px`, height: `${h}px` }}
                        >
                          <span>MISSING DATA GAP</span>
                        </div>
                      );
                    })}

                    {/* Anomalies on this track */}
                    {track.curveAnomalies.map((an, idx) => {
                      const y = mapDepthToY(an.depthStart);
                      return (
                        <div
                          key={idx}
                          className="absolute right-2 border border-red-500/40 bg-red-950/80 px-2 py-0.5 rounded shadow-lg text-[9px] font-bold text-red-200 flex items-center space-x-1 z-20"
                          style={{ top: `${y}px`, transform: "translateY(-50%)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                          <span className="truncate max-w-[120px] uppercase">
                            {an.anomalyType.replace(/_/g, " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-wellqc-muted font-mono">
          Showing depths {visStartDepth.toFixed(0)}–{visEndDepth.toFixed(0)} {depthUnit} · {selectedTracks.length} tracks active · {totalPoints.toLocaleString()} total samples
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-wellqc-panel border border-wellqc-border rounded-xl shadow-lg">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight truncate">
              {wellName} — Wireline Subsurface Explorer
            </h3>
          </div>
          <p className="text-[11px] sm:text-xs text-wellqc-muted font-mono mt-0.5 truncate">
            Depth Interval: {minDepth} – {maxDepth} {depthUnit} | {totalPoints.toLocaleString()} Recorded Samples
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-xs">
          {/* CURVE TRACKS DROPDOWN SELECTOR BUTTON */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsTrackDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold bg-wellqc-card border border-wellqc-border hover:border-cyan-500/50 text-slate-200 hover:text-white transition-all shadow-inner text-xs"
              title="Select which curve tracks to display in the wireline log"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Curves:{" "}
                <span className="text-cyan-300 font-extrabold">
                  {selectedCurveKeys.length === 1
                    ? selectedCurveKeys[0]
                    : `${selectedCurveKeys.length}/${allCurveKeys.length} Active`}
                </span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isTrackDropdownOpen ? "rotate-180 text-cyan-400" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu Popover */}
            {isTrackDropdownOpen && (
              <div className={`absolute mt-2 w-[calc(100vw-2.5rem)] sm:w-96 max-w-[calc(100vw-2.5rem)] sm:max-w-md bg-wellqc-panel/95 backdrop-blur-xl border border-wellqc-border rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-wellqc-border animate-in fade-in zoom-in-95 duration-150 ${
                dropdownAlign === "right" ? "right-0" : "left-0"
              }`}>
                {/* Header */}
                <div className="p-3 bg-wellqc-card/80 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Select Wireline Curves</span>
                    </div>
                    <p className="text-[11px] text-wellqc-muted font-sans mt-0.5">
                      Choose which tracks to display side-by-side
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 text-[10px] font-mono border border-cyan-500/30">
                    {selectedCurveKeys.length} of {allCurveKeys.length}
                  </span>
                </div>

                {/* Quick Presets Bar */}
                <div className="p-2 bg-wellqc-dark/60 flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={handleSelectAllCurves}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-wellqc-panel hover:bg-wellqc-card border border-wellqc-border text-slate-300 hover:text-white transition-colors text-center font-medium"
                    title="Display all available curves"
                  >
                    Select All ({allCurveKeys.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllCurves}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-wellqc-panel hover:bg-wellqc-card border border-wellqc-border text-slate-400 hover:text-red-400 transition-colors text-center font-medium"
                    title="Deselect all curves"
                  >
                    Clear
                  </button>
                </div>

                {/* Search Bar (if > 4 curves) */}
                {allCurveKeys.length > 4 && (
                  <div className="p-2 bg-wellqc-dark/30">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={curveSearchQuery}
                        onChange={(e) => setCurveSearchQuery(e.target.value)}
                        placeholder="Search curve mnemonic or name..."
                        className="w-full bg-wellqc-panel border border-wellqc-border rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Scrollable Curve Channels List */}
                <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                  {filteredCurvesForDropdown.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-mono">
                      No matching curves found
                    </div>
                  ) : (
                    filteredCurvesForDropdown.map((key) => {
                      const isSelected = selectedCurveKeys.includes(key);
                      const meta = curveMetaMap[key];
                      return (
                        <div
                          key={key}
                          onClick={() => handleToggleCurve(key)}
                          className={`p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer group ${
                            isSelected
                              ? "bg-cyan-500/10 border border-cyan-500/30 text-white"
                              : "hover:bg-wellqc-card border border-transparent text-slate-300"
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                            {/* Checkbox */}
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected
                                  ? "bg-cyan-500 border-cyan-400 text-slate-950"
                                  : "border-slate-600 group-hover:border-slate-400 bg-wellqc-panel"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            {/* Color indicator dot */}
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: meta?.colorDark || "#06b6d4" }}
                            />

                            {/* Curve Name & Info */}
                            <div className="min-w-0 flex-1 truncate">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-bold text-xs text-white">
                                  {key}
                                </span>
                                {meta?.unit && meta.unit !== "—" && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    [{meta.unit}]
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate font-sans">
                                {meta?.name || key}
                              </p>
                            </div>
                          </div>

                          {/* Right Controls: Range & "Only" button */}
                          <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                              {meta?.minVal}–{meta?.maxVal}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectOnlyCurve(key);
                              }}
                              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 transition-colors"
                              title={`Display ONLY the ${key} curve`}
                            >
                              Only
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer status */}
                <div className="p-2.5 bg-wellqc-card/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Tip: Click &ldquo;Only&rdquo; to isolate a single curve</span>
                  <button
                    type="button"
                    onClick={() => setIsTrackDropdownOpen(false)}
                    className="text-cyan-400 hover:text-cyan-300 font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Layout Mode Switcher Toggle (Log Plot, Data Table, Split View) */}
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
          </div>

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
                <span>Wireline Curves Track ({selectedTracks.length} Active)</span>
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

      {/* Interactive Cursor Floating Inspection Tooltip */}
      {renderFloatingTooltip()}
    </div>
  );
}

export const LogViewer = WellLogViewer;
