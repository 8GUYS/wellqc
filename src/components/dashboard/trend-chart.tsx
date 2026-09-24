"use client";

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

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#233252" />
        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]} />
        <Tooltip contentStyle={{ backgroundColor: "#131b2e", borderColor: "#233252", fontSize: "12px" }} />
        <Area type="monotone" dataKey="avgScore" name="Avg Quality Score" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#scoreColor)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}