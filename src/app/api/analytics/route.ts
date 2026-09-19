import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const ANOMALY_COLORS: Record<string, string> = {
  EXTREME_SPIKE: "#f59e0b",
  IMPOSSIBLE_VALUE: "#ef4444",
  FLATLINE: "#06b6d4",
  DEPTH_GAP: "#3b82f6",
  UNIT_MISMATCH: "#8b5cf6",
  NULL_CLUSTER: "#ec4899",
  DUPLICATE_DEPTH: "#14b8a6",
};

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    const [wells, anomalies] = await Promise.all([
      db.well.findMany({
        where: { ownerId: user.id },
        select: {
          operatorName: true,
          qualityScore: true,
          lasFiles: { select: { id: true } },
        },
      }),
      db.anomaly.groupBy({
        where: { qualityReport: { well: { ownerId: user.id } } },
        by: ["anomalyType"],
        _count: { anomalyType: true },
        orderBy: { _count: { anomalyType: "desc" } },
      }),
    ]);

    const operators = new Map<string, { totalScore: number; wells: number; files: number }>();
    wells.forEach((well) => {
      const current = operators.get(well.operatorName) || { totalScore: 0, wells: 0, files: 0 };
      current.totalScore += well.qualityScore;
      current.wells += 1;
      current.files += well.lasFiles.length;
      operators.set(well.operatorName, current);
    });

    return NextResponse.json({
      operatorScores: Array.from(operators.entries())
        .map(([operator, value]) => ({
          operator,
          score: value.wells > 0 ? Math.round(value.totalScore / value.wells) : 0,
          files: value.files,
        }))
        .sort((a, b) => b.score - a.score),
      anomalyDistribution: anomalies.map((anomaly) => ({
        name: anomaly.anomalyType.replace(/_/g, " "),
        value: anomaly._count.anomalyType,
        color: ANOMALY_COLORS[anomaly.anomalyType] || "#64748b",
      })),
    });
  } catch (error) {
    console.error("Failed to load analytics", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load analytics." },
      { status: 500 },
    );
  }
}
