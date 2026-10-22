"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface TrendPoint {
  date: string;
  avgScore: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  isDark?: boolean;
}

function CustomTooltip({ active, payload, label, isDark }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div
        className={`p-3 rounded-2xl shadow-xl backdrop-blur-md border font-mono text-xs transition-all ${
          isDark
            ? "bg-slate-900/95 border-slate-700/80 text-white shadow-cyan-500/10"
            : "bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-900/10"
        }`}
      >
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
          {label}
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
          <span className="font-semibold text-[11px]">Quality Index:</span>
          <span className="font-black text-sm font-mono text-cyan-600 dark:text-cyan-400">
            {val}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-500 dark:text-cyan-300">
            {val >= 90 ? "GRADE A" : val >= 75 ? "GRADE B" : "GRADE C"}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme !== "light");
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const strokeColor = isDark ? "#06b6d4" : "#0071e3"; // Apple blue in light, cyan in dark
  const gridStroke = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const axisColor = isDark ? "#64748b" : "#94a3b8";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreColorDynamic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={isDark ? 0.45 : 0.25} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis
          dataKey="date"
          stroke={axisColor}
          tick={{ fontSize: 11, fontFamily: "monospace" }}
          tickLine={false}
          axisLine={{ stroke: gridStroke }}
        />
        <YAxis
          stroke={axisColor}
          tick={{ fontSize: 11, fontFamily: "monospace" }}
          domain={[0, 100]}
          tickLine={false}
          axisLine={{ stroke: gridStroke }}
        />
        <Tooltip content={<CustomTooltip isDark={isDark} />} />
        <Area
          type="monotone"
          dataKey="avgScore"
          name="Avg Quality Score"
          stroke={strokeColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fillOpacity={1}
          fill="url(#scoreColorDynamic)"
          activeDot={{
            r: 6,
            fill: strokeColor,
            stroke: isDark ? "#0f172a" : "#ffffff",
            strokeWidth: 2.5,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}