"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  BarChart3,
  PieChart as PieIcon,
  Building2,
  RefreshCw,
} from "lucide-react";
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

interface AnalyticsData {
  operatorScores: Array<{ operator: string; score: number; files: number }>;
  anomalyDistribution: Array<{ name: string; value: number; color: string }>;
}

const EMPTY_ANALYTICS: AnalyticsData = {
  operatorScores: [],
  anomalyDistribution: [],
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      try {
        const response = await fetch("/api/analytics", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load analytics.");
        }

        if (!cancelled) {
          setAnalytics({
            operatorScores: data.operatorScores || [],
            anomalyDistribution: data.anomalyDistribution || [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load analytics.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-wellqc-panel/60 border border-wellqc-border p-5 rounded-2xl">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/20 text-cyan-300 border border-cyan-500/40">
                Module 08 - Basin & Operator Analytics
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              Petrophysical Analytics & Operator Benchmarks
            </h1>
            <p className="text-xs text-wellqc-muted font-mono mt-0.5">
              Analytics calculated from committed LAS validation reports and anomaly records.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-xs font-mono">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Operator Average Log Quality Score</span>
            </h3>
            <div className="h-72 w-full">
              {isLoading ? (
                <LoadingPanel label="Loading operator benchmarks" />
              ) : analytics.operatorScores.length === 0 ? (
                <EmptyPanel label="No committed wells available" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.operatorScores} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233252" />
                    <XAxis dataKey="operator" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: "#131b2e", borderColor: "#233252", fontSize: "12px" }} />
                    <Bar dataKey="score" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-wellqc-panel border border-wellqc-border p-5 rounded-2xl space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-amber-400" />
              <span>Common Error & Anomaly Type Frequency</span>
            </h3>
            <div className="h-72 w-full flex items-center justify-center">
              {isLoading ? (
                <LoadingPanel label="Loading anomaly distribution" />
              ) : analytics.anomalyDistribution.length === 0 ? (
                <EmptyPanel label="No anomalies recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.anomalyDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {analytics.anomalyDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#131b2e", borderColor: "#233252", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {analytics.anomalyDistribution.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 text-xs font-mono">
                {analytics.anomalyDistribution.map((entry) => (
                  <div key={entry.name} className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-300">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="h-full rounded-xl bg-wellqc-card/60 border border-wellqc-border flex items-center justify-center text-xs text-cyan-300 font-mono">
      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
      {label}
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="h-full rounded-xl bg-wellqc-card/60 border border-wellqc-border flex flex-col items-center justify-center text-xs text-wellqc-muted font-mono">
      <BarChart3 className="w-5 h-5 text-cyan-400 mb-2" />
      {label}
    </div>
  );
}
