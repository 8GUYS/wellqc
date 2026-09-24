"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface OperatorScore {
  operator: string;
  score: number;
}

export function OperatorScoreChart({ data }: { data: OperatorScore[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#233252" />
        <XAxis dataKey="operator" stroke="#94a3b8" tick={{ fontSize: 11 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]} />
        <Tooltip contentStyle={{ backgroundColor: "#131b2e", borderColor: "#233252", fontSize: "12px" }} />
        <Bar dataKey="score" fill="#06b6d4" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface AnomalySlice {
  value: number;
  color: string;
  [key: string]: unknown;
}

export function AnomalyPieChart({ data }: { data: AnomalySlice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ backgroundColor: "#131b2e", borderColor: "#233252", fontSize: "12px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}